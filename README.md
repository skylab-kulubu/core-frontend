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
- `src/components`: Form ve UI bileşenleri

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

Yerel geliştirme **sandbox**'a karşı yapılır; production API'si ve realm'i yerelde kullanılmaz. `/.env.local` örneği:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/sandbox-api
NEXT_PUBLIC_CMS_URL=http://localhost:3000/sandbox-api/api
OAUTH2_ISSUER=https://e.yildizskylab.com/realms/e-skylab-sandbox
OAUTH2_CLIENT_ID=admin-local
OAUTH2_REDIRECT_URI=http://localhost:3000/api/auth/callback
APP_URL=http://localhost:3000
```

- **Dev proxy:** `pnpm dev`, `/sandbox-api/*` isteklerini `https://sandbox-api.yildizskylab.com/*` adresine iletir (`next.config.ts`; yalnız `next dev`, `next build` ve imajlar bu yönlendirmeyi içermez). Tarayıcı yalnız `localhost:3000`'e gider. Kulübün kenarı (Traefik) `http://localhost:3000` kökeninden gelen çapraz kökenli isteklere izin vermez: API adresi doğrudan `https://…yildizskylab.com` olursa tarayıcının istekleri CORS'ta durur. `pnpm dev` açılışta böyle bir adresi uyarıyla yazar.
- Port 3000 değilse (3000 doluysa Next başka port seçer) adreslerdeki portu da değiştirin.
- İsteğe bağlı: panodaki GitHub bölümü için `NEXT_PUBLIC_GITHUB_ACTIVITY_URL=http://localhost:3000/sandbox-api/v1/dashboard/github-activity`.
- Giriş Keycloak'a yönlendirmedir, CORS'a takılmaz; kod-token değişimi sunucu tarafında olur. Yerelde sandbox realm'inin yalnız yerel geliştirme için açılmış `admin-local` istemcisi kullanılır: public (sırrı yok, giriş PKCE ile), tek dönüş adresi `http://localhost:3000/api/auth/callback`. `OAUTH2_CLIENT_SECRET` tanımlanmaz. Token'ı sandbox panelinin istemcisi `superadmin`'inkiyle aynı biçimdedir (`aud` core, forms, skycms; core ve forms rolleri, düz `roles`, tam yollu `groups`); `superadmin` localhost'a açık değildir. İstemciyi e-skylab-keycloak'taki `config/sandbox-admin-local-client.sh` kurar. Sandbox hesabınızla girersiniz; panelde ne göreceğinizi sandbox'taki gruplarınız belirler.
- "SkyApp'ten geçiş" sayfası yerelde açılmaz: Keycloak'ın yönetim uçları yalnız panelin kendi istemcisinin token'ını kabul eder (`azp`).
- Canlıdaki değerler (production: `https://api.yildizskylab.com`, realm `e-skylab`, istemci `admin`; sandbox: `https://sandbox-api.yildizskylab.com`) imaj build'inden (`.github/workflows/ghcr.yml`) ve Dokploy'dan gelir.
- `OAUTH2_ISSUER` aynı zamanda "SkyApp'ten geçiş" sayfasının Keycloak adresidir: sunucu tarafı `${OAUTH2_ISSUER}/sky-handoff/v1/admin/targets` uçlarını çağırır. Ek değişken gerekmez.

### Playground (skylcn-ui dokümantasyonu)

- Docker imajı, `NEXT_PUBLIC_INCLUDE_PLAYGROUND=true` build-arg'ı verilmedikçe skylcn-ui playground'ını içermez (varsayılan `false`): kenar çubuğunda "Playground" girdisi çıkmaz, `/playground` yönlendirilmez, Dockerfile'ın playground aşaması hiç çalışmaz.
- Playground ayrı bir bağımlılık ağacıyla build edilir ve panelle aynı origin'den servis edilir; admin access token'ı o origin'deki JS'e açık olduğu için production imajında kapalıdır (ADR 0055: dokümantasyon GitHub Pages'te yayımlanır). `.github/workflows/ghcr.yml` bayrağı yalnız sandbox (`main`) build'inde `true` yapar.
- Yerelde imajda denemek için: `docker build --build-arg NEXT_PUBLIC_INCLUDE_PLAYGROUND=true ...` (diğer `NEXT_PUBLIC_*` build-arg'larıyla birlikte).

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
- OAuth callback: `GET /api/auth/callback` kodu token’a çevirir ve oturum cookie’lerini yazar, ardından `/dashboard`’a yönlendirir.
- Oturum ve OAuth giriş çerezleri (`src/lib/auth/session-cookies.ts`, `src/lib/auth/oauth-transaction.ts`): Secure açıkken adlar `__Host-` öneklidir (`__Host-auth_token`, `__Host-access_token`, `__Host-refresh_token`, `__Host-oauth_state`, `__Host-oauth_code_verifier`); tarayıcı bunları yalnız bu host’tan, Secure, `Path=/` ve `Domain`’siz kabul eder, böylece yildizskylab.com altındaki başka bir alt alan adı bu çerezleri ekleyemez ya da gölgeleyemez. Secure açıkken öneksiz eski adlar okunmaz.
- Secure kuralı (`authCookieSecure()`, `src/lib/auth/cookie-secure.ts`): `AUTH_COOKIE_SECURE` boş değilse yalnız tam olarak `true` değeri açar; `1`, `TRUE`, `yes` gibi her başka değer Secure’u ve öneki kapatır. Tanımsız ya da boşsa `NODE_ENV === 'production'` belirler: Docker imajı (production ve sandbox) Secure, `next dev` öneksizdir.
- Oturum durumu: `GET /api/auth/me` backend’e token ile gider, kullanıcıyı döner (erişim yoksa cookie temizleme).
- Logout: `POST /api/auth/logout` oturum cookie’lerini ve eski öneksiz adları temizler.

## API Katmanı

- Tüm istekler `NEXT_PUBLIC_API_URL` üzerinden backend’e yönlenir (yerelde dev proxy üzerinden sandbox'a).
- İstisna: "SkyApp'ten geçiş" (`/handoff-targets`) core'a gitmez. Tarayıcı yalnız `/api/handoff-targets` route handler'larını çağırır; bunlar httpOnly çerezdeki yönetici access token'ıyla (süresi dolmuşsa yenileyerek) Keycloak'ın `sky-handoff` yönetim uçlarına gider; bu sayfa token'ı tarayıcıya taşımaz. Yetkiyi Keycloak denetler (realm süper yöneticisi değilse 403 → sayfa gizlenir); menüde yalnız `/ADMIN` grubuna görünür.
- İstemci tarafında `lib/api/client.ts`, sunucu tarafında `lib/api/server-client.ts` kullanılır.
- Bazı uçlar form-data / blob ister (örn. QR kod).

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
- Yerelde tarayıcı konsolunda CORS hatası: API adresleri `http://localhost:3000/sandbox-api` ile başlamalı (bkz. Çevre Değişkenleri).
- 401/403: Cookie’de `__Host-auth_token` (yerel http’de `auth_token`) var mı; backend’da rol/yetki ayarlarını doğrulayın.
- `Dynamic server usage` uyarıları: sayfanın SSG yerine dinamik render edilmesi normal; gerekirse dinamik bayrakları ekleyin.
