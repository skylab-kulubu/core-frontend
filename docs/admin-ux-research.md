# SKY LAB admin paneli: bilgi mimarisi ve etkileşim araştırması

_19 Eylül 2026 · Birincil kaynaklar ve mevcut kod üzerinden_

## Karar özeti

Panelin görsel kimliğini yeniden tasarlamayın. Space Grotesk, `skylab-*` renkleri, koyu yüzeyler, ince sınırlar, `ListItem`, `ActionButton`, `Drawer` ve `Pagination` dili SkyForms ile bilinçli olarak ortaktır (`ADR 0017`). İyileştirme; bilgi mimarisi, görev akışı, veri yoğunluğu, mobil davranış ve erişilebilirlikte olmalıdır.

En uygun model **sığ global navigasyon + seçili etkinliğe özel bağlamsal çalışma alanı**dır:

- Global menü kulübün kalıcı kaynaklarını gösterir.
- “Etkinlikler” tek seviyeli açılır bir gruptur.
- Bir etkinlik seçildiğinde, o etkinliğin programı, başvuranları, kapısı ve bağlantıları ayrı bir “Etkinlik çalışma alanı” bölümünde görünür.
- Yetkisi olmayan hedefler menüde ve global aramada hiç üretilmez; güvenlik yine API tarafında uygulanır.
- Basit listeler SkyForms `ListItem` dilinde kalır. Birden fazla sütunu karşılaştırma, sıralama veya toplu işlem gereken ekranlar ortak bir yoğun tablo bileşenine geçer.

## Mevcut yapıda görülenler

- [`Sidebar.tsx`](../src/components/layout/Sidebar.tsx) tüm hedefleri düz bağlantı olarak basıyor; yalnızca “Platform” ve “Program” başlıklarıyla görsel gruplama var. Alt seçenek, desktop daraltma ve bağlamsal etkinlik bölümü yok.
- [`sidebar-nav.ts`](../src/lib/navigation/sidebar-nav.ts) rol bazlı üç sabit düz liste üretiyor. Bu iyi bir yetki başlangıcı, ancak yeni ağaç için `children`, `requiredCapability` ve bağlamsal hedef bilgisi gerekiyor.
- Etkinlik ayrıntısı [`events/[id]/page.tsx`](<../src/app/(authorized)/events/[id]/page.tsx>) içinde 833 satırlık tek bir akış: özet/düzenleme, yarışmacılar, başvuranlar, günler-oturumlar, QR ve check-in aynı sayfada. Sorun eksik özellikten çok, görevlerin tek uzun yüzeyde birbirini itmesi.
- Gerçek listeler çoğunlukla `ListPanel` + `ListItem` kullanıyor. [`DataTable.tsx`](../src/components/tables/DataTable.tsx) kullanılmıyor ve eski açık renk sınıfları taşıyor; bunu genişletmek yerine SkyForms dilinde yeni ortak kaynak tablosu tanımlanmalı.
- [`AuthenticatedChrome.tsx`](../src/components/layout/AuthenticatedChrome.tsx) içeriği masaüstünde `max-w-6xl` ile sınırlıyor. Form ve özet ekranları için iyi; yoğun tablolar için sayfa düzeyinde `wide` görünüm seçeneği gerekli.
- [`Drawer.tsx`](../src/components/chrome/Drawer.tsx) `role="dialog"`, `aria-modal` ve Escape içeriyor; fakat açılış odağı, odak tuzağı, dış yüzeyin inert olması ve kapanınca tetikleyiciye odak dönüşü yok.
- Mobil sidebar kapalıyken sadece ekrandan taşınıyor ve `pointer-events` kapanıyor; içindeki linkler klavye odağı almaya devam edebilir. Kapalı durumda DOM'dan çıkarılmalı veya `inert`/uygun gizleme uygulanmalı.
- SkyForms’un kendi [`Sidebar.jsx`](../../forms-frontend/src/app/admin/components/Sidebar.jsx) bileşeninde `NavGroup`, aktif forma özel dinamik alt hedefler ve aynı renk/tipografi zaten var. Yeni modelin görsel kaynağı bu olmalı; yeni bir UI dili icat edilmemeli.

## Kaynaklardan çıkan kurallar

