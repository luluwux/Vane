# Multilanguage README

[English](#english) | [Türkçe](#türkçe)

---

# English

Vane DPI is a professional, high-performance graphical frontend and network control center designed for the zapret deep packet inspection circumvention engine (winws on Windows, nfqws on Linux). It provides an intuitive user interface to manage, configure, and automate network level DPI bypass strategies, secure DNS routing, and firewall rules without requiring command-line interaction.

## Features

- **Graphical Controller**: Seamless management of the underlying zapret daemon (start, stop, status tracking).
- **DNS Guard (Local DoH Forwarder)**: Runs a local DNS loopback server supporting DNS-over-HTTPS (DoH), DNS-over-TLS (DoT), and DNS-over-QUIC (DoQ). Includes smart DNS caching and built-in local AdBlock/Malware protection using StevenBlack hosts list.
- **Safety and Privacy Controls**:
  - **DNS Leak Protection (Kill Switch)**: Activates firewall rules blocking outbound TCP/UDP port 53 traffic to ensure all DNS requests are securely routed.
  - **Auto-Recovery Watchdog**: Continuously monitors internet access by querying user-defined target hosts and automatically triggers tunnel recovery on connection drops.
  - **SOCKS5 Upstream Proxy**: Allows routing encrypted DNS lookups through local or remote SOCKS5 proxies (such as Tor) for maximum anonymity.
- **Categorized Log Output**: Live console with custom tag badges (MOTOR, DNS, ADBLOCK, GÜVENLİK, SİSTEM, GÜNCELLEME, HATA, UYARI) to easily track daemon status and network changes.
- **Built-in Presets**: Pre-configured strategies for various network restrictions, including the TR 1 preset specifically optimized for Turkish ISPs.
- **Remote Preset Sync**: Pulls signed preset updates from a remote repository with Minisign (Ed25519) cryptographic signature verification.
- **Auto-Start**: Integrates with Windows Task Scheduler to launch elevated on system startup without prompt screens.

---

## How It Works

Vane interfaces with the low-level packet capture driver (WinDivert on Windows, NFQUEUE on Linux) to intercept and modify outgoing network packets. It uses packet manipulation techniques to bypass passive and active DPI systems.

### DPI Desync Mechanics

DPI bypass works by confusing the inspection appliances of your ISP without breaking the state of the destination server.

- **TCP Segmentation (split, multidisorder)**: Splits HTTP requests or TLS ClientHello packets into tiny TCP segments. For example, dividing the SNI host header across segment boundaries prevents the DPI sensor from matching the host block list. Sending segments out-of-order (multidisorder) further confuses DPI.
- **Fake Packet Injection (fake, fakeknown)**: Injects fake TCP packets carrying invalid or decoy SNI hostnames before sending the real payload. The DPI inspects the fake payload and stops tracking the connection, while the server drops it based on one of the fooling modes.
- **Fooling Modes**:
  - **ttl**: Lowers the Time-To-Live (TTL) value on fake packets so they expire and drop off the network before reaching the server, while still passing through the ISP's DPI sensor.
  - **badsum**: Generates fake packets with invalid checksums. The server drops them, but many DPI units ignore checksum validation. Requires disabling checksum drop filters on your router.
  - **badseq**: Uses an out-of-window sequence number on fake packets so the server discards them immediately.
  - **md5sig**: Appends an MD5 TCP option to fakes, causing non-Linux servers to drop them.
  - **ts**: Shifts the TCP timestamp (TSval) value of fakes to fall outside the server's accepted window.
  - **autottl**: Dynamically calculates the hop distance to the server and adjusts the fake packet TTL.
- **Out-of-Band (OOB) Signals**: Sends OOB signals to saturate stateful firewall sensors.
- **SYNDATA Mode**: Inserts SYN packet data payloads to confuse connection tracking.

---

## Technical Details

### DNS Guard Configuration
The local DNS forwarder runs on loopback `127.0.0.127:5353`. It is enabled automatically if an ISP resolver is detected.

### Safety Configuration
- **Kill Switch**: Configures system firewall rules to block native port 53 traffic. Rules are cleared automatically when Vane stops.
- **Watchdog Targets**: Sends ICMP/HTTP queries to specified domains (maximum 3 targets) to verify bypass functionality.

---

## Built-in Presets

Vane includes pre-configured, tested default presets:

- **Default**: Employs fake packet injection with multidisorder. A stable option for most networks.
- **TR 1**: Optimized desync profile specifically tailored for Turkish network providers. Uses split desync with autottl, md5sig, and multi-protocol enforcement.
- **Aggressive TTL Strict**: Strict low-TTL fake packet strategy for heavily restricted networks.
- **Standard Split**: Pure TCP splitting without fake packet injection. Safe and compatible with most home routers.
- **YouTube and QUIC Focus**: Targets UDP port 443 (QUIC/HTTP3) desync to unblock video streams.
- **Discord and VoIP Fix**: Prevents RTC/VoIP connection failures by targeting UDP ports 50000-65535.
- **Deep Fragmentation**: Fine-grained fragmentation (syndata) to hide SNI headers.
- **Heavy Censorship Evasion**: Multiple packet repeats for strict firewalls.
- **Lightweight Gaming**: Minimal packet splitting to preserve ping times.
- **Out-of-Band (OOB)**: Uses OOB signals.
- **HTTPS SNI Ghost**: Merges fake and syndata for browser performance.

---

## Installation

Download the installer from the Releases section.

- **Windows**: Launch the installer and run Vane as Administrator to allow kernel driver initialization.
- **Linux**: Install the `.deb` package or run the `.AppImage`. Run with privileges matching `CAP_NET_ADMIN`.

---

## Troubleshooting

- **No connection after startup**: Make sure other DPI tools (e.g. GoodbyeDPI) are completely closed. Try switching to the Standard Split preset.
- **ISP info shows N/A**: The geolocation query was blocked or timed out. The backend will retry periodically.
- **WinDivert error**: Verify that no other software is holding the driver lock. Run Vane as Administrator.

---

# Türkçe

Vane DPI, derin paket inceleme (DPI) engellerini aşma yazılımı olan zapret (Windows üzerinde winws, Linux üzerinde nfqws) için geliştirilmiş profesyonel, yüksek performanslı bir grafiksel arayüz ve ağ yönetim merkezidir. Kullanıcılara komut satırı kullanmadan DPI atlatma stratejilerini yönetme, güvenli DNS yönlendirmesi sağlama ve güvenlik duvarı kurallarını otomatikleştirme imkanı sunar.

## Özellikler

- **Grafiksel Kontrolcü**: Zapret servisinin arka planda kolayca yönetilmesi (başlatma, durdurma, durum takibi).
- **DNS Koruması (Yerel DoH İstemcisi)**: DNS-over-HTTPS (DoH), DNS-over-TLS (DoT) ve DNS-over-QUIC (DoQ) protokollerini destekleyen yerel bir DNS sunucusu çalıştırır. Akıllı DNS önbelleği ve StevenBlack host listesi tabanlı yerleşik reklam/zararlı yazılım engelleme içerir.
- **Güvenlik ve Proxy Kontrolleri**:
  - **DNS Sızıntı Koruması (Kill Switch)**: Dışarı giden standart TCP/UDP port 53 trafiğini güvenlik duvarı kuralları ile engelleyerek tüm DNS sorgularının güvenli tünelden geçmesini zorunlu kılar.
  - **Bağlantı Kurtarma Gözlemcisi (Watchdog)**: Belirlenen hedef adreslere düzenli olarak sorgu göndererek bağlantı durumunu izler ve kesinti durumunda bypass tünelini otomatik olarak kurtarır.
  - **SOCKS5 Proxy Yönlendirme**: Güvenli DNS sorgularının yerel veya uzak bir SOCKS5 proxy sunucusu (örneğin Tor) üzerinden geçirilmesini sağlayarak gizliliği artırır.
- **Kategorize Edilmiş Log Çıktısı**: Canlı log akışını etiketler (MOTOR, DNS, ADBLOCK, GÜVENLİK, SİSTEM, GÜNCELLEME, HATA, UYARI) ve renkli rozetler yardımıyla görselleştirerek sistem takibini kolaylaştırır.
- **Hazır Ayarlar (Presets)**: Çeşitli engelleme türleri için test edilmiş hazır profiller sunar. Türkiye ağ sağlayıcıları için optimize edilmiş TR 1 profili yerleşik olarak gelmektedir.
- **Uzak Ayar Senkronizasyonu**: Vane-Presets deposundan Minisign (Ed25519) kriptografik imza doğrulaması ile güncel hazır ayarları çeker ve uygular.
- **Otomatik Başlatma**: Windows Görev Zamanlayıcısı entegrasyonu sayesinde sistem başlangıcında kullanıcı hesabı denetimi (UAC) uyarısı göstermeden yönetici yetkileriyle otomatik başlar.

---

## Nasıl Çalışır

Vane, giden ağ paketlerini yakalamak ve değiştirmek için düşük seviyeli paket yakalama sürücüsüyle (Windows'ta WinDivert, Linux'ta NFQUEUE) etkileşime girer. Bu sayede servis sağlayıcıların pasif ve aktif DPI engelleme mekanizmaları atlatılır.

### DPI Desync (Bypass) Yöntemleri

DPI engellemesini aşma prensibi, hedef sunucunun bağlantısını bozmadan servis sağlayıcının filtreleme cihazlarını yanıltmaya dayanır.

- **TCP Segmentasyonu (split, multidisorder)**: HTTP isteklerini veya TLS ClientHello paketlerini küçük parçalara ayırır. Örneğin SNI hostname bilgisini segment sınırları arasına bölerek DPI cihazının engelleme listesindeki domainleri algılamasını önler. Parçaların ters sırada gönderilmesi (multidisorder) atlatma oranını artırır.
- **Sahte Paket Enjeksiyonu (fake, fakeknown)**: Orijinal paketten önce, içinde geçersiz veya yanıltıcı SNI barındıran sahte TCP paketleri göndererir. DPI cihazı bu sahte paketi inceleyip takibi bırakırken, hedef sunucu fooling ayarları sayesinde bu paketi çöpe atar.
- **Fooling (Yanıltma) Yöntemleri**:
  - **ttl**: Sahte paketlerin TTL değerini düşürür. Böylece paketler sunucuya ulaşmadan ağda kaybolur ancak yol üstündeki DPI sensörlerinden geçer.
  - **badsum**: Sahte paketleri geçersiz TCP sağlama toplamı (checksum) ile gönderir. Sunucu paketi reddeder ancak birçok DPI cihazı checksum doğrulaması yapmaz. Modemde checksum filtresinin kapalı olmasını gerektirebilir.
  - **badseq**: Sahte paketlerde TCP penceresi dışında kalan geçersiz sıra numaraları kullanır.
  - **md5sig**: Paketlere MD5 opsiyonu ekler, bu sayede Linux dışındaki sunucular paketi yok sayar.
  - **ts**: TCP zaman damgasını (TSval) değiştirerek sunucunun paketi reddetmesini sağlar.
  - **autottl**: Sunucuye olan düğüm uzaklığını (hop count) hesaplayarak sahte paketin TTL değerini otomatik ayarlar.
- **OOB (Out-of-Band) Sinyalleri**: Güvenlik duvarı sensörlerini yanıltmak için bant dışı TCP verisi gönderir.
- **SYNDATA Modu**: Bağlantı takibini şaşırtmak için SYN paketi içerisine veri yerleştirir.

---

## Teknik Detaylar

### DNS Koruması Yapılandırması
Yerel DNS yönlendiricisi `127.0.0.127:5353` adresinde çalışır. Servis sağlayıcı DNS'i tespit edildiğinde otomatik devreye girer.

### Güvenlik Yapılandırması
- **Kill Switch**: Giden port 53 trafiğini engellemek için sistem güvenlik duvarını yapılandırır. Kurallar Vane kapatıldığında temizlenir.
- **Watchdog Hedefleri**: Bağlantının aktifliğini test etmek için belirlenen alan adlarına (en fazla 3 adet) ICMP/HTTP sorguları atar.

---

## Yerleşik Hazır Ayarlar

Vane, test edilmiş varsayılan ayarları içerir:

- **Default**: Multidisorder ve sahte paket enjeksiyonu kullanır. Birçok servis sağlayıcı için en kararlı başlangıç ayarıdır.
- **TR 1**: Türkiye'deki internet servis sağlayıcıları için özel olarak optimize edilmiş profildir. Autottl, md5sig ve çoklu protokol desteğiyle split yöntemini kullanır.
- **Aggressive TTL Strict**: Sıkı sınırlamalara sahip ağlar için düşük TTL kullanan agresif sahte paket stratejisidir.
- **Standard Split**: Sahte paket kullanmadan sadece TCP paketlerini böler. Güvenlidir ve ev modemleriyle tam uyumludur.
- **YouTube and QUIC Focus**: YouTube video akışlarını hızlandırmak için UDP port 443 trafiğini hedefler.
- **Discord and VoIP Fix**: Sesli aramaların engellenmesini önlemek için 50000-65535 aralığındaki UDP portlarını optimize eder.
- **Deep Fragmentation**: SNI başlıklarını gizlemek için paketleri syndata ile çok küçük parçalara böler.
- **Heavy Censorship Evasion**: Yüksek filtrelemeye sahip ağlar için paket tekrarları kullanır.
- **Lightweight Gaming**: Oyun gecikmesini (ping) korumak için minimum düzeyde paket bölmesi uygular.
- **Out-of-Band (OOB)**: OOB sinyalleri ile çalışır.
- **HTTPS SNI Ghost**: Tarayıcı performansı için fake ve syndata yöntemlerini harmanlar.

---

## Kurulum

İndirilen kurulum dosyasını çalıştırın.

- **Windows**: Sürücülerin yüklenebilmesi için uygulamayı Yönetici olarak çalıştırın.
- **Linux**: `.deb` paketini kurun veya `.AppImage` dosyasını çalıştırın. `CAP_NET_ADMIN` yetkisine ihtiyaç duyar.

---

## Sorun Giderme

- **Bağlantı kurulamıyor**: GoodbyeDPI veya diğer benzer araçların kapalı olduğundan emin olun. Standard Split hazır ayarına geçmeyi deneyin.
- **ISP bilgisi N/A**: Konum belirleme API'si zaman aşımına uğramıştır. Uygulama belirli aralıklarla sorguyu tekrarlayacaktır.
- **WinDivert hatası**: Başka bir uygulamanın sürücüyü kilitlemediğinden emin olun ve uygulamayı yönetici olarak başlatın.

---

## Credits

- **zapret** by bol-van — Underlaying bypass engine
- **Tauri** — Application framework
- **Minisign** — Preset signature verification

---

## License

MIT License
