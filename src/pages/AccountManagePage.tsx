import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Trash2, Wallet } from 'lucide-react';
import { useCards } from '../hooks/useCards';
import { toChineseErrorMessage } from '../utils/errorMessages';

export function AccountManagePage() {
  const navigate = useNavigate();
  const { accounts, cards, deleteUnusedAccount } = useCards();
  const [deletingSyncId, setDeletingSyncId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const accountSummaries = useMemo(() => {
    return accounts.map(account => {
      const activeCardCount = cards.filter(card => card.account.syncId === account.syncId).length;
      return {
        ...account,
        activeCardCount,
      };
    });
  }, [accounts, cards]);

  const handleDeleteAccount = async (accountSyncId: string, accountName: string) => {
    const shouldDelete = confirm(`确定删除共享账户「${accountName}」吗？仅当没有卡片在使用时才允许删除。`);
    if (!shouldDelete) return;

    setDeletingSyncId(accountSyncId);
    setMessage(null);
    setMessageIsError(false);

    try {
      await deleteUnusedAccount(accountSyncId);
      setMessage(`共享账户「${accountName}」已删除`);
      setMessageIsError(false);
    } catch (error) {
      setMessage(toChineseErrorMessage(error, '删除共享账户失败，请稍后重试'));
      setMessageIsError(true);
    } finally {
      setDeletingSyncId(null);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full active:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-800">共享账户管理</h1>
          <p className="text-xs text-gray-500">共 {accountSummaries.length} 个共享账户</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 leading-6">
            这里可以查看所有共享额度账户。只有当账户下没有在用卡片时，才允许删除该账户。
          </p>
          {message && (
            <p className={`text-sm mt-3 ${messageIsError ? 'text-red-500' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </div>

        {accountSummaries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Wallet size={42} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">当前还没有共享账户</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accountSummaries.map(account => {
              const isDeleting = deletingSyncId === account.syncId;
              const canDelete = account.activeCardCount === 0;

              return (
                <div key={account.syncId} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet size={18} className="text-blue-500 flex-shrink-0" />
                        <h2 className="font-medium text-gray-800 truncate">{account.accountName}</h2>
                      </div>
                      <div className="space-y-1 text-sm text-gray-500">
                        <p>银行：{account.bank}</p>
                        <p>归属人：{account.owner || '未设置'}</p>
                        <p>共享额度：¥{account.sharedLimit.toLocaleString('zh-CN')}</p>
                        <p>账单日 / 还款日：每月 {account.billingDay} 日 / {account.paymentDueDay} 日</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                        <CreditCard size={12} />
                        {account.activeCardCount} 张在用卡
                      </div>
                      <button
                        onClick={() => handleDeleteAccount(account.syncId, account.accountName)}
                        disabled={!canDelete || isDeleting}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
                          canDelete
                            ? 'border border-red-200 text-red-500 active:bg-red-50 disabled:opacity-50'
                            : 'border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 size={14} />
                        {isDeleting ? '删除中...' : '删除账户'}
                      </button>
                    </div>
                  </div>

                  <p className={`text-xs mt-4 ${canDelete ? 'text-amber-600' : 'text-gray-400'}`}>
                    {canDelete
                      ? '该账户当前没有在用卡片，可以安全删除。'
                      : '该账户仍被卡片使用中，如需删除，请先将相关卡片切换到其他共享账户或删除卡片。'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
