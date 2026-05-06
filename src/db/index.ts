import Dexie, { type EntityTable } from 'dexie';
import type { CreditAccount, CreditCard, UserSettings } from '../types';
import { buildDefaultAccountName, buildSharedAccountKey, generateSyncId, parseStoredDate } from '../utils/cardAccounts';

// 定义数据库
const db = new Dexie('CreditCardManager') as Dexie & {
  accounts: EntityTable<CreditAccount, 'id'>;
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

// 版本4：引入共享额度账户，将卡片与共享额度/账单规则拆分
db.version(4).stores({
  accounts: '++id, syncId, bank, accountName, billingDay, paymentDueDay, createdAt, updatedAt',
  cards: '++id, accountSyncId, name, owner, syncId, isDeleted, createdAt, updatedAt',
  settings: '++id'
}).upgrade(async tx => {
  const cardsTable = tx.table('cards');
  const accountsTable = tx.table('accounts');
  const cards = await cardsTable.toArray() as Record<string, unknown>[];
  const accountKeyToSyncId = new Map<string, string>();
  const accountsToAdd: CreditAccount[] = [];

  for (const card of cards) {
    const bank = typeof card.bank === 'string' ? card.bank.trim() : '';
    const owner = typeof card.owner === 'string' ? card.owner.trim() : '';
    const sharedLimit = typeof card.creditLimit === 'number' ? card.creditLimit : Number(card.creditLimit) || 0;
    const billingDay = typeof card.billingDay === 'number' ? card.billingDay : Number(card.billingDay) || 1;
    const paymentDueDay = typeof card.paymentDueDay === 'number' ? card.paymentDueDay : Number(card.paymentDueDay) || 1;
    const createdAt = parseStoredDate(card.createdAt);
    const updatedAt = parseStoredDate(card.updatedAt, createdAt);

    let accountSyncId = typeof card.accountSyncId === 'string' ? card.accountSyncId : '';

    if (!accountSyncId) {
      const accountKey = buildSharedAccountKey({
        bank,
        owner,
        sharedLimit,
        billingDay,
        paymentDueDay,
      });
      accountSyncId = accountKeyToSyncId.get(accountKey) || generateSyncId();
      accountKeyToSyncId.set(accountKey, accountSyncId);

      if (!accountsToAdd.some(account => account.syncId === accountSyncId)) {
        accountsToAdd.push({
          syncId: accountSyncId,
          accountName: buildDefaultAccountName(bank, owner),
          bank,
          sharedLimit,
          billingDay,
          paymentDueDay,
          createdAt,
          updatedAt,
        });
      }
    }

    card.accountSyncId = accountSyncId;
  }

  if (accountsToAdd.length > 0) {
    await accountsTable.bulkAdd(accountsToAdd);
  }

  await cardsTable.toCollection().modify((card: Record<string, unknown>) => {
    if (!card.accountSyncId) {
      const bank = typeof card.bank === 'string' ? card.bank.trim() : '';
      const owner = typeof card.owner === 'string' ? card.owner.trim() : '';
      const sharedLimit = typeof card.creditLimit === 'number' ? card.creditLimit : Number(card.creditLimit) || 0;
      const billingDay = typeof card.billingDay === 'number' ? card.billingDay : Number(card.billingDay) || 1;
      const paymentDueDay = typeof card.paymentDueDay === 'number' ? card.paymentDueDay : Number(card.paymentDueDay) || 1;
      const accountKey = buildSharedAccountKey({
        bank,
        owner,
        sharedLimit,
        billingDay,
        paymentDueDay,
      });
      card.accountSyncId = accountKeyToSyncId.get(accountKey) || generateSyncId();
    }
  });
});

 export { db };
