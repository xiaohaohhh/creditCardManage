import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clipboard, RefreshCw, Trash2 } from 'lucide-react';
import { logger, type LogEntry } from '../utils/logger';

function formatLogDetails(details: string[]): string {
  if (details.length === 0) {
    return '';
  }

  return details.join('\n\n');
}

function buildClipboardText(logs: LogEntry[]): string {
  return logs.map(log => {
    const details = formatLogDetails(log.details);
    return [`[${log.time}] [${log.level}] [${log.module}] ${log.message}`, details].filter(Boolean).join('\n');
  }).join('\n\n--------------------\n\n');
}

const levelColorClass: Record<LogEntry['level'], string> = {
  DEBUG: 'text-gray-500 bg-gray-100',
  INFO: 'text-blue-600 bg-blue-50',
  WARN: 'text-amber-600 bg-amber-50',
  ERROR: 'text-red-600 bg-red-50',
};

export function LogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState(() => logger.getLogs());
  const [copyMessage, setCopyMessage] = useState('');

  const logCountText = useMemo(() => `共 ${logs.length} 条日志`, [logs.length]);

  const refreshLogs = () => {
    setLogs(logger.getLogs());
    setCopyMessage('');
  };

  const clearLogs = () => {
    logger.clearLogs();
    setLogs([]);
    setCopyMessage('日志已清空');
  };

  const copyLogs = async () => {
    if (logs.length === 0) {
      setCopyMessage('当前没有可复制的日志');
      return;
    }

    try {
      await navigator.clipboard.writeText(buildClipboardText(logs));
      setCopyMessage('日志已复制到剪贴板');
    } catch {
      setCopyMessage('复制失败，请手动截图或使用浏览器控制台');
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full active:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">运行日志</h1>
            <p className="text-xs text-gray-500">{logCountText}</p>
          </div>
        </div>
        <button
          onClick={refreshLogs}
          className="p-2 rounded-full active:bg-gray-100 transition-colors"
          aria-label="刷新日志"
        >
          <RefreshCw size={18} className="text-gray-600" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm text-gray-500">
            这里会保存前端运行日志、同步日志以及未捕获异常，方便排查线上问题。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={copyLogs}
              className="py-3 rounded-xl border border-gray-200 text-gray-700 font-medium active:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <Clipboard size={18} />
              复制日志
            </button>
            <button
              onClick={clearLogs}
              className="py-3 rounded-xl border border-red-200 text-red-500 font-medium active:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              清空日志
            </button>
          </div>
          {copyMessage && <p className="text-sm text-blue-600">{copyMessage}</p>}
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-gray-500">当前还没有日志记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColorClass[log.level]}`}>
                      {log.level}
                    </span>
                    <span className="text-xs text-gray-400">{log.time}</span>
                    <span className="text-xs text-gray-500 truncate">{log.module}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{log.message}</p>
                {log.details.length > 0 && (
                  <pre className="mt-3 text-xs text-gray-500 whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3 overflow-x-auto">
                    {formatLogDetails(log.details)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
