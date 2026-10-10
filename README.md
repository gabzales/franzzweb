# FRANZZ Orbit Web (Vercel + Firebase Cloud Firestore)

Struktur: `public/` (halaman statis, dilayani CDN, tidak dihitung invocation), `api/[name].js` (satu function untuk semua
`/api/*`), `lib/` (logika + adapter penyimpanan), `vercel.json` (region, batas durasi, header keamanan). Data pengguna, kuota, kunci Gemini terenkripsi, dan pengaturan panel disimpan di Cloud Firestore melalui Firebase Admin SDK di sisi server.

## Setup
1. Push proyek ini ke GitHub (repo private).
2. Vercel: Add New > Project > import repo. Framework Preset **Other**, Build Command kosong, Output Directory biarkan (otomatis `public`).
3. Buat database **Cloud Firestore** dari Firebase Console (Firestore Database → Create database). Gunakan satu database default di paket Spark. Atur akses client agar ditolak (file `firestore.rules` tersedia di repo); aplikasi ini mengakses Firestore hanya dari backend Vercel.
4. Environment Variables (Production; pilih Preview/Development juga bila diperlukan), tandai semua kredensial sebagai **Sensitive**, lalu Deploy:

| Variabel | Wajib | Isi |
|---|---|---|
| `SESSION_SECRET` | Ya | Acak, minimal 32 karakter. Buat: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Ya | Akun untuk masuk. Ganti password = ubah variabel, deploy ulang, semua sesi lama hangus |
| `GEMINI_API_KEY` | Ya (untuk fitur AI) | API key Gemini |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Tidak | Model utama dan cadangan. Cadangan dipakai otomatis bila model utama kena batas (429) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Ya untuk panel | Seluruh isi JSON service account dari Firebase Project Settings → Service accounts. Rahasia. |
| `FIREBASE_PROJECT_ID` | Disarankan | Project ID Firebase/Google Cloud; harus cocok dengan service account. |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Alternatif | Versi Base64 dari seluruh file JSON; gunakan salah satu format kredensial, jangan keduanya. |