| Konu                | Birincil kaynak ilkesi                                                                                                                                                                                                                                                                                                                                             | SKY LAB karşılığı                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Sol navigasyon      | Carbon, beşten fazla ikincil hedefte veya hedefler arasında sık geçişte sol panel öneriyor; alt menüleri chevron ile açıyor ve **üçüncü navigasyon katmanını desteklemiyor**. [Carbon UI shell](https://v10.carbondesignsystem.com/components/UI-shell-left-panel/usage/)                                                                                          | Global grup → tek seviye alt hedef. Daha derin etkinlik içeriği ayrı bağlamsal bölüm veya sayfa sekmesi olmalı.         |
| Açılır menü         | Atlassian güncel side nav'ı uygulamaya özel, daraltılabilir ve genişliği saklanabilir tasarlıyor; eski “nested view” yerine expandable items kullanıyor. [Atlassian migration](https://atlassian.design/components/navigation-system/migration-guide), [layout API](https://atlassian.design/components/navigation-system/layout/code)                             | Desktop sidebar 256 px ↔ rail; açık/kapalı durumu yerelde saklanır. Mobilde varsayılan kapalı drawer.                   |
| Etiket ve derinlik  | Shopify kısa, 1–2 kelimelik isim etiketleri, önem sırası ve sayfa başlığıyla aynı adlandırma öneriyor. Sekmeler yalnızca sayfa içi ikincil gezinme içindir. [Shopify app nav](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-nav), [navigation guidance](https://shopify.dev/docs/apps/design/navigation)                              | “Etkinlikleri Görüntüle” değil “Etkinlikler”; “Kullanıcıları Yönet” değil “Kullanıcılar”. Sidebar iki seviyeyi geçmez.  |
| Etkinlik bağlamı    | Eventbrite önce etkinliği seçtiriyor, sonra Event Dashboard altında “Manage attendees”, check-in ve reporting araçlarını açıyor. [Attendee management](https://www.eventbrite.com/help/en-us/articles/544246/), [analytics](https://www.eventbrite.com/help/en-us/articles/237711/how-to-use-the-analytics-tool/)                                                  | `/events/:id` bir varış noktası değil, etkinliğe ait çalışma alanının kabuğu olmalı.                                    |
| Yoğun veri          | Carbon tabloyu tam ana içerik alanında kullanmayı; toolbar'da arama, filtre/ayar/aktarım gibi global işlemleri; en fazla beş görünür eylemi ve altta sayfalamayı öneriyor. Satır yüksekliği içerik yoğunluğuna göre tutarlı seçilmeli. [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/)                                            | Başvuranlar, kullanıcılar ve URL hitleri ortak tablo kullanır; basit etkinlik/medya listeleri `ListItem` kalabilir.     |
| Global hızlı erişim | Jira komut paleti `⌘K`/`Ctrl+K` ile kaynak bulma, eylem çalıştırma ve ana hedeflere gitmeyi birleştiriyor; yazı alanındayken kısayolu devre dışı bırakıyor. [Jira command palette](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-command-palette/)                                                                                            | Global palet ile yerel liste araması ayrılır. İlk sürüm yalnızca gezinme/oluşturma; sonra kaynak araması.               |
| Uyarlanabilir düzen | Material/Android kılavuzu kompakt ekranda tek panel, geniş ekranda liste+detay; bileşenleri körlemesine germek yerine reflow/reveal/presentation change öneriyor. [Adaptive layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout), [list-detail](https://developer.android.com/develop/adaptive-apps/guides/list-detail) | Telefon tek görev/tek panel; desktop başvuru listesi + detay drawer/panel. Tablo genişliği tüm sayfayı yatay kaydırmaz. |
| Görev rolü          | Eventbrite “check-in attendees” rolünü yalnızca kapı görevine ayrılmış varsayılan rol olarak tanımlıyor. [Eventbrite roles](https://www.eventbrite.com/help/en-us/articles/509534/)                                                                                                                                                                                | Door staff genel yönetim ağacını değil, “Kapı” odaklı dar operasyon kabuğunu görür.                                     |

## Önerilen bilgi mimarisi

```text
Özet

ETKİNLİKLER
▾ Etkinlikler
  Tümü                    /events
  Takvim                  /events?view=calendar
  Yeni                    /events/new              [oluşturma yetkisi]
  Sezonlar                /seasons                 [privileged]

AKTİF ETKİNLİK                                      [yalnızca /events/:id altında]
  <Etkinlik adı>          /events/:id
  Program                 /events/:id/program
  Başvuranlar             /events/:id/participants [ticket:list]
  Kapı                    /events/:id/door         [check-in yetkisi]
  Bağlantılar & medya     /events/:id/assets       [ilgili yetkiler]
  Yarışmacılar            /events/:id/competitors  [ilgili etkinliklerde]

KULÜP
▸ İnsanlar
  Kullanıcılar            /users
  Gruplar                 /groups
  Ekipler                 /teams

İÇERİK
▸ Yayın
  Duyurular               /announcements
  Medya                   /media
  Kısa URL                /urls                    [url capability]

Kapı                      /qr                      [hızlı, kalıcı hedef]
```

Notlar:

1. “Aktif Etkinlik” ayrı bir üçüncü seviye değildir; mevcut rota bir etkinliğin içindeyken görünen bağlamsal bir sidebar bölümüdür.
2. İlk uygulama yeni route'lar açmadan hash/query tabanlı sayfa içi bölümlerle yapılabilir. Kalıcı URL, deep-link ve geri tuşu için nihai yapı ayrı route segmentleri olmalıdır.
3. Etkinlik adı uzun olduğunda tek satır kesilir ve tam adı tooltip/title ile verilir.
4. Aktif yolun ait olduğu grup otomatik açılır. Kullanıcının elle kapattığı diğer grupların durumu oturumlar arasında saklanır.
5. Sidebar rail durumunda yalnızca ikonlar kalır; tooltip zorunludur. Profil/rol ve ClubSwitcher footer'da kalır.

### Yetkiye göre kabuk

| Kullanıcı                      | Görünen ana yapı                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Privileged                     | Tüm global gruplar; tüm etkinlik çalışma alanı hedefleri.                                                     |
| Owner-team Leader              | Özet, kendi etkinlikleri, aktif etkinlik Program/Başvuranlar/Kapı/Yarışmacılar/Medya; izinliyse Kısa URL.     |
| GECEKODU member                | Yalnız gerçekten yazabildiği/okuyabildiği etkinlik hedefleri; Leader etiketi veya Leader'a özgü hedefler yok. |
| Door staff                     | Etkinlik seçici + Kapı + son check-in'ler; kullanıcı/grup/içerik yönetimi yok.                                |
| `users:read`                   | Global aramada ve kişi seçicilerde kişi bulabilir; telefon/UID veya yazma eylemleri görünmez.                 |
| `url:create` / `url:moderator` | Aynı sayfada capability'ye göre oluşturma, hit sayısı ve hit ayrıntısı ayrı ayrı görünür.                     |

Navigasyon ağacı rol adına göre kopyalanmış listelerden değil, tek bir tanımın `visibleWhen(user, context)` filtresinden üretilmeli. Bu, sidebar, breadcrumb ve komut paletinin aynı yetki gerçeğini kullanmasını sağlar. Menü gizleme yalnızca UX'tir; API yetkilendirmesinin yerini almaz.

## Etkinlik çalışma alanı

Mevcut 833 satırlık hub aşağıdaki görev odaklarına ayrılmalı:

- **Özet:** durum, tarih/konum, owner team, başvuru ve check-in metrikleri, sonraki oturum, temel eylemler.
- **Program:** günler ve oturumlar; ekle/düzenle/QR işlemleri.
- **Başvuranlar:** üye/misafir roster'ı, filtre/sıralama, toplu e-posta, katılımcı ekleme, detay paneli.
- **Kapı:** oturum seçici, kişi/eposta bulma, check-in, canlı sayaç ve son işlemler. Mobilde varsayılan yüzey budur.
- **Bağlantılar & medya:** form slotları, kısa link/QR, kapak ve galeri; SkyForms'a bounce mevcut davranış olarak kalır.
- **Yarışmacılar:** yalnız yarışma kullanan etkinliklerde görünür; puan/kazanan akışı.

Desktop'ta `PageHeader` altında sabit bir yerel sekme şeridi yön duygusunu güçlendirir; sidebar aynı hedefleri bağlamsal hızlı erişim olarak gösterebilir. Telefonda sekmeler yatay kaydırılmamalı; “Bölüm” seçicisi veya tek kolon hedef listesi kullanılmalı.

## Liste ve tablo sistemi

Yeni `ResourceTable` yalnızca gerçekten sütun karşılaştırması gereken yerlerde kullanılmalı:

- Başvuranlar: kişi, tür, durum, etkinlik/oturum, check-in, ek alan özeti, eylem.
- Kullanıcılar: kişi, e-posta, ana grup/ekip, durum, son bağlam, eylem.
- Kısa URL hitleri: zaman, kaynak, kullanıcı, IP/UA özeti; hassas veri yetkiye göre.
- Yarışmacılar: kişi, etkinlik, skor, kazanan, eylem.

Ortak davranış:

- Üstte her zaman yerel arama; aktif filtreler chip olarak görünür ve tek tek/tümü temizlenebilir.
- Sıralanabilir başlık `button` olur; `aria-sort` güncellenir. İlk sütun ana nesnenin adı olmalı.
- 32–40 px “yoğun” ve 48 px “rahat” satır seçeneği; seçim yerelde saklanır.
- Satır seçimi gerekiyorsa checkbox + seçili sayısı + bağlamsal toplu işlem çubuğu.
- En fazla iki doğrudan satır eylemi; diğerleri üç nokta menüsünde. Silme gibi geri döndürülemez eylem doğrudan ikon olmamalı.
- Mobilde önemli 2–3 alan satır/kart özetine reflow eder; “daha fazla” detay drawer'ı açar. Masaüstü sütunlarını telefonda yalnız CSS ile sıkıştırmayın.
- Basit, tek başlık + alt başlık listeleri `ListPanel/ListItem` olarak kalır. Carbon da çok sütunlu içerikte contained list yerine data table öneriyor. [Carbon contained list](https://carbondesignsystem.com/components/contained-list/usage/)

## Global arama ve komut paleti

İlk sürüm:

- Masaüstü üst çubuğunda “Ara veya komut çalıştır…” butonu; `⌘K`/`Ctrl+K`.
- Mobil header'da aynı paleti açan arama ikonu.
- Bölümler: “Git”, “Oluştur”, “Son kullanılanlar”.
- Yalnız `filterSidebarNavForUser` ile erişilebilen hedefler ve aynı capability kontrolünden geçen eylemler.
- Form alanı, textarea veya contenteditable odaktayken kısayol çalışmaz.
- Ok tuşlarıyla seçim, Enter ile çalıştırma, Escape ile kapatma; sonuç sayısı canlı bölgeyle duyurulur.

İkinci sürüm, API destekliyorsa etkinlik, kişi, bilet ve kısa URL arar. Sonuçlar tür başlığıyla ayrılır; etkinlik içindeyken aynı etkinliğe ait sonuçlar önce gelir. Palet, tablo içi aramanın yerine geçmez.

## Responsive davranış

- `<768 px`: tek panel; sidebar modal drawer; event workspace tek görev; toolbar eylemleri overflow'a geçer; tablolar kart/özet satırına reflow eder.
- `768–1279 px`: sidebar rail veya 240–256 px; tek ana içerik paneli; detaylar drawer.
- `≥1280 px`: kalıcı sidebar; geniş veri sayfalarında içerik `max-w-none`, liste + detay destek paneli mümkün; form/okuma ekranları mevcut `max-w-6xl` sınırını korur.
- Kullanıcı zoom'u veya dar pencere yüzünden 320 CSS px'e indiğinde iki yönlü tüm-sayfa scroll oluşmamalı. W3C reflow kılavuzu sabit/sticky elemanların klavye odağını kapatmamasını da ister. [WCAG Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## Erişilebilirlik zorunlulukları

1. Sidebar bir `<nav aria-label="Ana navigasyon">` içermeli. Normal site navigasyonuna `role="menu"` verilmemeli; WAI bu kullanım için disclosure + gerçek link modelini öneriyor. [WAI disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
2. Her grup gerçek `button`; `aria-expanded`, `aria-controls`, Enter ve Space desteği. Aktif link `aria-current="page"`. [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
3. Mobil sidebar ve tüm drawer/modal'lar açıldığında odağı içeri almalı, `Tab`/`Shift+Tab` odağını içeride tutmalı, Escape ile kapanmalı ve odağı tetikleyiciye döndürmeli. Arkadaki içerik inert olmalı. [WAI modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
4. Görsel tablo gerçek `<table>`, `<th>` ve `<td>` semantiğini korumalı; başlık-veri ilişkisi yalnız renk/konuma bırakılmamalı. [WAI tables](https://www.w3.org/WAI/tutorials/tables/)
5. Tüm odak göstergeleri görünür; yapışkan header/toolbar odaklı kontrolü örtmez. Minimum hedef 24×24 CSS px; sık kullanılan mobil kontroller için 44×44 tercih edilir. [WCAG Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
6. Yükleme, kayıt, hata ve check-in sonucu `aria-live`/status bölgesiyle duyurulur; yalnız renk değişimi kullanılmaz.
7. `prefers-reduced-motion` altında sidebar, drawer ve liste geçişleri animasyonsuz çalışır.

## Uygulama sırası

### P0 — kabuk ve erişilebilirlik

1. Tek `NavigationNode` modeli ve capability filtresi.
2. SkyForms `NavGroup` dilini TypeScript'e taşıyan, bir seviyeli disclosure sidebar.
3. Mobil sidebar'ın kapalıyken focus alamaması; `Drawer` focus yönetimi/inert/geri dönüş düzeltmesi.
4. Desktop sidebar rail ve saklanan açık/kapalı grup durumu.

### P1 — etkinlik çalışma alanı

1. Mevcut event hub'ı route segmentlerine/bölümlere ayır.
2. Dinamik “Aktif Etkinlik” sidebar bölümü + yerel event nav.
3. Kapı için görev-odaklı mobil ekran ve canlı son işlemler.

### P2 — veri verimliliği

1. `ResourceTable`, toolbar, filtre chip'leri, sıralama, yoğunluk ve sayfalama.
2. Önce Başvuranlar; sonra Kullanıcılar, Yarışmacılar ve URL hitleri.
3. Geniş sayfa modu ve desktop liste+detay paneli.

### P3 — hızlı erişim

1. Navigasyon/oluşturma odaklı komut paleti.
2. API desteği geldiğinde yetki filtreli kaynak araması ve son kullanılanlar.

## Bitti sayılma ölçütleri

- Privileged, Leader, GECEKODU member, Door staff, `users:read`, `url:create` ve moderator için sidebar/palet snapshot veya DOM testleri var.
- Açık aktif grup route değişince korunuyor; yetkisiz çocuk yüzünden boş grup oluşmuyor.
- Event detayının her ana görevi doğrudan URL ile açılabiliyor ve tarayıcı geri/ileri davranışı doğru.
- Mobilde kapalı sidebar ve kapalı drawer içeriğine Tab ile ulaşılamıyor.
- Drawer açma-kapama için focus trap ve focus return testleri var.
- `axe`/eşdeğer otomatik tarama ile kritik ihlal yok; yalnız otomatik teste güvenmeden klavye turu yapılmış.
- 320 CSS px ve %200 zoom'da temel görevler tamamlanabiliyor; sayfa yatay taşmıyor.
- Başvuran tablosu arama, filtre, sıralama, toplu seçim ve sayfalama durumunu URL'de veya geri dönülebilir yerel durumda koruyor.
- Yeni bileşenler mevcut `skylab-*`, neutral palette ve Space Grotesk dışına çıkmıyor; ADR 0017 değişmiyor.

## Kaçınılacaklar

- Her global menü hedefinin altına sırf “dallanmış görünsün” diye seçenek eklemek.
- Üç veya daha fazla sidebar seviyesi; Carbon bunun yerine sayfa içi tabs/breadcrumb öneriyor.
- Yeni renk sistemi, büyük gradient kartlar veya SkyForms'tan kopuk bir dashboard estetiği.
- Her listeyi tabloya çevirmek; basit tarama listelerinde mevcut `ListItem` daha hızlıdır.
- Yetkiyi yalnız gizli menüyle uygulamak.
- Komut paletini ilk sürümde CRUD motoruna çevirmek; önce gezinme ve güvenli oluşturma eylemleri.
- Mobilde masaüstü tabloyu küçültmek veya tüm sayfayı yatay kaydırmak.
