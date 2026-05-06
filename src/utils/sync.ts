import { db } from '../db';
import { logger } from './logger';
import {
  buildSharedAccountKey,
  createAccountFromSyncCard,
  flattenCardForSync,
  generateSyncId,
} from './cardAccounts';
import type { ApiResponse, CreditCard, CreditAccount, SyncStatus, SyncedCardRecord } from '../types';

// 同步服务类
class SyncService {
  private serverUrl: string = 'https://credit-api.xhxh.eu.org';
  private deviceId: string = '';
  private lastSyncAt: number = 0;
  private isSyncing: boolean = false;
  private syncListeners: ((status: SyncStatus) => void)[] = [];

  constructor() {
    this.initDeviceId();
    this.loadSyncState();
  }

  // 初始化设备ID
  private initDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + generateSyncId();
      localStorage.setItem('deviceId', deviceId);
    }
    this.deviceId = deviceId;
  }

  // 加载同步状态
  private loadSyncState() {
    this.serverUrl = localStorage.getItem('serverUrl') || '';
    this.lastSyncAt = parseInt(localStorage.getItem('lastSyncAt') || '0', 10);
  }

  // 保存同步状态
  private saveSyncState() {
    localStorage.setItem('serverUrl', this.serverUrl);
    localStorage.setItem('lastSyncAt', this.lastSyncAt.toString());
  }

  // 设置服务器地址
  setServerUrl(url: string) {
    this.serverUrl = url.replace(/\/$/, '');
    this.saveSyncState();
  }

  // 获取服务器地址
  getServerUrl(): string {
    return this.serverUrl;
  }

  // 检查是否已配置服务器
  isConfigured(): boolean {
    return !!this.serverUrl;
  }

  // 添加同步状态监听器
  onSyncStatusChange(listener: (status: SyncStatus) => void) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(status: SyncStatus) {
    this.syncListeners.forEach(listener => listener(status));
  }

  getSyncStatus(): SyncStatus {
    return {
      lastSyncAt: this.lastSyncAt ? new Date(this.lastSyncAt * 1000) : null,
      isSyncing: this.isSyncing,
      error: null,
      pendingChanges: 0,
    };
  }

  reloadSyncState(): SyncStatus {
    this.deviceId = localStorage.getItem('deviceId') || '';
    if (!this.deviceId) {
      this.initDeviceId();
    }
    this.loadSyncState();
    const status = this.getSyncStatus();
    this.notifyListeners(status);
    return status;
  }

  async testConnection(url?: string): Promise<boolean> {
    const testUrl = url || this.serverUrl;
    if (!testUrl) return false;

    try {
      const response = await fetch(`${testUrl}/api/v1/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      console.error('连接测试失败:', error);
      return false;
    }
  }

  private async loadSyncSnapshot(): Promise<{ cards: CreditCard[]; accounts: CreditAccount[] }> {
    const [cards, accounts] = await Promise.all([
      db.cards.filter(card => !card.isDeleted).toArray(),
      db.accounts.toArray(),
    ]);

    return { cards, accounts };
  }

  async sync(): Promise<{ success: boolean; error?: string }> {
    if (!this.serverUrl) {
      return { success: false, error: '未配置服务器地址' };
    }

    if (this.isSyncing) {
      return { success: false, error: '备份进行中' };
    }

    this.isSyncing = true;
    this.notifyListeners({
      ...this.getSyncStatus(),
      isSyncing: true,
    });

    try {
      const { cards: localCards, accounts } = await this.loadSyncSnapshot();
      logger.info('sync', `备份开始，本地未删除卡片: ${localCards.length} 张`);

      for (const card of localCards) {
        if (!card.syncId) {
          const newSyncId = generateSyncId();
          await db.cards.update(card.id!, { syncId: newSyncId });
          card.syncId = newSyncId;
        }
      }

      const accountMap = new Map(accounts.map(account => [account.syncId, account]));
      const cardsToSync: SyncedCardRecord[] = localCards.map(card => {
        const account = accountMap.get(card.accountSyncId);
        if (!account) {
          throw new Error(`卡片 ${card.name} 缺少共享账户，无法同步`);
        }

        const payload = flattenCardForSync(card, account);
        return {
          ...payload,
          syncId: payload.syncId || '',
          createdAt: payload.createdAt instanceof Date ? Math.floor(payload.createdAt.getTime() / 1000) : payload.createdAt,
          updatedAt: payload.updatedAt instanceof Date ? Math.floor(payload.updatedAt.getTime() / 1000) : payload.updatedAt,
        };
      });

      const response = await fetch(`${this.serverUrl}/api/v1/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': this.deviceId,
        },
        body: JSON.stringify({
          cards: cardsToSync,
          lastSyncAt: this.lastSyncAt,
          deviceId: this.deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`服务器错误: ${response.status}`);
      }

      const result: ApiResponse<{ cards: SyncedCardRecord[]; serverTime: number }> = await response.json();

      if (result.success && result.data) {
        this.lastSyncAt = result.data.serverTime;
        this.saveSyncState();
      }

      this.isSyncing = false;
      this.notifyListeners({
        lastSyncAt: new Date(this.lastSyncAt * 1000),
        isSyncing: false,
        error: null,
        pendingChanges: 0,
      });

      return { success: true };
    } catch (error) {
      this.isSyncing = false;
      const errorMessage = error instanceof Error ? error.message : '备份失败';

      this.notifyListeners({
        ...this.getSyncStatus(),
        isSyncing: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  async restoreFromCloud(): Promise<{ success: boolean; error?: string; count?: number }> {
    if (!this.serverUrl) {
      return { success: false, error: '未配置服务器地址' };
    }

    if (this.isSyncing) {
      return { success: false, error: '恢复进行中' };
    }

    this.isSyncing = true;
    this.notifyListeners({
      ...this.getSyncStatus(),
      isSyncing: true,
    });

    try {
      logger.info('restore', '开始从云端恢复...');
      logger.debug('restore', `请求 URL: ${this.serverUrl}/api/v1/cards`);

      const response = await fetch(`${this.serverUrl}/api/v1/cards`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      logger.debug('restore', `响应状态: ${response.status}`);

      if (!response.ok) {
        throw new Error(`服务器错误: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await response.json() as any;
      logger.debug('restore', '服务器原始返回:', JSON.stringify(result).slice(0, 500));
      logger.debug('restore', `返回字段: keys=${Object.keys(result).join(',')}`);

      const serverCards = result.cards || result.data?.cards || result.data || [];
      logger.debug('restore', `解析到卡片数: ${Array.isArray(serverCards) ? serverCards.length : 'not array'}`);

      if (!Array.isArray(serverCards) || serverCards.length === 0) {
        logger.warn('restore', '云端没有可恢复的卡片', { result });
        throw new Error('云端没有可恢复的卡片数据');
      }

      const accountMap = new Map<string, CreditAccount>();
      const legacyAccountKeyMap = new Map<string, string>();
      const restoredCards: Omit<CreditCard, 'id'>[] = [];

      for (const rawCard of serverCards as SyncedCardRecord[]) {
        const legacyKey = buildSharedAccountKey({
          bank: rawCard.bank || '',
          owner: rawCard.owner || '',
          sharedLimit: Number(rawCard.creditLimit) || 0,
          billingDay: Number(rawCard.billingDay) || 1,
          paymentDueDay: Number(rawCard.paymentDueDay) || 1,
        });
        const accountSyncId = rawCard.accountSyncId || legacyAccountKeyMap.get(legacyKey) || generateSyncId();
        legacyAccountKeyMap.set(legacyKey, accountSyncId);

        if (!accountMap.has(accountSyncId)) {
          accountMap.set(accountSyncId, createAccountFromSyncCard({
            ...rawCard,
            accountSyncId,
          }, accountSyncId));
        }

        restoredCards.push({
          accountSyncId,
          syncId: rawCard.syncId || '',
          name: rawCard.name || '',
          cardNumber: rawCard.cardNumber || '',
          cvv: rawCard.cvv || '',
          expiryDate: rawCard.expiryDate || '',
          cardholderName: rawCard.cardholderName || '',
          color: rawCard.color || 'blue',
          cardFrontImage: rawCard.cardFrontImage || '',
          cardBackImage: rawCard.cardBackImage || '',
          notes: rawCard.notes || '',
          owner: rawCard.owner || '',
          lastFour: rawCard.lastFour || '',
          isDeleted: false,
          createdAt: new Date((Number(rawCard.createdAt) || 0) * 1000),
          updatedAt: new Date((Number(rawCard.updatedAt) || 0) * 1000),
        });
      }

      await db.transaction('rw', db.accounts, db.cards, async () => {
        await db.accounts.clear();
        await db.cards.clear();

        if (accountMap.size > 0) {
          await db.accounts.bulkAdd(Array.from(accountMap.values()));
        }

        if (restoredCards.length > 0) {
          await db.cards.bulkAdd(restoredCards);
        }
      });

      this.isSyncing = false;
      this.notifyListeners({
        lastSyncAt: new Date(),
        isSyncing: false,
        error: null,
        pendingChanges: 0,
      });

      return { success: true, count: restoredCards.length };
    } catch (error) {
      this.isSyncing = false;
      const errorMessage = error instanceof Error ? error.message : '恢复失败';

      this.notifyListeners({
        ...this.getSyncStatus(),
        isSyncing: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }
}

export const syncService = new SyncService();
