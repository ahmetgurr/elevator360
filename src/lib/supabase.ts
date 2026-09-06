import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
    // tarafinda guvenle devre disi kalir. AsyncStorage yalnizca iOS/Android
    // icin gereklidir; web'de yuklenmesi 'window is not defined' hatasi verir.
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});
