import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { ModuleType, Profile } from './types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Kullanicinin yetkili oldugu moduller (profiles.allowed_modules) */
  modules: ModuleType[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  // Oturum degistiginde profil (rol + modul yetkisi) yuklenir
  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoading(true);

    supabase
      .from('profiles')
      .select('id, full_name, role, allowed_modules, is_active')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.warn('Profil okunamadi:', error.message);
        setProfile((data as Profile) ?? null);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [session?.user.id]);

  const value = useMemo<AuthState>(() => ({
    session,
    profile,
    loading,
    modules: profile?.allowed_modules ?? [],
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (error) throw new Error(translateAuthError(error.message));
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  }), [session, profile, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth, AuthProvider icinde kullanilmalidir.');
  return v;
}

function translateAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-posta veya şifre hatalı.';
  if (/email not confirmed/i.test(msg))       return 'E-posta adresi henüz doğrulanmamış.';
  if (/network|fetch/i.test(msg))             return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.';
  if (/rate limit|too many/i.test(msg))       return 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.';
  return msg;
}
