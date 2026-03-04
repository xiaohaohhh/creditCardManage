import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { CreditCard, CardFormData } from '../types';
export function useCards() {
  // 只查询未删除的卡片
  const cards = useLiveQuery(() => 
    db.cards.filter(card => !card.isDeleted).toArray()
  ) ?? [];
  const addCard = async (formData: CardFormData): Promise<number> => {
    const now = new Date();
    const card: Omit<CreditCard, 'id'> = {
      name: formData.name.trim(),
      bank: formData.bank.trim(),
      cardNumber: formData.cardNumber.trim(),
      cvv: formData.cvv.trim(),
      expiryDate: formData.expiryDate.trim(),
      cardholderName: formData.cardholderName.trim(),
      creditLimit: parseInt(formData.creditLimit, 10),
      billingDay: parseInt(formData.billingDay, 10),
      paymentDueDay: parseInt(formData.paymentDueDay, 10),
      color: formData.color,
      cardFrontImage: formData.cardFrontImage,
      cardBackImage: formData.cardBackImage,
      notes: formData.notes?.trim(),
      isDeleted: false,
      owner: formData.owner?.trim() || '',
      createdAt: now,
      updatedAt: now
    };
    const id = await db.cards.add(card);
    return id as number;
  };
  const updateCard = async (id: number, formData: CardFormData): Promise<void> => {
    await db.cards.update(id, {
      name: formData.name.trim(),
      bank: formData.bank.trim(),
      cardNumber: formData.cardNumber.trim(),
      cvv: formData.cvv.trim(),
      expiryDate: formData.expiryDate.trim(),
      cardholderName: formData.cardholderName.trim(),
      creditLimit: parseInt(formData.creditLimit, 10),
      billingDay: parseInt(formData.billingDay, 10),
      paymentDueDay: parseInt(formData.paymentDueDay, 10),
      color: formData.color,
      cardFrontImage: formData.cardFrontImage,
      cardBackImage: formData.cardBackImage,
      notes: formData.notes?.trim(),
      owner: formData.owner?.trim() || '',
      updatedAt: new Date()
    });
  };
  
  // 软删除：更新本地 IndexedDB，同时通知服务器
  const deleteCard = async (id: number): Promise<void> => {
    // 先获取 syncId
    const card = await db.cards.get(id);
    
    // 更新本地
    await db.cards.update(id, {
      isDeleted: true,
      updatedAt: new Date()
    });

    // 立即通知服务器软删除（有 syncId 才推送）
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
  };
  
  // 永久删除
  const permanentDeleteCard = async (id: number): Promise<void> => {
    await db.cards.delete(id);
  };
  const getCard = async (id: number): Promise<CreditCard | undefined> => {
    return await db.cards.get(id);
  };
  
  // 获取所有卡片（包括已删除，用于同步）
  const getAllCards = async (): Promise<CreditCard[]> => {
    return await db.cards.toArray();
  };
  
  return { 
    cards, 
    addCard, 
    updateCard, 
    deleteCard, 
    permanentDeleteCard,
    getCard,
    getAllCards
  };
}
