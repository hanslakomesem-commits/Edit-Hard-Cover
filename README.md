# ZAIN.NET COVER V4.4 — GitHub Pages • Tanpa token API

Versi perbaikan pembacaan berkas dan OCR lokal dari V4.3. Website **statis**; cukup unggah seluruh isi folder ke root repository GitHub Pages. Tidak memerlukan server Node.js, Python, atau API Gemini untuk mengolah berkas.

## Perbaikan khusus V4.4

1. **Word tidak lagi macet pada “Sedang membaca”.** `document-reader.js` membuka DOCX secara lokal, menelusuri hanya paragraf awal, dan tidak membuat DOM untuk seluruh dokumen skripsi yang sangat panjang. `vendor/jszip.min.js` disertakan di ZIP sehingga pembacaan Word tidak bergantung pada CDN JSZip.
2. **PDF digital membaca halaman pertama saja**, dari text layer menggunakan PDF.js; tidak memakai OCR atau token. PDF hasil scan hanya merender halaman pertama, dengan pembatasan resolusi untuk RAM HP.
3. **OCR foto lebih efisien.** Tesseract.js v5 memakai satu worker yang disimpan dan digunakan kembali selama tab hidup; sebelumnya `Tesseract.recognize()` berpotensi membuat worker baru untuk tiap foto. Secara default cukup satu model bahasa Indonesia (`ind`). Mode “Teliti” memakai `ind+eng`, biasanya lebih lambat.
4. **Foto diperkecil sebelum OCR** maksimum sisi 1900 piksel dan sekitar 2,5 MP, diubah ke grayscale/kontras ringan, kemudian dikirim ke worker sebagai JPEG yang terkompresi. Data gambar sumber **tidak diunggah ke server**.
5. **Status pembacaan terlihat**: memuat model, menyiapkan foto, mengenali tulisan. Kegagalan atau timeout ditampilkan per pesanan. Satu berkas gagal tidak menghentikan antrean berkas lainnya.
6. **Tidak ada Gemini / permintaan API berbayar** pada jalur pembacaan ini. Foto masih membutuhkan model OCR lokal, yang diunduh saat pertama dipakai dan biasanya masuk cache browser (dapat perlu diunduh ulang jika cache dihapus).

## Instalasi GitHub Pages

1. Download ZIP, lalu ekstrak.
2. Buat repository di GitHub, unggah **isi ZIP** ke root (`index.html`, `app.js`, `ocr-fast.js`, `document-reader.js`, `vendor/`, `assets/` dan berkas lainnya).
3. GitHub repository → Settings → Pages → Deploy from a branch → `main` → `/(root)`.
4. Buka alamat `https://username.github.io/nama-repository/` melalui Chrome. Refresh paksa jika masih melihat versi lama. Pastikan tulisan footer **V4.4** dan pengaturan **Mode OCR** muncul.
5. **Tidak perlu membuka AI Studio.** Perubahan source GitHub Pages **tidak otomatis memperbarui** aplikasi lama di `aistudio.google.com`.

## Cara memakai

- **Word DOCX**: upload → Baca Semua Berkas → periksa form → pilih Polos/Warna serta ketebalan → ekspor.
- **PDF teks asli**: hanya halaman pertama dibaca tanpa token.
- **PDF scan atau JPG/PNG/WebP**: OCR lokal. Pilih **Cepat** untuk default. Saat pertama kali, unduhan engine/model memerlukan internet; lihat status. Setelah tersedia, worker dipakai ulang untuk foto selanjutnya.
- Untuk banyak pesanan, ketebalan masing-masing berbeda dan hasil dapat diekspor sebagai PDF gabungan atau ZIP per orang.

## Catatan penting

- **Foto pertama masih bisa lambat** di jaringan buruk karena model perlu diunduh. Tidak ada jaminan pemrosesan selalu selesai dalam hitungan detik, terutama HP dengan RAM terbatas.
- Foto sangat buram, miring ekstrem, terlalu kecil, atau gelap tetap bisa membuat OCR keliru. Koreksi data di editor sebelum cetak.
- **DOCX tidak selalu menyimpan batas halaman cetak.** Kalau tidak ada page break eksplisit, aplikasi hanya mengambil bagian awal sampai penanda akhir cover atau batas aman, *bukan* menjamin secara matematis halaman cetak pertama. Untuk akurasi paling tinggi, simpan halaman pertama DOCX sebagai PDF digital.
- Ketika pustaka **PDF.js atau Tesseract.js CDN** tidak dapat dimuat, aplikasi tetap membutuhkan koneksi internet untuk mengunduhnya. Ini **tanpa token/API berbayar**, bukan 100% offline jika cache belum tersedia. JSZip untuk Word sudah disertakan lokal.
- Mode **Polos 480×330 mm**, warna **Merah/Maroon/Custom 475×320 mm** dengan logo/tulisan kuning, punggung 10–28 mm seperti versi terdahulu. Mode warna 28 mm tetap dikunci karena geometri tanda potong paling kiri tidak aman pada master sebelumnya.
- Font Times New Roman asli tidak dibagikan. Bila ingin presisi cetak atau karakter diakritik, unggah font yang secara sah tersedia bagi Anda dan lakukan uji cetak skala 100%.
- **Ekspor PDF langsung di browser dan OCR Tesseract nyata di Android belum diuji end-to-end di lingkungan pembuatan ZIP ini.** Uji fungsi tersebut di GitHub Pages sebelum dipakai produksi.

## Pengujian yang sudah dijalankan

Jalankan `node tests/test_reader.mjs` pada Node 22 jika ingin mengulang. Yang telah lulus:

- Ekstraksi dari berkas **DOCX 125 halaman**, hanya data cover (sekitar 15–22 ms di lingkungan pengujian, bukan prediksi kecepatan HP).
- Stress test **20 DOCX berisi 125 halaman** per berkas (semua terbaca melalui parser lokal).
- Alur PDF 60 halaman **dengan PDF.js mock** — dipastikan hanya memanggil `getPage(1)`. **Belum** membuktikan PDF.js CDN nyata.
- Dua simulasi OCR — worker Tesseract mock hanya diinisialisasi sekali, digunakan dua kali.
- Gagal memuat model — simulasi melempar error, tidak menggantung selamanya.

Tes modul tersebut **tidak** membuktikan akurasi OCR foto nyata atau presisi ekspor PDF. Untuk menyelidiki berkas tertentu yang masih gagal, lampirkan DOCX/PDF tersebut dan pesan error dari V4.4.
