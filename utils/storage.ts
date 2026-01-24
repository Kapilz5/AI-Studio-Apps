import { CreditCard } from '../types';

// Security Version 4: Master Key + Dual Password Recovery
const STORAGE_KEY = 'card_strategist_data_v4';
const MASTER_KEY_MPIN_ENC = 'card_strategist_v4_mk_mpin';
const MASTER_KEY_SECRET_ENC = 'card_strategist_v4_mk_secret';
const MASTER_KEY_BIO_ENC = 'card_strategist_v4_mk_bio';
const MPIN_HASH_KEY = 'card_strategist_v4_mpin_hash';
const SECRET_HASH_KEY = 'card_strategist_v4_secret_hash';
const USER_SESSION_KEY = 'card_strategist_v4_user';
const BIOMETRICS_ENROLLED_KEY = 'card_strategist_v4_biometrics';
const CLOUD_SYNC_KEY = 'card_strategist_v4_cloud_mock';
const NOTIFICATION_PERIOD_KEY = 'card_strategist_v4_notif_period';
const NOTIFIED_CARDS_EXPIRY_KEY = 'card_strategist_v4_notified_expiry';
const CUSTOM_API_KEY_STORAGE = 'card_strategist_v4_custom_api_key';


// --- Hashing ---
export const hashString = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.toLowerCase().trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- Key Derivation (PBKDF2) ---
async function deriveKeyFromPassword(password: string, salt: Uint8Array) {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password.toLowerCase().trim()),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// --- Initial Setup ---
export const setupSecurity = async (mpin: string, secretWord: string) => {
  const masterKey = window.crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(MPIN_HASH_KEY, await hashString(mpin));
  localStorage.setItem(SECRET_HASH_KEY, await hashString(secretWord));

  await encryptAndStoreMasterKey(masterKey, mpin, MASTER_KEY_MPIN_ENC);
  await encryptAndStoreMasterKey(masterKey, secretWord, MASTER_KEY_SECRET_ENC);
  
  return masterKey;
};

async function encryptAndStoreMasterKey(masterKey: Uint8Array, password: string, storageKey: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);
  
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, masterKey);
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  localStorage.setItem(storageKey, btoa(String.fromCharCode(...combined)));
}

// --- Unlock Flows ---
export const unlockWithMPIN = async (mpin: string): Promise<Uint8Array | null> => {
  return await decryptMasterKey(mpin, MASTER_KEY_MPIN_ENC);
};

export const unlockWithSecretWord = async (secretWord: string): Promise<Uint8Array | null> => {
  return await decryptMasterKey(secretWord, MASTER_KEY_SECRET_ENC);
};

async function decryptMasterKey(password: string, storageKey: string): Promise<Uint8Array | null> {
  const base64 = localStorage.getItem(storageKey);
  if (!base64) return null;

  try {
    const combined = new Uint8Array(atob(base64).split("").map(c => c.charCodeAt(0)));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    const key = await deriveKeyFromPassword(password, salt);
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new Uint8Array(decrypted);
  } catch (e) {
    return null;
  }
}

// --- Biometric Storage ---
export const enrollBiometricsWithKey = async (masterKey: Uint8Array) => {
  try {
    if (!window.navigator.credentials || !window.navigator.credentials.create) {
        throw new Error("Web Authentication is not supported in this environment.");
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
      await encryptAndStoreMasterKey(masterKey, "bio-internal-secret", MASTER_KEY_BIO_ENC);
      localStorage.setItem(BIOMETRICS_ENROLLED_KEY, 'true');
      return true;
    }
  } catch (e: any) {
    console.error("Biometric enrollment error:", e.name, e.message);
    if (e.name === 'NotAllowedError' || e.message?.includes('policy')) {
        localStorage.removeItem(BIOMETRICS_ENROLLED_KEY);
    }
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
  if (localStorage.getItem(BIOMETRICS_ENROLLED_KEY) !== 'true') return null;

  try {
    if (!window.navigator.credentials || !window.navigator.credentials.get) {
        return null;
    }
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required"
      }
    });

    if (assertion) {
      return await decryptMasterKey("bio-internal-secret", MASTER_KEY_BIO_ENC);
    }
  } catch (e: any) {
    console.error("Biometric verification error:", e.name, e.message);
    if (e.name === 'NotAllowedError' || e.message?.includes('policy')) {
        // Silently fail to fallback to PIN
    }
  }
  return null;
};

// --- Reset MPIN Flow ---
export const resetMPINWithSecretWord = async (secretWord: string, newMpin: string): Promise<boolean> => {
  const masterKey = await unlockWithSecretWord(secretWord);
  if (!masterKey) return false;

  localStorage.setItem(MPIN_HASH_KEY, await hashString(newMpin));
  await encryptAndStoreMasterKey(masterKey, newMpin, MASTER_KEY_MPIN_ENC);
  return true;
};

