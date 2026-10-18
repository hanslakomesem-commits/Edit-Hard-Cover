# ZAIN.NET COVER V4.14 — FIX FONT PUNGGUNG WARNA

**Perubahan hanya pada perhitungan judul punggung WARNA (Merah/Maroon/Custom).**
- Punggung 13–28 mm: 2×9 pt → 3×9 pt → 2×8 pt → 3×8 pt → ... sampai minimum 6 pt.
- Punggung 10–12 mm: 2 baris dengan font adaptif dahulu; baru 3 baris jika perlu.
- Batas panjang judul menggunakan zona cetak referensi sebenarnya; aturan lama memakai angka tetap 320 pt dan dapat mengecilkan huruf tanpa perlu.
- Tetap center antara dua garis kuning dan dalam zona vertikal yang aman.
- Ukuran font/baris terpilih ditampilkan jelas setelah PDF dibuat.
- Cover depan polos maupun warna, logo, data OCR/PDF/DOCX, batch, dan template tidak diubah.
- **Cover warna 28 mm tetap diblokir** karena trim mark keluar dari halaman pada master yang diberikan.

**Tes:** `node tests/test_v414_color_font.mjs` dan tes regresi lainnya.

**Batas pengujian:** perhitungan huruf dapat diperiksa secara lokal; PDF final di browser dengan font yang sesungguhnya serta hasil cetak harus tetap diuji, jangan menganggap gambar pratinjau sebagai bukti 100% presisi.

---

# ZAIN.NET COVER V4.13 — PRIORITAS FONT 9 PT PADA PUNGGUNG LEBAR

**Perubahan khusus:** ketika punggung lebar (23–28 mm), 9 pt menjadi target keterbacaan.
- 23–28 mm: 2 baris × 9 pt → 3 baris × 9 pt → 2/3 baris × 8, 7, 6 pt bila harus.
- 13–22 mm: 2 × 9 pt → 2 × 8 pt → 3 × 9 pt → font lebih kecil hanya bila diperlukan.
- 10–12 mm: 2 baris diutamakan sampai minimum 6 pt, kemudian 3 baris jika diperlukan.
- 3 baris **tidak pernah dipakai bila 2 baris sudah muat pada 9 pt**. Perubahan ke 3 baris 9 pt pada punggung lebar adalah kompromi yang disengaja untuk mencegah huruf terlalu kecil.
- Font tidak ditingkatkan melebihi 9 pt, dan tidak diturunkan di bawah 6 pt. Semua teks masih harus lolos uji batas punggung, posisi atas/bawah dan titik tengah master.
- Cover depan Polos, Merah, Maroon, Custom, logo, warna tinta, master dan dukungan Foto/PDF/Word tetap seperti V4.12.
- Mode warna 28 mm tetap dibatasi oleh pengaman tanda potong yang telah diketahui.

**Tes:** `node tests/test_v413_font_priority.mjs` dan tes regresi terpilih. Pengujian PDF output dari browser dan proof cetak masih wajib sebelum produksi.

---

# ZAIN.NET COVER V4.12 — DUA BARIS DIUTAMAKAN

Aturan baru untuk **Polos maupun Warna**: gunakan judul punggung **dua baris lebih dahulu**. Coba font default (10 mm: 8 pt; 11–28 mm: 9 pt), lalu kecilkan bertahap hingga **6 pt**. **Hanya jika dua baris tetap tidak muat pada 6 pt**, gunakan tiga baris dan cari font terbesar yang aman. Judul satu kata boleh satu baris. Tidak boleh memotong judul atau keluar dua garis kuning.

Seluruh posisi cover depan, logo, ukuran cetak, teks universitas lengkap, upload otomatis foto/PDF/Word, dan batch **tidak diubah**. Master tiga baris 10–28 mm tetap ada sebagai acuan khusus ketika diperlukan. Mode warna 28 mm tetap memiliki pengaman terhadap tanda potong yang melewati tepi kertas.

Pengujian: `node tests/test_v412_row_priority.mjs` dan regresi pada `tests/`. Hasil tes dan batasnya dicatat dalam `HASIL_UJI_V4_12.md`. PDF nyata dan cetak fisik masih membutuhkan uji browser/percetakan sebelum produksi.

