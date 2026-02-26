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
      updatedAt: new Date()
    });
  };
  
  // 软删除，保留数据用于同步
  const deleteCard = async (id: number): Promise<void> => {
    await db.cards.update(id, {
      isDeleted: true,
      updatedAt: new Date()
    });
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
