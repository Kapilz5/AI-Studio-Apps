

import { CreditCard, BackupPayload } from '../types';

// App Version Definition
export const APP_VERSION = '1.1.0';

// Security Version 6: Local-Only Storage (No Cloud Sync)
const DB_NAME = 'MyCards_SecureVault_v6';
const STORE_NAME = 'vault_store';

// Storage Keys
const KEY_MASTER_ENC_MPIN = 'mk_enc_mpin';
const KEY_MASTER_ENC_SECRET = 'mk_enc_secret';
const KEY_MASTER_ENC_BIO = 'mk_enc_bio';
const KEY_DATA_ENC = 'data_enc';
const KEY_MPIN_HASH = 'mpin_hash';
const KEY_SECRET_HASH = 'secret_hash';
const KEY_BIO_ENABLED = 'bio_enabled';
const KEY_NOTIF_PERIOD = 'notif_period';
const KEY_NOTIFIED_CARDS = 'notified_cards';
const KEY_LAST_SEEN_VERSION = 'last_seen_version';
// Changed to explicit encrypted key to denote it contains ciphertext
const KEY_USER_API_KEY_ENC = 'user_api_key_enc';
const KEY_PRO_STATUS = 'pro_status_v1';
const KEY_ADVISOR_USAGE = 'advisor_usage_v1';

// Crypto Constants
const PBKDF2_ITERATIONS = 600000; // High iteration count for PWA fallback
const SALT_LEN = 16;
const IV_LEN = 12;

/* 
   SECURITY NOTICE: 
   This application is designed for STRICT LOCAL STORAGE only.
   On Native (iOS/Android): Master Key is stored in Hardware Secure Storage (Keychain/Keystore).
   On Web (PWA): Master Key is Encrypted with MPIN and stored in IndexedDB.
*/

// --- Helper Functions ---
const toBase64 = (buffer: Uint8Array): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const fromBase64 = (base64: string): Uint8Array => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
};

// Check environment
const isNative = (): boolean => {
  return (window as any).Capacitor?.isNativePlatform() || false;
};

// Wrapper for Capacitor Secure Storage Plugin
const NativeStorage = {
  get: async (key: string): Promise<string | null> => {
    try {
      const { Capacitor } = window as any;
      const plugin = Capacitor?.Plugins?.SecureStoragePlugin;
      if (plugin) {
        const result = await plugin.get({ key });
        return result.value;
      }
    } catch (e) {
      return null;
    }
    return null;
  },
  set: async (key: string, value: string): Promise<void> => {
     try {
      const { Capacitor } = window as any;
      const plugin = Capacitor?.Plugins?.SecureStoragePlugin;
      if (plugin) {
        await plugin.set({ key, value });
      }
    } catch(e) {
      console.error("Native Storage Error", e);
    }
  },
  remove: async (key: string): Promise<void> => {
     try {
      const { Capacitor } = window as any;
      const plugin = Capacitor?.Plugins?.SecureStoragePlugin;
      if (plugin) {
        await plugin.remove({ key });
      }
    } catch(e) { }
  }
};