---

# ZAIN.NET COVER V4.11 — FIX POSISI JUDUL PUNGGUNG WARNA

**Perbaikan utama:** titik tengah judul punggung warna mengikuti PDF referensi tiga baris: sekitar **295,0 pt dari atas (104,07 mm)** pada semua ketebalan 10–28 mm. Sebelumnya perhitungan panjang teks dikurangi dua kali sehingga judul panjang bisa menabrak tanda potong atas. V4.11 menghapus pengurangan ganda tersebut.

- Cover depan warna menggunakan master `assets/warna_clean.pdf` lama (tidak diubah).
- Posisi logo, teks identitas depan, dan penanda kanan tidak berubah.
- Baris punggung ditaruh di tengah dua garis kuning dalam bidang warna 475 × 320 mm.
- Dua/tiga baris, font adaptif 9/8 → 7 → 6 pt dengan penolakan jika tidak muat.
- Ada pemeriksaan bahwa ujung teks judul minimal 30 mm dari tepi atas dan maksimal 181 mm dari tepi atas, agar tidak menabrak zona data punggung lain.
- Mode polos 480 × 330 mm tidak berubah.
- Upload JPG / PDF / DOCX, tanpa token, batch, PDF per orang dan gabungan tetap tersedia.
- Master 28 mm warna masih diblokir jika garis potong paling kiri keluar kertas (pengaman yang sudah ada).

**Pengujian:** `node tests/test_v411_title_anchor.mjs`, `python tests/test_v411_reference_alignment.py`, jalankan pula tes V4.10. Lihat `PERBAIKAN_V4_11.txt`.

**Catatan jujur:** Ekspor PDF end-to-end memakai pdf-lib dan font eksternal belum dapat dijalankan di lingkungan pengujian tanpa jaringan; cek PDF produksi lewat browser GitHub Pages dan lakukan uji cetak.

# ZAIN.NET COVER V4.10 — PERBAIKAN UPLOAD OTOMATIS

**Perubahan:** memilih 1 atau banyak JPG/PNG/WebP/PDF/DOCX akan langsung memulai pembacaan tanpa tombol tambahan. Tombol “Baca Ulang Berkas Gagal” tersedia bila berkas gagal. Pembacaan berkas baru ketika antrean sibuk akan otomatis menyusul.

**PDF digital:** PDF.js (CDN) membaca halaman 1. **Word DOCX:** JSZip lokal membaca bagian cover tanpa API. **Foto/PDF scan:** Tesseract lokal (CDN + model bahasa) dengan waktu yang dapat lebih lama. Seluruhnya tanpa token Gemini. Jika CDN tidak dapat diakses, pesan error akan muncul pada baris pesanan. Word DOCX tanpa pagination eksplisit masih menggunakan perkiraan bagian cover.

**Catatan:** Ini bukan jaminan bahwa OCR mengenali setiap karakter benar atau bahwa PDF sudah aman cetak. Periksa setiap identitas dan hasil PDF.

**Cara GitHub:** upload seluruh isi folder ini ke root repo, commit, tunggu Pages, Ctrl+F5. Pastikan `app.js` dan seluruh modul JS berada di root bersama `index.html`, serta `assets/` dan `vendor/` terunggah.

# Update penting V4.9

**Upload satu pintu:** klik area upload dan pilih JPG, PNG, WebP, PDF, serta DOCX sekaligus. Deteksi jenis file dilakukan otomatis. Kamera dan pesanan manual tetap tersedia.

**Perbaikan download:** tombol Download PDF dapat membuat PDF otomatis; setiap PDF atau ZIP batch yang selesai menyediakan **tautan unduh manual** (klik jika download otomatis tidak berjalan). Untuk batch, pesanan belum lengkap akan ditampilkan jelas; pengguna dapat memilih melewati pesanan tersebut dan mengunduh hanya pesanan yang lengkap. Semua pesanan lengkap perlu dikonfirmasi sebelum ekspor.

