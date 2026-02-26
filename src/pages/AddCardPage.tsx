import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CardForm } from '../components/CardForm';
import { useCards } from '../hooks/useCards';
import type { CardFormData } from '../types';

export function AddCardPage() {
  const navigate = useNavigate();
  const { addCard } = useCards();
  
  const handleSubmit = async (data: CardFormData) => {
    await addCard(data);
    navigate('/');
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full active:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">添加信用卡</h1>
      </div>
      
      {/* 表单 */}
      <div className="p-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <CardForm
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
            submitText="添加"
          />
        </div>
      </div>
    </div>
  );
}
