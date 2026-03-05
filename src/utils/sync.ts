import { db } from '../db';
import type { CreditCard, SyncStatus, ApiResponse } from '../types';

// 兼容非安全上下文（HTTP+IP访问）的UUID生成
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
      deviceId = 'device_' + generateUUID();
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
    this.serverUrl = url.replace(/\/$/, ''); // 移除末尾斜杠
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

  // 通知监听器
  private notifyListeners(status: SyncStatus) {
    this.syncListeners.forEach(listener => listener(status));
  }

  // 获取当前同步状态
  getSyncStatus(): SyncStatus {
    return {
      lastSyncAt: this.lastSyncAt ? new Date(this.lastSyncAt * 1000) : null,
      isSyncing: this.isSyncing,
      error: null,
      pendingChanges: 0
    };
  }

  // 测试服务器连接
  async testConnection(url?: string): Promise<boolean> {
    const testUrl = url || this.serverUrl;
    if (!testUrl) return false;

    try {
      const response = await fetch(`${testUrl}/api/v1/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      console.error('连接测试失败:', error);
      return false;
    }
  }

  // 备份到云端（单向推送：前端 → 服务器，不接受服务器返回数据）
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
      isSyncing: true
    });

    try {
      // 只推送未删除的卡片（已删除的不推送，通过 DELETE API 单独处理）
      const localCards = await db.cards.filter(c => !c.isDeleted).toArray();

      // 确保所有本地卡都有 syncId
      for (const card of localCards) {
        if (!card.syncId) {
          const newSyncId = generateUUID();
          await db.cards.update(card.id!, { syncId: newSyncId });
          card.syncId = newSyncId;
        }
      }

      // 转换为同步格式
      const cardsToSync = localCards.map(card => ({
        ...card,
        syncId: card.syncId || '',
        createdAt: card.createdAt instanceof Date ? Math.floor(card.createdAt.getTime() / 1000) : card.createdAt,
        updatedAt: card.updatedAt instanceof Date ? Math.floor(card.updatedAt.getTime() / 1000) : card.updatedAt
      }));

      // 发送备份请求
      const response = await fetch(`${this.serverUrl}/api/v1/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': this.deviceId
        },
        body: JSON.stringify({
          cards: cardsToSync,
          lastSyncAt: this.lastSyncAt,
          deviceId: this.deviceId
        })
      });

      if (!response.ok) {
        throw new Error(`服务器错误: ${response.status}`);
      }

      const result: ApiResponse<{ cards: CreditCard[]; serverTime: number }> = await response.json();

      if (result.success && result.data) {
        // 只更新备份时间，不处理服务器返回的卡片数据
        this.lastSyncAt = result.data.serverTime;
        this.saveSyncState();
      }

      this.isSyncing = false;
      this.notifyListeners({
        lastSyncAt: new Date(this.lastSyncAt * 1000),
        isSyncing: false,
        error: null,
        pendingChanges: 0
      });

      return { success: true };
    } catch (error) {
      this.isSyncing = false;
      const errorMessage = error instanceof Error ? error.message : '备份失败';

      this.notifyListeners({
        ...this.getSyncStatus(),
        isSyncing: false,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }


  // 从云端恢复：拉取服务器上 is_deleted=0 的卡片到本地
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
      isSyncing: true
    });

    try {
      // 从服务器获取所有未删除的卡片
      const response = await fetch(`${this.serverUrl}/api/v1/cards`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`服务器错误: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await response.json() as any;

      // 后端返回格式: {cards: [...]} 或 {success: true, data: [...]}
      const serverCards = result.cards || result.data || [];
      if (!serverCards || serverCards.length === 0) {
        throw new Error('云端没有可恢复的卡片数据');
      }

      // 清空本地所有卡片，然后写入云端数据
      await db.cards.clear();

      for (const sc of serverCards) {
        await db.cards.add({
          syncId: sc.syncId || '',
          name: sc.name || '',
          bank: sc.bank || '',
          cardNumber: sc.cardNumber || '',
          cvv: sc.cvv || '',
          expiryDate: sc.expiryDate || '',
          cardholderName: sc.cardholderName || '',
          creditLimit: sc.creditLimit ?? 0,
          billingDay: sc.billingDay ?? 1,
          paymentDueDay: sc.paymentDueDay ?? 1,
          color: sc.color || 'blue',
          cardFrontImage: sc.cardFrontImage || '',
          cardBackImage: sc.cardBackImage || '',
          notes: sc.notes || '',
          owner: sc.owner || '',
          lastFour: sc.lastFour || '',
          isDeleted: false,
          createdAt: new Date((sc.createdAt || 0) * 1000),
          updatedAt: new Date((sc.updatedAt || 0) * 1000)
        });
      }

      this.isSyncing = false;
      this.notifyListeners({
        lastSyncAt: new Date(),
        isSyncing: false,
        error: null,
        pendingChanges: 0
      });

      return { success: true, count: serverCards.length };
    } catch (error) {
      this.isSyncing = false;
      const errorMessage = error instanceof Error ? error.message : '恢复失败';

      this.notifyListeners({
        ...this.getSyncStatus(),
        isSyncing: false,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }
}

// 导出单例
export const syncService = new SyncService();
