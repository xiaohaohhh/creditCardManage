import { db } from '../db';

interface DatabaseExportResult {
  fileName: string;
  recordCount: number;
  tableCount: number;
}

interface DatabaseExportPayload {
  exportVersion: number;
  exportedAt: string;
  indexedDB: {
    name: string;
    version: number;
    tables: Record<string, unknown[]>;
  };
  localStorage: {
    deviceId: string | null;
    lastSyncAt: string | null;
    serverUrl: string | null;
  };
}

interface DatabaseImportResult {
  exportedAt: string;
  recordCount: number;
  tableCount: number;
}

interface DatabaseExportOptions {
  filePrefix?: string;
}

function createExportFileName(date: Date, filePrefix: string): string {
  const formatted = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');

  const time = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join('-');

  return `${filePrefix}-${formatted}_${time}.json`;
}

async function buildExportPayload(): Promise<DatabaseExportPayload> {
  const tables = await Promise.all(
    db.tables.map(async table => [table.name, await table.toArray()] as const)
  );

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    indexedDB: {
      name: db.name,
      version: db.verno,
      tables: Object.fromEntries(tables)
    },
    localStorage: {
      deviceId: localStorage.getItem('deviceId'),
      lastSyncAt: localStorage.getItem('lastSyncAt'),
      serverUrl: localStorage.getItem('serverUrl')
    }
  };
}

function downloadJsonFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown, fallback: Date = new Date()): Date {
  if (value instanceof Date) return value;

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return fallback;
}

function normalizeCards(rows: unknown[]): Record<string, unknown>[] {
  return rows.map(row => {
    if (!isRecord(row)) {
      throw new Error('导入文件中的卡片数据格式无效');
    }

    return {
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
      ...(row.lastSyncAt !== undefined ? { lastSyncAt: parseDate(row.lastSyncAt) } : {})
    };
  });
}

function normalizeSettings(rows: unknown[]): Record<string, unknown>[] {
  return rows.map(row => {
    if (!isRecord(row)) {
      throw new Error('导入文件中的设置数据格式无效');
    }

    return {
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt)
    };
  });
}

function normalizeRowsForTable(tableName: string, rows: unknown[]): Record<string, unknown>[] {
  switch (tableName) {
    case 'cards':
      return normalizeCards(rows);
    case 'settings':
      return normalizeSettings(rows);
    default:
      return rows.map(row => {
        if (!isRecord(row)) {
          throw new Error(`导入文件中的 ${tableName} 表数据格式无效`);
        }

        return row;
      });
  }
}

function parseImportPayload(text: string): DatabaseExportPayload {
  const payload = JSON.parse(text) as unknown;

  if (!isRecord(payload)) {
    throw new Error('导入文件不是有效的 JSON 对象');
  }

  const { exportVersion, exportedAt, indexedDB, localStorage } = payload;

  if (exportVersion !== 1) {
    throw new Error('暂不支持该导出文件版本');
  }

  if (typeof exportedAt !== 'string') {
    throw new Error('导入文件缺少导出时间');
  }

  if (!isRecord(indexedDB) || typeof indexedDB.name !== 'string' || !isRecord(indexedDB.tables)) {
    throw new Error('导入文件中的数据库内容格式无效');
  }

  if (indexedDB.name !== db.name) {
    throw new Error(`该文件属于 ${indexedDB.name}，不能导入到当前数据库 ${db.name}`);
  }

  if (!isRecord(localStorage)) {
    throw new Error('导入文件中的本地配置格式无效');
  }

  return {
    exportVersion,
    exportedAt,
    indexedDB: {
      name: indexedDB.name,
      version: typeof indexedDB.version === 'number' ? indexedDB.version : db.verno,
      tables: indexedDB.tables as Record<string, unknown[]>
    },
    localStorage: {
      deviceId: typeof localStorage.deviceId === 'string' ? localStorage.deviceId : null,
      lastSyncAt: typeof localStorage.lastSyncAt === 'string' ? localStorage.lastSyncAt : null,
      serverUrl: typeof localStorage.serverUrl === 'string' ? localStorage.serverUrl : null
    }
  };
}

function restoreLocalStorageValue(key: string, value: string | null) {
  if (value === null) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, value);
}

/**
 * 导出本地 IndexedDB 与相关本地配置为 JSON 文件
 */
export async function exportDatabaseAsJson(options: DatabaseExportOptions = {}): Promise<DatabaseExportResult> {
  const exportDate = new Date();
  const payload = await buildExportPayload();
  const jsonContent = JSON.stringify(payload, null, 2);
  const fileName = createExportFileName(
    exportDate,
    options.filePrefix || 'credit-card-manager-export'
  );
  const recordCount = Object.values(payload.indexedDB.tables)
    .reduce((sum, rows) => sum + rows.length, 0);

  downloadJsonFile(fileName, jsonContent);

  return {
    fileName,
    recordCount,
    tableCount: Object.keys(payload.indexedDB.tables).length
  };
}

/**
 * 从 JSON 备份文件恢复本地 IndexedDB 与相关本地配置
 */
export async function importDatabaseFromJson(file: File): Promise<DatabaseImportResult> {
  const text = await file.text();
  const payload = parseImportPayload(text);

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rawRows = payload.indexedDB.tables[table.name];
      const rows = Array.isArray(rawRows)
        ? normalizeRowsForTable(table.name, rawRows)
        : [];

      await table.clear();

      if (rows.length > 0) {
        await table.bulkAdd(rows);
      }
    }
  });

  restoreLocalStorageValue('deviceId', payload.localStorage.deviceId);
  restoreLocalStorageValue('lastSyncAt', payload.localStorage.lastSyncAt);
  restoreLocalStorageValue('serverUrl', payload.localStorage.serverUrl);

  return {
    exportedAt: payload.exportedAt,
    recordCount: Object.values(payload.indexedDB.tables)
      .reduce((sum, rows) => sum + rows.length, 0),
    tableCount: Object.keys(payload.indexedDB.tables).length
  };
}
