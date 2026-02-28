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

  // 执行同步
  async sync(): Promise<{ success: boolean; error?: string }> {
    if (!this.serverUrl) {
      return { success: false, error: '未配置服务器地址' };
    }

    if (this.isSyncing) {
      return { success: false, error: '同步进行中' };
    }

    this.isSyncing = true;
    this.notifyListeners({
      ...this.getSyncStatus(),
      isSyncing: true
    });

    try {
      // 获取本地所有卡片（包括已删除的）
      const localCards = await db.cards.toArray();
      
      // 确保所有本地卡都有 syncId，没有的先写入再同步
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

      // 发送同步请求
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
        // 处理服务器返回的卡片
        for (const serverCard of result.data.cards) {
          await this.mergeServerCard(serverCard);
        }

        // 更新同步时间
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
      const errorMessage = error instanceof Error ? error.message : '同步失败';
      
      this.notifyListeners({
        ...this.getSyncStatus(),
        isSyncing: false,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  // 合并服务器卡片到本地
  private async mergeServerCard(serverCard: CreditCard) {
    // 查找本地是否有对应卡片
    const localCard = await db.cards
      .filter(c => c.syncId === serverCard.syncId)
      .first();

    const serverUpdatedAt = typeof serverCard.updatedAt === 'number' 
      ? serverCard.updatedAt 
      : Math.floor(new Date(serverCard.updatedAt).getTime() / 1000);

    if (localCard) {
      const localUpdatedAt = localCard.updatedAt instanceof Date
        ? Math.floor(localCard.updatedAt.getTime() / 1000)
        : localCard.updatedAt;

      // 服务器版本更新，更新本地
      if (serverUpdatedAt > localUpdatedAt) {
        await db.cards.update(localCard.id!, {
          ...serverCard,
          id: localCard.id,
          createdAt: new Date((serverCard.createdAt as unknown as number) * 1000),
          updatedAt: new Date(serverUpdatedAt * 1000)
        });
      }
    } else {
      // 本地没有，添加新卡片
      await db.cards.add({
        ...serverCard,
        id: undefined,
        createdAt: new Date((serverCard.createdAt as unknown as number) * 1000),
        updatedAt: new Date(serverUpdatedAt * 1000)
      });
    }
  }

  // 强制全量同步
  async forceFullSync(): Promise<{ success: boolean; error?: string }> {
    this.lastSyncAt = 0;
    this.saveSyncState();
    return this.sync();
  }
}

// 导出单例
export const syncService = new SyncService();