// --- IndexedDB Wrapper ---
const idb = {
  db: null as IDBDatabase | null,
  async open() {
    if (this.db) return this.db;
    return new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e: any) => {
        this.db = e.target.result;
        resolve(this.db!);
      };
      req.onerror = () => reject(req.error);
    });
  },
  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(key: string, value: any) {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async delete(key: string) {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async clear() {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};

// --- Hashing ---
export const hashString = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.toLowerCase().trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- Key Derivation (PBKDF2) ---
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password.trim()), // Removed toLowerCase for backups to allow case-sensitive strong passwords
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  return window.crypto.subtle.deriveKey(
    { 
      name: "PBKDF2", 
      salt, 
      iterations: PBKDF2_ITERATIONS, 
      hash: "SHA-256" 
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // derived key is non-extractable
    ["encrypt", "decrypt"]
  );
}

// --- Initial Setup ---
export const setupSecurity = async (mpin: string, secretWord: string): Promise<Uint8Array> => {
  // 1. Generate Random Master Key (32 bytes)
  const masterKey = window.crypto.getRandomValues(new Uint8Array(32));

  // 2. Hash credentials for quick verification (comparison only)
  await idb.put(KEY_MPIN_HASH, await hashString(mpin));
  await idb.put(KEY_SECRET_HASH, await hashString(secretWord));

  if (isNative()) {
    // 3A. NATIVE: Store RAW master key in Hardware Secure Storage (Keychain/Keystore)
    // This key is non-exportable from the device hardware.
    await NativeStorage.set('master_key', toBase64(masterKey));
  } else {
    // 3B. PWA: Encrypt Master Key with MPIN and Secret Word (Fallback)
    await encryptAndStoreMasterKey(masterKey, mpin.toLowerCase(), KEY_MASTER_ENC_MPIN);
    await encryptAndStoreMasterKey(masterKey, secretWord.toLowerCase(), KEY_MASTER_ENC_SECRET);
  }
  
  return masterKey;
};

async function encryptAndStoreMasterKey(masterKey: Uint8Array, password: string, storageKey: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
  
  const kek = await deriveKeyFromPassword(password, salt);
  
  const encryptedMasterKey = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, 
    kek, 
    masterKey
  );

  // Store format: [SALT (16)] [IV (12)] [CIPHERTEXT]
  const combined = new Uint8Array(salt.length + iv.length + encryptedMasterKey.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encryptedMasterKey), salt.length + iv.length);
  
  await idb.put(storageKey, combined);
}

// --- Unlock Flows ---
export const unlockWithMPIN = async (mpin: string): Promise<Uint8Array | null> => {
  // Common: Verify MPIN Hash to authenticate user knowledge
  const storedHash = await idb.get<string>(KEY_MPIN_HASH);
  const inputHash = await hashString(mpin);
  
  if (storedHash && storedHash !== inputHash) {
      return null; // Incorrect MPIN
  }

  if (isNative()) {
      // Native: Retrieve from Hardware Secure Storage
      const b64 = await NativeStorage.get('master_key');
      return b64 ? fromBase64(b64) : null;
  } else {
      // PWA: Decrypt blob from IndexedDB
      return await decryptMasterKey(mpin.toLowerCase(), KEY_MASTER_ENC_MPIN);
  }
};

export const unlockWithSecretWord = async (secretWord: string): Promise<Uint8Array | null> => {
  const storedHash = await idb.get<string>(KEY_SECRET_HASH);
  const inputHash = await hashString(secretWord);
  
  if (storedHash && storedHash !== inputHash) {
      return null;
  }

  if (isNative()) {
      // Native: Retrieve from Hardware Secure Storage
      const b64 = await NativeStorage.get('master_key');
      return b64 ? fromBase64(b64) : null;
  } else {
      // PWA: Decrypt blob from IndexedDB
      return await decryptMasterKey(secretWord.toLowerCase(), KEY_MASTER_ENC_SECRET);
  }
};

async function decryptMasterKey(password: string, storageKey: string): Promise<Uint8Array | null> {
  const combined = await idb.get<Uint8Array>(storageKey);
  if (!combined) return null;

  try {
    const salt = combined.slice(0, SALT_LEN);
    const iv = combined.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const ciphertext = combined.slice(SALT_LEN + IV_LEN);

    const kek = await deriveKeyFromPassword(password, salt);
    
    const decryptedMasterKey = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, 
      kek, 
      ciphertext
    );
    
    return new Uint8Array(decryptedMasterKey);
  } catch (e) {
    // Decryption failed (wrong password)
    return null;
  }
}

