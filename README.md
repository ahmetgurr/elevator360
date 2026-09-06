# Elevator360

Asansör ve temizlik operasyonlarının bakım/tahsilat takibi.
Expo (React Native) + Supabase (PostgreSQL). Tek kod tabanı: iOS, Android, Web.

## Kurulum

```bash
npm install
cp .env.example .env      # Supabase URL + anon key girin
npx expo start            # w = web, a = Android, i = iOS
```

## Yapı

```
src/app/            Ekranlar (expo-router, dosya tabanlı yönlendirme)
  _layout.tsx         Sağlayıcılar + oturum koruması (auth guard)
  login.tsx           Giriş
  index.tsx           Modül seçimi
  [module]/index.tsx  Aylık takip listesi
src/components/     Arayüz bileşenleri
src/lib/            Supabase istemcisi, oturum, veri katmanı, tema
supabase/migrations/ Veritabanı şeması (Supabase SQL Editor'da sırayla çalıştırılır)
supabase/seed/      Eski Excel verisinin aktarımı
docs/ARCHITECTURE.md Mimari kararlar ve iş kuralları
```

## Önemli

- Uygulama tutarları asla kendisi hesaplamaz; veritabanı fonksiyonlarını (`post_transaction`,
  `apply_payment_fifo`, `waive_period_fee`) çağırır. Bilanço toplamları trigger ile üretilir.
- Aylık liste `ensure_current_period()` ile kendiliğinden açılır; elle dönem açmak gerekmez.
- `.env` dosyası Git'e girmez. `anon` anahtarı istemciye gömülür ve gizli değildir —
  veriyi koruyan şey RLS politikalarıdır. `service_role` anahtarı uygulamada kullanılmaz.
