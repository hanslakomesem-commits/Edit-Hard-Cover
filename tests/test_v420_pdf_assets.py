from pathlib import Path
import fitz
HERE=Path(__file__).resolve().parents[1]
source=fitz.open(HERE/'assets/SOFT_COVER_IPS_REFERENSI_6_HALAMAN.pdf')
clean=fitz.open(HERE/'assets/soft_ips_clean.pdf')
assert len(source)==6
assert len(clean)==1
assert abs(clean[0].rect.width/72*25.4-330)<.02
assert abs(clean[0].rect.height/72*25.4-210)<.02
assert clean[0].get_text().strip()==''
assert len(clean[0].get_images())==len(source[0].get_images())==1
assert len(clean[0].get_drawings())==len(source[0].get_drawings())
print('PASS V4.20 IPS PDF master: six reference pages, one cleaned vector page, 330x210mm, image/logo and crop marks retained, student text removed')