// --- Biometric Storage (WebAuthn / Local Simulation) ---
export const enrollBiometricsWithKey = async (masterKey: Uint8Array) => {
  console.log("[Bio] Starting enrollment...");
  try {
    if (!window.navigator.credentials || !window.navigator.credentials.create) {
        throw new Error("Web Authentication is not supported.");
    }

    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "My Cards AI" },
        user: {
          id: window.crypto.getRandomValues(new Uint8Array(16)),
          name: "user@local",
          displayName: "Local User"
        },
        // Request broadly compatible algorithms (ES256, RS256)
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: { 
            authenticatorAttachment: "platform",
            userVerification: "required" // Enforce biometric/pin usage
        },
        timeout: 60000
      }
    });

    if (credential) {
      console.log("[Bio] Credential created successfully.");
      // Note: On Native, we typically rely on Secure Storage + Biometric Plugin.
      // However, keeping WebAuthn logic here allows cross-platform compatibility 
      // if the native WebView supports it (modern Android/iOS do).
      await encryptAndStoreMasterKey(masterKey, "bio-internal-device-secret-v5", KEY_MASTER_ENC_BIO);
      await idb.put(KEY_BIO_ENABLED, true);
      return true;
    }
  } catch (e: any) {
    console.error("[Bio] Biometric enrollment error:", e);
    await idb.delete(KEY_BIO_ENABLED);
    throw e;
  }
  return false;
};

export const enrollBiometrics = async (mpin: string) => {
  const masterKey = await unlockWithMPIN(mpin);
  if (!masterKey) return false;
  return await enrollBiometricsWithKey(masterKey);
};

export const unlockWithBiometrics = async (): Promise<Uint8Array | null> => {
  const isEnabled = await idb.get(KEY_BIO_ENABLED);
  if (!isEnabled) return null;

  try {
    if (!window.navigator.credentials || !window.navigator.credentials.get) return null;
    
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required"
      }
    });

    if (assertion) {
      return await decryptMasterKey("bio-internal-device-secret-v5", KEY_MASTER_ENC_BIO);
    }
  } catch (e: any) {
    console.error("Biometric verification error:", e.name);
  }
  return null;
};

// --- Reset MPIN Flow ---
export const resetMPINWithSecretWord = async (secretWord: string, newMpin: string): Promise<boolean> => {
  const masterKey = await unlockWithSecretWord(secretWord);
  if (!masterKey) return false;

  await idb.put(KEY_MPIN_HASH, await hashString(newMpin));

  // If Native, we don't need to re-encrypt master key because it resides in Secure Storage.
  // We only update the MPIN hash used for verification.
  if (!isNative()) {
    await encryptAndStoreMasterKey(masterKey, newMpin.toLowerCase(), KEY_MASTER_ENC_MPIN);
  }
  
  return true;
};

// --- Data Operations (Using Master Key) ---
export const saveCards = async (cards: CreditCard[], masterKey: Uint8Array) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["encrypt"]);
  
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(cards));
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, 
    cryptoKey, 
    encodedData
  );

  // Store: [IV (12)] [CIPHERTEXT]
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  await idb.put(KEY_DATA_ENC, combined);
};

export const decryptLocalCards = async (masterKey: Uint8Array): Promise<CreditCard[]> => {
  const combined = await idb.get<Uint8Array>(KEY_DATA_ENC);
  if (!combined) return [];

  try {
    const iv = combined.slice(0, IV_LEN);
    const ciphertext = combined.slice(IV_LEN);

    const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["decrypt"]);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, 
      cryptoKey, 
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (e) {
    console.error("Data Decryption failed:", e);
    return [];
  }
};

// --- Storage Helpers ---
export const hasStoredData = async (): Promise<boolean> => {
  const data = await idb.get(KEY_DATA_ENC);
  return data !== undefined;
};

export const getMPINHash = async (): Promise<string | undefined> => {
  return await idb.get<string>(KEY_MPIN_HASH);
};

// --- API Key Secure Storage (Device-Bound Encryption) ---

export const getGeminiApiKeyEncrypted = async (): Promise<boolean> => {
  const data = await idb.get(KEY_USER_API_KEY_ENC);
  return !!data;
};

