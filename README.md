## Skylab SuperAdmin

Next.js 16.0.1 (App Router, Turbopack) ile geliştirilmiş Skylab yönetim paneli.

- Next sürüm: 16.0.1
- Paket yöneticisi: pnpm
- UI: Tailwind CSS (yalnızca Tailwind renkleri; ihtiyaç olursa `tailwind.config.*` ile eklenir)
- Domain (prod): `https://admin-skylab.vercel.app`
- Not: Responsivity şu an kapsam dışı (gereksinim)

## İçindekiler
- Proje Mimari Özeti
- Hızlı Başlangıç
- Çevre Değişkenleri (.env)
- Komutlar
- Geliştirme Notları (Next 16 değişiklikleri, dynamic routes)
- Kimlik Doğrulama ve Akış
- API Katmanı
- Dağıtım (Vercel) ve Domain

## Proje Mimari Özeti
- `src/app`: App Router sayfaları ve API route’ları
  - `app/api/*`: Frontend-proxy API uçları (ör. `auth`, `users`, `announcements`, `events`)
  - Ör. `src/app/api/auth/login/route.ts`: OAuth başlangıcına yönlendirir (GET)
- `src/lib`: İstemciler ve yardımcı katmanlar
  - `lib/api/client.ts`: Genel API istemcisi
  - `lib/api/server-client.ts`: Sunucu tarafı fetch wrapper’ı (cookie/token yönetimi)
  - `lib/auth/oauth2.ts`: OAuth2 URL üretimi, token alma/yenileme
- `src/components`: Form ve UI bileşenleri (ör. `components/forms/Form.tsx` RHF+Zod)
- `backend_datalari/`: Backend referans dökümantasyonu (gerekirse frontend düzeyinde uyarlanır)

## Hızlı Başlangıç
### Gereksinimler
- Node.js 18+
- pnpm 8+

### Kurulum
```bash
pnpm install
```

### Geliştirme Sunucusu
```bash
pnpm dev
# http://localhost:3000
```

### Üretim Derlemesi
```bash
pnpm build
pnpm start
```

## Çevre Değişkenleri (.env.local)
`/.env.local` örneği:
```env
NEXT_PUBLIC_API_URL=https://api.yildizskylab.com
NEXT_PUBLIC_CMS_URL=https://api.yildizskylab.com/api
OAUTH2_ISSUER=https://e.yildizskylab.com/realms/e-skylab
OAUTH2_CLIENT_ID=...
OAUTH2_CLIENT_SECRET=...
OAUTH2_REDIRECT_URI=http://localhost:3000/api/auth/callback
APP_URL=http://localhost:3000
```
- Sandbox ortamında `OAUTH2_ISSUER` değeri `https://e.yildizskylab.com/realms/e-skylab-sandbox` olmalıdır.

## Komutlar
- `pnpm dev`: Geliştirme
- `pnpm build`: Üretim derlemesi (Turbopack)
- `pnpm start`: Üretim sunucusu
- `pnpm lint` (varsa): Lint kontrolü

## Geliştirme Notları
### Next 16.0.1 Uyumları
- App Router + Turbopack.
- `middleware` konvansiyonu depreceated → `proxy` kullanımı önerilir. Uyarı build’i engellemez; daha sonra `src/proxy.ts`’e taşınabilir.

### Dynamic Server Usage (cookies)
- `cookies()` kullanan sayfalar SSG yerine dinamik render edilir. Bu beklenen davranış olup build’i engellemez.
- Gerekirse sayfa başına `export const dynamic = 'force-dynamic'` veya `revalidate = 0` ile netleştirilebilir.

## Kimlik Doğrulama ve Akış
- Login sayfası `/login` oauth yetkilendirme URL’sine otomatik yönlendirir.
- OAuth callback: `GET /api/auth/callback` kodu token’a çevirir ve `auth_token`/`refresh_token` cookie’lerini yazar, ardından `/dashboard`’a yönlendirir.
- Oturum durumu: `GET /api/auth/me` backend’e token ile gider, kullanıcıyı döner (erişim yoksa cookie temizleme).
- Logout: `POST /api/auth/logout` cookie temizler.

## API Katmanı
- Tüm istekler `NEXT_PUBLIC_API_URL` üzerinden backend’e yönlenir.
- İstemci tarafında `lib/api/client.ts`, sunucu tarafında `lib/api/server-client.ts` kullanılır.
- Bazı uçlar form-data / blob ister (örn. QR kod). `lib/api/qr-codes.ts` header normalizasyonu içerir.

## Dağıtım ve Domain
- Platform: Vercel
- Prod domain: `https://admin-skylab.vercel.app`
- Vercel ortam değişkenlerini `.env.local` ile eşleyin (Project Settings → Environment Variables).
- Build Command: `pnpm build`
- Install Command: `pnpm install`
- Output: Next.js (otomatik)

## Kod Standartları
- Paket yönetimi: yalnızca pnpm
- Renkler: yalnızca Tailwind CSS palette; ihtiyaç halinde `tailwind.config.*` ile ekleyin
- Component yapısı: modüler, okunaklı, sorumluluğu net
- Tip güvenliği: Zod + React Hook Form ile formlar, tiplerin uyuşmasına dikkat

## Sorun Giderme
- OAuth callback dönmüyorsa: `OAUTH2_REDIRECT_URI` prod/dev uyumunu ve OAuth client izinli URL’lerini kontrol edin.
- 401/403: Cookie’de `auth_token` var mı; backend’da rol/yetki ayarlarını doğrulayın.
- `Dynamic server usage` uyarıları: sayfanın SSG yerine dinamik render edilmesi normal; gerekirse dinamik bayrakları ekleyin.
