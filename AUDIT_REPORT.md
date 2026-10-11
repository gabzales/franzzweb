# Audit FRANZZ Orbit Web dan kompatibilitas klien

Tanggal pemeriksaan: 11 Oktober 2026.

## Perbaikan yang sudah diterapkan

1. **Default Gemini sudah diperbarui.** Source lama menggunakan `gemini-3.5-flash`. Dokumentasi resmi Google pada 8 Oktober 2026 menyatakan model itu deprecated dan digantikan oleh `gemini-3.6-flash`; `gemini-3.7-flash` juga deprecated dan digantikan oleh `gemini-3.8-flash`. Default sekarang `gemini-3.8-flash`, dengan alias migrasi untuk pengaturan tersimpan yang memakai model lama. Referensi: https://ai.google.dev/gemini-api/docs/changelog dan https://ai.google.dev/gemini-api/docs/models.
2. **Firebase credential harus tunggal.** Bila `FIREBASE_SERVICE_ACCOUNT_JSON` dan `FIREBASE_SERVICE_ACCOUNT_BASE64` diisi bersamaan, konfigurasi sekarang ditolak (dulu JSON didahulukan diam-diam). Endpoint status menyebutkan bahwa satu format saja boleh digunakan.
3. **Status Firestore.** Endpoint `/api/status` menjalankan probe baca ringan; format JSON yang valid saja tidak dianggap sebagai bukti bahwa Firestore bisa dijangkau. Probe ini bukan verifikasi izin tulis penuh.
4. **Kontrak klien Web/Android diperiksa.** Route dan payload yang digunakan klien dicakup oleh tes kontrak. Source Android disediakan pada ZIP terpisah dan menggunakan endpoint server yang sama.
5. **ENV template aman.** `ENV.example` memakai placeholder, tidak berisi service-account key atau API key asli.

## Tes otomatis

`npm test` lulus untuk routing, validasi input, kecepatan, chat, pembatasan kuota, halaman, tes Firebase dengan fake Firestore, alat belajar, kontrak klien, dan migrasi model.

## Yang belum bisa dipastikan dari audit statis

- Endpoint live `https://www.franzzorbit.my.id/api/status` dan halaman produksi tidak berhasil dibuka oleh alat inspeksi sesi ini, jadi status deployment live tidak diklaim terverifikasi.
- Tes Firestore menggunakan fake/mock Firestore, bukan service account produksi. Setelah deploy, lakukan uji login admin, buat akun uji, logout/login akun tersebut, dan uji perubahan kuota untuk memastikan izin baca/tulis IAM benar.
- Build Android penuh wajib dijalankan di GitHub Actions atau Android Studio dengan SDK sungguhan; ZIP Android memiliki workflow yang menyelaraskan versi Gradle dan compiler, tetapi source belum diklaim menghasilkan APK sampai workflow sukses.
