"""Audit corrected UNIRA logo against original PDF indexed image + soft mask."""
from pathlib import Path
from PIL import Image
import hashlib
import fitz
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets' / 'unira_logo.png'
TRANSPARENT = ROOT / 'assets' / 'unira_logo_transparan.png'
ORIGINAL = ROOT / 'assets' / 'CONTOH_COVER_UNIRA_REFERENSI.pdf'

im=Image.open(ASSET)
assert im.mode=='RGB' and im.size==(33,34), 'Image should be Adobe-Reader-safe opaque RGB'
assert im.getpixel((0,0))==(255,255,255), 'Black rectangle: transparent area was not composited white'
assert im.getpixel((32,33))==(255,255,255)
assert min(im.getpixel((15,15)))<100, 'Logo content disappeared'
rgba=Image.open(TRANSPARENT)
assert rgba.mode=='RGBA' and rgba.getpixel((0,0))[3]==0
src=fitz.open(ORIGINAL)
assert any(info[1] for info in src[0].get_images(full=True)), 'Reference must have indexed image + smask'
ref = fitz.open(ROOT/'assets/unira_clean.pdf')
assert ref.page_count==1
js=(ROOT/'pdf-engine.js').read_text()
assert 'const emblem=await doc.embedPng(UNIRA_LOGO)' in js
assert 'page.drawImage(emblem,{x:g.center-5.98,y:page.getHeight()-784.93,width:11.96,height:12.3})' in js
assert 'pre-composited on WHITE' in js
print('PASS: logo extracted with soft mask; white RGB background, nonblank icon, unchanged placement')
