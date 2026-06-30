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
  - [4.3. TCP Sıra Numarası Çakıştırma (seqovl)](#43-tcp-sıra-numarası-çakıştırma-seqovl)
  - [4.4. IP ID Atama Şemaları](#44-ip-id-atama-şemaları)
  - [4.5. Paket Yeniden Birleştirme (Kyber ve Parçalı ClientHello)](#45-paket-yeniden-birleştirme-kyber-ve-parçalı-clienthello)
  - [4.6. UDP Desync ve QUIC Engeli Aşma Yolları](#46-udp-desync-ve-quic-engeli-aşma-yolları)
  - [4.7. Sunucu Tarafı Cevap Manipülasyonu (wssize)](#47-sunucu-tarafı-cevap-manipülasyonu-wssize)
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

DPI cihazları şifreli bağlantıların başlangıç aşamasını (el sıkışma - handshake) izler.
- **HTTP**: İstek paketinin içindeki düz metin olan `Host:` başlığı incelenir.
- **HTTPS (TLS)**: Sunucu Adı Belirtimi (SNI) uzantısı incelenir. `ClientHello` paketi içinde giden alan adı, ISS'nin engelleme listesindeki bir desenle eşleşirse bloklama tetiklenir.

### 2.3. Blok Enjeksiyonu (RST ve Yönlendirmeler)

Yasaklı alan adı tespit edildiğinde:
- Pasif DPI enjektörü, TCP başlığında `RST` veya `FIN` bayrağı ayarlanmış sahte paketleri istemci ve sunucuya gönderir.
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

- **split**: TCP verisini belirlenen noktalardan böler. Örneğin, TLS ClientHello paketini SNI domain bilgisinin tam ortasından bölmek, DPI'ı bu verileri birleştirmeye zorlar. Yüksek trafik yükü altında birçok DPI cihazı bu birleştirme işlemini yapamaz ve paketin geçmesine izin verir.
- **multisplit**: TCP verisini birden fazla belirlenmiş sınır noktasından böler.
- **multidisorder**: Bölünen paket segmentlerini ters sırada gönderir (örneğin segment 2, segment 1'den önce gönderilir). Hedef sunucunun işletim sistemi bu paketleri tampona alır, segment 1 geldiğinde doğru sırada birleştirerek uygulamaya iletir. Ancak DPI cihazının bu sırasız paketleri izlemek için oturum tablosu tutması gerekir; bu da yüksek kaynak tükettiğinden genellikle bypass ile sonuçlanır.
- **hostfakesplit**: Gerçek alan adının etrafına sahte alan adı parçaları yerleştirerek DPI analizörünü şaşırtır.

### 4.2. Sahte Paket Enjeksiyonu ve Fooling (Yanıltma) Yöntemleri

Sahte paket enjeksiyonu (`fake`, `fakeknown`), orijinal veriden önce yasaklı alan adını içeren sahte bir istek paketi göndererek DPI sensörünü doyurmayı hedefler. DPI bu sahte paketi engellediğini varsayarak oturumu izlemeyi bırakır. Hemen ardından gerçek paket gönderilir. Gerçek sunucunun bu sahte paketi alıp bağlantıyı koparmaması için şu yanıltma (fooling) yöntemleri kullanılır:

- **ttl**: Sahte paketlerin Yaşam Süresi (TTL) değerini düşürür. Paket, ISS'nin DPI sensöründen geçtikten sonra hedef sunucuya ulaşamadan ağda yok olur.
- **badsum**: Geçersiz bir TCP sağlama toplamına (checksum) sahip paket üretir. Sunucu paketi çöpe atar ancak birçok DPI cihazı sağlama toplamını doğrulamaz. Ev routerlarında geçersiz checksum paketlerinin düşürülmesini engellemek için router üzerinde `net.netfilter.nf_conntrack_checksum=0` ayarı yapılmalıdır.
- **badseq**: TCP penceresi dışında kalan geçersiz sıra numaraları kullanır. Sunucu bunu geçersiz veri olarak değerlendirip reddeder.
- **md5sig**: Paket başlığına MD5 imza seçeneği ekler. Linux dışındaki sunucular bu paketi kabul etmez.
- **ts**: TCP zaman damgasını (TSval) değiştirerek sunucunun PAWS mekanizması tarafından reddedilmesini sağlar.
- **autottl**: Sunucudan gelen paketlerin TTL değerini ölçerek aradaki düğüm mesafesini hesaplar ve sahte paketin TTL'ini sunucuya ulaşmayacak şekilde dinamik olarak ayarlar.

### 4.3. TCP Sıra Numarası Çakıştırma (seqovl)

`seqovl` yöntemi, sahte segmentin sıra numaralarını orijinal segmentin sıra numaralarıyla çakıştırarak gönderir.
- Sunucu akışı birleştirirken gerçek veriyi öncelikli kabul eder ve sahte verinin üzerine yazar.
- DPI cihazı ise gelen ilk veriyi nihai kabul ettiği için sahte veriyi okur. Böylece DPI'ın denetlediği veri ile sunucunun işlediği veri birbirinden farklı olur.

### 4.4. IP ID Atama Şemaları

IP paket başlıklarının tutarlılığını denetleyen sistemleri aşmak için şu şemalar yapılandırılabilir:
- **seq**: Her enjekte edilen paket için IP ID değerini düzenli artırır.
- **seqgroup**: Sahte segmentin IP ID'sini orijinal segmentle eşleştirir.
- **rnd**: Tamamen rastgele IP ID'leri atar.
- **zero**: IP ID değerini sıfıra zorlar (Linux/BSD).

### 4.5. Paket Yeniden Birleştirme (Kyber ve Parçalı ClientHello)

Yeni nesil tarayıcılar, TLS el sıkışma boyutunu artıran post-quantum kriptografi (ML-KEM/Kyber) algoritmaları kullanır. Bu durum SNI bilgisinin birden fazla pakete bölünmesine neden olur.
- Vane'in arka plan servisi, parçalı gelen el sıkışma isteklerini yakalar.
- Tüm parçalar gelene kadar paketleri bekletir ve ardından desync stratejisini birleştirilmiş veri bloğuna tek seferde uygular.

### 4.6. UDP Desync ve QUIC Engeli Aşma Yolları

QUIC (HTTP/3) protokolü UDP port 443 üzerinden çalışır. UDP'de akış segmentasyonu yapılamadığı için:
- Aşma işlemi sahte UDP paket enjeksiyonu (`fake`), uzunluk değiştirme (`udplen`) veya IPv6'ya özel ek başlıklarla gerçekleştirilir.
- `udplen` parametresi, UDP paketlerinin boyutunu değiştirerek imza tabanlı engellemeleri engeller.

### 4.7. Sunucu Tarafı Cevap Manipülasyonu (wssize)

DPI sunucudan gelen sertifika bilgisini okuyarak engelleme yapıyorsa, el sıkışma sırasında sunucuya bildirilen TCP Pencere Boyutu (`--wssize`) sınırlandırılır. Bu durum sunucunun cevabını çok küçük paketlere bölmesini zorunlu kılar ve DPI'ın tek seferde sertifikayı okumasını engeller.

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
