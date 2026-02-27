import Dexie, { type EntityTable } from 'dexie';
import type { CreditCard, UserSettings } from '../types';
// 定义数据库
const db = new Dexie('CreditCardManager') as Dexie & {
  cards: EntityTable<CreditCard, 'id'>;
  settings: EntityTable<UserSettings, 'id'>;
};

// 版本1的schema (基础版本)
db.version(1).stores({
  cards: '++id, name, bank, billingDay, paymentDueDay, createdAt'
});

// 版本2增加新字段和settings表
db.version(2).stores({
  cards: '++id, name, bank, billingDay, paymentDueDay, syncId, isDeleted, createdAt, updatedAt',
  settings: '++id'
}).upgrade(tx => {
  // 迁移旧数据：为旧卡片添加新字段默认值
  return tx.table('cards').toCollection().modify((card: Record<string, unknown>) => {
    if (!card.cardNumber) card.cardNumber = '';
    if (!card.cvv) card.cvv = '';
    if (!card.expiryDate) card.expiryDate = '';
    if (!card.cardholderName) card.cardholderName = '';
    if (card.lastFourDigits && !card.cardNumber) {
      card.cardNumber = '************' + card.lastFourDigits;
    }
  });
});

// 版本3：新增归属人字段
db.version(3).stores({
  cards: '++id, name, bank, owner, billingDay, paymentDueDay, syncId, isDeleted, createdAt, updatedAt',
  settings: '++id'
}).upgrade(tx => {
  return tx.table('cards').toCollection().modify((card: Record<string, unknown>) => {
    if (!card.owner) card.owner = '';
  });
});
export { db };
