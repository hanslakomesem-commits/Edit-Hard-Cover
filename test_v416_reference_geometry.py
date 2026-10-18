"""Audit Serli reference PDF baseline anchors against assets/layout.json."""
import json
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parent.parent
LAY=json.loads((ROOT/'assets/layout.json').read_text())['templates']
SOURCES=[Path('/mnt/data/contoh pdf(1).pdf'),Path('/mnt/data/contoh 14mm-28 mm.pdf')]
if not all(p.exists() for p in SOURCES):
    print('SKIP: PDF referensi asli tidak berada pada folder /mnt/data; pengujian memerlukan PDF milik pengguna')
    raise SystemExit(0)
anchors=[]
spans_count=0
for filename in SOURCES:
    for page in fitz.open(filename):
        rows=[]
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                if abs(line['dir'][0])>=.5: continue
                for sp in line['spans']:
                    t=sp['text'].strip(); x0,y0,x1,y1=sp['bbox']
                    if len(t)>20 and 70<y0<500 and 620<x0<720:
                        rows.append(sp)
        if not rows:continue
        spans_count+=len(rows)
        cy=sum((s['bbox'][1]+s['bbox'][3])/2 for s in rows)/len(rows)
        anchors.append(cy)
        assert 76<min(s['bbox'][1] for s in rows),filename
        assert max(s['bbox'][3] for s in rows)<513,filename
for mm,layout in LAY.items():
    intended=layout['spine_title_center_y']
    diff=min(abs(intended-a) for a in anchors)
    assert diff<0.08,(mm,intended,diff)
print(f'PASS V4.16 reference PDF anchors: {len(LAY)} sizes, {len(anchors)} reference pages, {spans_count} title rows (tolerance 0.08pt)')
