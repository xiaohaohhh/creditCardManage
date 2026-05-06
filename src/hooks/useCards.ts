import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildDefaultAccountName, generateSyncId, hydrateCardsWithAccounts } from '../utils/cardAccounts';
import type { CreditAccount, CreditCard, CreditCardWithAccount, CardFormData } from '../types';

function sortAccounts(accounts: CreditAccount[]): CreditAccount[] {
  return [...accounts].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

function buildAccountFromForm(formData: CardFormData, syncId: string, now: Date): Omit<CreditAccount, 'id'> {
  const bank = formData.bank.trim();
  const owner = formData.owner?.trim() || '';

  return {
    syncId,
    accountName: formData.accountName.trim() || buildDefaultAccountName(bank, owner),
    bank,
    owner,
    sharedLimit: parseInt(formData.creditLimit, 10),
    billingDay: parseInt(formData.billingDay, 10),
    paymentDueDay: parseInt(formData.paymentDueDay, 10),
    createdAt: now,
    updatedAt: now,
  };
}

export function useCards() {
  const cards = useLiveQuery(async () => {
    const [cardRows, accountRows] = await Promise.all([
      db.cards.filter(card => !card.isDeleted).toArray(),
      db.accounts.toArray(),
    ]);

    return hydrateCardsWithAccounts(cardRows, accountRows);
  }) ?? [];

  const accounts = useLiveQuery(async () => {
    const accountRows = await db.accounts.toArray();
    return sortAccounts(accountRows);
  }) ?? [];

  const addCard = useCallback(async (formData: CardFormData): Promise<number> => {
    const now = new Date();
    const owner = formData.owner?.trim() || '';
    let accountSyncId = formData.existingAccountSyncId?.trim() || '';

    if (formData.accountMode === 'existing') {
      if (!accountSyncId) {
        throw new Error('请选择共享额度账户');
      }

      const selectedAccount = await db.accounts.where('syncId').equals(accountSyncId).first();
      if (!selectedAccount) {
        throw new Error('共享额度账户不存在');
      }

      if (selectedAccount.bank.trim() !== formData.bank.trim() || (selectedAccount.owner || '') !== owner) {
        throw new Error('只能选择同银行且同归属人的共享额度账户');
      }
    } else {
      accountSyncId = generateSyncId();
      await db.accounts.add(buildAccountFromForm(formData, accountSyncId, now));
    }

    const card: Omit<CreditCard, 'id'> = {
      accountSyncId,
      name: formData.name.trim(),
      cardNumber: formData.cardNumber.trim(),
      cvv: formData.cvv.trim(),
      expiryDate: formData.expiryDate.trim(),
      cardholderName: formData.cardholderName.trim(),
      color: formData.color,
      cardFrontImage: formData.cardFrontImage,
      cardBackImage: formData.cardBackImage,
      notes: formData.notes?.trim(),
      isDeleted: false,
      syncId: generateSyncId(),
      owner,
      createdAt: now,
      updatedAt: now
    };

    const id = await db.cards.add(card);
    return id as number;
  }, []);

  const updateCard = useCallback(async (id: number, formData: CardFormData): Promise<void> => {
    const now = new Date();
    const owner = formData.owner?.trim() || '';
    const existingCard = await db.cards.get(id);

    if (!existingCard) {
      throw new Error('卡片不存在');
    }

    let nextAccountSyncId = existingCard.accountSyncId;

    if (formData.accountMode === 'existing') {
      nextAccountSyncId = formData.existingAccountSyncId?.trim() || '';
      if (!nextAccountSyncId) {
        throw new Error('请选择共享额度账户');
      }

      const selectedAccount = await db.accounts.where('syncId').equals(nextAccountSyncId).first();
      if (!selectedAccount) {
        throw new Error('共享额度账户不存在');
      }

      if (selectedAccount.bank.trim() !== formData.bank.trim() || (selectedAccount.owner || '') !== owner) {
        throw new Error('只能选择同银行且同归属人的共享额度账户');
      }

      if (nextAccountSyncId === existingCard.accountSyncId) {
        if (selectedAccount?.id) {
          await db.accounts.update(selectedAccount.id, {
            accountName: formData.accountName.trim() || buildDefaultAccountName(formData.bank, formData.owner),
            bank: formData.bank.trim(),
            owner,
            sharedLimit: parseInt(formData.creditLimit, 10),
            billingDay: parseInt(formData.billingDay, 10),
            paymentDueDay: parseInt(formData.paymentDueDay, 10),
            updatedAt: now,
          });
        }
      }
    } else {
      nextAccountSyncId = generateSyncId();
      await db.accounts.add(buildAccountFromForm(formData, nextAccountSyncId, now));
    }

    await db.cards.update(id, {
      accountSyncId: nextAccountSyncId,
      name: formData.name.trim(),
      cardNumber: formData.cardNumber.trim(),
      cvv: formData.cvv.trim(),
      expiryDate: formData.expiryDate.trim(),
      cardholderName: formData.cardholderName.trim(),
      color: formData.color,
      cardFrontImage: formData.cardFrontImage,
      cardBackImage: formData.cardBackImage,
      notes: formData.notes?.trim(),
      owner,
      updatedAt: now,
    });
  }, []);
  
  // 软删除：更新本地 IndexedDB，同时通知服务器
  const deleteCard = useCallback(async (id: number): Promise<void> => {
    const card = await db.cards.get(id);
    
    await db.cards.update(id, {
      isDeleted: true,
      updatedAt: new Date()
    });

    if (card?.syncId) {
      const serverUrl = import.meta.env.VITE_API_URL || 'https://credit-api.xhxh.eu.org';
      try {
        await fetch(`${serverUrl}/api/v1/cards/${card.syncId}`, {
          method: 'DELETE'
        });
      } catch {
        // 网络失败不影响本地删除，下次备份时不会推送已删除卡
      }
    }
  }, []);
  
  const permanentDeleteCard = useCallback(async (id: number): Promise<void> => {
    await db.cards.delete(id);
  }, []);

  const getCard = useCallback(async (id: number): Promise<CreditCardWithAccount | undefined> => {
    const [card, accountRows] = await Promise.all([
      db.cards.get(id),
      db.accounts.toArray(),
    ]);

    if (!card) {
      return undefined;
    }

    return hydrateCardsWithAccounts([card], accountRows)[0];
  }, []);
  
  const getAllCards = useCallback(async (): Promise<CreditCard[]> => {
    return await db.cards.toArray();
  }, []);
  
  return { 
    cards, 
    accounts,
    addCard, 
    updateCard, 
    deleteCard, 
    permanentDeleteCard,
    getCard,
    getAllCards
  };
}
