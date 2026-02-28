import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { CardForm } from '../components/CardForm';
import { useCards } from '../hooks/useCards';
import type { CreditCard, CardFormData } from '../types';

export function EditCardPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getCard, updateCard, deleteCard } = useCards();
  const [card, setCard] = useState<CreditCard | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  useEffect(() => {
    if (id) {
      getCard(parseInt(id, 10)).then(c => {
        if (c) setCard(c);
        else navigate('/');
      });
    }
  }, [id]);
  
  const handleSubmit = async (data: CardFormData) => {
    if (id) {
      await updateCard(parseInt(id, 10), data);
      navigate('/');
    }
  };
  
  const handleDelete = async () => {
    if (id) {
      await deleteCard(parseInt(id, 10));
      navigate('/');
    }
  };

  if (!card) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full active:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">编辑卡片</h1>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 rounded-full active:bg-red-50 transition-colors"
        >
          <Trash2 size={22} className="text-red-500" />
        </button>
      </div>
      
      {/* 表单 */}
      <div className="p-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <CardForm
            initialData={card}
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
            submitText="保存修改"
          />
        </div>
      </div>
      
      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认删除</h3>
            <p className="text-gray-600 mb-4">
              确定要删除「{card.name}」吗？此操作无法撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 
                  font-medium active:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium 
                  active:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
