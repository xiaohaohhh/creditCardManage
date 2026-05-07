/**
 * 前端日志系统
 *
 * 日志级别: DEBUG < INFO < WARN < ERROR
 *
 * 设置方式:
 * - localStorage.setItem('LOG_LEVEL', 'DEBUG')  // 开启 debug 日志
 * - localStorage.setItem('LOG_LEVEL', 'INFO')   // 默认，只显示 info 及以上
 * - localStorage.setItem('LOG_LEVEL', 'WARN')   // 只显示警告和错误
 * - localStorage.setItem('LOG_LEVEL', 'ERROR')  // 只显示错误
 *
 * 使用: import { logger } from '../utils/logger';
 *       logger.debug('sync', '详细信息', data);
 *       logger.info('sync', '操作完成');
 *       logger.warn('sync', '注意', detail);
 *       logger.error('sync', '失败', error);
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: number;
  time: string;
  level: LogLevel;
  module: string;
  message: string;
  details: string[];
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG: 'color: #8B8B8B',
  INFO: 'color: #2196F3',
  WARN: 'color: #FF9800',
  ERROR: 'color: #F44336; font-weight: bold',
};

const LOG_STORAGE_KEY = 'APP_RUNTIME_LOGS';
const MAX_LOG_ENTRIES = 300;

let globalErrorHandlersInstalled = false;

function getLogLevel(): LogLevel {
  try {
    const level = localStorage.getItem('LOG_LEVEL')?.toUpperCase() as LogLevel;
    if (level && LEVEL_ORDER[level] !== undefined) return level;
  } catch {
    // localStorage 不可用
  }
  return 'INFO';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getLogLevel()];
}

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('zh-CN', { hour12: false }) + '.' +
    String(date.getMilliseconds()).padStart(3, '0');
}

function safeSerialize(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined) {
    return 'undefined';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readStoredLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is LogEntry => (
      typeof entry === 'object'
      && entry !== null
      && typeof (entry as LogEntry).id === 'string'
      && typeof (entry as LogEntry).timestamp === 'number'
      && typeof (entry as LogEntry).time === 'string'
      && typeof (entry as LogEntry).level === 'string'
      && typeof (entry as LogEntry).module === 'string'
      && typeof (entry as LogEntry).message === 'string'
      && Array.isArray((entry as LogEntry).details)
    ));
  } catch {
    return [];
  }
}

function writeStoredLogs(entries: LogEntry[]) {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries.slice(-MAX_LOG_ENTRIES)));
  } catch {
    // localStorage 不可用或超限时忽略
  }
}

function appendLog(entry: LogEntry) {
  const entries = readStoredLogs();
  entries.push(entry);
  writeStoredLogs(entries);
}

function log(level: LogLevel, module: string, message: string, ...args: unknown[]) {
  const now = new Date();
  const time = formatTime(now);
  const serializedArgs = args.map(safeSerialize);
  const entry: LogEntry = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now.getTime(),
    time,
    level,
    module,
    message,
    details: serializedArgs,
  };

  appendLog(entry);

  if (!shouldLog(level)) return;

  const prefix = `%c[${time}] [${level}] [${module}]`;
  const style = LEVEL_STYLES[level];

  switch (level) {
    case 'DEBUG':
      console.debug(prefix, style, message, ...args);
      break;
    case 'INFO':
      console.info(prefix, style, message, ...args);
      break;
    case 'WARN':
      console.warn(prefix, style, message, ...args);
      break;
    case 'ERROR':
      console.error(prefix, style, message, ...args);
      break;
  }
}

function installGlobalErrorHandlers() {
  if (globalErrorHandlersInstalled || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', event => {
    log('ERROR', 'global', event.message || '发生未捕获异常', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error instanceof Error ? safeSerialize(event.error) : event.error,
    });
  });

  window.addEventListener('unhandledrejection', event => {
    log('ERROR', 'global', '发生未处理的异步异常', event.reason);
  });

  globalErrorHandlersInstalled = true;
}

export const logger = {
  debug: (module: string, message: string, ...args: unknown[]) => log('DEBUG', module, message, ...args),
  info: (module: string, message: string, ...args: unknown[]) => log('INFO', module, message, ...args),
  warn: (module: string, message: string, ...args: unknown[]) => log('WARN', module, message, ...args),
  error: (module: string, message: string, ...args: unknown[]) => log('ERROR', module, message, ...args),

  getLogs: (): LogEntry[] => readStoredLogs().sort((a, b) => b.timestamp - a.timestamp),
  clearLogs: () => writeStoredLogs([]),
  installGlobalErrorHandlers,

  /** 快捷方式：设置日志级别 */
  setLevel: (level: LogLevel) => {
    localStorage.setItem('LOG_LEVEL', level);
    console.info(`[Logger] 日志级别已设置为 ${level}`);
  },

  getLevel: (): LogLevel => getLogLevel(),
};
