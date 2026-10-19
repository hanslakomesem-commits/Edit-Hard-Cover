# ZAIN.NET COVER V4.23 — Tambahan COVER CD

Situs statis GitHub Pages untuk cover Polos, Warna, UNIRA, Dummybook, Soft Cover IPS, dan COVER CD.

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
