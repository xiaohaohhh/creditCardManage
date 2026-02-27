// 信用卡数据类型
export interface CreditCard {
  id?: number;
  name: string;           // 卡片名称，如"招行信用卡"
  bank: string;           // 银行名称
  cardNumber: string;     // 完整卡号 (加密存储)
  cvv: string;            // CVV码 (加密存储)
  expiryDate: string;     // 有效期 MM/YY
  cardholderName: string; // 持卡人姓名
  creditLimit: number;    // 信用额度
  billingDay: number;     // 账单日 (1-28)
  paymentDueDay: number;  // 还款日 (1-28)
  color: CardColor;       // 卡片颜色主题
  cardFrontImage?: string; // 卡片正面照片 (Base64, 加密存储)
  cardBackImage?: string;  // 卡片背面照片 (Base64, 加密存储)
  notes?: string;         // 备注
  owner?: string;          // 归属人（如：本人、配偶、父母等）
  // 同步相关
  syncId?: string;        // 服务器端ID
  lastSyncAt?: Date;      // 最后同步时间
  isDeleted?: boolean;    // 软删除标记
  createdAt: Date;
  updatedAt: Date;
}

// 加密数据包装类型
export interface EncryptedData {
  ciphertext: string;     // Base64编码的密文
  iv: string;             // Base64编码的IV
  salt?: string;          // Base64编码的盐值 (用于密钥派生)
}

// 卡片颜色主题
export type CardColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'gray';

// 表单数据类型
export interface CardFormData {
  name: string;
  bank: string;
  cardNumber: string;
  cvv: string;
  expiryDate: string;
  cardholderName: string;
  creditLimit: string;
  billingDay: string;
  paymentDueDay: string;
  color: CardColor;
  cardFrontImage?: string;
  cardBackImage?: string;
  notes?: string;
  owner?: string;
}

// 账单周期信息
export interface BillingInfo {
  nextBillingDate: Date;      // 下一个账单日
  nextPaymentDueDate: Date;   // 下一个还款日
  daysUntilBilling: number;   // 距离账单日天数
  daysUntilPayment: number;   // 距离还款日天数
  status: PaymentStatus;      // 还款状态
}

// 还款状态
export type PaymentStatus = 'safe' | 'warning' | 'urgent';

// 同步状态
export interface SyncStatus {
  lastSyncAt: Date | null;
  isSyncing: boolean;
  error: string | null;
  pendingChanges: number;
}

// 用户设置
export interface UserSettings {
  id?: number;
  serverUrl?: string;         // N1后端服务器地址
  encryptionEnabled: boolean; // 是否启用加密
  passwordHash?: string;      // 主密码哈希 (用于验证)
  salt?: string;              // 密钥派生盐值
  autoSync: boolean;          // 自动同步
  syncInterval: number;       // 同步间隔(分钟)
  createdAt: Date;
  updatedAt: Date;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// 同步数据包
export interface SyncPayload {
  cards: CreditCard[];
  lastSyncAt: number;
  deviceId: string;
}
