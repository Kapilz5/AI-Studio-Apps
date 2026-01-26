
import { CreditCard, BackupPayload } from '../types';

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

// Crypto Constants
const PBKDF2_ITERATIONS = 600000; // High iteration count for PWA fallback
const SALT_LEN = 16;
const IV_LEN = 12;

/* 
   SECURITY NOTICE: 
   This application is designed for STRICT LOCAL STORAGE only.
   Do not add any mechanisms to export, sync, or backup the 'vault_store' to cloud services.
   The Master Key must remain non-extractable and device-bound.
*/

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

  // 3. Encrypt Master Key with MPIN
  await encryptAndStoreMasterKey(masterKey, mpin.toLowerCase(), KEY_MASTER_ENC_MPIN);
  
  // 4. Encrypt Master Key with Secret Word (Recovery)
  await encryptAndStoreMasterKey(masterKey, secretWord.toLowerCase(), KEY_MASTER_ENC_SECRET);
  
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
  return await decryptMasterKey(mpin.toLowerCase(), KEY_MASTER_ENC_MPIN);
};

export const unlockWithSecretWord = async (secretWord: string): Promise<Uint8Array | null> => {
  return await decryptMasterKey(secretWord.toLowerCase(), KEY_MASTER_ENC_SECRET);
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
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform" },
        timeout: 60000
      }
    });

    if (credential) {
      await encryptAndStoreMasterKey(masterKey, "bio-internal-device-secret-v5", KEY_MASTER_ENC_BIO);
      await idb.put(KEY_BIO_ENABLED, true);
      return true;
    }
  } catch (e: any) {
    console.error("Biometric enrollment error:", e.name);
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
  await encryptAndStoreMasterKey(masterKey, newMpin.toLowerCase(), KEY_MASTER_ENC_MPIN);
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

export const wipeEverything = async () => {
  // Cryptographic shredding: Overwrite sensitive key slots with random noise
  const noise = window.crypto.getRandomValues(new Uint8Array(256));
  
  try {
    await idb.put(KEY_MASTER_ENC_MPIN, noise);
    await idb.put(KEY_MASTER_ENC_SECRET, noise);
    await idb.put(KEY_MASTER_ENC_BIO, noise);
    await idb.put(KEY_DATA_ENC, noise);
    await idb.put(KEY_MPIN_HASH, noise);
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

// --- EXPORT / IMPORT (Manual Encrypted Backups) ---

export const exportEncryptedBackup = async (cards: CreditCard[], passphrase: string): Promise<Blob> => {
  // 1. Prepare Payload
  const payload: BackupPayload = {
    version: 1,
    timestamp: Date.now(),
    data: cards
  };
  const jsonString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);

  // 2. Generate Salt & IV
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));

  // 3. Derive Key from User Passphrase (case-sensitive)
  const key = await deriveKeyFromPassword(passphrase, salt);

  // 4. Encrypt
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBuffer
  );

  // 5. Combine: [SALT 16] [IV 12] [CIPHERTEXT]
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LEN);
  combined.set(new Uint8Array(encrypted), SALT_LEN + IV_LEN);

  // 6. Return as Blob
  return new Blob([combined], { type: 'application/octet-stream' });
};

export const importEncryptedBackup = async (fileBuffer: ArrayBuffer, passphrase: string): Promise<CreditCard[]> => {
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

    return payload.data;
  } catch (e) {
    console.error("Import failed:", e);
    throw new Error("Decryption failed. Incorrect passphrase or corrupted file.");
  }
};

// --- SYSTEM SECURITY SELF-CHECK ---
export const runStorageIntegrityCheck = async () => {
    // 1. Verify Encrypted Master Key Exists
    const mpinKey = await idb.get(KEY_MASTER_ENC_MPIN);
    const keysFound = !!mpinKey;
    
    // 2. Scan LocalStorage for potential plaintext leaks (Common mistake keys)
    const riskyKeys = ['cards', 'credit_cards', 'wallet_data', 'my_cards_backup', 'vault'];
    const leaks = riskyKeys.filter(k => localStorage.getItem(k) !== null);
    
    return {
        keysFound,
        leaks
    };
};