export const saveEncryptedApiKey = async (apiKey: string, masterKey: Uint8Array) => {
  if (!apiKey) {
    await idb.delete(KEY_USER_API_KEY_ENC);
    return;
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["encrypt"]);
  
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(apiKey);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, 
    cryptoKey, 
    encodedData
  );

  // Store: [IV (12)] [CIPHERTEXT]
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  await idb.put(KEY_USER_API_KEY_ENC, combined);
};

export const getDecryptedApiKey = async (masterKey: Uint8Array): Promise<string | undefined> => {
  const combined = await idb.get<Uint8Array>(KEY_USER_API_KEY_ENC);
  if (!combined) return undefined;

  try {
    const iv = combined.slice(0, IV_LEN);
    const ciphertext = combined.slice(IV_LEN);

    const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["decrypt"]);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, 
      cryptoKey, 
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    console.error("API Key Decryption failed:", e);
    return undefined;
  }
};


export const wipeEverything = async () => {
  // Cryptographic shredding: Overwrite sensitive key slots with random noise
  const noise = window.crypto.getRandomValues(new Uint8Array(256));
  
  try {
    // If native, ensure the hardware secure key is removed
    if (isNative()) {
       await NativeStorage.remove('master_key');
    }
    await idb.put(KEY_MASTER_ENC_MPIN, noise);
    await idb.put(KEY_MASTER_ENC_SECRET, noise);
    await idb.put(KEY_MASTER_ENC_BIO, noise);
    await idb.put(KEY_DATA_ENC, noise);
    await idb.put(KEY_MPIN_HASH, noise);
    await idb.put(KEY_USER_API_KEY_ENC, noise);
    await idb.put(KEY_PRO_STATUS, noise);
    await idb.put(KEY_ADVISOR_USAGE, noise);
  } catch (e) {
    console.warn("Secure overwrite interrupted, proceeding to clear.", e);
  }

  await idb.clear();
  localStorage.clear();
  sessionStorage.clear();
  window.location.reload();
};

export const getBiometricEnrolled = async () => await idb.get<boolean>(KEY_BIO_ENABLED);
export const setBiometricEnrolled = async (v: boolean) => {
    if (v) await idb.put(KEY_BIO_ENABLED, true);
    else await idb.delete(KEY_BIO_ENABLED);
};

// Notification Settings
export const getNotificationPeriod = async (): Promise<number> => {
  const val = await idb.get<number>(KEY_NOTIF_PERIOD);
  return val !== undefined ? val : 2; // Default to 2 months
};

export const setNotificationPeriod = async (months: number) => {
  await idb.put(KEY_NOTIF_PERIOD, months);
};

export const getNotifiedCards = async (): Promise<Record<string, boolean>> => {
  const val = await idb.get<Record<string, boolean>>(KEY_NOTIFIED_CARDS);
  return val || {};
};

export const saveNotifiedCards = async (notified: Record<string, boolean>) => {
  await idb.put(KEY_NOTIFIED_CARDS, notified);
};

export const removeNotifiedFlag = async (cardId: string) => {
    const notified = await getNotifiedCards();
    if (notified[cardId]) {
        delete notified[cardId];
        await saveNotifiedCards(notified);
    }
};

// Version Tracking
export const getLastSeenVersion = async (): Promise<string | undefined> => {
  return await idb.get<string>(KEY_LAST_SEEN_VERSION);
};

export const setLastSeenVersion = async (version: string) => {
  await idb.put(KEY_LAST_SEEN_VERSION, version);
};

// --- Monetization & Pro Tier ---
export const getProStatus = async (): Promise<boolean> => {
  return await idb.get<boolean>(KEY_PRO_STATUS) || false;
};

export const setProStatus = async (enabled: boolean) => {
  if (enabled) await idb.put(KEY_PRO_STATUS, true);
  else await idb.delete(KEY_PRO_STATUS);
};

