/**
 * Supabase oturum (session) depolamasi icin SecureStore tabanli adaptor.
 *
 * SORUN: Auth token'lari (access_token / refresh_token) duz AsyncStorage'da
 * tutulmak sifrelenmemis disk depolamasi demektir (bkz. OWASP Mobile M9 —
 * Insecure Data Storage); cihaza fiziksel/dosya sistemi erisimi olan biri
 * oturumu calabilir.
 *
 * expo-secure-store (iOS Keychain / Android Keystore, donanim destekli
 * sifreleme) DOGRUDAN kullanilamaz cunku Android Keystore tek deger basina
 * ~2048 bayt sinirlar — Supabase'in oturum blobu (iki JWT + kullanici
 * nesnesi) bunu kolayca asar. Resmi Supabase/Expo deseni: rastgele bir AES
 * anahtari SecureStore'da (kucuk, donanimda sifreli) tutulur; ASIL oturum
 * verisi bu anahtarla sifrelenip AsyncStorage'da saklanir. Boylece hem
 * "encrypted at rest" saglanir hem boyut siniri asilmaz.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  // react-native-get-random-values, global.crypto.getRandomValues'i doldurur.
  (globalThis as unknown as { crypto: Crypto }).crypto.getRandomValues(bytes);
  return bytes;
}

class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = getRandomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const hexKey = await SecureStore.getItemAsync(key);
    if (!hexKey) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(hexKey), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

/** Native (iOS/Android) icin — web'de kullanilmaz (bkz. supabase.ts). */
export const secureSessionStorage = new LargeSecureStore();