Model bawaan proyek adalah `gemini-3.8-flash`. Jika instalasi lama sudah menyimpan model melalui panel Admin di Firestore, nilai tersimpan itu lebih prioritas daripada bawaan; periksa **Admin → Pengaturan Gemini** dan ubah model ke `gemini-3.8-flash` bila masih memakai model lama. Google menandai `gemini-3.5-flash` sebagai deprecated dan menyarankan migrasi ke model Flash yang lebih baru. ([Dokumentasi model Gemini](https://ai.google.dev/gemini-api/docs/models.md))


5. Buka situs dan login dengan `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Tidak ada layar setup. Setelah service account dan Firestore benar, tombol Admin akan aktif untuk mengelola pengguna, kuota, dan pengaturan Gemini.
6. Aplikasi Android: login dengan alamat situs ini, username, dan password admin.

Kalau deploy gagal karena `regions`, hapus baris `"regions"` di `vercel.json` (isinya `sin1`, Singapura, terdekat dari Jakarta).

### Mengatur service account
- Di Firebase Console: **Project settings → Service accounts → Generate new private key**. Simpan JSON di komputer sendiri; jangan commit ke GitHub, upload ke chat, atau memasukkannya ke file frontend.
- Masukkan isi JSON tersebut ke variabel Vercel `FIREBASE_SERVICE_ACCOUNT_JSON`. Bila lebih mudah untuk env satu-baris, ubah ke Base64 di PowerShell: `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .\service-account.json -Raw)))`, lalu masukkan hasilnya ke `FIREBASE_SERVICE_ACCOUNT_BASE64` dan jangan set variabel JSON sekaligus.
- `FIREBASE_PROJECT_ID` sebaiknya diisi dengan **Project ID**, bukan nama tampilan Firebase.
- Pastikan service account punya izin baca/tulis Firestore melalui Google Cloud IAM. Gunakan akses sesempit mungkin; untuk kasus permission denied, cek peran IAM datastore/firestore yang terpasang.
- Firestore Rules di `firestore.rules` menolak semua akses langsung dari browser. Firebase Admin SDK di backend memakai IAM dan tidak diotorisasi oleh client Security Rules, jadi rahasia service account harus tetap server-side.
- Bila konfigurasi JSON tidak valid, endpoint status menampilkan pesan konfigurasi dan Admin Panel tetap nonaktif. Bila akun/key benar secara format tetapi permission IAM salah, perbaiki IAM dan redeploy.
- Data lama dari mode tanpa database tidak dapat dipulihkan dari memori Vercel. Pengguna produksi sebelumnya harus dibuat ulang melalui Admin Panel setelah Firestore aktif.

## Fitur AI (menu belajar)
Tombol **Fitur AI** di bar atas membuka menu belajar:
- **Tutor AI**: chat dalam mode tutor (dijelaskan bertahap, ada pertanyaan pengecekan, petunjuk dulu sebelum penyelesaian).
- **Tanya AI**: chat bebas (bisa pakai suara).
- **Penjelasan lengkap**: konsep, langkah, contoh, kesalahan umum. **Ringkas Materi**: ringkasan, poin penting, istilah, pertanyaan pengecekan.
  Keduanya bisa memakai teks yang ditempel atau isi halaman yang sedang terbuka.
- **Cek Jawaban**: tulis soal dan **jawabanmu sendiri** (kunci/rubrik opsional), AI memberi **perkiraan skor** 0-100, yang sudah baik, yang kurang, saran, dan inti jawaban yang benar.
- **Latihan Soal**: AI membuat soal dari materi (pilihan ganda, esai singkat, atau campur), kamu menjawab, lalu dinilai. Pilihan ganda dinilai lokal (tanpa AI, tanpa kuota),
  esai dinilai AI terhadap poin acuan. Hasilnya skor total perkiraan plus umpan balik per soal.
- **Scan Soal**: ambil/unggah foto JPG, PNG, atau WebP; browser mengecilkan gambar lalu AI membaca soal dan menjelaskan konsep serta langkah penyelesaiannya. Foto maksimum 1,5 MB setelah kompresi.
- **Buka ChatGPT**: membuka ChatGPT pada tab baru.
- Semua skor adalah **perkiraan AI untuk latihan, bukan nilai resmi**, dan itu ditulis di kartu skornya. Setiap permintaan ke AI menghitung satu kuota harian pengguna biasa (admin tanpa batas).
- Endpoint: `/api/study` (`tool`: `check`, `quiz`, `grade`), `/api/scan` (foto soal), dan `/api/chat` dengan `mode` (`tutor`, `explain`, `summary`). Logika alat belajar ada di `lib/study.js`; pembacaan foto ada di `lib/gemini.js` dan `lib/api.js`.
- Sengaja tidak ada fitur menjawab soal ujian otomatis, mengatur nilai agar melewati KKM, atau menyamarkan penggunaan.

## Chat AI dan situs lain
- **Chat AI**: tombol "Chat AI" di bar atas. Percakapan multi-giliran (12 pesan terakhir dikirim ke AI), tidak disimpan di server.
  Kalau ada halaman terbuka (mode baca) atau datang dari bookmark Orbit, isinya bisa disertakan sebagai konteks (bisa dimatikan).
  Teks halaman diperlakukan sebagai data tidak tepercaya. Satu pesan = satu hitungan kuota harian pengguna biasa; admin tanpa batas.
- **Bookmark Orbit (situs apa saja)**: Pengaturan > "Pakai di situs lain", seret tombol **Orbit** ke bar bookmark. Di situs mana pun,
  termasuk yang butuh login atau dirender JavaScript, klik bookmark itu. Orbit membaca teks dan kolom isian di halaman (dari browser kamu sendiri,
  jadi sesi login ikut), membuka jendela Orbit dengan chat AI, dan tombol **Isi kolom di halaman**: AI menjawab dulu, kamu lihat jawabannya,
  lalu **Terapkan ke halaman** mengisi kolom (teks, pilihan tunggal/ganda, dropdown). Tombol Kirim di situs itu tetap kamu tekan sendiri.
- Jendela Orbit hanya menerima data dari halaman yang membukanya, dan jawaban hanya dikirim balik ke halaman itu setelah kamu menekan Terapkan.
- Batas: situs yang memblokir bookmarklet (CSP ketat) atau memutus hubungan antar jendela (COOP) tidak bisa; widget pilihan buatan sendiri
  (bukan input HTML biasa) tidak terdeteksi sebagai kolom, tapi isi halamannya tetap bisa ditanyakan lewat chat. Perlu izin popup. Hanya browser desktop.

## Penyimpanan data Firestore
- **Akun admin utama** tetap berasal dari `ADMIN_USERNAME` dan `ADMIN_PASSWORD`. Akun pengguna tambahan, hash password, peran, status aktif, kuota, dan pengaturan Gemini disimpan permanen di Firestore.
- Koleksi internal bernama `orbitStore`; tiap entri mempunyai dokumen dengan ID aman hasil encoding kunci internal. Jangan memasukkan data lain secara manual ke koleksi ini.
- Pembaruan kuota harian dan pembuatan username menggunakan transaksi agar request bersamaan tidak gampang melewati kuota atau membuat username ganda.
- Bila kredensial Firestore tidak dikonfigurasi, aplikasi tetap memungkinkan login admin berbasis Environment Variables, tetapi panel multi-user dinonaktifkan. Mode `ORBIT_MEMORY_DB=1` hanya untuk tes lokal, bukan produksi.
- Kuota gratis Firestore Standard yang saat ini didokumentasikan: 1 GiB data, 50.000 pembacaan dokumen/hari, 20.000 penulisan/hari, 20.000 penghapusan/hari, dan 10 GiB transfer keluar/bulan. Kuota reset harian mengikuti waktu Pacific dan hanya satu database per project yang memperoleh kuota gratis. Pantau penggunaan di Firebase Console; bila batas tercapai, operasi database dapat gagal sampai kuota pulih. Detail: https://firebase.google.com/docs/firestore/pricing

## Hemat kuota gratis
- Hobby: sekitar 1 juta invocation, 100 GB transfer, dan 4 jam CPU aktif per bulan; melewati batas tidak ditagih, project dijeda.
  **Hobby hanya untuk pemakaian pribadi non-komersial.** Untuk klien berbayar, pakai Pro.
- Halaman dan gambar adalah file statis (cache), bukan function. Satu function melayani semua API, `maxDuration` 30 detik.
- Jangan aktifkan Analytics/Speed Insights, Cron, atau Image Optimization kalau tidak perlu.
- Satu kali "Isi otomatis" memakai beberapa permintaan Gemini bila soalnya banyak (dipecah per 8 soal). Isi `GEMINI_FALLBACK_MODEL` agar tidak mentok 429.

## Keamanan
- Rahasia hanya di Environment Variables, tidak ada di kode atau repo. API key Gemini tidak pernah dikirim ke browser atau APK.
- Token sesi bertanda tangan (HMAC) dan terikat ke password admin: ganti `ADMIN_PASSWORD` mencabut semua sesi.
- Password yang diketik hanya dikirim lewat HTTPS saat login dan tidak disimpan. Token disimpan di browser (localStorage) / APK (Android Keystore).
- Header keamanan (vercel.json): Content-Security-Policy, X-Frame-Options DENY, nosniff, no-referrer.

## Lihat dan analisis halaman web apa saja
Tempel link situs apa saja di kolom atas (link Google Form tetap diisi otomatis):
- Kalau situs mengizinkan, halamannya tampil langsung di dalam FRANZZ Orbit.
- Kalau situs melarang ditampilkan di halaman lain (`X-Frame-Options` atau `frame-ancestors`), server mengambil isinya dan
  menampilkannya sebagai teks bacaan, lengkap dengan daftar kolom dan pertanyaan yang terdeteksi dari HTML-nya.
- Tombol **Analisis halaman (AI)** merangkum halaman dan menjawab pertanyaanmu tentang isinya. AI tidak menjawab soal ujian atau kuis bernilai.

Keamanan pengambil halaman: wajib login; hanya http/https di port 80/443/8080/8443; alamat internal (localhost, 10.x, 192.168.x,
169.254.x, dll.) ditolak termasuk lewat pengalihan dan DNS; ukuran maksimal 2 MB; batas waktu total 8 detik; maksimal 100 halaman per
pengguna per hari (admin tanpa batas). Analisis AI memakai kuota AI harian pengguna.

Batasan: halaman yang dirender dengan JavaScript atau butuh login hanya menampilkan sedikit teks; kolom form terdeteksi dari HTML
awal saja; tombol Isi otomatis hanya untuk Google Forms. Untuk situs lain yang berisi form biasa, pakai bookmark Orbit (lihat Chat AI dan situs lain) atau aplikasi Android.

## Kecepatan
Mode berpikir Gemini diturunkan otomatis (Gemini 3: `thinkingLevel: low`, Gemini 2.x: `thinkingBudget: 0`) dan request diulang tanpa pengaturan berpikir bila model menolaknya. Parameter `temperature` legacy tidak dikirim untuk model Gemini 3.x mengikuti panduan migrasi terbaru. Soal lebih dari 8 dipecah dan dikirim paralel (maks 3 sekaligus).

## Batasan
- Tombol Isi otomatis hanya untuk Google Forms publik. Situs lain: bookmark Orbit (desktop) atau aplikasi Android.
- Tanpa konfigurasi kredensial Firestore yang valid, hanya admin dari env yang bisa login dan panel Admin dinonaktifkan.
- Tidak ada lanjut otomatis antar halaman di web.
- Parser membaca struktur internal Google Forms yang bisa berubah sewaktu-waktu.

## Tes lokal
Jalankan `npm install`, lalu `npm test` (termasuk adapter Firestore dengan fake Firestore, tes transaksi tiruan, regresi Scan Soal, pembatasan kuota konkuren, dan hardening login; perintah tes tidak memerlukan database live dan berjalan di Windows/macOS/Linux). Belum diuji ke project Firebase asli, API key Gemini asli, browser produksi, atau deployment Vercel; lakukan uji staging sebelum meluncurkan ke pengguna. Lihat `AUDIT_REPORT.md` untuk temuan, perbaikan, dan batas verifikasi.
