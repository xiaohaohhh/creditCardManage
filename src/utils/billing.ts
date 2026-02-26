import {
  addMonths,
  setDate,
  isBefore,
  isToday,
  differenceInDays,
  startOfDay
} from 'date-fns';
import type { BillingInfo, PaymentStatus } from '../types';

/**
 * 计算下一个指定日期（账单日或还款日）
 * @param day 每月的日期 (1-28)
 * @param referenceDate 参考日期，默认为今天
 */
export function getNextDateForDay(day: number, referenceDate: Date = new Date()): Date {
  const today = startOfDay(referenceDate);
  let targetDate = setDate(today, day);
  
  // 如果目标日期已过或是今天，则取下个月
  if (isBefore(targetDate, today) || isToday(targetDate)) {
    targetDate = addMonths(targetDate, 1);
  }
  
  return targetDate;
}

/**
 * 计算还款日（考虑账单日和还款日的关系）
 * 如果还款日 < 账单日，说明还款日在下个月
 */
export function getNextPaymentDueDate(
  billingDay: number,
  paymentDueDay: number,
  referenceDate: Date = new Date()
): Date {
  const today = startOfDay(referenceDate);
  const nextBillingDate = getNextDateForDay(billingDay, referenceDate);
  
  // 计算对应的还款日
  let paymentDate = setDate(nextBillingDate, paymentDueDay);
  
  // 如果还款日小于账单日，还款日在账单日的下个月
  if (paymentDueDay <= billingDay) {
    paymentDate = addMonths(paymentDate, 1);
  }
  
  // 检查是否有更近的还款日（上个账单周期的还款日）
  const prevPaymentDate = addMonths(paymentDate, -1);
  if (isBefore(today, prevPaymentDate) || isToday(prevPaymentDate)) {
    return prevPaymentDate;
  }
  
  return paymentDate;
}

/**
 * 获取完整的账单周期信息
 */
export function getBillingInfo(billingDay: number, paymentDueDay: number): BillingInfo {
  const today = startOfDay(new Date());
  const nextBillingDate = getNextDateForDay(billingDay);
  const nextPaymentDueDate = getNextPaymentDueDate(billingDay, paymentDueDay);
  
  const daysUntilBilling = differenceInDays(nextBillingDate, today);
  const daysUntilPayment = differenceInDays(nextPaymentDueDate, today);
  
  // 根据距离还款日的天数确定状态
  let status: PaymentStatus = 'safe';
  if (daysUntilPayment <= 3) {
    status = 'urgent';
  } else if (daysUntilPayment <= 7) {
    status = 'warning';
  }
  
  return {
    nextBillingDate,
    nextPaymentDueDate,
    daysUntilBilling,
    daysUntilPayment,
    status
  };
}

/**
 * 格式化金额显示
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * 格式化日期显示
 */
export function formatDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
