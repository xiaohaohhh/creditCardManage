import { useNavigate } from 'react-router-dom';
import { Plus, CreditCard, Wallet, Settings } from 'lucide-react';
import { useCards } from '../hooks/useCards';
import { CardItem } from '../components/CardItem';
import { formatCurrency } from '../utils/billing';
import { getBillingInfo } from '../utils/billing';

export function HomePage() {
  const navigate = useNavigate();
  const { cards } = useCards();
  
  // 计算总额度
  const totalLimit = cards.reduce((sum, card) => sum + card.creditLimit, 0);
  
  // 按还款日紧急程度排序
  const sortedCards = [...cards].sort((a, b) => {
    const infoA = getBillingInfo(a.billingDay, a.paymentDueDay);
    const infoB = getBillingInfo(b.billingDay, b.paymentDueDay);
    return infoA.daysUntilPayment - infoB.daysUntilPayment;
  });
  
  // 统计紧急还款的卡片数量
  const urgentCount = cards.filter(card => {
    const info = getBillingInfo(card.billingDay, card.paymentDueDay);
    return info.status === 'urgent';
  }).length;

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
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <Wallet size={16} />
              <span>总额度</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalLimit)}</p>
          </div>
          
          <div className="bg-white/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <CreditCard size={16} />
              <span>卡片数量</span>
            </div>
            <p className="text-2xl font-bold">{cards.length} 张</p>
            {urgentCount > 0 && (
              <p className="text-red-200 text-xs mt-1">{urgentCount}张需紧急还款</p>
            )}
          </div>
        </div>
      </div>
      
      {/* 卡片列表 */}
      <div className="px-5 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-gray-700 font-medium">我的卡片</h2>
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
