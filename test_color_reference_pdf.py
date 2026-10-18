import fitz,pathlib,json
r=pathlib.Path(__file__).resolve().parents[1]
a=json.loads((r/'assets/audit_3_baris_19_ukuran.json').read_text())
d=fitz.open(r/'assets/REFERENSI_WARNA_3_BARIS_10-28MM.pdf')
assert len(d)==len(a)==19
assert [q['reference_mm'] for q in a]==list(range(10,29))
for p,q in zip(d,a):
 assert abs(p.rect.width*25.4/72-475)<.01
 assert abs(p.rect.height*25.4/72-320)<.01
 assert q['title_3line_rows']==3
 assert q['all_3_rows_between_spine_guides']
 assert abs(q['measured_spine_width_mm']-q['reference_mm'])<.3,(q['reference_mm'],q['measured_spine_width_mm'])
assert a[15]['original_file']=='25-26 mm(1).pdf'
assert a[16]['original_file']=='25-26 mm(1).pdf'
print('PASS V4.8: 19 measured PDF pages, 25-26 included, 3 rows within physical guides')
