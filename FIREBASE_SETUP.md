# Aktivasi Firestore untuk FRANZZ Orbit di Vercel

Ikuti checklist ini setelah mengunggah source yang telah diperbarui.

## 1. Buat project dan database

1. Buka https://console.firebase.google.com/ lalu buat/pilih project Firebase.
2. Dari Firebase Console, pilih **Build → Firestore Database → Create database**.
3. Pilih **Standard edition**, buat database default, lalu pilih lokasi yang dekat dengan backend dan pengguna. Lokasi database tidak bisa sekadar diganti lewat source; pilih dengan hati-hati.
4. Tetap pada paket **Spark** bila ingin memakai kuota gratis. Jangan mengaktifkan billing / upgrade bila memang tidak ingin menghubungkan metode pembayaran.
5. Di tab **Rules**, gunakan aturan penolakan klien dari file `firestore.rules`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Backend menggunakan Firebase Admin SDK yang terautentikasi lewat Google Cloud IAM; SDK server melewati Firestore Security Rules. Karena itu, semua akses langsung dari klien ditolak dan kunci service account tidak boleh masuk ke browser.

## 2. Buat kredensial server

1. Buka **Project settings → Service accounts → Generate new private key**.
2. Unduh JSON dan simpan di komputer pribadi. Jangan commit file ini ke Git, unggah ke web publik, atau kirim lewat chat.
3. Di Google Cloud Console → **IAM**, pastikan service account punya izin baca/tulis Firestore yang diperlukan. Berikan izin sekecil mungkin. Jika API memberikan `PERMISSION_DENIED`, periksa IAM, project ID, dan apakah database sudah dibuat.

## 3. Isi Vercel Environment Variables

Buka Vercel → project FRANZZ Orbit → **Settings → Environment Variables**. Masukkan variabel berikut untuk **Production** (dan Preview/Development bila memang digunakan):

- `FIREBASE_SERVICE_ACCOUNT_JSON`: seluruh isi file JSON service account sebagai satu nilai environment variable.
- `FIREBASE_PROJECT_ID`: **Project ID**, bukan nama tampilan. Harus sama dengan `project_id` di JSON service account. Variabel ini sebenarnya opsional bila `project_id` sudah ada di JSON, tapi mengisinya membantu menghindari salah project.
- Saat halaman memanggil `/api/status`, backend melakukan probe baca ringan ke Firestore. Jika format JSON valid tetapi koneksi, database, atau izin IAM bermasalah, `panel` akan nonaktif dan status menampilkan pesan penyebab umum. Probe baca ini tidak membuktikan izin tulis; login admin/pembuatan pengguna akan menguji operasi tulis yang sebenarnya.
- `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, serta `GEMINI_API_KEY` tetap dibutuhkan seperti sebelumnya. Untuk model baru, pakai `GEMINI_MODEL=gemini-3.8-flash`; model lama di environment/pengaturan tersimpan dimigrasikan oleh kode jika memakai `gemini-3.5-flash` atau `gemini-3.7-flash`.

Alternatif kalau ingin variabel kredensial satu-baris: encode isi file JSON ke Base64 di PowerShell dari folder file tersebut:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .\service-account.json -Raw)))
```

Masukkan hasilnya ke `FIREBASE_SERVICE_ACCOUNT_BASE64` sebagai pengganti `FIREBASE_SERVICE_ACCOUNT_JSON`. **Jangan set kedua variabel kredensial sekaligus**—source sekarang menolak konfigurasi ambigu dan endpoint status menampilkan pesan yang spesifik. Nilai Base64 tetap merupakan rahasia, bukan cara mengenkripsi file.

## 4. Redeploy dan verifikasi

1. Pastikan dependency `firebase-admin` terpasang saat deploy (sudah dicantumkan di `package.json`). Vercel memakai Node.js 22 sesuai konfigurasi project.
2. Redeploy di Vercel setelah mengubah Environment Variables.
3. Buka website. Login menggunakan `ADMIN_USERNAME` dan `ADMIN_PASSWORD`.
4. Klik **Admin**. Buat user percobaan, logout, login dengan user itu, lalu periksa apakah user tetap terdaftar setelah reload. Coba ubah kuota dan refresh panel.
5. Buka Firestore Data; aplikasi akan membuat koleksi `orbitStore` saat penulisan pertama terjadi. Jangan mengubah dokumen internal secara manual.
6. Hapus user percobaan setelah berhasil.

Jika login/panel mengembalikan pesan Firestore, cek apakah database benar-benar dibuat, JSON kredensial utuh, Project ID cocok, service account punya akses IAM, serta Environment Variables benar-benar aktif untuk deployment yang sedang diuji.

## Catatan batas gratis

Firestore Standard mendokumentasikan kuota gratis 1 GiB data, 50.000 pembacaan dokumen per hari, 20.000 penulisan per hari, 20.000 penghapusan per hari, dan 10 GiB transfer keluar per bulan. Kuota gratis hanya berlaku untuk satu database per project. Batas dapat berubah; rujuk https://firebase.google.com/docs/firestore/pricing.

Di versi FRANZZ Orbit sebelumnya, penyimpanan produksi memang belum permanen, sehingga user tambahan lama di memori tidak bisa dimigrasi. Akun admin dari Environment Variables tetap dipakai; setelah Firestore aktif, login admin akan menyimpan dokumen akun admin ke Firestore.
