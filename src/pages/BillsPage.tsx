import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useCards } from '../hooks/useCards';
import type { BillStatement } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://credit-api.xhxh.eu.org';

export function BillsPage() {
  const navigate = useNavigate();
  const { cards } = useCards();
  const [bills, setBills] = useState<BillStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchResult, setFetchResult] = useState<{ total: number; saved: number; skipped: number } | null>(null);

  const loadBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/bills`);
      const json = await res.json();
      if (json.success) {
        setBills(json.data || []);
      } else {
        setError(json.error || '加载失败');
      }
    } catch (e) {
      setError('无法连接到服务器，请检查网络或服务器配置');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    setFetchResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/bills/fetch`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setFetchResult(json.data);
        await loadBills();
      } else {
        setError(json.error || '拉取失败');
      }
    } catch (e) {
      setError('无法连接到服务器');
    } finally {
      setFetching(false);
    }
  };

  // 将账单按 cardSyncId 分组
  const grouped = bills.reduce<Record<string, BillStatement[]>>((acc, bill) => {
    if (!acc[bill.cardSyncId]) acc[bill.cardSyncId] = [];
    acc[bill.cardSyncId].push(bill);
    return acc;
  }, {});

  // 根据 syncId 找到对应卡片信息
  const getCard = (syncId: string) => cards.find(c => c.syncId === syncId);

  const formatAmount = (amount: number, currency = 'CNY') => {
    if (!amount) return '-';
    const symbol = currency === 'CNY' ? '¥' : currency;
    return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return dateStr;
  };

  const confidenceColor = (confidence?: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-blue-600 bg-blue-50';
      case 'low': return 'text-amber-600 bg-amber-50';
      case 'ambiguous': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const confidenceLabel = (confidence?: string) => {
    switch (confidence) {
      case 'high': return '高置信';
      case 'medium': return '中置信';
      case 'low': return '低置信';
      case 'ambiguous': return '模糊匹配';
      default: return '';
    }
  };

  const matchedByLabel = (matchedBy?: string) => {
    switch (matchedBy) {
      case 'full_card': return '完整卡号';
      case 'last_four': return '尾号匹配';
      case 'name': return '姓名匹配';
      default: return matchedBy || '';
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full active:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">邮件账单</h1>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl
            text-sm font-medium active:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
          {fetching ? '拉取中...' : '立即拉取'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 拉取结果提示 */}
        {fetchResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              拉取完成：共 {fetchResult.total} 封邮件，
              新增 <strong>{fetchResult.saved}</strong> 条账单，
              跳过 {fetchResult.skipped} 条
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* 加载中 */}
        {loading && (
          <div className="flex justify-center py-12">
            <RefreshCw size={32} className="text-gray-300 animate-spin" />
          </div>
        )}

        {/* 无数据 */}
        {!loading && bills.length === 0 && !error && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-1">暂无账单数据</p>
            <p className="text-xs text-gray-400">点击右上角「立即拉取」从邮箱获取账单</p>
          </div>
        )}

        {/* 账单列表（按卡片分组） */}
        {!loading && Object.entries(grouped).map(([syncId, cardBills]) => {
          const card = getCard(syncId);
          const cardName = card ? `${card.bank} · ${card.name}` : `未知卡片 (${syncId.slice(0, 8)}...)`;
          const cardColor = card?.color || 'blue';

          const colorMap: Record<string, string> = {
            blue: 'bg-blue-500',
            purple: 'bg-purple-500',
            green: 'bg-green-500',
            orange: 'bg-orange-500',
            pink: 'bg-pink-500',
            gray: 'bg-gray-500',
          };

          return (
            <div key={syncId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 卡片标题 */}
              <div className={`${colorMap[cardColor] || 'bg-blue-500'} px-4 py-3 flex items-center gap-2`}>
                <div className="w-2 h-2 rounded-full bg-white/70" />
                <span className="text-white font-medium text-sm">{cardName}</span>
                {card?.lastFour && (
                  <span className="text-white/70 text-xs">尾号 {card.lastFour}</span>
                )}
              </div>

              {/* 账单列表 */}
              <div className="divide-y divide-gray-50">
                {cardBills.map(bill => (
                  <div key={bill.id} className="p-4">
                    {/* 金额行 */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xl font-bold text-gray-800">
                          {formatAmount(bill.amount, bill.currency)}
                        </span>
                        {(bill.minPayment ?? 0) > 0 && (
                          <span className="text-xs text-gray-400 ml-2">
                            最低还款 {formatAmount(bill.minPayment ?? 0, bill.currency)}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColor(bill.matchConfidence)}`}>
                        {confidenceLabel(bill.matchConfidence)}
                      </span>
                    </div>

                    {/* 日期行 */}
                    <div className="flex gap-4 text-xs text-gray-500 mb-2">
                      {bill.billDate && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          账单日 {formatDate(bill.billDate)}
                        </span>
                      )}
                      {bill.dueDate && (
                        <span className="flex items-center gap-1 text-red-500">
                          <Clock size={12} />
                          还款截止 {formatDate(bill.dueDate)}
                        </span>
                      )}
                    </div>

                    {/* 元数据行 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {bill.bank && (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                          {bill.bank}
                        </span>
                      )}
                      {bill.matchedBy && (
                        <span className="text-xs text-gray-400">
                          via {matchedByLabel(bill.matchedBy)}
                        </span>
                      )}
                      {bill.statementType && (
                        <span className="text-xs text-gray-300">
                          {bill.statementType.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
