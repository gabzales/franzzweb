# Audit kompatibilitas Web ↔ Android

Tanggal audit: 11 Oktober 2026.

## Kontrak yang digunakan kedua klien

| Fitur | Endpoint | Request | Response utama |
|---|---|---|---|
| Status server | `GET /api/status` | tanpa body | `configured`, `panel`, `storageError` bila Firestore gagal |
| Login | `POST /api/login` | `{username,password}` | `token`, `username`, `role` |
| Chat AI | `POST /api/chat` | `{messages,mode?,page?}` | `{text}` |
| Buat gambar / edit foto | `POST /api/image` | `{action,prompt,aspectRatio?,imageData?,mimeType?}` | `{action,imageData,mimeType,text}` |
| Analisis halaman | `POST /api/analyze` | `{title,url,text,instruction}` | `{text}` |
| Scan & Fill | `POST /api/gemini` | `{questions,profile}` | `{answers}` |
| Alat belajar | `POST /api/study` | `tool=check`, `quiz`, atau `grade` | skor / pertanyaan / hasil penilaian |

## Temuan dan tindak lanjut

- Seluruh grup tes Node.js lulus, termasuk tes routing, chat, alat belajar, validasi halaman, kuota dan adapter Firestore tiruan.
- Tes Firestore menggunakan adapter/mock; tidak membuktikan izin IAM atau database produksi dapat dibaca/ditulis.
- Server default Android sebelumnya kosong, sehingga pengguna harus memasukkan URL sendiri. Versi Android yang diselaraskan sekarang memakai URL awal yang sama seperti deploy web dan tetap menyediakan tes status.
- UI Android sebelumnya tidak memiliki menu Analisis Halaman AI dan enam menu Fitur AI. Versi Android yang diselaraskan sekarang menggunakan endpoint web yang sama.
- Android ScreenReader mengakses teks/nodes lewat Accessibility Service, bukan screenshot. Password field diabaikan. Hanya jalankan pembacaan ketika diminta pengguna.
- Batas tetap ada: UI Android tidak dapat membaca DOM browser secara lengkap seperti halaman web yang dimuat langsung; konteksnya berasal dari teks yang diekspos aplikasi melalui accessibility tree.

- Endpoint gambar memakai `GEMINI_API_KEY` server-side dan model default `gemini-nano-banana-2.1`; browser serta APK hanya memanggil `/api/image` dengan token sesi. Edit foto hanya mengirim foto yang dipilih pengguna. Respons gambar dibatasi agar tidak melewati batas ukuran fungsi.

## Status verifikasi

Tes otomatis backend/web berjalan lokal dan lulus. Koneksi Firestore/Vercel production dan build APK perlu diuji di deployment/CI dengan kredensial serta Android SDK sebenarnya; tidak disamakan dengan tes mock atau pemeriksaan statis.
