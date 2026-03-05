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

function getLogLevel(): LogLevel {
  try {
    const level = localStorage.getItem('LOG_LEVEL')?.toUpperCase() as LogLevel;
    if (level && LEVEL_ORDER[level] !== undefined) return level;
  } catch {
    // localStorage 不可用
  }
  return 'INFO'; // 默认 INFO
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getLogLevel()];
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + 
    String(now.getMilliseconds()).padStart(3, '0');
}

function log(level: LogLevel, module: string, message: string, ...args: unknown[]) {
  if (!shouldLog(level)) return;

  const time = formatTime();
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

export const logger = {
  debug: (module: string, message: string, ...args: unknown[]) => log('DEBUG', module, message, ...args),
  info: (module: string, message: string, ...args: unknown[]) => log('INFO', module, message, ...args),
  warn: (module: string, message: string, ...args: unknown[]) => log('WARN', module, message, ...args),
  error: (module: string, message: string, ...args: unknown[]) => log('ERROR', module, message, ...args),

  /** 快捷方式：设置日志级别 */
  setLevel: (level: LogLevel) => {
    localStorage.setItem('LOG_LEVEL', level);
    console.info(`[Logger] 日志级别已设置为 ${level}`);
  },
};
