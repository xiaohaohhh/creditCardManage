import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, RefreshCw, Check, X, Cloud, CloudOff } from 'lucide-react';
import { syncService } from '../utils/sync';
import type { SyncStatus } from '../types';

export function SettingsPage() {
  const navigate = useNavigate();
  const [serverUrl, setServerUrl] = useState(syncService.getServerUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncService.getSyncStatus());
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = syncService.onSyncStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  const handleTestConnection = async () => {
    if (!serverUrl) return;
    setTesting(true);
    setTestResult(null);
    const result = await syncService.testConnection(serverUrl);
    setTestResult(result);
    setTesting(false);
  };

  const handleSaveServer = () => {
    syncService.setServerUrl(serverUrl);
    setTestResult(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    const result = await syncService.sync();
    if (!result.success) {
      setSyncError(result.error || '同步失败');
    }
    setSyncing(false);
  };

  const handleForceSync = async () => {
    setSyncing(true);
    setSyncError(null);
    const result = await syncService.forceFullSync();
    if (!result.success) {
      setSyncError(result.error || '同步失败');
    }
    setSyncing(false);
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return '从未同步';
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full active:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">设置</h1>
      </div>

      <div className="p-5 space-y-4">
        {/* 同步状态卡片 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            {syncService.isConfigured() ? (
              <Cloud size={24} className="text-blue-500" />
            ) : (
              <CloudOff size={24} className="text-gray-400" />
            )}
            <div>
              <h2 className="font-medium text-gray-800">云同步</h2>
              <p className="text-sm text-gray-500">
                {syncService.isConfigured() ? '已配置' : '未配置'}
              </p>
            </div>
          </div>
          
          {syncStatus.lastSyncAt && (
            <p className="text-sm text-gray-500 mb-2">
              上次同步: {formatLastSync(syncStatus.lastSyncAt)}
            </p>
          )}
          
          {syncError && (
            <p className="text-sm text-red-500 mb-2">{syncError}</p>
          )}
        </div>

        {/* 服务器配置 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Server size={20} className="text-gray-600" />
            <h2 className="font-medium text-gray-800">服务器地址</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                placeholder="https://credit-api.xhxh.eu.org"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 
                  focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
              />
              {testResult !== null && (
                <div className={`flex items-center justify-center w-12 rounded-xl ${
                  testResult ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {testResult ? (
                    <Check size={20} className="text-green-600" />
                  ) : (
                    <X size={20} className="text-red-600" />
                  )}
                </div>
              )}
            </div>
            
            <p className="text-xs text-gray-500">
              示例: http://[2001:db8::1]:2006 或 http://192.168.1.100:2006
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={!serverUrl || testing}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 
                  font-medium active:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={handleSaveServer}
                disabled={!serverUrl}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-medium 
                  active:bg-blue-600 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>

        {/* 同步操作 */}
        {syncService.isConfigured() && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw size={20} className="text-gray-600" />
              <h2 className="font-medium text-gray-800">数据同步</h2>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium 
                  active:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    同步中...
                  </>
                ) : (
                  '立即同步'
                )}
              </button>
              
              <button
                onClick={handleForceSync}
                disabled={syncing}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 
                  font-medium active:bg-gray-100 transition-colors disabled:opacity-50"
              >
                强制全量同步
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                强制同步会重新下载所有数据
              </p>
            </div>
          </div>
        )}

        {/* 关于 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-medium text-gray-800 mb-2">关于</h2>
          <p className="text-sm text-gray-500">信用卡管家 v1.0.0</p>
          <p className="text-xs text-gray-400 mt-1">数据本地加密存储，安全可靠</p>
        </div>
      </div>
    </div>
  );
}
