import type { CreditAccount, CreditCard, CreditCardWithAccount, SyncedCardRecord } from '../types';

export function generateSyncId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function parseStoredDate(value: unknown, fallback: Date = new Date()): Date {
  if (value instanceof Date) return value;

  if (typeof value === 'string' || typeof value === 'number') {
    const normalizedValue = typeof value === 'number' && value < 1e12
      ? value * 1000
      : value;
    const date = new Date(normalizedValue);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return fallback;
}

export function buildDefaultAccountName(bank: string, owner?: string): string {
  const trimmedBank = bank.trim();
  const trimmedOwner = owner?.trim();

  if (!trimmedBank) {
    return trimmedOwner ? `${trimmedOwner}共享额度` : '共享额度账户';
  }

  return trimmedOwner ? `${trimmedBank}-${trimmedOwner}共享额度` : `${trimmedBank}共享额度`;
}

export function buildSharedAccountKey(params: {
  bank: string;
  owner?: string;
  sharedLimit: number;
  billingDay: number;
  paymentDueDay: number;
}): string {
  return [
    params.bank.trim().toLowerCase(),
    params.owner?.trim().toLowerCase() || '',
    params.sharedLimit,
    params.billingDay,
    params.paymentDueDay,
  ].join('::');
}

function normalizeAccount(account: CreditAccount): CreditAccount {
  return {
    ...account,
    owner: account.owner?.trim() || '',
    createdAt: parseStoredDate(account.createdAt),
    updatedAt: parseStoredDate(account.updatedAt),
  };
}

function normalizeCard(card: CreditCard): CreditCard {
  return {
    ...card,
    createdAt: parseStoredDate(card.createdAt),
    updatedAt: parseStoredDate(card.updatedAt),
    ...(card.lastSyncAt ? { lastSyncAt: parseStoredDate(card.lastSyncAt) } : {}),
  };
}

export function createAccountFromSyncCard(
  card: Pick<SyncedCardRecord, 'accountSyncId' | 'accountName' | 'bank' | 'creditLimit' | 'billingDay' | 'paymentDueDay' | 'owner' | 'createdAt' | 'updatedAt'>,
  fallbackSyncId?: string
): CreditAccount {
  const bank = card.bank?.trim() || '未命名银行';
  const owner = card.owner?.trim() || '';
  const createdAt = parseStoredDate(card.createdAt);
  const updatedAt = parseStoredDate(card.updatedAt, createdAt);

  return {
    syncId: card.accountSyncId || fallbackSyncId || generateSyncId(),
    accountName: (card.accountName || '').trim() || buildDefaultAccountName(bank, owner),
    bank,
    owner,
    sharedLimit: Number(card.creditLimit) || 0,
    billingDay: Number(card.billingDay) || 1,
    paymentDueDay: Number(card.paymentDueDay) || 1,
    createdAt,
    updatedAt,
  };
}

export function hydrateCardsWithAccounts(
  cards: CreditCard[],
  accounts: CreditAccount[]
): CreditCardWithAccount[] {
  const normalizedAccounts = accounts.map(normalizeAccount);
  const accountMap = new Map(normalizedAccounts.map(account => [account.syncId, account]));

  return cards.map(rawCard => {
    const card = normalizeCard(rawCard);
    const account = accountMap.get(card.accountSyncId);

    if (account) {
      return {
        ...card,
        account,
      };
    }

    const fallbackAccount = createAccountFromSyncCard({
      accountSyncId: card.accountSyncId,
      bank: '未分组账户',
      owner: card.owner,
      creditLimit: 0,
      billingDay: 1,
      paymentDueDay: 1,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    }, card.accountSyncId || generateSyncId());

    return {
      ...card,
      account: fallbackAccount,
    };
  });
}

export function flattenCardForSync(card: CreditCard, account: CreditAccount): SyncedCardRecord {
  return {
    id: card.id,
    syncId: card.syncId,
    accountSyncId: account.syncId,
    accountName: account.accountName,
    name: card.name,
    bank: account.bank,
    cardNumber: card.cardNumber,
    cvv: card.cvv,
    expiryDate: card.expiryDate,
    cardholderName: card.cardholderName,
    creditLimit: account.sharedLimit,
    billingDay: account.billingDay,
    paymentDueDay: account.paymentDueDay,
    color: card.color,
    cardFrontImage: card.cardFrontImage,
    cardBackImage: card.cardBackImage,
    notes: card.notes,
    owner: card.owner || account.owner,
    lastFour: card.lastFour,
    isDeleted: card.isDeleted,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}
