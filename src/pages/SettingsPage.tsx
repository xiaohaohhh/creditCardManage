import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, RefreshCw, Check, X, Cloud, CloudOff, Mail, Eye, EyeOff } from 'lucide-react';
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

  // 邮箱配置
  const [emailAddress, setEmailAddress] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [imapHost, setImapHost] = useState('imap.qq.com:993');
  const [showPassword, setShowPassword] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<boolean | null>(null);
  const [emailTestMsg, setEmailTestMsg] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'https://credit-api.xhxh.eu.org';

  useEffect(() => {
    const unsubscribe = syncService.onSyncStatusChange(setSyncStatus);
    // 加载已保存的邮箱配置
    fetch(`${API_BASE}/api/v1/email-config`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setEmailAddress(json.data.email || '');
          setImapHost(json.data.imapHost || 'imap.qq.com:993');
        }
      })
      .catch(() => {});
    return unsubscribe;
  }, [API_BASE]);

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
  const handleTestEmailConfig = async () => {
    if (!emailAddress || !emailPassword) return;
    setEmailTesting(true);
    setEmailTestResult(null);
    setEmailTestMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/email-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress, password: emailPassword, imapHost }),
      });
      const json = await res.json();
      setEmailTestResult(json.success);
      setEmailTestMsg(json.success ? '连接成功！' : (json.error || '连接失败'));
    } catch {
      setEmailTestResult(false);
      setEmailTestMsg('无法连接到服务器');
    } finally {
      setEmailTesting(false);
    }
  };

  const handleSaveEmailConfig = async () => {
    if (!emailAddress || !emailPassword) return;
    setEmailSaving(true);
    setEmailSaved(false);
    try {
      await fetch(`${API_BASE}/api/v1/email-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress, password: emailPassword, imapHost }),
      });
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setEmailSaving(false);
    }
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

        {/* 邮箱账单配置 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={20} className="text-gray-600" />
            <h2 className="font-medium text-gray-800">邮件账单</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">邮箱地址</label>
              <input
                type="email"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                placeholder="2467624051@qq.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500
                  focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">授权码（非登录密码）</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={emailPassword}
                  onChange={e => setEmailPassword(e.target.value)}
                  placeholder="QQ邮箱授权码"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-blue-500
                    focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
                />
                <button
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">IMAP服务器</label>
              <input
                type="text"
                value={imapHost}
                onChange={e => setImapHost(e.target.value)}
                placeholder="imap.qq.com:993"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500
                  focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">QQ邮箱默认 imap.qq.com:993</p>
            </div>

            {emailTestResult !== null && (
              <div className={`flex items-center gap-2 text-sm ${
                emailTestResult ? 'text-green-600' : 'text-red-500'
              }`}>
                {emailTestResult ? <Check size={16} /> : <X size={16} />}
                {emailTestMsg}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTestEmailConfig}
                disabled={!emailAddress || !emailPassword || emailTesting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600
                  font-medium active:bg-gray-100 transition-colors disabled:opacity-50 text-sm"
              >
                {emailTesting ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={handleSaveEmailConfig}
                disabled={!emailAddress || !emailPassword || emailSaving}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-medium
                  active:bg-blue-600 transition-colors disabled:opacity-50 text-sm"
              >
                {emailSaved ? '已保存 ✓' : emailSaving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>
        </div>

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
