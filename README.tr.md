<p align="center">
  <img src="src-tauri/icons/icon.png" width="160" alt="Vane Logo">
</p>

<h1 align="center">Vane DPI</h1>

<p align="center">
  <strong>Gelişmiş DPI Engeli Aşma ve Ağ Güvenliği Kontrol Merkezi</strong>
</p>

<p align="center">
  <a href="README.md">[![en](https://img.shields.io/badge/lang-en-red.svg)](README.md)</a>
</p>

---

## İçindekiler

- [1. Genel Bakış ve Proje Hedefleri](#1-genel-bakış-ve-proje-hedefleri)
- [2. Derin Paket İnceleme (DPI) Nasıl Çalışır](#2-derin-paket-inceleme-dpi-nasıl-çalışır)
  - [2.1. Pasif DPI ve Aktif DPI Karşılaştırması](#21-pasif-dpi-ve-aktif-dpi-karşılaştırması)
  - [2.2. SNI ve Hostname Ayıklama Süreci](#22-sni-ve-hostname-ayıklama-süreci)
  - [2.3. Blok Enjeksiyonu (RST ve Yönlendirmeler)](#23-blok-enjeksiyonu-rst-ve-yönlendirmeler)
  - [2.4. DNS Zehirlenmesi (Poisoning)](#24-dns-zehirlenmesi-poisoning)
- [3. Zapret Mimarisi ve nfqws/winws Çekirdeği](#3-zapret-mimarisi-ve-nfqwswinws-çekirdeği)
- [4. Gelişmiş Bypass Tekniklerinin Detaylı Açıklamaları](#4-gelişmiş-bypass-tekniklerinin-detaylı-açıklamaları)
  - [4.1. TCP Segmentasyonu ve Paket Sıralaması](#41-tcp-segmentasyonu-ve-paket-sıralaması)
  - [4.2. Sahte Paket Enjeksiyonu ve Fooling (Yanıltma) Yöntemleri](#42-sahte-paket-enjeksiyonu-ve-fooling-yanıltma-yöntemleri)
  - [4.3. TLS ClientHello Sahte Paket Özelleştirmeleri](#43-tls-clienthello-sahte-paket-özelleştirmeleri)
  - [4.4. TCP Sıra Numarası Çakıştırma (seqovl)](#44-tcp-sıra-numarası-çakıştırma-seqovl)
  - [4.5. IP ID Atama Şemaları](#45-ip-id-atama-şemaları)
  - [4.6. Paket Yeniden Birleştirme (Kyber ve Parçalı ClientHello)](#46-paket-yeniden-birleştirme-kyber-ve-parçalı-clienthello)
  - [4.7. UDP Desync ve QUIC/VoIP Engeli Aşma Yolları](#47-udp-desync-ve-quicvoip-engeli-aşma-yolları)
  - [4.8. Sunucu Tarafı Cevap Manipülasyonu (wssize)](#48-sunucu-tarafı-cevap-manipülasyonu-wssize)
  - [4.9. Yinelenen Paket Enjeksiyonu (Duplicates)](#49-yinelenen-paket-enjeksiyonu-duplicates)
  - [4.10. Orijinal Paket Başlık Değişiklikleri](#410-orijinal-paket-başlık-değişiklikleri)
  - [4.11. SYNDATA Modu](#411-syndata-modu)
  - [4.12. IP Önbellek Yönetimi](#412-ip-önbellek-yönetimi)
  - [4.13. Bağlantı Takibi (Conntrack)](#413-bağlantı-takibi-conntrack)
- [5. Vane Ekosistemi ve Özellikleri](#5-vane-ekosistemi-ve-özellikleri)
  - [5.1. DNS Koruması (Yerel DoH/DoT/DoQ Yönlendirici)](#51-dns-koruması-yerel-dohdotdoq-yönlendirici)
  - [5.2. Güvenlik Denetimleri (Kill Switch ve Watchdog)](#52-güvenlik-denetimleri-kill-switch-ve-watchdog)
  - [5.3. SOCKS5 Üst Düzey Proxy Yapılandırması](#53-socks5-üst-düzey-proxy-yapılandırması)
  - [5.4. Canlı Log Konsolu ve Kategorize Edilmiş Etiketler](#54-canlı-log-konsolu-ve-kategorize-edilmiş-etiketler)
- [6. Parametrelerin Kombinasyonu (Pratik Senaryolar)](#6-parametrelerin-kombinasyonu-pratik-senaryolar)
- [7. Güvenlik Duvarı ve Linux Entegrasyonu (Iptables/Nftables)](#7-güvenlik-duvarı-ve-linux-entegrasyonu-iptablesnftables)
- [8. Sınırlar ve Engellemenin Aşılamadığı Durumlar](#8-sınırlar-ve-engellemenin-aşılamadığı-durumlar)
- [9. Kod Tabanı Mimarisi ve Geliştirici Kılavuzu](#9-kod-tabanı-mimarisi-ve-geliştirici-kılavuzu)
- [10. Sorun Giderme ve Teşhis](#10-sorun-giderme-ve-teşhis)
- [11. Emeği Geçenler ve Lisans](#11-emeği-geçenler-ve-lisans)

---

## 1. Genel Bakış ve Proje Hedefleri

Vane DPI, derin paket inceleme (DPI) engellerini aşma aracı olan zapret (Windows üzerinde winws, Linux üzerinde nfqws) için geliştirilmiş yüksek performanslı bir grafiksel kontrol paneli ve ağ güvenlik merkezidir. Zapret motoru ağ seviyesinde son derece güçlü olmasına karşın, yapılandırılması süreç yönetimi, karmaşık terminal komutları ve işletim sistemi düzeyindeki güvenlik duvarı politikalarının manuel ayarlanmasını gerektirir.

Vane, bu süreci tamamen otomatik hale getirerek kullanıcıya görsel bir arayüz sağlar. Gerekli servislerin başlatılması, yerel güvenlik duvarı kurallarının yazılması, şifreli DNS tünellerinin oluşturulması ve ağ durumunun anlık test edilmesi gibi kritik arka plan süreçlerini kendi yönetir. Amacı, ağ yöneticileri, yazılım geliştiricileri ve ileri düzey kullanıcılar için güvenli ve kararlı bir DPI aşma platformu sunmaktır.

---

## 2. Derin Paket İnceleme (DPI) Nasıl Çalışır

Etkili bir atlatma stratejisi oluşturmak için internet servis sağlayıcılarının (ISS) kullandığı denetim sistemlerinin çalışma biçiminin bilinmesi gerekir.

### 2.1. Pasif DPI ve Aktif DPI Karşılaştırması

- **Pasif DPI**: Ağın ana hattına yerleştirilen optik bölücüler veya ayna portlar (TAP) aracılığıyla çalışır. Trafiğin bir kopyasını alarak inceler. Doğrudan veri hattında yer almadığı için giden paketleri fiziksel olarak düşüremez (drop edemez). Bunun yerine, yasaklı bir istek algıladığında hem istemciye hem sunucuya sahte TCP RST (Reset) veya HTTP yönlendirme paketleri enjekte eder.
- **Aktif DPI**: Doğrudan veri hattı üzerine (inline) kurulur. Paketleri gerçek zamanlı olarak geciktirebilir, silebilir (drop), değiştirebilir veya hız sınırlandırması uygulayabilir. Aktif sistemleri atlatmak, paket düşürme yetenekleri nedeniyle daha zordur.

### 2.2. SNI ve Hostname Ayıklama Süreci

DPI cihazları şifreli bağlantıların başlangıç aşamasını (el elkışma - handshake) izler.
- **HTTP**: İstek paketinin içindeki düz metin olan Host: başlığı incelenir.
- **HTTPS (TLS)**: Sunucu Adı Belirtimi (SNI) uzantısı incelenir. ClientHello paketi içinde giden alan adı, ISS'nin engelleme listesindeki bir desenle eşleşirse bloklama tetiklenir.

### 2.3. Blok Enjeksiyonu (RST ve Yönlendirmeler)

Yasaklı alan adı tespit edildiğinde:
- Pasif DPI enjektörü, TCP başlığında RST veya FIN bayrağı ayarlanmış sahte paketleri istemci ve sunucuya gönderir.
- HTTP bağlantılarında ise tarayıcıya sahte bir HTTP 302 yönlendirmesi göndererek kullanıcının ISS uyarı sayfasına gitmesini sağlar.
- Sahte paket sunucunun gerçek yanıtından önce ulaşırsa bağlantı sonlandırılır.

### 2.4. DNS Zehirlenmesi (Poisoning)

TCP bağlantısı kurulmadan önce alan adının çözümlenmesi gerekir. ISS'ler standart UDP/TCP port 53 DNS sorgularını izler ve yasaklı siteler için sahte IP adresleri döndürür ya da sorguları tamamen yanıtsız bırakır.

---

## 3. Zapret Mimarisi ve nfqws/winws Çekirdeği

Vane'in alt katmanda yönettiği zapret mimarisi şu sürücüleri kullanır:
- Windows'ta **WinDivert**: Kullanıcı alanından gelen filtrelerle ağ paketlerini yakalayan, değiştiren ve enjekte eden çekirdek seviyesinde bir sürücüdür.
- Linux'ta **NFQUEUE**: Paketleri işlenmek üzere kullanıcı alanındaki kuyruklara yönlendiren bir güvenlik duvarı hedefidir.

Filtreler doğrultusunda yakalanan paketler parse edilir, ilgili alanları modifiye edilir ve ağ yığınına tekrar gönderilir.

---

## 4. Gelişmiş Bypass Tekniklerinin Detaylı Açıklamaları

Bu bölüm, Vane'in Gelişmiş (Advanced) sekmesinde yer alan paket manipülasyon parametrelerinin teknik ayrıntılarını açıklamaktadır.

### 4.1. TCP Segmentasyonu ve Paket Sıralaması

DPI sistemleri yüksek hızlı donanımsal yeniden birleştirme tamponlarına (reassembly buffers) sahiptir. TCP akışı birleştirilemezse paket içeriği denetlenemez.

- **multisplit**: TCP verisini split pozisyon listesinde belirlenen çoklu sınırlardan böler.
- **multidisorder**: Bölünen paket segmentlerini ters sırada gönderir (örneğin segment 2, segment 1'den önce gönderilir). Hedef sunucunun işletim sistemi bu paketleri tampona alır, segment 1 geldiğinde doğru sırada birleştirerek uygulamaya iletir. Ancak DPI cihazının bu sırasız paketleri izlemek için oturum tablosu tutması gerekir; bu da yüksek kaynak tükettiğinden genellikle bypass ile sonuçlanır.
- **fakedsplit**: Tek pozisyonlu bölme işlemi uygulayarak orijinal segmentlerin arasına sahte veri paketleri serpiştirir. Segmentler ardışık sırada gönderilir.
- **fakeddisorder**: fakedsplit mantığıyla çalışır ancak orijinal paket segmentlerini sunucuya ters sırada gönderir.
- **hostfakesplit**: İstek paketini Host başlığının etrafından bölerek gerçek alan adından önce ve sonra sahte alan adları enjekte eder.

#### İşaretçiler (Markers) ve Bölme Noktaları
Bölme noktaları şu işaretçiler yardımıyla dinamik olarak çözümlenir:
- **method**: HTTP istek metodunun (GET, POST vb.) başladığı nokta.
- **host**: HTTP veya TLS SNI başlığındaki alan adının başladığı nokta.
- **endhost**: Alan adının bittiği ilk bayt.
- **sld**: İkinci seviye alan adının (second-level domain) başladığı nokta.
- **endsld**: İkinci seviye alan adının bittiği ilk bayt.
- **midsld**: İkinci seviye alan adının tam ortası.
- **sniext**: TLS SNI uzantısının veri alanının başlangıcı.

Örnek yapılandırma:
`--dpi-desync-split-pos=method+2,midsld` ifadesi HTTP için method+2 konumunu, TLS için ise midsld konumunu bölme noktası olarak alır.

#### Segment Sıralaması ve Altorder Modifikasyonları
`--dpi-desync-fakedsplit-mod=altorder=N` parametresi ile paket segmentlerinin gönderim sırası özelleştirilebilir:
- **altorder=0**: Sahte 1. segment, gerçek 1. segment, sahte 1. segment, sahte 2. segment, gerçek 2. segment, sahte 2. segment.
- **altorder=1**: Gerçek 1. segment, sahte 1. segment, sahte 2. segment, gerçek 2. segment, sahte 2. segment.
- **altorder=2**: Gerçek 1. segment, sahte 2. segment, gerçek 2. segment, sahte 2. segment.
- **altorder=3**: Gerçek 1. segment, sahte 2. segment, gerçek 2. segment.
- **altorder=8**: Gerçek paket, sahte paket.
- **altorder=16**: Sadece gerçek paket (sahteler enjekte edilmez).

### 4.2. Sahte Paket Enjeksiyonu ve Fooling (Yanıltma) Yöntemleri

Sahte paket enjeksiyonu, orijinal veriden önce yasaklı alan adını içeren sahte bir istek paketi göndererek DPI sensörünü doyurmayı hedefler. DPI bu sahte paketi engellediğini varsayarak oturumu izlemeyi bırakır. Hemen ardından gerçek paket gönderilir. Gerçek sunucunun bu sahte paketi alıp bağlantıyı koparmaması için şu yanıltma (fooling) yöntemleri kullanılır:

- **ttl**: Sahte paketlerin Yaşam Süresi (TTL) değerini düşürür. Paket, ISS'nin DPI sensöründen geçtikten sonra hedef sunucuya ulaşamadan ağda yok olur. Düğüm mesafesinin doğru ayarlanması gerekir. Bazı orijinal modem yazılımları giden paketlerin TTL değerini sabitleyebilir; bu durumda TTL yanıltması çalışmayacaktır.
- **badsum**: Geçersiz bir TCP sağlama toplamına (checksum) sahip paket üretir. Sunucu paketi reddeder ancak birçok DPI cihazı checksum doğrulaması yapmaz. Ev routerlarında bu paketlerin düşürülmemesi için router üzerinde `net.netfilter.nf_conntrack_checksum=0` ayarı yapılmalıdır. Aksi halde Linux tabanlı routerlar geçersiz checksum paketlerini FORWARD zincirinde düşürür.
- **badseq**: TCP penceresi dışında kalan geçersiz sıra numaraları kullanır. Varsayılan artış değeri -10000'dir. DPI cihazı eğer pencere boyutunu takip ediyorsa bu paketi yok sayabilir. Kesin bir çözüm için artış değerini 0x80000000 yaparak paketi tamamen pencere dışına itmek mümkündür.
- **md5sig**: Paket başlığına MD5 imza seçeneği ekler. Linux dışındaki sunucular bu paketi kabul etmez. Bu seçenek TCP başlığında ek alan kapladığı için Kyber tabanlı parçalı ClientHello isteklerinde MTU aşımına yol açabilir.
- **datanoack**: Sahte paketleri ACK bayrağı olmadan gönderir. Sunucular ACK bayrağı olmayan paketleri reddederken DPI cihazları genellikle işler. Bazı routerlarda NAT veya masquerade kurallarıyla çakışabilir.
- **ts**: TCP zaman damgasını (TSval) değiştirerek sunucunun PAWS mekanizması tarafından paketi reddetmesini sağlar. İstemci işletim sisteminde zaman damgalarının açık olmasını gerektirir. Windows için şu komutla etkinleştirilir:
  `netsh interface tcp set global timestamps=enabled`
- **autottl**: Sunucudan gelen paketlerin TTL değerini ölçerek aradaki düğüm mesafesini hesaplar ve sahte paketin TTL'ini sunucuya ulaşmayacak şekilde dinamik olarak ayarlar. İşletim sistemlerinin standart varsayılan TTL değerlerini (64, 128, 255) baz alır.

### 4.3. TLS ClientHello Sahte Paket Özelleştirmeleri

Vane, enjekte edilen sahte paketlerin TLS parmak izi denetimlerine takılmaması için şu özelleştirmeleri destekler:
- **rnd**: Her istekte TLS yapısı içindeki Random ve Session ID alanlarını rastgele hale getirir.
- **rndsni**: Rastgele belirlenen bir alt alan adı ve popüler bir alan adı uzantısı kullanarak SNI kısmını rastgele doldurur.
- **dupsid**: Orijinal ClientHello paketindeki Session ID bilgisini kopyalayarak sahte paketin aynı oturumun bir parçası gibi görünmesini sağlar.
- **sni=domain**: SNI uzantısını belirlenen izinli bir alan adına (örneğin iana.org) dönüştürür ve paket boyutu uzunluklarını otomatik düzeltir.
- **padencap**: Sahte TLS verisi içerisindeki padding uzantısını orijinal paket boyutu kadar genişleterek paket boyutu imzalarını yanıltır.

### 4.4. TCP Sıra Numarası Çakıştırma (seqovl)

`seqovl` yöntemi, sahte segmentin sıra numaralarını orijinal segmentin sıra numaralarıyla çakıştırarak gönderir.
- Sunucu akışı birleştirirken gerçek veriyi öncelikli kabul eder ve sahte verinin üzerine yazar.
- DPI cihazı ise gelen ilk veriyi nihai kabul ettiği için sahte veriyi okur. Böylece DPI'ın denetlediği veri ile sunucunun işlediği veri birbirinden farklı olur. Windows sunucuları sıra numarası çakışmalarını Linux tabanlı sunucular gibi işlemediğinden seqovl yöntemi Windows barındırıcılarda başarısız olabilir.

### 4.5. IP ID Atama Şemaları

IP paket başlıklarının tutarlılığını denetleyen sistemleri aşmak için şu şemalar yapılandırılabilir:
- **seq**: Her enjekte edilen paket için IP ID değerini düzenli artırır.
- **seqgroup**: Sahte segmentin IP ID'sini orijinal segmentle eşleştirir.
- **rnd**: Tamamen rastgele IP ID'leri atar.
- **zero**: IP ID değerini sıfıra zorlar (Linux/BSD).

### 4.6. Paket Yeniden Birleştirme (Kyber ve Parçalı ClientHello)

Yeni nesil tarayıcılar, TLS el sıkışma boyutunu artıran post-quantum kriptografi (ML-KEM/Kyber) algoritmaları kullanır. Bu durum SNI bilgisinin birden fazla pakete bölünmesine neden olur.
- Vane'in arka plan servisi, parçalı gelen el sıkışma isteklerini yakalar.
- Tüm parçalar gelene kadar paketleri bekletir ve ardından desync stratejisini birleştirilmiş veri bloğuna tek seferde uygular.

### 4.7. UDP Desync ve QUIC/VoIP Engeli Aşma Yolları

QUIC (HTTP/3) protokolü UDP port 443 üzerinden çalışır. UDP'de akış segmentasyonu yapılamadığı için:
- Aşma işlemi sahte UDP paket enjeksiyonu (`fake`), uzunluk değiştirme (`udplen`) veya IPv6'ya özel ek başlıklarla gerçekleştirilir.
- `udplen` parametresi, UDP paketlerinin boyutunu değiştirerek imza tabanlı engellemeleri engeller.
- VoIP ve Discord ses protokolleri yüksek UDP port aralıklarını (50000-65535) kullanır. Vane, bu port aralıklarında sahte paket enjeksiyonu uygulayarak bağlantıyı kararlı hale getiren hazır kurallar barındırır.

### 4.8. Sunucu Tarafı Cevap Manipülasyonu (wssize)

DPI sunucudan gelen sertifika bilgisini okuyarak engelleme yapıyorsa, el sıkışma sırasında sunucuya bildirilen TCP Pencere Boyutu (`--wssize`) sınırlandırılır. Bu durum sunucunun cevabını çok küçük paketlere bölmesini zorunlu kılar ve DPI'ın tek seferde sertifikayı okumasını engeller.
- wssize pencere ölçek çarpanını belirler (örneğin `1:6`).
- El sıkışma sırasında hızı düşürse de sunucu tarafındaki SNI tarayıcılarını atlatır.
- İlk istek başarıyla iletildikten sonra Vane'in bağlantı takipçisi (conntrack) pencere boyutunu normale çekerek veri indirme hızını geri kazandırır.

### 4.9. Yinelenen Paket Enjeksiyonu (Duplicates)

`--dup=N` parametresi, orijinal paketlerin belirlenen sayıda kopyasını enjekte eder.
- Kopyalanan paketler özel TTL (`--dup-ttl`) veya autottl politikalarıyla gönderilebilir.
- Paket anomalileri eklenerek (örneğin geçersiz TCP bayrakları veya MD5 imzaları), DPI cihazının oturum takip bütünlüğü bozulur.

### 4.10. Orijinal Paket Başlık Değişiklikleri

Vane, orijinal giden paketlerin başlık alanlarını da modifiye edebilir. `--orig-ttl` veya `--orig-autottl` kullanılarak istemcinin gerçek işletim sistemi imzaları maskelenir ve DPI'ın TTL tabanlı analiz hesaplamaları yanıltılır.

### 4.11. SYNDATA Modu

Standart koşullarda TCP SYN paketlerinde veri bulunmaz. SYNDATA modu, SYN paketinin içerisine veri bloğu (genellikle 16 adet sıfır baytı) yerleştirir. Sunucu bunu yok sayarken, DPI cihazının durum takip mekanizması el sıkışmanın fazını yanlış analiz eder.

### 4.12. IP Önbellek Yönetimi

Sunucuya giden ilk paketten itibaren otomatik TTL hesaplamalarını uygulayabilmek için Vane, arka planda dinamik bir IP önbelleği (IP cache) tutar.
- Önbellek, sunucu IP adreslerini ve ağ arayüzlerini hop mesafeleriyle eşleştirir.
- Aynı sunucuya yapılan sonraki isteklerde autottl anında devreye girer.
- Önbellek süresi varsayılan olarak 2 saattir ve `--ipcache-lifetime` ile değiştirilebilir.

### 4.13. Bağlantı Takibi (Conntrack)

Vane, çoklu paket birleştirmelerini ve pencere boyutu kesintilerini yönetmek için hafif bir bağlantı takip sistemi barındırır.
- Bağlantı fazlarını (SYN, ESTABLISHED, FIN) ve UDP akışlarını takip eder.
- Zaman aşımına uğrayan pasif bağlantıları bellekten temizler.
- Sorun teşhisi için daemona `SIGUSR1` sinyali gönderilerek aktif conntrack tablosu standart çıktıya yazdırılabilir.

---

## 5. Vane Ekosistemi ve Özellikleri

Vane arayüzü, motoru yönetmenin yanında ek ağ servisleri barındırır.

### 5.1. DNS Koruması (Yerel DoH/DoT/DoQ Yönlendirici)
DNS Koruması `127.0.0.127:5353` adresinde yerel bir çözümleyici çalıştırır.
- UDP port 53 üzerinden gelen standart DNS sorgularını şifreli DoH, DoT veya DoQ isteklerine dönüştürür.
- Çözümlenen adresleri bellekte önbelleğe alarak sonraki erişimleri hızlandırır.
- StevenBlack hosts listesini kullanarak reklam, takipçi ve zararlı yazılım içeren alan adlarını DNS seviyesinde engeller.

### 5.2. Güvenlik Denetimleri (Kill Switch ve Watchdog)
- **Kill Switch**: Güvenlik duvarı kuralları yazarak dışarı giden standart DNS (port 53) trafiğini engeller ve DNS sızıntılarını önler. Vane kapatıldığında kurallar otomatik silinir.
- **Watchdog**: Belirlenen test adreslerine (örneğin `discord.com`) düzenli sorgular atar. Bağlantı kesilirse tüneli otomatik olarak yeniden başlatır veya optimizasyon taraması yapar.

### 5.3. SOCKS5 Üst Düzey Proxy Yapılandırması
DNS Guard'ın şifreli DNS sorgularını bir SOCKS5 proxy (örneğin Tor) üzerinden geçirerek sorgu kaynağını gizler.

### 5.4. Canlı Log Konsolu ve Kategorize Edilmiş Etiketler
Konsola düşen loglar kategorilerine göre renkli etiketlerle ayrıştırılır:
- `[MOTOR]`: Zapret motorunun çalışma ve süreç logları (mor).
- `[DNS]`: DNS Guard sorguları ve protokol değişiklikleri (yeşil).
- `[ADBLOCK]`: Reklam engelleme filtreleme olayları (kırmızı).
- `[GÜVENLİK]`: Yönetici yetki durumları ve sürücü kilitleri (sarı).
- `[SİSTEM]`: Başlangıç görevleri ve ağ değişiklikleri (mavi).
- `[HATA]`: Süreç çalışma hataları (kırmızı).
- `[UYARI]`: Kritik olmayan uyarılar ve kurtarma denemeleri (amber).

---

## 6. Parametrelerin Kombinasyonu (Pratik Senaryolar)

Farklı engelleme türlerine karşı parametrelerin birlikte kullanımı aşağıda örneklendirilmiştir.

### Senaryo 1: Standart Split Aşma (Güvenli, Yüksek Uyumluluk)
Temel engellemelere karşı sahte paket üretmeden çalışan uyumlu bir yöntemdir.
```
--wf-tcp=80,443 --dpi-desync=split --dpi-desync-split-pos=2
```
*Çalışma Mantığı*: Tüm HTTP ve TLS el sıkışmalarını 2. bayt konumundan böler.

### Senaryo 2: Autottl ve Sahte Paket Enjeksiyonu (Agresif Strateji)
Alan adının sıkı denetlendiği ve sahte paketlerin kabul edildiği ağlarda kullanılır.
```
--wf-tcp=80,443 --dpi-desync=fake,multidisorder --dpi-desync-autottl=-1:3-20 --dpi-desync-fooling=badseq --dpi-desync-any-protocol
```
*Çalışma Mantığı*:
1. Sunucunun gerçek TTL değerini ölçer.
2. Belirlenen TTL ve badseq değeri ile sahte paket enjekte eder.
3. Kalan orijinal paket parçalarını ters sırada sunucuya gönderir.

### Senaryo 3: Türkiye Ağ Sağlayıcıları Ayarı (TR 1 Yerleşik Preseti)
Türkiye'deki servis sağlayıcıların engelleme yapılarına karşı optimize edilmiş yerleşik kuraldır.
```
--wf-tcp=80,443 --wf-udp=443 --dpi-desync=split --dpi-desync-any-protocol --dpi-desync-cutoff=d3 --dpi-desync-split-pos=4 --dpi-desync-fooling=md5sig --dpi-desync-autottl
```
*Çalışma Mantığı*:
- Hem TCP (web siteleri) hem de UDP (QUIC/HTTP3) trafiğini hedefler.
- Kesin bölme pozisyonu 4 olacak şekilde split yöntemini uygular.
- MD5 signature yanıltmasını kullanarak sahte veri doğrulamalarını aşar.
- autottl ile TTL sınırlarını otomatik belirler.

---

## 7. Güvenlik Duvarı ve Linux Entegrasyonu (Iptables/Nftables)

Linux üzerinde `nfqws` kullanımı için paketlerin NFQUEUE kuyruğuna yönlendirilmesi gerekir.

### Iptables Yönlendirme Örneği
```bash
# Giden HTTP ve HTTPS trafiğini nfqws kuyruk 1'e yönlendir
iptables -A OUTPUT -p tcp -m multiport --dports 80,443 -j NFQUEUE --queue-num 1 --queue-bypass

# Gelen trafiği yönlendir (autottl hesaplamaları için gereklidir)
iptables -A INPUT -p tcp -m multiport --sports 80,443 -j NFQUEUE --queue-num 1 --queue-bypass
```

### Nftables Yönlendirme Örneği
```nftables
table inet vane_filter {
    chain bypass_out {
        type filter hook output priority filter; policy accept;
        tcp dport { 80, 443 } queue num 1 bypass
    }
    chain bypass_in {
        type filter hook input priority filter; policy accept;
        tcp sport { 80, 443 } queue num 1 bypass
    }
}
```

---

## 8. Sınırlar ve Engellemenin Aşılamadığı Durumlar

Paket manipülasyon teknikleri şu senaryolarda yetersiz kalabilir:
1. **IP Tabanlı Engelleme**: Hedef sunucunun IP adresi yönlendirme katmanında tamamen yasaklandıysa paket içeriğini değiştirmek işe yaramaz. VPN veya proxy kullanımı zorunludur.
2. **Aktif TCP Yeniden Yapılandırma**: ISS trafiği tamamen sonlandırıp yeniden inşa eden şeffaf bir proxy (transparent proxy) üzerinden yönlendiriyorsa, Vane'in değiştirdiği paketler proxy tarafından yutulur.
3. **Aktif Problama (Active Probing)**: Güvenlik duvarının istemciye doğrulama paketleri göndererek bağlantının gerçekliğini test ettiği durumlar.

---

## 9. Kod Tabanı Mimarisi ve Geliştirici Kılavuzu

Vane kod tabanı Rust (backend) ve React/TypeScript (frontend) olarak ikiye ayrılır.

```
src/                        React arayüzü (bileşenler, store ve stiller)
src-tauri/
  src/
    engine/                 Süreç yönetimi, logger ve parametre temizleyici
    dns/                    Yerel yönlendirici, önbellek ve filtreleme ayarları
    presets/                Senkronizasyon ve Minisign imza kontrolleri
    logging.rs              Canlı log etiket sınıflandırması
    commands.rs             Arayüze sunulan Tauri API komutları
```

### Parametre Temizleyici (Sanitizer)
Komut enjeksiyonu açıklarını önlemek için `src-tauri/src/engine/sanitizer.rs` dosyası süreç başlatılmadan önce tüm argümanları beyaz liste üzerinden kontrol eder. Listede olmayan parametreler reddedilir.

---

## 10. Sorun Giderme ve Teşhis

- **WinDivert sürücü hatası**: GoodbyeDPI gibi diğer aşma araçlarının tamamen kapalı olduğundan emin olun.
- **DNS Sızıntısı**: Safety & Proxy sekmesinden Kill Switch özelliğinin açık olduğunu doğrulayın.
- **Log ekranında [HATA] yazısı**: Vane'in Yönetici (Administrator) yetkileriyle başlatıldığından emin olun.

---

## 11. Emeği Geçenler ve Lisans

- **zapret** by bol-van: Atlatma motoru çekirdeği.
- **Tauri**: Uygulama çerçevesi.
- **Minisign**: Kriptografik imza doğrulama kütüphanesi.

MIT Lisansı ile korunmaktadır.