// --- Data Operations (Using Master Key) ---
export const saveCards = async (cards: CreditCard[], masterKey: Uint8Array) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["encrypt"]);
  
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(cards));
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encodedData);

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  localStorage.setItem(STORAGE_KEY, btoa(String.fromCharCode(...combined)));
};

export const decryptLocalCards = async (masterKey: Uint8Array): Promise<CreditCard[]> => {
  const base64 = localStorage.getItem(STORAGE_KEY);
  if (!base64) return [];

  try {
    const combined = new Uint8Array(atob(base64).split("").map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["decrypt"]);
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (e) {
    console.error("Decryption failed:", e);
    return [];
  }
};

// --- Cloud Sync Operations ---
export const encryptAppDataForCloud = async (cards: CreditCard[], masterKey: Uint8Array): Promise<string> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["encrypt"]);
  
  const payload = {
    version: "4.0",
    timestamp: new Date().toISOString(),
    cards: cards
  };
  
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(payload));
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encodedData);

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
};

export const decryptAppDataFromCloud = async (encryptedBase64: string, masterKey: Uint8Array): Promise<{ cards: CreditCard[], timestamp: string }> => {
  const combined = new Uint8Array(atob(encryptedBase64).split("").map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const cryptoKey = await window.crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["decrypt"]);
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);

  const decoder = new TextDecoder();
  const parsed = JSON.parse(decoder.decode(decrypted));
  return {
    cards: parsed.cards || [],
    timestamp: parsed.timestamp || new Date().toISOString()
  };
};

// --- Storage Helpers ---
export const hasStoredData = () => localStorage.getItem(STORAGE_KEY) !== null;
export const getMPINHash = () => localStorage.getItem(MPIN_HASH_KEY);

export const wipeEverything = () => {
  const keysToWipe = [
    STORAGE_KEY, MASTER_KEY_MPIN_ENC, MASTER_KEY_SECRET_ENC, MASTER_KEY_BIO_ENC,
    MPIN_HASH_KEY, SECRET_HASH_KEY, USER_SESSION_KEY, BIOMETRICS_ENROLLED_KEY,
    CLOUD_SYNC_KEY, NOTIFICATION_PERIOD_KEY, NOTIFIED_CARDS_EXPIRY_KEY, CUSTOM_API_KEY_STORAGE
  ];
  keysToWipe.forEach(key => localStorage.removeItem(key));
  sessionStorage.clear();
  window.location.reload();
};

export const saveUser = (user: any) => localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
export const getUser = () => JSON.parse(localStorage.getItem(USER_SESSION_KEY) || 'null');
export const getBiometricEnrolled = () => localStorage.getItem(BIOMETRICS_ENROLLED_KEY) === 'true';
export const setBiometricEnrolled = (v: boolean) => v ? localStorage.setItem(BIOMETRICS_ENROLLED_KEY, 'true') : localStorage.removeItem(BIOMETRICS_ENROLLED_KEY);
export const saveToCloudMock = (blob: string) => localStorage.setItem(CLOUD_SYNC_KEY, blob);
export const getFromCloudMock = () => localStorage.getItem(CLOUD_SYNC_KEY);

// Notification Settings
export const getNotificationPeriod = (): number => {
  const val = localStorage.getItem(NOTIFICATION_PERIOD_KEY);
  return val ? parseInt(val, 10) : 2; // Default to 2 months
};

export const setNotificationPeriod = (months: number) => {
  localStorage.setItem(NOTIFICATION_PERIOD_KEY, months.toString());
};

export const getNotifiedCards = (): Record<string, boolean> => {
  const val = localStorage.getItem(NOTIFIED_CARDS_EXPIRY_KEY);
  return val ? JSON.parse(val) : {};
};

export const saveNotifiedCards = (notified: Record<string, boolean>) => {
  localStorage.setItem(NOTIFIED_CARDS_EXPIRY_KEY, JSON.stringify(notified));
};

export const removeNotifiedFlag = (cardId: string) => {
    const notified = getNotifiedCards();
    if (notified[cardId]) {
        delete notified[cardId];
        saveNotifiedCards(notified);
    }
}

// --- API Key Fallback Storage (Obfuscated) ---
export const saveAPIKey = (apiKey: string) => {
  if (!apiKey || apiKey.trim() === '') {
    localStorage.removeItem(CUSTOM_API_KEY_STORAGE);
    return;
  }
  // Basic obfuscation to prevent casual shoulder surfing reading.
  // We use btoa (Base64) as requested.
  try {
    const obfuscated = btoa(apiKey.trim());
    localStorage.setItem(CUSTOM_API_KEY_STORAGE, obfuscated);
  } catch (e) {
    console.warn("Failed to save API key", e);
  }
};

export const getAPIKey = (): string | null => {
  const stored = localStorage.getItem(CUSTOM_API_KEY_STORAGE);
  if (!stored) return null;
  try {
    return atob(stored);
  } catch (e) {
    return null;
  }
};