export const getAdvisorUsage = async (): Promise<{ count: number, limit: number, remaining: number }> => {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}`;
  const usageData = await idb.get<{ month: string, count: number }>(KEY_ADVISOR_USAGE) || { month: key, count: 0 };
  
  // Reset if new month
  if (usageData.month !== key) {
    return { count: 0, limit: 20, remaining: 20 };
  }
  
  return { count: usageData.count, limit: 20, remaining: Math.max(0, 20 - usageData.count) };
};

export const incrementAdvisorUsage = async () => {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}`;
  const usageData = await idb.get<{ month: string, count: number }>(KEY_ADVISOR_USAGE) || { month: key, count: 0 };
  
  let newCount = usageData.count;
  if (usageData.month !== key) {
    newCount = 1;
  } else {
    newCount += 1;
  }
  
  await idb.put(KEY_ADVISOR_USAGE, { month: key, count: newCount });
};

export const restoreSettings = async (settings: BackupPayload['settings']) => {
  if (!settings) return;
  if (settings.notificationPeriod) await setNotificationPeriod(settings.notificationPeriod);
  if (settings.proStatus !== undefined) await setProStatus(settings.proStatus);
  if (settings.advisorUsage) await idb.put(KEY_ADVISOR_USAGE, settings.advisorUsage);
};

// --- EXPORT / IMPORT (Manual Encrypted Backups) ---

export const exportEncryptedBackup = async (cards: CreditCard[], passphrase: string): Promise<Blob> => {
  // 1. Gather Settings
  const settings = {
    notificationPeriod: await getNotificationPeriod(),
    proStatus: await getProStatus(),
    advisorUsage: (await idb.get<{ month: string; count: number }>(KEY_ADVISOR_USAGE)) || { month: '', count: 0 }
  };

  // 2. Prepare Payload
  const payload: BackupPayload = {
    version: 1,
    timestamp: Date.now(),
    data: cards,
    settings
  };
  const jsonString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);

  // 3. Generate Salt & IV
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));

  // 4. Derive Key from User Passphrase (case-sensitive)
  const key = await deriveKeyFromPassword(passphrase, salt);

  // 5. Encrypt
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBuffer
  );

  // 6. Combine: [SALT 16] [IV 12] [CIPHERTEXT]
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LEN);
  combined.set(new Uint8Array(encrypted), SALT_LEN + IV_LEN);

  // 7. Return as Blob
  return new Blob([combined], { type: 'application/octet-stream' });
};

export const importEncryptedBackup = async (fileBuffer: ArrayBuffer, passphrase: string): Promise<BackupPayload> => {
  const data = new Uint8Array(fileBuffer);

  // 1. Extract Headers
  if (data.length < SALT_LEN + IV_LEN) throw new Error("Invalid file format");
  
  const salt = data.slice(0, SALT_LEN);
  const iv = data.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ciphertext = data.slice(SALT_LEN + IV_LEN);

  try {
    // 2. Derive Key
    const key = await deriveKeyFromPassword(passphrase, salt);

    // 3. Decrypt
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    // 4. Parse & Validate
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decrypted);
    const payload = JSON.parse(jsonString) as BackupPayload;

    if (!payload.data || !Array.isArray(payload.data)) {
      throw new Error("Invalid backup structure");
    }

    return payload;
  } catch (e) {
    console.error("Import failed:", e);
    throw new Error("Decryption failed. Incorrect passphrase or corrupted file.");
  }
};

// --- SYSTEM SECURITY SELF-CHECK ---
export const runStorageIntegrityCheck = async () => {
    // 1. Verify Encrypted Master Key Exists
    let keysFound = false;
    
    if (isNative()) {
        const k = await NativeStorage.get('master_key');
        keysFound = !!k;
    } else {
        const mpinKey = await idb.get(KEY_MASTER_ENC_MPIN);
        keysFound = !!mpinKey;
    }
    
    // 2. Scan LocalStorage for potential plaintext leaks (Common mistake keys)
    const riskyKeys = ['cards', 'credit_cards', 'wallet_data', 'my_cards_backup', 'vault', 'user_api_key'];
    const leaks = riskyKeys.filter(k => localStorage.getItem(k) !== null);
    
    return {
        keysFound,
        leaks
    };
};
