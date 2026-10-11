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
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Tidak | Default baru `gemini-3.8-flash`; model utama/cadangan dapat diubah. ID lama `gemini-3.5-flash` dan `gemini-3.7-flash` dimigrasikan ke pengganti resminya. Cadangan dipakai bila model utama gagal sementara. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Ya untuk panel | Seluruh isi JSON service account dari Firebase Project Settings → Service accounts. Rahasia. |
| `FIREBASE_PROJECT_ID` | Disarankan | Project ID Firebase/Google Cloud; harus cocok dengan service account. |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Alternatif | Versi Base64 dari seluruh file JSON; gunakan salah satu format kredensial, jangan keduanya. |

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
- Semua skor adalah **perkiraan AI untuk latihan, bukan nilai resmi**, dan itu ditulis di kartu skornya. Setiap permintaan ke AI menghitung satu kuota harian pengguna biasa (admin tanpa batas).
- Endpoint: `/api/study` (`tool`: `check`, `quiz`, `grade`) dan `/api/chat` dengan `mode` (`tutor`, `explain`, `summary`). Logikanya di `lib/study.js`.
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


## Chat AI visual: mikrofon, buat gambar, dan edit foto

Chat AI sekarang menggunakan composer bergaya kartu dengan kolom pesan yang lebih besar, tombol mikrofon (speech-to-text; perlu browser yang mendukung dan izin mic), pemilih foto, serta mode **Buat gambar** dan **Edit foto**. Di web, hasil gambar memiliki tombol unduh. Di Android, pilih foto lewat pemilih file, beri arahan edit, lalu hasilnya ditampilkan di percakapan.

Endpoint backend: `POST /api/image` dengan sesi login yang sama seperti endpoint AI lainnya. Request untuk generate menggunakan `{ action: "generate", prompt, aspectRatio? }`; edit menggunakan `{ action: "edit", prompt, imageData, mimeType, aspectRatio? }`. Foto dikompres di klien sebelum diunggah; backend memvalidasi MIME/base64, membatasi ukuran prompt/payload/output, menggunakan kuota AI, dan mengembalikan kuota jika provider gagal. `GEMINI_API_KEY` tetap hanya berada di server. Model gambar opsional dapat diatur dengan `GEMINI_IMAGE_MODEL`; default `gemini-nano-banana-2.1`. Tidak perlu menaruh API key di APK atau browser.

Untuk menggunakan fitur gambar, pastikan API key Gemini aktif dan project memiliki akses serta kuota untuk model gambar. Endpoint ini menggunakan Gemini Interactions API; uji di deployment staging terlebih dahulu karena akun/provider dapat berbeda dalam ketersediaan model dan kuota.

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
- Password yang diketik hanya dikirim lewat HTTPS saat login dan tidak disimpan. Token disimpan di browser (localStorage) dan di penyimpanan privat sandbox aplikasi Android (SharedPreferences; bukan hardware-backed Android Keystore).
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
Model utama default: `gemini-3.8-flash`; ID lama `gemini-3.5-flash` → `gemini-3.6-flash` dan `gemini-3.7-flash` → `gemini-3.8-flash`. Mode berpikir Gemini diturunkan otomatis (Gemini 3: `thinkingLevel: low`, Gemini 2.x: `thinkingBudget: 0`;
diulang tanpa pengaturan itu bila model menolak). Soal lebih dari 8 dipecah dan dikirim paralel (maks 3 sekaligus).

## Batasan
- Tombol Isi otomatis hanya untuk Google Forms publik. Situs lain: bookmark Orbit (desktop) atau aplikasi Android.
- Tanpa konfigurasi kredensial Firestore yang valid, hanya admin dari env yang bisa login dan panel Admin dinonaktifkan.
- Tidak ada lanjut otomatis antar halaman di web.
- Parser membaca struktur internal Google Forms yang bisa berubah sewaktu-waktu.

## Tes lokal
Jalankan `npm install`, lalu `npm test` (termasuk adapter Firestore dengan fake Firestore dan tes transaksi tiruan; perintah tes tidak memerlukan database live dan berjalan di Windows/macOS/Linux). Belum diuji ke project Firebase asli atau deployment Vercel; lakukan uji staging sebelum meluncurkan ke pengguna.


## Kompatibilitas klien Android

Aplikasi Android memakai backend yang sama dengan web; ia tidak menyimpan `GEMINI_API_KEY` atau kredensial Firebase di APK. Endpoint yang dipakai: `GET /api/status` untuk memeriksa server, `POST /api/login`, `POST /api/chat` (opsi `mode`: `tutor`, `explain`, `summary`), `POST /api/image` (generate/edit gambar), `POST /api/analyze`, `POST /api/gemini` untuk Scan & Fill, dan `POST /api/study` (`check`, `quiz`, `grade`). Semua permintaan AI memakai token sesi `Authorization: Bearer …`.

Di APK, alamat server awal adalah `https://www.franzzorbit.my.id` dan tetap dapat diganti di layar login jika deploy lu memakai domain lain. Fitur baca layar hanya menggunakan Accessibility Service yang diaktifkan pengguna; kolom password dikecualikan, dan teks layar dikirim ke server hanya saat pengguna memilih opsi konteks layar atau menjalankan Scan & Fill / Analisis AI. Periksa jawaban yang disarankan sebelum menerapkannya ke aplikasi asal.

Scan & Fill mendukung jawaban pendek serta kolom esai/paragraf hingga 3.000 karakter.
