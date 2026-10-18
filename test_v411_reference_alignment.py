#!/usr/bin/env python3
"""Read only the original source PDF examples: title bounding boxes must
have a consistent vertical midpoint. Do not infer layout from screenshots."""
import sys
from pathlib import Path
import statistics
import fitz

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
A=fitz.open(ASSETS/'REFERENSI_WARNA_3_BARIS_17_HALAMAN.pdf')
C=fitz.open('/mnt/data/25-26 mm(1).pdf') if Path('/mnt/data/25-26 mm(1).pdf').exists() else None
# The packaged 19-page compilation places 25/26 at indexes 15,16.
D=fitz.open(ASSETS/'REFERENSI_WARNA_3_BARIS_10-28MM.pdf')
assert len(D)==19,len(D)
rows=[]
for n in range(19):
 p=D[n]
 spans=[]
 for b in p.get_text('dict')['blocks']:
  for line in b.get('lines',[]):
   if abs(line['dir'][1]-1)>0.01:continue
   for sp in line['spans']:
    if sp['bbox'][0] < p.rect.width*.55 and len(sp['text'].strip())>=30:
     spans.append(sp)
 spans.sort(key=lambda s:s['bbox'][0],reverse=True)
 assert len(spans)>=3, (n+10,len(spans))
 centers=[(sp['bbox'][1]+sp['bbox'][3])/2 for sp in spans[:3]]
 center=statistics.mean(centers)
 assert abs(center-295.0)<0.20,(n+10,center)
 rows.append((n+10,center,min(s['bbox'][1] for s in spans[:3]),max(s['bbox'][3] for s in spans[:3])))
print('PASS V4.11: all 19 color reference titles vertically centered near 295.0 pt')
print('range centers pt',round(min(x[1] for x in rows),3),round(max(x[1] for x in rows),3))
