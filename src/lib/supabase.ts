import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { secureSessionStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase baglanti bilgileri eksik. Proje kokunde .env dosyasi olusturup ' +
    'EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY degerlerini girin ' +
    '(ornek icin .env.example dosyasina bakin).'
  );
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient(url, anonKey, {
  auth: {
    // Web'de supabase-js kendi localStorage katmanini kullanir ve sunucu
    // tarafinda guvenle devre disi kalir. Native'de (iOS/Android) oturum
    // token'lari DUZ AsyncStorage yerine SecureStore-tabanli, sifreli bir
    // katmanda tutulur (bkz. secureStorage.ts — OWASP Mobile M9: Insecure
    // Data Storage'a karsi).
    storage: isWeb ? undefined : secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});
