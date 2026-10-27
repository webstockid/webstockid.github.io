# 📈 Stock ID Web Application Suite (#Andaimology Edition)

**Stock ID (#Andaimology Edition)** adalah platform web terpadu (*all-in-one web suite*) yang dirancang khusus untuk memenuhi kebutuhan trader dan investor pasar modal Indonesia (BEI/IDX). Platform ini menggabungkan alat analisis teknikal berbasis AI, pemindai saham (*screener*), kalkulator manajemen risiko, jurnal trading interaktif, pemantau durasi keanggotaan, hingga platform edukasi trading komprehensif.

## 🌟 Modul & Fitur Unggulan Halaman

Ekosistem Stock ID terdiri dari 6 modul utama yang saling terintegrasi:

```
Stock ID Suite
 ├── 👑 Stock ID VIP (Landing Page & Komunitas)
 ├── 🔍 Stock ID Screener (Analisis AI & Radar Saham)
 ├── 🛠️ Stock ID Tools (Kalkulator Trading & Utility)
 ├── 👁️ Stock ID Watchlist (Pantauan & Tagging Saham)
 ├── 👤 Stock ID Member (Manajemen Keanggotaan & Remind System)
 └── 📚 Stock ID Study (Platform Edukasi & Kurikulum Saham)

```

### 1. 👑 Stock ID VIP (`index.html`)

Halaman utama (*landing page*) serta pusat informasi keanggotaan grup edukasi dan komunitas trading premium Stock ID VIP.

* **Live Community Dashboard**: Menampilkan statistik statistik anggota secara *real-time* (Member Cap Rp 1,8 Miliar, Total Anggota yang Pernah Bergabung, Anggota Aktif, serta Timer Durasi Komunitas Berjalan sejak 16 September 2025).

* **TradingView Live Ticker Tape**: Monitoring pergerakan indeks IHSG, saham *blue-chip* (BBCA, BMRI, TLKM, ASII, ANTM), valas, bursa global (SPX, NKY, HSI, SSE), komoditas (Emas, Minyak WTI), dan kripto (BTC, ETH).

* **Kurikulum & Benefit VIP**: Detail materi pembelajaran komprehensif mulai dari Analisa Struktur Trend Chart, Bandarmologi & Broker Summary (Top Buyer/Seller), Watchlist Swing Siap Pakai, Entry Safe & Stop Loss, Analisa Fundamental, hingga Analisa Foreign Flow.

* **Monitoring Jadwal Jam Perdagangan BEI**: Indikator status pasar otomatis *real-time* (Pra-Pembukaan, Sesi I, Istirahat, Sesi II, Pra-Penutupan, Pasca-Penutupan) disesuaikan dengan aturan WIB.

* **Sistem Pembayaran & QRIS Dinamis**: Pemilihan paket langganan (Paket Screener, Paket AI Tools, Kelas 100 Hari, Kelas 200 Hari, Kelas 365 Hari, dan Stock ID Free) lengkap dengan generator QRIS dinamis (`qris_{nominal}.png`), kalkulator *add-on* opsional, dan integrasi konfirmasi via WhatsApp.

* **Testimonial Slider Interaktif**: Galeri ulasan dan kritik-saran dari member aktif dengan dukungan *mouse-drag* & *touch-swipe*.

* **FAQ Accordion**: Tanya jawab interaktif seputar manajemen risiko dan kurikulum pembelajaran.

### 2. 🔍 Stock ID Screener (`screener.html`)

Pusat komputasi analisis teknikal dan pemindaian (*screening*) saham berbasis kecerdasan buatan (*AI*).

* **VIP Gateway Token Authentication**: Proteksi akses menggunakan token otentikasi VIP (`HARDIGANTENG`).

* **Pencarian Suara & Autocomplete**: Fitur pencarian saham berbasis *Speech Recognition* dan rekomendasi instan.

* **Chart & Gauge Teknikal Real-Time**: Integrasi chart interaktif 1-harian dan indikator pengukur teknikal TradingView Engine.

* **14 Modul Analisis & Screener**:

   1. **AI Signal & Trading Map**: Kalkulasi otomatis Technical Pivot (Entry Area, Resistance, TP1/TP2, Stop Loss), Skor AI (1-5), Skenario Pergerakan, Katalis Utama, serta batas ARA & ARB.

   2. **Export AI Trading Plan Card**: Fitur konversi trading plan menjadi kartu visual siap unduh menggunakan library `html2canvas`.

   3. **Radar Saham (Big Money Radar)**: Pemindaian otomatis kondisi pasar (Breakout, Accumulation, Golden Cross, Curi Start).

   4. **Custom Radar**: Filter multi-parameter fleksibel berdasarkan aturan Moving Average (MA5/MA20/Golden Cross), Likuiditas Volume (Spike 1.5x, Spike 3.0x, Dry), dan Perubahan Harga (%).

   5. **BSJP Radar (Beli Sore Jual Pagi)**: Pemindaian emiten akumulasi kuat untuk strategi *overnight hold*.

   6. **Whales Detector Radar**: Deteksi lonjakan volume anomali dan jejak akumulasi senyap institusi/bandar.

   7. **Peer Komparasi**: Perbandingan emiten setara dalam rentang harga ±25%.

   8. **Smart RRR & Kalkulator Keuangan**: Kalkulator Risk-Reward Ratio, Max Risk, Position Sizing, Averaging Down/Up, Trailing Stop (Partial Profit Risk-Free), serta Kalkulator Dividen & *Dividend Trap Detector*.

   9. **Smart Alert & Push Notification**: Notifikasi latar belakang browser via Service Worker dan integrasi **Bot Telegram API** (menggunakan Bot Token & Chat ID).

  10. **Paper Trade Simulator**: Simulasi trading virtual beraset awal Rp 100 Juta, sistem peringkat (*Newbie to Pro*), pelacakan P&L *realized/unrealized*, dan histori posisi.

  11. **Journal Trading (Table & Kanban Board)**: Pencatatan rencana trading dengan visualisasi Kanban (Open, Win, Loss) serta fitur ekspor data ke format `.csv`.

  12. **Berita & Aksi Korporasi**: Agregator berita terkini dan pengumuman Dividen, RUPS, dan Stock Split.

  13. **Insider Portfolio (SEC Form 13F)**: Pelacak portofolio institusi global raksasa (Berkshire Hathaway, Bridgewater, Citadel, Soros, ARK Invest, JPMorgan) menggunakan data Financial Modeling Prep API.

  14. **Sektor Heatmap & Live Macro Commodity**: Peta panas sektoral BEI serta pemantau harga komoditas dunia (Emas, Tembaga, Minyak, Batu Bara, Perak).

* **Floating AI Assistant & Chatbox**: Asisten obrolan interaktif untuk analisis saham instan.

* **System Preferences**: Pengaturan Mode Gelap/Terang, kustomisasi ukuran & gaya font, efek audio/getar haptic, serta inspektur diagnostik perangkat keras/browser.

### 3. 🛠️ Stock ID Tools (`tools.html`)

Kumpulan alat bantu (*utility suite*) dan kalkulator finansial mandiri untuk mempermudah perhitungan rasio trading.

* **Floating Navigation Drawer**: Menu melayang interaktif disertai efek suara (*sound clips*) dan getaran *haptic*.

* **Stock ID AI Assistant (Groq LLM Powered)**: Interface percakapan kecerdasan buatan berbasis API Groq (`llama-3.3-70b-versatile`) yang dilatih khusus dengan konteks pasar saham Indonesia.

* **Arah & Sentimen Pasar Global**: Widget monitoring pasar saham Blue Chip IDX, Indeks Saham Dunia, Komoditas, dan Kripto.

* **Kalkulator Right Issue & Delusi**: Perhitungan Harga Teoretis saham, jumlah Hak (HMETD) yang diterima, potensi persentase delusi kepemilikan, dana tebus yang dibutuhkan, dan estimasi average baru post-tebus.

* **Kalkulator Proyeksi & Target Profit**: Simulasi pertumbuhan modal menggunakan metode *Compound Interest* (efek gulung) harian hingga bulanan.

* **Kalkulator Average Up & Down Pro**: Kalkulator rata-rata modal baru dengan fitur pemotongan komisi broker beli/jual serta kalkulasi titik impas (Break-Even Point).

* **Kalkulator Target Average**: Kalkulator balik (*reverse calculator*) untuk menentukan jumlah lot dan modal amunisi yang diperlukan untuk mencapai target average tertentu.

* **Kalkulator Position Sizing**: Alat pengaman modal berdasarkan toleransi risiko (1% - 15%) untuk menentukan batas maksimal lot pembelian.

* **Kalkulator Rapor & Diagnostik Trading**: Diagnostik statistik *Win Rate*, *Profit Factor*, dan *Expectancy Value* untuk menguji keunggulan (*edge*) strategi trading.

* **Modul Tambahan**: Jurnal Trading Harian, Catatan Watchlist, Simulator ARA/ARB, Trading Plan Generator, Sentimen Pasar BEI, Edukasi Chart Pattern, dan Live Market News Feed.

### 4. 👁️ Stock ID Watchlist (`watchlist.html`)

Modul pemantau daftar saham prioritas (*watchlist management*).

* **Real-time Stock Tracking**: Pemantauan pergerakan harga saham pilihan secara terorganisir.

* **Custom Tagging & Notes**: Penambahan catatan target harga beli, area *cut loss*, dan target *take profit*.

* **Quick Access Shortcut**: Integrasi cepat menuju pemindaian detail di modul Screener dan Tools.

### 5. 👤 Stock ID Member (`member.html`)

Dashboard manajemen durasi masa aktif dan pemantauan status keanggotaan VIP.

* **Mandatory WhatsApp Login**: Sistem login mandatori mencocokkan nomor WhatsApp pengguna dengan basis data `data-member.js`.

* **Active User Dashboard**: Menampilkan informasi profil pengguna, nomor HP terdaftar, riwayat paket join, tanggal kadaluarsa, serta penghitung mundur (*countdown timer*) masa aktif secara presisi.

* **Filter & Sorting Multi-Kategori**:

  * Filter Durasi: 1 Bulan, 2 Bulan, 3 Bulan, 6 Bulan, 1 Tahun, dan Expired.

  * Pengurutan: Masa Aktif Terlama, Mendekati Expired (1-15 Hari), Nama (A-Z, Z-A).

* **Dynamic Card Status**: Kartu anggota dengan indikator warna (*color-coded*) berbasis persentase sisa masa aktif (Emerald, Sky, Amber, Rose, Fuchsia) dan efek titik putih berkedip.

* **Automated Expiry Reminder System**: Sistem notifikasi browser otomatis via Service Worker (`sw-member.js`) yang memberikan peringatan H-10 sebelum masa aktif berakhir.

* **Statistik & Rekap Kelas**: Jurnal akumulasi distribusi pembelian kelas VIP.

### 6. 📚 Stock ID Study (`study.html`)

Platform pusat pembelajaran dan materi edukasi trading saham.

* **Kurikulum Berjenjang**: Panduan langkah demi langkah dari tingkat pemula (*basic*) hingga tingkat mahir (*advanced*).

* **Scalping & Swing Strategy Masterclass**: Panduan strategi *day trading*, *scalping*, pembacaan data *Bandarmologi*, dan manajemen psikologi trading.

* **Media & Resource Library**: Akses materi edukasi berformat PDF, panduan bergambar, dan modul pembelajaran mandiri.

## 🏗️ Teknologi & Arsitektur Pengkodean

### 1. Bahasa Pemrograman & Core Tech

* **HTML5**: Struktur halaman web yang semantik dan responsif.

* **CSS3**: Styling custom, Glassmorphism UI layout (`backdrop-filter: blur`), custom scrollbars, dan animasi CSS Keyframes (`pulse-glow`, `shimmer`, `marquee`, `rainbowScroll`).

* **Vanilla JavaScript (ES6+)**: Logika aplikasi *pure client-side* tanpa *dependency framework* berat untuk memastikan performa loading yang sangat cepat.

* **JSON**: Format pertukaran data internal (`data-member.js`, `ticker.js`, parameter API).

### 2. UI Framework, Tipografi & Ikonografi

* **Tailwind CSS (v4 & v3 CDN)**: Utility-first CSS framework untuk tata letak modern.

* **Typography Custom**: Integrasi Google Fonts yang disesuaikan pada tiap modul (`Outfit`, `Lexend`, `Comfortaa`, `Montserrat`, `Fredoka`, `Quicksand`, `Ubuntu`, `Unbounded`).

* **Icon Sets**: FontAwesome 6 Pro & Lucide Icons.

### 3. API & Library Pihak Ketiga

* **TradingView Embed Widgets**: Ticker Tape, Advanced Technical Chart, Technical Gauge Engine, Market Overview, dan IDX Sektor Heatmap.

* **Groq LLM API (`llama-3.3-70b-versatile`)**: Engine kecerdasan buatan untuk modul Stock ID AI Assistant.

* **Financial Modeling Prep (FMP) API**: Penyedia data laporan kepemilikan saham institusional global (SEC Form 13F).

* **Web Speech Recognition API**: Fitur pencarian saham berbasis perintah suara (*voice search*).

* **HTML2Canvas**: Library render DOM ke gambar canvas untuk ekspor *AI Trading Plan Card*.

* **Service Worker & Web Push Notification API**: Notifikasi latar belakang untuk pengingat masa aktif member (`sw-member.js`) dan Smart Alert harga saham (`sw.js`).

* **Telegram Bot API**: Pengiriman sinyal alert instan ke Telegram pribadi/grup.

* **Web Audio API & Vibration Haptic API**: Efek suara interaktif (`vip.mp3`, `exp.mp3`, `dangdut.mp3`, `member.mp3`, `notif.mp3`) dan umpan balik getaran pada perangkat seluler.

### 4. Style Pengkodean & Pattern Desain (*Coding Style & Design Pattern*)

```
                            ┌─────────────────────────────────────────┐
                            │    User Interface (HTML5 / Tailwind)   │
                            └────────────────────┬────────────────────┘
                                                 │
                                         Event Listener
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             Pure Vanilla JS Event-Driven Logic                                   │
├────────────────────────────────┬────────────────────────────────┬────────────────────────────────┤
│    Calculators & Algorithms    │   State & Session Management   │    API & Async Data Service    │
│  - Right Issue & Dilution      │   - LocalStorage Caching       │   - TradingView Widgets        │
│  - Position Sizing & RRR       │   - Token VIP Gateway Auth     │   - Groq AI LLM Endpoint       │
│  - Technical Pivot Calculation │   - Journal & Alert History    │   - FMP 13F Institutional API  │
│  - Averaging Down / Up         │   - User Preferences System    │   - Telegram Bot API           │
└────────────────────────────────┴────────────────────────────────┴────────────────────────────────┘
                                                 │
                                         Dynamic DOM Render
                                                 │
                                                 ▼
                            ┌─────────────────────────────────────────┐
                            │      Reactive UI Component Render       │
                            └─────────────────────────────────────────┘

```

1. **Modular Client-Side Architecture**: Seluruh proses perhitungan finansial, filter *screener*, dan manipulasi data dilakukan langsung di sisi peramban pengguna (*browser-side processing*) untuk menjamin latensi 0ms.

2. **Event-Driven & Reactive DOM Manipulation**: Pembaruan antarmuka menggunakan event listener terpusat (`oninput`, `onchange`, `keyup`) yang memicu fungsi kalkulasi dan melakukan re-render komponen DOM secara presisi.

3. **State Persistence & Storage Management**: Memanfaatkankan `localStorage` untuk menyimpan state sesi (Token VIP, preferensi tema, ukuran font, histori jurnal, portofolio *paper trade*, data alert, serta log notifikasi).

4. **Serverless Proxy & Security Layer**: Penggunaan Cloudflare Worker Scripts sebagai *reverse proxy* untuk menangani CORS headers, menyembunyikan API token sensitif, serta mencegah *rate-limiting*.

5. **PWA & Background Sync Ready**: Arsitektur Service Worker yang memungkinkan ekosistem web menjalankan kalkulasi di latar belakang (*background periodic sync*) dan mengirimkan push notification walaupun tab utama ditutup.

## 📁 Struktur Direktori Proyek

```
webstockid/
├── index.html              # Landing page utama Stock ID VIP
├── screener.html           # Platform Screener & AI Trading Map
├── tools.html              # Kalkulator Trading & Utility Suite
├── member.html             # Dashboard Keanggotaan & Cek Masa Aktif
├── watchlist.html          # Pemantau Watchlist Saham
├── study.html              # Pusat Edukasi & Kurikulum Trading
├── data-member.js          # Basis data terenkripsi anggota VIP
├── ticker.js               # Basis data simbol emiten BEI & watchlist
├── app.js                  # Logika utama modul Screener & AI
├── sw.js                   # Service worker notifikasi Smart Alert
├── sw-member.js            # Service worker notifikasi pengingat member
├── stockid_gambar/         # Asset gambar, logo, QRIS, & avatar
└── stockid_suara/          # Asset efek suara & background audio (.mp3)

```

## 🚀 Cara Penggunaan & Pengembangan Local

1. **Clone Repositori**:

   ```
   git clone https://github.com/webstockid/webstockid.github.io.git
   cd webstockid.github.io
   
   ```

2. **Jalankan HTTP Server Local**:
   Karena platform ini memanfaatkan fitur *Service Worker* dan *Web Speech API*, disarankan menggunakan local live server:

   ```
   # Menggunakan Python
   python -m http.server 8000
   
   # Menggunakan Node.js npx
   npx serve .
   
   ```

3. **Buka di Browser**:
   Buka `http://localhost:8000` pada peramban web pilihan Anda.

© 2026 **Stock ID Suite (#Andaimology Edition)**. All Rights Reserved.

*Disclaimer: Seluruh hasil kalkulasi, sinyal AI, dan data pemindaian saham bersifat edukasi dan alat bantu analisis mandiri. Keputusan jual-beli saham tetap menjadi tanggung jawab penuh masing-masing investor.*
