# Oturum yoklama QR ekranı (projeksiyon / OBS)

Program → oturum `⋯` → **Oturum QR**. Kapı yetkilisi (`canDesk`) görür.

## Dönen QR

Core'un ekran belirteci (`door-qr?use=display`): 15 sn'de bir yenilenir, her biri 60 sn geçerli, 400 katılım. Oturumdan 12 sa önce – bitişinden 12 sa sonra çalışır (core `DOOR_QR_SESSION_GRACE`). **Tam ekran**: siyah zemin, oturum adı, QR, "Yoklama için telefonunun kamerasıyla okut".

## Programı izle (seçmeli)

- Varsayılan **kapalı**: ekran operatörün seçtiği oturumu gösterir (çekmeceyi hangi oturumdan açtıysa, ya da "Oturum" listesinden seçtiği).
- Açılınca saate göre: o an süren oturum (iç içe geçenlerde en son başlayan); yoksa sıradaki, başlık "Sıradaki: 1. Oturum · 12:15"; gün bitince son oturum. Saatsiz ve iptal edilmiş oturumlar atlanır; bitişi olmayan oturum bir sonrakinin başlangıcına kadar (sonuncusu 1 sa) sürer. Saat 15 sn'de bir yeniden okunur.
- Tercih **bu cihazda** hatırlanır (`localStorage`, `attendance-qr-follow`); gizli pencerede sayfa kapanınca unutulur.
- Elle oturum seçmek (liste ya da tam ekranda **Bu oturumda kal**) Programı izle'yi kapatır. Saatler kayarsa elle seç.
- Tam ekranda sol altta kip ve oturum yazar ("Programı izliyor · 2. Oturum" / "Elle seçildi · 2. Oturum"). Fare kıpırdatınca ya da dokununca üstte 4 sn denetim çubuğu çıkar: Programı izle, Bu oturumda kal, oturum listesi.

## Sabit QR (yazdır/ekran)

Ekran dönen QR'ı gösteremezse yedek: oturumun tek, değişmeyen QR'ı (`door-qr?use=static`). Yalnız "Sabit QR'ı göster"e basınca alınır; **Tam ekran** ve **PNG indir** (1024 px, altında oturum adı). Dönen QR'la aynı pencerede geçerli (12 sa önce – 12 sa sonra); kullanım sınırı yok. Fotoğrafı paylaşılırsa salonda olmayan da bu sürede okutabilir: canlı yayına, kayda koyma; ekran dönen QR'ı gösterebildiği anda ona dön. Sızarsa core'da `DOOR_QR_STATIC=off` (hepsi durur).

## Sınırlar (tarayıcının)

- Pencere **gizliyken** (küçültülmüş, tamamen örtülmüş, başka macOS Space'i, arka sekme) QR yenilenmez; son QR süresi dolunca (60 sn) ekrandan kalkar, pencere görünür olunca hemen geri gelir. Chrome tek ekranda tam ekranı ayrı Space'e alır: OBS'e geçince QR ~1 dk'da kaybolur.
- Bu yüzden: ekran bilgisayarında panel ayrı ekranda tam ekran ve hep görünür dursun, OBS o ekranı **Display Capture** ile alsın; ya da ayrı dizüstü doğrudan perdeye/capture kartına. OBS **Browser Source** önerilmez (panel girişi, passkey ve tam ekran orada doğrulanmadı).
- Programı izle de yalnız pencere görünürken yeni oturumun QR'ını alabilir; gizliyken oturum değişirse pencere görünür olunca yenisine geçer.
- Panel girişi en çok 8 sa yaşar: gün başında taze giriş yap.
- Hata mesajı ("QR yenilenemedi." vb.) tam ekran alanının dışında yazar; tam ekranda yalnız QR'ın kaybolduğu görülür.
