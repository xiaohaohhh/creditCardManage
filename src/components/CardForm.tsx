import { useRef, useState } from 'react';
import { Camera, CreditCard, Eye, EyeOff, X } from 'lucide-react';
import type { CardFormData, CardColor, CreditAccount, CreditCardWithAccount } from '../types';
import { buildDefaultAccountName } from '../utils/cardAccounts';

interface CardFormProps {
  accounts?: CreditAccount[];
  initialData?: CreditCardWithAccount;
  onSubmit: (data: CardFormData) => void;
  onCancel: () => void;
  submitText?: string;
}

const colorOptions: { value: CardColor; label: string; class: string }[] = [
  { value: 'blue', label: '蓝色', class: 'bg-blue-500' },
  { value: 'purple', label: '紫色', class: 'bg-purple-500' },
  { value: 'green', label: '绿色', class: 'bg-green-500' },
  { value: 'orange', label: '橙色', class: 'bg-orange-500' },
  { value: 'pink', label: '粉色', class: 'bg-pink-500' },
  { value: 'gray', label: '灰色', class: 'bg-gray-500' },
];

const defaultFormData: CardFormData = {
  accountMode: 'new',
  existingAccountSyncId: '',
  accountName: '',
  name: '',
  bank: '',
  cardNumber: '',
  cvv: '',
  expiryDate: '',
  cardholderName: '',
  creditLimit: '',
  billingDay: '',
  paymentDueDay: '',
  color: 'blue',
  cardFrontImage: '',
  cardBackImage: '',
  notes: '',
  owner: '',
};

function createFormData(initialData?: CreditCardWithAccount): CardFormData {
  if (!initialData) {
    return { ...defaultFormData };
  }

  return {
    accountMode: 'existing',
    existingAccountSyncId: initialData.accountSyncId,
    accountName: initialData.account.accountName,
    name: initialData.name,
    bank: initialData.account.bank,
    cardNumber: initialData.cardNumber || '',
    cvv: initialData.cvv || '',
    expiryDate: initialData.expiryDate || '',
    cardholderName: initialData.cardholderName || '',
    creditLimit: initialData.account.sharedLimit.toString(),
    billingDay: initialData.account.billingDay.toString(),
    paymentDueDay: initialData.account.paymentDueDay.toString(),
    color: initialData.color,
    cardFrontImage: initialData.cardFrontImage || '',
    cardBackImage: initialData.cardBackImage || '',
    notes: initialData.notes || '',
    owner: initialData.owner || '',
  };
}

// 格式化卡号（每4位加空格）
function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 19);
  const groups = cleaned.match(/.{1,4}/g) || [];
  return groups.join(' ');
}

// 格式化有效期（MM/YY）
function formatExpiryDate(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
  }
  return cleaned;
}

