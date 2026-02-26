/**
 * 加密工具模块
 * 使用 Web Crypto API 实现 AES-256-GCM 加密
 * 密钥通过 PBKDF2 从用户主密码派生
 */

// 加密配置
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * 生成随机盐值
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * 生成随机IV
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * 从密码派生加密密钥 (PBKDF2)
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // 导入密码作为原始密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // 使用PBKDF2派生AES密钥
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密数据
 */
export async function encrypt(
  plaintext: string, 
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = generateIV();
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data
  );
  
  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * 解密数据
 */
export async function decrypt(
  ciphertext: string, 
  iv: string, 
  key: CryptoKey
): Promise<string> {
  const encryptedData = base64ToArrayBuffer(ciphertext);
  const ivBuffer = base64ToArrayBuffer(iv);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer.buffer as ArrayBuffer },
    key,
    encryptedData.buffer as ArrayBuffer
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * 计算密码哈希 (用于验证密码正确性)
 */
export async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + arrayBufferToBase64(salt));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * ArrayBuffer 转 Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 转 ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 加密管理器类 - 管理加密状态和操作
 */
export class EncryptionManager {
  private key: CryptoKey | null = null;
  private salt: Uint8Array | null = null;
  
  /**
   * 初始化加密（首次设置密码）
   */
  async initialize(password: string): Promise<{ salt: string; passwordHash: string }> {
    this.salt = generateSalt();
    this.key = await deriveKey(password, this.salt);
    const passwordHash = await hashPassword(password, this.salt);
    
    return {
      salt: arrayBufferToBase64(this.salt),
      passwordHash
    };
  }
  
  /**
   * 解锁加密（使用已有密码）
   */
  async unlock(password: string, saltBase64: string, expectedHash: string): Promise<boolean> {
    this.salt = base64ToArrayBuffer(saltBase64);
    const actualHash = await hashPassword(password, this.salt);
    
    if (actualHash !== expectedHash) {
      this.salt = null;
      return false;
    }
    
    this.key = await deriveKey(password, this.salt);
    return true;
  }
  
  /**
   * 锁定（清除密钥）
   */
  lock(): void {
    this.key = null;
  }
  
  /**
   * 检查是否已解锁
   */
  isUnlocked(): boolean {
    return this.key !== null;
  }
  
  /**
   * 加密字符串
   */
  async encryptString(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    if (!this.key) {
      throw new Error('加密管理器未解锁');
    }
    return await encrypt(plaintext, this.key);
  }
  
  /**
   * 解密字符串
   */
  async decryptString(ciphertext: string, iv: string): Promise<string> {
    if (!this.key) {
      throw new Error('加密管理器未解锁');
    }
    return await decrypt(ciphertext, iv, this.key);
  }
}

// 全局加密管理器实例
export const encryptionManager = new EncryptionManager();
