# ZAIN.NET COVER V4.22 — UNIRA & Dummybook

Source website GitHub Pages untuk template Polos, Warna, UNIRA, Dummybook 5–10 mm, dan Soft Cover IPS.

## Perubahan V4.22

1. Logo UNIRA baru: `assets/unira_logo_custom.png` disalin dari gambar transparan unggahan pengguna. Ukuran cetak gambar punggung tetap ±11,96×12,29 pt, dengan koreksi posisi turun 3 pt untuk logo dan tahun. Garis lipatan dan desain cover depan tidak berubah.
2. Dummybook memakai keluarga font sans-serif Arial-kompatibel Arimo saat default. Untuk penggunaan font **Arial asli**, unggah sendiri Arial Regular dan Arial Bold di bagian pilihan font Dummybook pada website. Font Microsoft tidak disertakan. Font Arimo diunduh dari internet oleh browser ketika PDF dibuat; jika akses terblokir, unggah Arial asli secara manual.
3. Parser abstrak membuang metadata bibliografis (misalnya nama, nomor induk, judul skripsi, kampus, pembimbing), menolak hasil yang hanya berisi identitas, lalu mengambil isi akhir 1–3 paragraf tanpa mengarang teks. Pratinjau khusus memperlihatkan paragraf akhir yang terpilih.
4. Bentuk Dummybook tetap satu halaman 420×297 mm dengan punggung asli 5–10 mm. Master lainnya tidak berubah.

## Cara memperbarui

Ekstrak ZIP, lalu upload SEMUA berkas dan folder `assets/`, `vendor/` ke root repository `Edit-Hard-Cover` di branch `main`. **Jangan upload ZIP secara langsung** dan jangan memindahkan isi `assets/` ke root. Tunggu deployment GitHub Pages berwarna hijau, lalu refresh `Ctrl+F5`.

**Uji:** Pastikan banner V4.22, buka UNIRA untuk mengecek logo/tahun, buka Dummybook dan lihat pratinjau PARAGRAF TERAKHIR. Lakukan cetak bukti sebelum produksi.

**Batas:** Uji 200 judul/abstrak bersifat sintetis. Pengujian Chrome end-to-end tidak tersedia dari lingkungan ini. Untuk PDF scan tanpa text layer, isi abstrak secara manual.