// 压缩图片
async function compressImage(file: File, maxSizeKB: number = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // 限制最大尺寸
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CardForm({ accounts = [], initialData, onSubmit, onCancel, submitText = '保存' }: CardFormProps) {
  const [formData, setFormData] = useState<CardFormData>(() => createFormData(initialData));
  const [errors, setErrors] = useState<Partial<Record<keyof CardFormData, string>>>({});
  const frontImageRef = useRef<HTMLInputElement>(null);
  const backImageRef = useRef<HTMLInputElement>(null);
  const [showCvv, setShowCvv] = useState(false);

  const selectedAccount = formData.existingAccountSyncId
    ? accounts.find(account => account.syncId === formData.existingAccountSyncId)
    : undefined;
  const isEditingCurrentAccount = !!initialData
    && formData.accountMode === 'existing'
    && formData.existingAccountSyncId === initialData.accountSyncId;
  const sharedFieldsDisabled = formData.accountMode === 'existing' && !isEditingCurrentAccount;

  const applyAccountToForm = (account: CreditAccount) => {
    setFormData(prev => ({
      ...prev,
      accountMode: 'existing',
      existingAccountSyncId: account.syncId,
      accountName: account.accountName,
      bank: account.bank,
      creditLimit: account.sharedLimit.toString(),
      billingDay: account.billingDay.toString(),
      paymentDueDay: account.paymentDueDay.toString(),
    }));
  };

  const handleAccountModeChange = (mode: 'new' | 'existing') => {
    setErrors(prev => ({
      ...prev,
      accountMode: undefined,
      existingAccountSyncId: undefined,
      accountName: undefined,
      bank: undefined,
      creditLimit: undefined,
      billingDay: undefined,
      paymentDueDay: undefined,
    }));

    if (mode === 'existing') {
      const preferredAccount = initialData
        ? accounts.find(account => account.syncId === initialData.accountSyncId)
        : selectedAccount;
      const fallbackAccount = preferredAccount || accounts[0];

      if (fallbackAccount) {
        applyAccountToForm(fallbackAccount);
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      accountMode: mode,
      existingAccountSyncId: mode === 'new' ? '' : prev.existingAccountSyncId,
      accountName: mode === 'new' && !prev.accountName.trim()
        ? buildDefaultAccountName(prev.bank, prev.owner)
        : prev.accountName,
    }));
  };

  const handleExistingAccountChange = (syncId: string) => {
    const account = accounts.find(item => item.syncId === syncId);
    if (!account) return;

    applyAccountToForm(account);
    if (errors.existingAccountSyncId) {
      setErrors(prev => ({ ...prev, existingAccountSyncId: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CardFormData, string>> = {};

    if (formData.accountMode === 'existing' && !formData.existingAccountSyncId) {
      newErrors.existingAccountSyncId = '请选择共享额度账户';
    }

    if (!formData.bank.trim()) newErrors.bank = '请输入银行名称';
    if (!formData.name.trim()) newErrors.name = '请输入卡片名称';

    const cardNum = formData.cardNumber.replace(/\s/g, '');
    if (cardNum && !/^\d{13,19}$/.test(cardNum)) {
      newErrors.cardNumber = '请输入13-19位卡号';
    }
    
    if (formData.cvv && !/^\d{3,4}$/.test(formData.cvv)) {
      newErrors.cvv = '请输入3-4位CVV';
    }
    
    if (formData.expiryDate && !/^\d{2}\/\d{2}$/.test(formData.expiryDate)) {
      newErrors.expiryDate = '格式：MM/YY';
    }
    
    const limit = parseInt(formData.creditLimit, 10);
    if (!formData.creditLimit || Number.isNaN(limit) || limit <= 0) {
      newErrors.creditLimit = '请输入有效的共享额度';
    }
    
    const billingDay = parseInt(formData.billingDay, 10);
    if (!formData.billingDay || Number.isNaN(billingDay) || billingDay < 1 || billingDay > 28) {
      newErrors.billingDay = '1-28';
    }
    
    const paymentDay = parseInt(formData.paymentDueDay, 10);
    if (!formData.paymentDueDay || Number.isNaN(paymentDay) || paymentDay < 1 || paymentDay > 28) {
      newErrors.paymentDueDay = '1-28';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        ...formData,
        accountName: formData.accountName.trim() || buildDefaultAccountName(formData.bank, formData.owner),
        bank: formData.bank.trim(),
        name: formData.name.trim(),
        owner: formData.owner?.trim() || '',
        cardNumber: formData.cardNumber.replace(/\s/g, '')
      });
    }
  };

  const handleChange = (field: keyof CardFormData, value: string) => {
    let processedValue = value;
    
    if (field === 'cardNumber') {
      processedValue = formatCardNumber(value);
    } else if (field === 'expiryDate') {
      processedValue = formatExpiryDate(value);
    } else if (field === 'cvv') {
      processedValue = value.replace(/\D/g, '').slice(0, 4);
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'cardFrontImage' | 'cardBackImage'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressed = await compressImage(file);
      setFormData(prev => ({ ...prev, [field]: compressed }));
    } catch (err) {
      console.error('图片处理失败:', err);
    }
  };

  const removeImage = (field: 'cardFrontImage' | 'cardBackImage') => {
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 共享额度账户 */}
      <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
        <div className="flex items-center gap-2 text-blue-700">
          <CreditCard size={18} />
          <h3 className="text-sm font-semibold">共享额度账户</h3>
        </div>

        {accounts.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleAccountModeChange('existing')}
              className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                formData.accountMode === 'existing'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-50'
              }`}
            >
              使用已有账户
            </button>
            <button
              type="button"
              onClick={() => handleAccountModeChange('new')}
              className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                formData.accountMode === 'new'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-50'
              }`}
            >
              新建共享账户
            </button>
          </div>
        )}

        {formData.accountMode === 'existing' && accounts.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择共享账户</label>
            <select
              value={formData.existingAccountSyncId || ''}
              onChange={e => handleExistingAccountChange(e.target.value)}
              className={inputClass}
            >
              <option value="">请选择共享账户</option>
              {accounts.map(account => (
                <option key={account.syncId} value={account.syncId}>
                  {account.accountName} · {account.bank} · ¥{account.sharedLimit.toLocaleString('zh-CN')}
                </option>
              ))}
            </select>
            {errors.existingAccountSyncId && <p className="text-red-500 text-xs mt-1">{errors.existingAccountSyncId}</p>}
            <p className="text-xs text-gray-500 mt-2">
              {isEditingCurrentAccount
                ? '当前正在编辑该共享账户的额度与还款规则，修改后会影响关联的所有卡片。'
                : '选择已有共享账户后，新卡会沿用该账户的额度和账单规则，不会重复计入总额度。'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">共享账户名称</label>
          <input
            type="text"
            value={formData.accountName}
            onChange={e => handleChange('accountName', e.target.value)}
            disabled={sharedFieldsDisabled}
            placeholder="如：招行共享额度"
            className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`}
          />
          {errors.accountName && <p className="text-red-500 text-xs mt-1">{errors.accountName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">银行名称 *</label>
          <input
            type="text"
            value={formData.bank}
            onChange={e => handleChange('bank', e.target.value)}
            disabled={sharedFieldsDisabled}
            placeholder="如：招商银行"
            className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`}
          />
          {errors.bank && <p className="text-red-500 text-xs mt-1">{errors.bank}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">共享额度 (元) *</label>
          <input
            type="text"
            inputMode="numeric"
            value={formData.creditLimit}
            onChange={e => handleChange('creditLimit', e.target.value.replace(/\D/g, ''))}
            disabled={sharedFieldsDisabled}
            placeholder="50000"
            className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`}
          />
          {errors.creditLimit && <p className="text-red-500 text-xs mt-1">{errors.creditLimit}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账单日 *</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={formData.billingDay}
              onChange={e => handleChange('billingDay', e.target.value.replace(/\D/g, ''))}
              disabled={sharedFieldsDisabled}
              placeholder="5"
              className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`}
            />
            {errors.billingDay && <p className="text-red-500 text-xs mt-1">{errors.billingDay}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">还款日 *</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={formData.paymentDueDay}
              onChange={e => handleChange('paymentDueDay', e.target.value.replace(/\D/g, ''))}
              disabled={sharedFieldsDisabled}
              placeholder="25"
              className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`}
            />
            {errors.paymentDueDay && <p className="text-red-500 text-xs mt-1">{errors.paymentDueDay}</p>}
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">卡片名称 *</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="如：Visa 卡、附属卡"
            className={inputClass}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">归属人</label>
          <input
            type="text"
            value={formData.owner || ''}
            onChange={e => handleChange('owner', e.target.value)}
            placeholder="如：本人、配偶、父母"
            className={inputClass}
          />
        </div>
      </div>

      {/* 卡片信息 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-600">卡片信息</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">卡号</label>
          <input
            type="text"
            inputMode="numeric"
            value={formData.cardNumber}
            onChange={e => handleChange('cardNumber', e.target.value)}
            placeholder="1234 5678 9012 3456"
            className={`${inputClass} font-mono tracking-wider`}
          />
          {errors.cardNumber && <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">有效期</label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.expiryDate}
              onChange={e => handleChange('expiryDate', e.target.value)}
              placeholder="MM/YY"
              maxLength={5}
              className={inputClass}
            />
            {errors.expiryDate && <p className="text-red-500 text-xs mt-1">{errors.expiryDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
            <div className="relative">
              <input
                type={showCvv ? 'text' : 'password'}
                inputMode="numeric"
                value={formData.cvv}
                onChange={e => handleChange('cvv', e.target.value)}
                placeholder="***"
                maxLength={4}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowCvv(!showCvv)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600 p-1"
              >
                {showCvv ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">持卡人姓名</label>
          <input
            type="text"
            value={formData.cardholderName}
            onChange={e => handleChange('cardholderName', e.target.value)}
            placeholder="ZHANG SAN"
            className={inputClass}
          />
        </div>
      </div>

      {/* 卡片照片 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-600">卡片照片</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input
              ref={frontImageRef}
              type="file"
              accept="image/*"
              onChange={e => handleImageUpload(e, 'cardFrontImage')}
              className="hidden"
            />
            {formData.cardFrontImage ? (
              <div className="relative">
                <img src={formData.cardFrontImage} alt="卡片正面" className="w-full h-24 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => removeImage('cardFrontImage')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => frontImageRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 active:bg-gray-50"
              >
                <Camera size={24} />
                <span className="text-xs mt-1">正面</span>
              </button>
            )}
          </div>
          <div>
            <input
              ref={backImageRef}
              type="file"
              accept="image/*"
              onChange={e => handleImageUpload(e, 'cardBackImage')}
              className="hidden"
            />
            {formData.cardBackImage ? (
              <div className="relative">
                <img src={formData.cardBackImage} alt="卡片背面" className="w-full h-24 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => removeImage('cardBackImage')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => backImageRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 active:bg-gray-50"
              >
                <Camera size={24} />
                <span className="text-xs mt-1">背面</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 卡片颜色 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">卡片颜色</label>
        <div className="flex gap-3">
          {colorOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange('color', option.value)}
              className={`w-10 h-10 rounded-full ${option.class} transition-all
                ${formData.color === option.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
              aria-label={option.label}
            />
          ))}
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
        <textarea
          value={formData.notes || ''}
          onChange={e => handleChange('notes', e.target.value)}
          placeholder="其他信息..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* 按钮 */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium active:bg-gray-100 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-medium active:bg-blue-600 transition-colors"
        >
          {submitText}
        </button>
      </div>
    </form>
  );
}
