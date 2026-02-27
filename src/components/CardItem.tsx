import { CreditCard } from 'lucide-react';
import type { CreditCard as CreditCardType, CardColor } from '../types';
import { getBillingInfo, formatCurrency, formatDate } from '../utils/billing';
// 格式化卡号显示（每4位一组）
function formatCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s/g, '');
  const groups = cleaned.match(/.{1,4}/g) || [];
  return groups.join(' ');
}

interface CardItemProps {
  card: CreditCardType;
  onClick?: () => void;
}

const colorClasses: Record<CardColor, string> = {
  blue: 'card-gradient-blue',
  purple: 'card-gradient-purple',
  green: 'card-gradient-green',
  orange: 'card-gradient-orange',
  pink: 'card-gradient-pink',
  gray: 'card-gradient-gray'
};

const statusColors = {
  safe: 'bg-green-500',
  warning: 'bg-yellow-500',
  urgent: 'bg-red-500'
};

const statusText = {
  safe: '安全',
  warning: '临近',
  urgent: '紧急'
};

export function CardItem({ card, onClick }: CardItemProps) {
  const billingInfo = getBillingInfo(card.billingDay, card.paymentDueDay);
  
  return (
    <div
      onClick={onClick}
      className={`${colorClasses[card.color]} rounded-2xl p-5 text-white shadow-lg 
        active:scale-[0.98] transition-transform cursor-pointer`}
    >
      {/* 顶部：銀行和状态 */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-white/80 text-sm">{card.bank}</p>
          <p className="font-semibold text-lg">{card.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {card.owner && (
            <span className="bg-white/25 px-2 py-0.5 rounded-full text-xs font-medium">
              {card.owner}
            </span>
          )}
          <div className={`${statusColors[billingInfo.status]} px-2 py-1 rounded-full text-xs font-medium`}>
            {statusText[billingInfo.status]}
          </div>
        </div>
      </div>
      
      {/* 卡号 */}
      <div className="flex items-center gap-2 mb-4">
        <CreditCard size={20} className="text-white/70" />
        <span className="text-white/90 tracking-wider font-mono">
          {card.cardNumber ? formatCardNumber(card.cardNumber) : '•••• •••• •••• ••••'}
        </span>
      </div>
      
      {/* 额度 */}
      <div className="mb-4">
        <p className="text-white/70 text-xs">信用额度</p>
        <p className="text-2xl font-bold">{formatCurrency(card.creditLimit)}</p>
      </div>
      
      {/* 底部：账单日和还款日 */}
      <div className="flex justify-between text-sm border-t border-white/20 pt-3">
        <div>
          <p className="text-white/70 text-xs">账单日</p>
          <p className="font-medium">每月{card.billingDay}日</p>
          <p className="text-white/60 text-xs">
            下次: {formatDate(billingInfo.nextBillingDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-xs">还款日</p>
          <p className="font-medium">每月{card.paymentDueDay}日</p>
          <p className="text-white/60 text-xs">
            {billingInfo.daysUntilPayment}天后还款
          </p>
        </div>
      </div>
    </div>
  );
}
