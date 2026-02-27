import { useState, useEffect, useRef } from 'react';
import { Camera, X, Eye, EyeOff } from 'lucide-react';
import type { CardFormData, CardColor, CreditCard } from '../types';

interface CardFormProps {
  initialData?: CreditCard;
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

// 格式化卡号（每4位加空格）
function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
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
    reader.onload = (e) => {
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
        
        // 尝试不同质量压缩
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

export function CardForm({ initialData, onSubmit, onCancel, submitText = '保存' }: CardFormProps) {
  const [formData, setFormData] = useState<CardFormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof CardFormData, string>>>({});
  const frontImageRef = useRef<HTMLInputElement>(null);
  const backImageRef = useRef<HTMLInputElement>(null);
  const [showCvv, setShowCvv] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        bank: initialData.bank,
        cardNumber: initialData.cardNumber || '',
        cvv: initialData.cvv || '',
        expiryDate: initialData.expiryDate || '',
        cardholderName: initialData.cardholderName || '',
        creditLimit: initialData.creditLimit.toString(),
        billingDay: initialData.billingDay.toString(),
        paymentDueDay: initialData.paymentDueDay.toString(),
        color: initialData.color,
        cardFrontImage: initialData.cardFrontImage || '',
        cardBackImage: initialData.cardBackImage || '',
        notes: initialData.notes || '',
        owner: initialData.owner || '',
      });
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CardFormData, string>> = {};
    
    if (!formData.name.trim()) newErrors.name = '请输入卡片名称';
    if (!formData.bank.trim()) newErrors.bank = '请输入银行名称';
    
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
    if (!formData.creditLimit || isNaN(limit) || limit <= 0) {
      newErrors.creditLimit = '请输入有效的信用额度';
    }
    
    const billingDay = parseInt(formData.billingDay, 10);
    if (!formData.billingDay || isNaN(billingDay) || billingDay < 1 || billingDay > 28) {
      newErrors.billingDay = '1-28';
    }
    
    const paymentDay = parseInt(formData.paymentDueDay, 10);
    if (!formData.paymentDueDay || isNaN(paymentDay) || paymentDay < 1 || paymentDay > 28) {
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

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">卡片名称 *</label>
          <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)}
            placeholder="如：招行信用卡" className={inputClass} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        

      {/* 归属人 */}
      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">归属人</label>
        <input type="text" value={formData.owner || ''} onChange={e => handleChange('owner', e.target.value)}
          placeholder="如：本人、配偶、父母" className={inputClass} />
      </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">银行名称 *</label>
          <input type="text" value={formData.bank} onChange={e => handleChange('bank', e.target.value)}
            placeholder="如：招商银行" className={inputClass} />
          {errors.bank && <p className="text-red-500 text-xs mt-1">{errors.bank}</p>}
        </div>
      </div>

      {/* 卡片信息 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-600">卡片信息</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">卡号</label>
          <input type="text" inputMode="numeric" value={formData.cardNumber}
            onChange={e => handleChange('cardNumber', e.target.value)}
            placeholder="1234 5678 9012 3456" className={`${inputClass} font-mono tracking-wider`} />
          {errors.cardNumber && <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">有效期</label>
            <input type="text" inputMode="numeric" value={formData.expiryDate}
              onChange={e => handleChange('expiryDate', e.target.value)}
              placeholder="MM/YY" maxLength={5} className={inputClass} />
            {errors.expiryDate && <p className="text-red-500 text-xs mt-1">{errors.expiryDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
            <div className="relative">
              <input type={showCvv ? 'text' : 'password'} inputMode="numeric" value={formData.cvv}
                onChange={e => handleChange('cvv', e.target.value)}
                placeholder="***" maxLength={4} className={`${inputClass} pr-10`} />
              <button type="button" onClick={() => setShowCvv(!showCvv)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600 p-1">
                {showCvv ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">持卡人姓名</label>
          <input type="text" value={formData.cardholderName}
            onChange={e => handleChange('cardholderName', e.target.value)}
            placeholder="ZHANG SAN" className={inputClass} />
        </div>
      </div>

      {/* 额度和日期 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">信用额度 (元) *</label>
        <input type="text" inputMode="numeric" value={formData.creditLimit}
          onChange={e => handleChange('creditLimit', e.target.value.replace(/\D/g, ''))}
          placeholder="50000" className={inputClass} />
        {errors.creditLimit && <p className="text-red-500 text-xs mt-1">{errors.creditLimit}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">账单日 *</label>
          <input type="text" inputMode="numeric" maxLength={2} value={formData.billingDay}
            onChange={e => handleChange('billingDay', e.target.value.replace(/\D/g, ''))}
            placeholder="5" className={inputClass} />
          {errors.billingDay && <p className="text-red-500 text-xs mt-1">{errors.billingDay}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">还款日 *</label>
          <input type="text" inputMode="numeric" maxLength={2} value={formData.paymentDueDay}
            onChange={e => handleChange('paymentDueDay', e.target.value.replace(/\D/g, ''))}
            placeholder="25" className={inputClass} />
          {errors.paymentDueDay && <p className="text-red-500 text-xs mt-1">{errors.paymentDueDay}</p>}
        </div>
      </div>

      {/* 卡片照片 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-600">卡片照片</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* 正面 */}
          <div>
            <input ref={frontImageRef} type="file" accept="image/*"
              onChange={e => handleImageUpload(e, 'cardFrontImage')} className="hidden" />
            {formData.cardFrontImage ? (
              <div className="relative">
                <img src={formData.cardFrontImage} alt="卡片正面" 
                  className="w-full h-24 object-cover rounded-xl" />
                <button type="button" onClick={() => removeImage('cardFrontImage')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => frontImageRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 active:bg-gray-50">
                <Camera size={24} />
                <span className="text-xs mt-1">正面</span>
              </button>
            )}
          </div>
          {/* 背面 */}
          <div>
            <input ref={backImageRef} type="file" accept="image/*"
              onChange={e => handleImageUpload(e, 'cardBackImage')} className="hidden" />
            {formData.cardBackImage ? (
              <div className="relative">
                <img src={formData.cardBackImage} alt="卡片背面"
                  className="w-full h-24 object-cover rounded-xl" />
                <button type="button" onClick={() => removeImage('cardBackImage')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => backImageRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 active:bg-gray-50">
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
            <button key={option.value} type="button"
              onClick={() => handleChange('color', option.value)}
              className={`w-10 h-10 rounded-full ${option.class} transition-all
                ${formData.color === option.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
              aria-label={option.label} />
          ))}
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
        <textarea value={formData.notes || ''} onChange={e => handleChange('notes', e.target.value)}
          placeholder="其他信息..." rows={2}
          className={`${inputClass} resize-none`} />
      </div>

      {/* 按钮 */}
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium active:bg-gray-100 transition-colors">
          取消
        </button>
        <button type="submit"
          className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-medium active:bg-blue-600 transition-colors">
          {submitText}
        </button>
      </div>
    </form>
  );
}
