# FRANZZ Orbit Web — Audit & Perbaikan

Tanggal audit: 10 Oktober 2026  
Versi paket: `0.3.0` (ditambahi fitur/perbaikan dalam audit ini)

## Ruang lingkup

Arsip yang diaudit berisi proyek **web** Vercel + Firebase Firestore (34 berkas sebelum patch). Tidak ada source Android/Kotlin, `BotOverlay.kt`, file Gradle, atau proyek APK dalam ZIP yang diberikan. Karena itu audit ini tidak mengklaim telah memeriksa aplikasi Android, panggilan suara Android, atau build APK.

## Temuan dan perbaikan

| Prioritas | Temuan | Perbaikan |
|---|---|---|
| Tinggi | Kuota membuka halaman memakai pola baca-lalu-tulis; request paralel dapat membaca angka yang sama dan melewati batas. | Diubah menjadi mutasi atomik `db.mutate`; ditambah tes 120 request bersamaan untuk memastikan batas 100. |
| Sedang | Login salah untuk username yang tidak ada menulis dokumen lock untuk setiap nama acak; ini dapat memperbesar Firestore tanpa manfaat proteksi untuk akun nyata. | Lock persisten hanya dibuat untuk akun yang benar-benar ada atau username admin environment. |
| Sedang | Environment admin terblokir bila konfigurasi Firestore tidak valid, meskipun autentikasi admin tersebut bersumber dari environment variable. | Login admin environment memakai fallback memori bila penyimpanan tidak tersedia; status panel tetap nonaktif dan operasi multi-user tetap memerlukan Firestore valid. |
| Sedang | Batas body API hanya memeriksa `Content-Length`; request tanpa header tersebut bisa lolos pemeriksaan awal. | Tambah pemeriksaan ukuran JSON hasil parse selain pemeriksaan header. Scan foto memiliki limit khusus. |
| Sedang | Pemeriksaan alamat internal belum secara eksplisit memblokir alamat IPv4-compatible IPv6 seperti `::127.0.0.1`. | Rentang IPv6 kompatibel IPv4 ditolak dan tes regresi ditambahkan; IPv4-mapped publik tetap dikenali sebagai IPv4. |
| Sedang | Kombinasi izin iframe `allow-scripts` dan `allow-same-origin` tidak ideal bila dokumen berasal dari origin aplikasi sendiri. | Izin sandbox dipilih berdasarkan origin: izin same-origin dilepas untuk dokumen se-origin, tetapi dipertahankan untuk halaman eksternal agar situs pihak ketiga tidak mudah rusak. |
| Fitur belum ada | Menu Scan Soal belum menerima foto dan belum memanggil model multimodal. | Ditambahkan input kamera/unggah JPG, PNG, WebP, kompresi di browser, validasi signature dan ukuran di server, pembacaan lewat Gemini, penjelasan langkah belajar, serta pengembalian kuota saat panggilan gagal. |
| Fitur belum ada | Menu Buka ChatGPT tidak tersedia. | Ditambahkan aksi yang membuka `https://chatgpt.com/` pada tab baru. |
| Sedang | Model bawaan masih `gemini-3.5-flash`, yang sudah deprecated. | Bawaan diperbarui ke `gemini-3.8-flash`; pengaturan yang sudah tersimpan di Firestore tetap perlu diperiksa lewat panel Admin karena memang memiliki prioritas. |
| Tinggi | Request Gemini masih mengirim parameter `temperature` legacy, sementara panduan migrasi Gemini 3.8 meminta parameter tersebut dihapus. | `temperature` kini hanya dikirim untuk model non-Gemini-3; tes memastikan request teks dan gambar Gemini 3.x tidak memuat parameter itu. |

## Tes yang dijalankan

`npm test` menjalankan **15 rangkaian tes**: tes lama untuk API/login/kuota/Firestore tiruan/halaman/Gemini/study, ditambah tes regresi untuk Scan Soal, kuota halaman konkuren, hardening login, dan menu frontend. Semua lulus di lingkungan lokal.

Pemeriksaan tambahan: `node --check` untuk JavaScript backend, handler API, tes, dan JavaScript inline pada `public/index.html`. Konfigurasi request Gemini 3.x juga dites agar tidak mengirim parameter `temperature` yang sudah deprecated. Browser smoke test dengan API dan aksi tab ChatGPT tiruan memverifikasi UI login, menu, kompresi foto, pemanggilan endpoint Scan Soal, serta render hasil; ini bukan pengujian API produksi.

Percobaan `npm install` di lingkungan audit berakhir timeout saat mengakses package registry, jadi instalasi dependensi penuh belum terverifikasi di sini. `npm test` berhasil berjalan tanpa live Firebase/Gemini karena rangkaian tersebut menggunakan mock.

## Batas verifikasi yang penting

Tes ini belum memverifikasi:

- Kredensial service account, IAM, dan database Firebase asli. Jika JSON valid tetapi izin IAM salah, `persistent()` bisa tetap mengaktifkan tampilan panel Admin meski operasi Firestore gagal; perbaiki IAM berdasarkan error endpoint/log.
- Panggilan nyata ke API Gemini atau ketersediaan model pada akun deployment.
- Deploy Vercel dan perilaku browser produksi di semua perangkat.
- Android/Kotlin, akses layar Android, progress bar robot pada APK, atau panggilan suara real-time.

Sebelum dipakai client, deploy ke staging lalu tes login, chat, Scan Soal dengan foto nyata, kuota, pemuatan Google Forms, dan halaman eksternal. Jangan masukkan service-account JSON, API key, atau password produksi ke source control.

## Fitur yang tetap dibatasi

Scan Soal berfokus pada penjelasan dan langkah penyelesaian untuk belajar. Cek Jawaban dan Latihan Soal tetap menghasilkan perkiraan latihan, bukan nilai resmi. Fitur manipulasi nilai agar melewati KKM, mode samaran untuk menyembunyikan aktivitas, atau submit evaluasi otomatis tidak ditambahkan. Google Forms yang didukung tetap menampilkan hasil untuk diperiksa pengguna; tombol Kirim tetap ditekan sendiri oleh pengguna.
