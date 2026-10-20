# ZAIN.NET COVER V4.24 — Dua pilihan Polos (Nama–Logo / Logo–Nama)

Source statis siap upload ke GitHub Pages, berasal dari V4.23 (semua menu lama dipertahankan).

## Polos V1: Nama → Logo
- Menu: **Polos V1 — Nama di Atas Logo**, nilai internal `polos` supaya pesanan lama kompatibel.
- Judul depan, posisi nama, NIM, data kampus dan punggung memakai kalibrasi Serli yang ada.
- Logo UIN Madura ditaruh di bawah nama/NIM dan sebelum bagian prodi/fakultas.

## Polos V2: Logo → Nama
- Menu: **Polos V2 — Logo di Atas Nama**, nilai internal `poloslogoatas`.
- Logo berada di atas label OLEH, nama dan NIM.
- Koordinat judul, OLEH, nama, NIM, prodi/fakultas/universitas/tahun berasal dari `polos logo atas.pdf` baru; untuk mempertahankan master Polos 483×330 mm dipetakan dengan inset sumber (+4 mm x dan +5 mm y).
- **PENTING: PDF referensi terbaru tidak mengandung gambar logo.** Logo yang ditempatkan berasal dari `assets/cover_cd_uin_logo.png` yang sudah dipakai Cover CD.

## Aturan umum kedua Polos
- Tetap memilih punggung **10–28 mm** dengan kalibrasi Serli dan prioritas 9 pt di punggung lebar.
- Output PDF Polos fisik tetap **480 × 330 mm**. Master sumber Serli 483 × 330 mm disesuaikan lebar saat output (kode lama).
- Hasil PDF satuan/ZIP/gabungan tetap tersedia. Kedua gaya bisa digunakan dalam satu batch.
- Menu Merah, Maroon, Custom, UNIRA, Dummybook, Soft Cover IPS, dan Cover CD tidak dimodifikasi.

## Berkas yang relevan
- `plain-variant-layout.js` — konfigurasi dan pemeriksaan area logo/identitas per varian.
- `pdf-engine.js` — injeksi logo ke dua varian Polos, pemilihan rendering depan V2.
- `app.js`, `index.html` — dua pilihan Polos di menu per pesanan dan menu utama.
- `assets/REFERENSI_POLOS_V2_LOGO_ATAS.pdf` — file PDF terbaru pengguna, disertakan sebagai referensi (belum ada gambar logo di dalamnya).
- `assets/cover_cd_uin_logo.png` — logo UIN yang sudah ada sebelum V4.24.

## Pengujian yang dilakukan
- `node tests/test_plain_v424.mjs`: 19 ketebalan × 2 pilihan = 38 tes jalur generator dan tumpukan logo melalui runtime PDF tiruan.
- `node tests/test_cover_cd.mjs`: regresi Cover CD.
- `node --check app.js`, `node --check pdf-engine.js`: pemeriksaan sintaks JS.
- Pemeriksaan semua `src`/`href` lokal dan integritas ZIP.
- **Belum** memverifikasi PDF hasil melalui Chrome end-to-end atau cetak fisik dengan skala 100%. Pengukuran dan mock runtime tidak menggantikan cetak proof.

## Update GitHub Pages
1. Ekstrak ZIP; unggah isinya ke **root** branch `main` repository Edit-Hard-Cover, bukan file ZIP utuh.
2. Pastikan `assets/`, `vendor/`, `index.html`, `app.js`, `pdf-engine.js`, `plain-variant-layout.js` ada.
3. Commit; tunggu deploy GitHub Pages hijau; refresh `Ctrl+F5`.
4. Coba Polos V1 dan V2 pada 10 mm dan 23 mm, bandingkan urutan nama/logo dan posisi punggung.

 
## COVER CD — berdasarkan referensi Word pengguna

- Ukuran cetak tepat mengikuti page size pada `COVER CD IAIN MADURA fix.docx`: **137,0189 × 137,0189 mm**, halaman **persegi**, 1 halaman PDF per orang.
- NAMA dan `NIM: ...` di bagian atas.
- PRODI dan BULAN/TAHUN di bagian atas tengah **opsional**, meniru lima contoh Word.
- Dua gambar LOGO UIN MADURA berwarna yang diekstrak dari DOCX tersebut pada kiri dan kanan.
- JUDUL bagian bawah, rata tengah; teks panjang dibungkus menjadi beberapa baris, font Tinos Bold (serif kompatibel Times New Roman). Jika terlalu panjang, font turun 9 → 7 pt; bila tetap tidak muat ekspor ditolak, tidak dipotong.
- **Cover CD tidak memakai punggung / ketebalan.** Tidak memerlukan data fakultas, universitas, dan jenis dokumen. Hanya nama, NIM, judul yang wajib.
- Hasil tetap PDF satuan, PDF gabungan, dan ZIP batch. Nama output `01_NAMA_COVERCD.pdf` (tanpa `MM`).

## Referensi

- `assets/cover_cd_uin_logo.png` — logo berwarna asli dari dokumen Word.
- `assets/REFERENSI_COVER_CD_5_CONTOH.docx` — dokumen Word yang diberikan, berisi 5 contoh.
- `cover-cd-layout.js` — angka tata letak dalam satuan point, dihitung dari render Word.
- `pdf-engine.js` — generator PDF browser.
- `app.js`, `index.html`, `style.css` — menu Cover CD dan validasi khusus tanpa ketebalan.

## Cara update GitHub

Ekstrak ZIP → pilih seluruh file/folder **di dalamnya** → unggah ke root repo `Edit-Hard-Cover` branch `main` → `Commit changes` → tunggu Pages hijau → refresh `Ctrl+F5`. **Jangan mengunggah ZIP saja** atau memindahkan isi `assets/` ke root. Paket ini kurang dari 100 berkas.

## Pengujian & batasan

- 5 judul dari lima halaman DOCX diuji terhadap batas dan area layout di mock generator.
- 200 judul sintetis dengan variasi panjang diuji; jika terlalu panjang akan ditolak dengan keterangan yang jelas.
- PDF visual 5 halaman yang disediakan sebagai pratinjau dibuat terpisah dengan ReportLab berdasarkan koordinat Word, **bukan keluaran end-to-end generator situs**.
- `tests/test_cover_cd.mjs` menguji fungsi generator dengan PDF runtime tiruan. `TEST_COVER_CD_V423.mjs` memeriksa pembungkus judul.
- **Browser/Chrome nyata belum teruji end-to-end karena kebijakan lingkungan menghalangi akses localhost.** Cetak proof skala 100% sebelum digunakan untuk pesanan.
- Berkas DOCX contoh berisi **lima cover**; aplikasi menganggap satu berkas unggahan sebagai satu pesanan. Ekspor otomatis kelima cover dari satu DOCX multipage belum dibuat. Koreksi hasil ekstraksi identitas secara manual bila perlu.
- CD menghasilkan **PDF** seperti keluaran cover lainnya; dokumen Word disertakan sebagai **referensi**, bukan output DOCX yang otomatis diisi.

Semua template terdahulu disertakan dalam ZIP tanpa perubahan sumber master mereka.
