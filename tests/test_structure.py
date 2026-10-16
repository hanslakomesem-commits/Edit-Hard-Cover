import fitz,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parent.parent
layout=json.loads((ROOT/'assets/layout.json').read_text())['templates']
assert sorted(map(int,layout))==list(range(10,29))
masters=fitz.open(ROOT/'assets/masters.pdf')
assert len(masters)==19
for p in masters:
 assert abs(p.rect.width*25.4/72-483)<.03
 assert abs(p.rect.height*25.4/72-330)<.03
for file in ['warna_clean.pdf','warna_transparent_marks_logo.pdf']:
 d=fitz.open(ROOT/'assets'/file);assert len(d)==2
 assert abs(d[0].rect.width*25.4/72-475)<.05
 assert abs(d[0].rect.height*25.4/72-320)<.05
app=(ROOT/'app.js').read_text()
assert '/api/' not in app
assert 'await worker()' in app
assert "ocrBatchRunning=false;btnBusy($('ocrAllButton'),false);clearProgress();" in app
assert all((ROOT/f).exists() for f in ['index.html','app.js','pdf-engine.js','document-reader.js','classifier.js','guide-geometry.js','style.css'])
print('PASS: 19 template polos, 2 master warna, halaman fisik, tanpa /api, penyelesaian status antrean')
