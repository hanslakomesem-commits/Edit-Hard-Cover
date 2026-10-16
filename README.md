# ZAIN.NET COVER V4.6 — PENINGKATAN OCR TANPA TOKEN

**Gunakan sebagai pengganti SELURUH isi V4.5 di root repository GitHub Pages.**

## Apa yang baru
- OCR Cepat: pengenalan satu halaman, dengan ulang pada zona judul atau nama/NIM jika field penting kosong.
- OCR Teliti: membaca foto penuh + zona judul, nama/NIM, dan identitas kampus; gambar zona dipertajam dan bisa memakai threshold adaptif pada hasil yang kurang jelas.
- Batas resolusi/memori di HP: sekitar 2.4 megapiksel tiap zona, tidak memproses satu foto menjadi gambar tanpa batas.
- Worker Tesseract Indonesia (`ind`) dipakai ulang; tidak perlu pergantian model bahasa ketika berpindah mode.
- Hasil zona hanya mengisi kolom yang sebelumnya kosong. Jika hasil berbeda, aplikasi memperingatkan agar manusia memeriksa, tidak mengarang kata.
- PDF/Word berisi teks tetap dibaca dari halaman pertama tanpa AI/biaya token. PDF scan memakai jalur OCR foto hanya untuk halaman pertama.
- Semua fitur V4.5 (cover polos/warna, Unicode, 10–28 mm, batch, ekspor) tetap disertakan.

## Batasan
- OCR lokal bukan mesin pengenal format asli (italic) yang andal. Operator wajib memeriksa judul, italic, NIM, dan transliterasi sebelum mencetak.
- OCR lokal tidak dapat menjamin setiap huruf benar (contoh foto Mara: Q bisa dikenali sebagai O). Jangan mengubah identitas yang meragukan secara otomatis.
- Zona otomatis cocok untuk foto cover yang dipotret tegak dan mencakup seluruh lembar. Foto miring drastis atau foto terpotong sebaiknya difoto ulang.
- Mode Teliti menjalankan sampai empat pembacaan dan **dapat lebih lambat** daripada Cepat pada HP dengan RAM rendah. Gunakan bila mode Cepat kurang akurat.
- Tesseract.js dan pustaka PDF mengunduh aset pertama kali dari CDN. Ini **tanpa token API**, tidak harus offline sejak instalasi pertama.
- Ini proyek statis GitHub Pages. Agar perubahan terlihat, unggah semua file/folder pada root repositori, bukan hanya index.html. Setelah deploy, muat ulang dengan Ctrl+F5 atau hapus cache Chrome.

## Cara menguji
1. Unggah satu foto seperti sampel Zihad atau Mara, pilih `Cepat`, tekan Baca Terpilih. Periksa data.
2. Pilih `Teliti`, tekan Baca Terpilih lagi. Bandingkan kesalahan secara visual.
3. Uji satu PDF asli dan DOCX asli: diproses tanpa OCR jika punya text layer.
4. Uji tanda petik lengkung “ ” dan transliterasi setelah membuat PDF.
5. Cetak percobaan skala 100%, cocokkan garis dan posisi punggung.

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

## Riwayat V4.5 — PDF Unicode tanpa upload font manual

Versi ini menanggulangi pesan `Karakter “ (U+201C) tidak didukung Times bawaan` yang muncul untuk judul dengan petik melengkung seperti **“KARTINI NYANTRI”**.

- Ekspor PDF tidak lagi memakai `StandardFonts.TimesRomanBold` sebagai font utama. Sistem mengambil **Tinos Bold** dan **Tinos Bold Italic** berformat TTF secara otomatis dari sumber terbuka melalui CDN GitHub/Google Fonts, lalu menanamkannya ke PDF menggunakan `pdf-lib` dan `@pdf-lib/fontkit`. Tidak ada token API maupun login.
- **Penting:** pada pembuatan PDF pertama, akses internet ke CDN/font host dibutuhkan. Browser dapat menyimpan font di cache. Setelah font berhasil dimuat sekali dalam satu sesi, tidak diunduh berulang untuk setiap mahasiswa. Jika font host diblokir, aplikasi menampilkan error dan Anda boleh mengunggah font TTF/OTF milik Anda pada kolom opsional.
- Judul menggunakan petik lengkung `“”`, diakritik latin `ā ī ū ḥ ṣ ḍ ṭ ẓ`, dan format italic tetap dipertahankan bila glyph tersedia pada font. Huruf Arab murni / ligatur kompleks masih di luar dukungan generator saat ini dan ditolak agar tidak salah cetak.
- Hasil masih menggunakan **Tinos** (serif kompatibel Times), **bukan** font Times New Roman berlisensi yang sama persis. Sebelum produksi bandingkan cetakan dengan master asli.
- Font Tinos: hak cipta pemilik font, lisensi SIL Open Font License, informasi: https://github.com/googlefonts/tinos. File sumber ZIP ini **tidak menyertakan font**.
- Jalur **Foto OCR lokal, PDF teks halaman pertama, dan Word DOCX** tetap sama dengan V4.4. Pilihan Polos/warna 10–28 mm, batch ZIP/PDF gabungan, dan pembatasan keamanan cover warna 28 mm juga tidak berubah.

### Uji ulang masalah tanda petik

1. Deploy V4.6 ke GitHub Pages (pastikan footer tertulis `V4.6` dan lakukan hard reload jika masih versi lama).
2. Gunakan judul `ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU “KARTINI NYANTRI” DAN RELEVANSINYA DALAM PENEGAKAN ISLAM MODERAT`.
3. Lengkapi identitas yang relevan, pilih punggung 10–27 mm, tekan **Buat & Lihat PDF**. Pertama kali browser perlu mengunduh font Unicode.
4. Jika unduhan font atau fontkit diblokir oleh jaringan, aplikasi akan menjelaskan masalahnya. Jalur opsional adalah unggah dua font TTF/OTF dengan glyph Unicode yang diperlukan.
5. Periksa bahwa bentuk petik tidak berubah, judul tidak keluar area, posisi punggung presisi, dan ukuran PDF sesuai jenis cover.

**Cakupan pengujian:** Sintaks dan tes logika font dibuat di source. Kami tidak mengklaim ekspor PDF nyata di browser telah lulus sebelum dites di GitHub Pages; CDN tidak dapat diakses dari lingkungan pembuatan source ini.
