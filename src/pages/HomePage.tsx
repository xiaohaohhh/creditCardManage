import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CreditCard, Wallet, Settings, Users, FileText } from 'lucide-react';
import { useCards } from '../hooks/useCards';
import { CardItem } from '../components/CardItem';
import { formatCurrency } from '../utils/billing';
import { getBillingInfo } from '../utils/billing';

export function HomePage() {
  const navigate = useNavigate();
  const { cards } = useCards();
  const [selectedOwner, setSelectedOwner] = useState<string>('全部');

  // 提取所有归属人列表（去重，过滤空值）
  const owners = useMemo(() => {
    const ownerSet = new Set<string>();
    cards.forEach(card => {
      if (card.owner && card.owner.trim()) {
        ownerSet.add(card.owner.trim());
      }
    });
    return Array.from(ownerSet).sort();
  }, [cards]);

  // 当前筛选后的卡片
  const filteredCards = useMemo(() => {
    if (selectedOwner === '全部') return cards;
    return cards.filter(card => (card.owner?.trim() || '') === selectedOwner);
  }, [cards, selectedOwner]);

  // 计算筛选后的总额度
  const totalLimit = filteredCards.reduce((sum, card) => sum + card.creditLimit, 0);

  // 按还款日紧急程度排序
  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      const infoA = getBillingInfo(a.billingDay, a.paymentDueDay);
      const infoB = getBillingInfo(b.billingDay, b.paymentDueDay);
      return infoA.daysUntilPayment - infoB.daysUntilPayment;
    });
  }, [filteredCards]);

  // 统计紧急还款的卡片数量（基于筛选后）
  const urgentCount = filteredCards.filter(card => {
    const info = getBillingInfo(card.billingDay, card.paymentDueDay);
    return info.status === 'urgent';
  }).length;

  // Tab 列表：全部 + 各归属人
  const tabs = ['全部', ...owners];

  return (
    <div className="min-h-full bg-slate-50">
      {/* 顶部统计区域 */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white px-5 pt-6 pb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">信用卡管家</h1>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-full bg-white/20 active:bg-white/30 transition-colors"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => navigate('/bills')}
            className="p-2 rounded-full bg-white/20 active:bg-white/30 transition-colors"
          >
            <FileText size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <Wallet size={16} />
              <span>总额度{selectedOwner !== '全部' ? `·${selectedOwner}` : ''}</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalLimit)}</p>
          </div>

          <div className="bg-white/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <CreditCard size={16} />
              <span>卡片数量</span>
            </div>
            <p className="text-2xl font-bold">{filteredCards.length} 张</p>
            {urgentCount > 0 && (
              <p className="text-red-200 text-xs mt-1">{urgentCount}张需紧急还款</p>
            )}
          </div>
        </div>
      </div>

      {/* 归属人筛选 Tab — 仅在有多个归属人时显示 */}
      {owners.length > 0 && (
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400">按归属人筛选</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedOwner(tab)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                  ${selectedOwner === tab
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-50'
                  }`}
              >
                {tab}
                {tab !== '全部' && (
                  <span className={`ml-1 text-xs ${selectedOwner === tab ? 'text-blue-100' : 'text-gray-400'}`}>
                    {cards.filter(c => (c.owner?.trim() || '') === tab).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 卡片列表 */}
      <div className="px-5 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-gray-700 font-medium">
            {selectedOwner === '全部' ? '我的卡片' : `${selectedOwner}的卡片`}
          </h2>
          <button
            onClick={() => navigate('/add')}
            className="flex items-center gap-1 text-blue-500 text-sm font-medium 
              active:text-blue-600 transition-colors"
          >
            <Plus size={18} />
            添加
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <CreditCard size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">还没有添加信用卡</p>
            <button
              onClick={() => navigate('/add')}
              className="px-6 py-2 bg-blue-500 text-white rounded-full text-sm 
                font-medium active:bg-blue-600 transition-colors"
            >
              添加第一张卡
            </button>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Users size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">「{selectedOwner}」名下暂无卡片</p>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {sortedCards.map(card => (
              <CardItem
                key={card.id}
                card={card}
                onClick={() => navigate(`/edit/${card.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