**Universitas:** judul logo yang hanya menulis UIN MADURA tidak mengalahkan nama panjang UNIVERSITAS ISLAM NEGERI MADURA dari sumber. Singkatan UIN MADURA yang dikenali diperluas ke UNIVERSITAS ISLAM NEGERI MADURA di editor dan PDF. Untuk universitas lain, gunakan teks lengkap pada sumber; aplikasi tidak menebak singkatan yang tidak dikenal.

**Belum divalidasi pada printer fisik.** CDN dan font Unicode masih perlu tersedia.

---

# ZAIN.NET COVER V4.9 — REVISI COVER DEPAN FIX + REFERENSI PUNGGUNG 3 BARIS LENGKAP

**Download untuk GitHub Pages:** unggah seluruh isi ZIP di root repository.

- **Cover depan warna** wajib mengikuti master yang sudah benar sebelumnya, `PILIHAN WARNA.pdf` (aset `assets/warna_clean.pdf` / logo aset); jangan menyalin cover depan dari file terbaru 10–28 mm.
- **Cover depan polos** tetap mengikuti Serli; sama sekali tidak dipindahkan.
- **Punggung tiga baris** sekarang punya referensi lengkap 19 ukuran: 10–24 dari file 17 halaman, 25 dan 26 dari `25-26 mm(1).pdf`, lalu 27–28 dari file lama. `assets/REFERENSI_WARNA_3_BARIS_10-28MM.pdf` merupakan arsip referensi, **bukan master produksi**.
- **Punggung polos** dapat memakai prinsip pembagian tiga baris yang sama, tetapi tetap memakai ukuran/font/posisi punggung dari master polos.
- **Pengaman:** warna 28 mm diblokir karena salah satu penanda potong paling kiri keluar bidang cetak 475 mm; ada peringatan tanda lain yang dipendekkan. Tidak menyatakan 100% presisi cetak tanpa proof printer.
- **Foto, PDF halaman pertama, Word awal, batch, OCR lokal tanpa token, italic, Unicode, warna & ukuran** dipertahankan dari V4.7.
- Baca laporan `AUDIT_WARNA_3_BARIS_V4_8.md` dan spreadsheet CSV sebelum produksi.

---

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

1. Deploy V4.9 ke GitHub Pages (pastikan footer tertulis `V4.9` dan lakukan hard reload jika masih versi lama).
2. Gunakan judul `ANALISIS PENDIDIKAN KARAKTER ISLAM PADA BUKU “KARTINI NYANTRI” DAN RELEVANSINYA DALAM PENEGAKAN ISLAM MODERAT`.
3. Lengkapi identitas yang relevan, pilih punggung 10–27 mm, tekan **Buat & Lihat PDF**. Pertama kali browser perlu mengunduh font Unicode.
4. Jika unduhan font atau fontkit diblokir oleh jaringan, aplikasi akan menjelaskan masalahnya. Jalur opsional adalah unggah dua font TTF/OTF dengan glyph Unicode yang diperlukan.
5. Periksa bahwa bentuk petik tidak berubah, judul tidak keluar area, posisi punggung presisi, dan ukuran PDF sesuai jenis cover.

**Cakupan pengujian:** Sintaks dan tes logika font dibuat di source. Kami tidak mengklaim ekspor PDF nyata di browser telah lulus sebelum dites di GitHub Pages; CDN tidak dapat diakses dari lingkungan pembuatan source ini.

---

## V4.7 — Pemeriksaan template warna tiga baris

File baru `REFERENSI_WARNA_3_BARIS_17_HALAMAN.pdf` ditambahkan **sebagai referensi**, bukan sebagai master siap pakai tanpa validasi. Lihat `AUDIT_WARNA_3_BARIS.md` dan `AUDIT_3_BARIS_17_HALAMAN.csv` sebelum cetak. **File referensi tidak menyediakan 25 dan 26 mm**. Terdapat tanda potong di luar halaman dalam sejumlah ukuran. Engine mempertahankan layout depan warna dari `PILIHAN WARNA.pdf` dan menata judul di antara dua garis tengah serta memberi peringatan bila sudut kiri dipendekkan. Mode warna 28 mm tetap diblokir sampai master fisik aman. Ini mencegah hasil salah cetak, bukan kekurangan OCR. Perubahan mode warna ini tidak mengubah pembaca foto, PDF, Word, batch, font Unicode, atau master polos.
