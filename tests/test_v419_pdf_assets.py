from pathlib import Path
import fitz
root=Path(__file__).resolve().parents[1]
source=fitz.open(root/'assets/DUMMYBOOK_REFERENSI_2_HALAMAN.pdf')
clean=fitz.open(root/'assets/dummybook_clean_2pages.pdf')
assert len(source)==len(clean)==2
for s,c in zip(source,clean):
    assert abs(s.rect.width-c.rect.width)<.01
    assert abs(s.rect.height-c.rect.height)<.01
    assert abs(c.rect.width-595.276)<.1
    assert abs(c.rect.height-841.89)<.1
    assert c.get_text().strip()==''
assert clean[0].get_images(), 'logo/photos must be retained on cover front'
assert source[1].get_text().strip(), 'original source has sample abstract text'
assert clean[1].get_text().strip()=='', 'never reuse another student abstract'
print('PASS V4.19: A4 2-page source/blank master, original graphics preserved, sample text excluded')
