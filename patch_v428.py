from pathlib import Path
p=Path(__file__).resolve().parent
q=p/'pdf-engine.js'; s=q.read_text()
s=s.replace('static-browser GitHub Pages edition V4.27','static-browser GitHub Pages edition V4.28')
s=s.replace("for(const name of ['judul','nama','nim','prodi','fakultas','universitas','jenis_dokumen','bulan_tahun']){", "for(const name of ['judul','nama','nim','prodi','universitas','jenis_dokumen','bulan_tahun']){")
needle=" return normalizeTitleSegments(data);\n}\n\n/** Embed Unicode"
replacement=""" // Fakultas opsional; tetap periksa karakter jika kolom diisi.
 if(norm(data.fakultas)){
  if(String(data.fakultas).length>2000)fail('Kolom fakultas terlalu panjang.');
  if(String(data.fakultas).includes('\\u00ad'))fail('Kolom fakultas mengandung soft hyphen (U+00AD).');
  if(LATIN_CHECK.test(String(data.fakultas)))fail('Aksara Arab langsung pada kolom fakultas belum didukung.');
 }
 return normalizeTitleSegments(data);
}

/** Embed Unicode"""
assert needle in s;s=s.replace(needle,replacement)
# Put prodi one row lower if faculty missing, keeping institution and year anchored as in reference.
patches=[
("single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,12,placement.frontCX,placement.prodiY,395,'Prodi',warnings,9);\n single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,placement.frontCX,placement.fakultasY,395,'Fakultas',warnings,9);", 
 "single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,12,placement.frontCX,norm(data.fakultas)?placement.prodiY:placement.fakultasY,395,'Prodi',warnings,9);\n if(norm(data.fakultas))single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,placement.frontCX,placement.fakultasY,395,'Fakultas',warnings,9);"),
("single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,12,1000.7,767.1,395,'Prodi warna',warnings,9,false,YELLOW);\n single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,1000.7,780.4,395,'Fakultas warna',warnings,9,false,YELLOW);",
 "single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,12,1000.7,norm(data.fakultas)?767.1:780.4,395,'Prodi warna',warnings,9,false,YELLOW);\n if(norm(data.fakultas))single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,1000.7,780.4,395,'Fakultas warna',warnings,9,false,YELLOW);"),
("single(page,fonts,`PRODI ${upper(data.prodi)}`,12,cx,781.3,390,'Prodi UNIRA',warnings,9,false,BLACK);\n single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,cx,794.6,390,'Fakultas UNIRA',warnings,9,false,BLACK);",
 "single(page,fonts,`PRODI ${upper(data.prodi)}`,12,cx,norm(data.fakultas)?781.3:794.6,390,'Prodi UNIRA',warnings,9,false,BLACK);\n if(norm(data.fakultas))single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,cx,794.6,390,'Fakultas UNIRA',warnings,9,false,BLACK);"),
("single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,14,cx,707,420,'Prodi Dummybook',warnings,9,false,BLACK);\n single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,14,cx,722.6,420,'Fakultas Dummybook',warnings,9,false,BLACK);",
 "single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,14,cx,norm(data.fakultas)?707:722.6,420,'Prodi Dummybook',warnings,9,false,BLACK);\n if(norm(data.fakultas))single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,14,cx,722.6,420,'Fakultas Dummybook',warnings,9,false,BLACK);"),
("single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,8.35,cx,512.1,350,'Prodi IPS',warnings,6.5,false,BLACK);\n single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,8.35,cx,521.2,350,'Fakultas IPS',warnings,6.5,false,BLACK);",
 "single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,8.35,cx,norm(data.fakultas)?512.1:521.2,350,'Prodi IPS',warnings,6.5,false,BLACK);\n if(norm(data.fakultas))single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,8.35,cx,521.2,350,'Fakultas IPS',warnings,6.5,false,BLACK);")
]
for a,b in patches:
 assert a in s, a[:120];s=s.replace(a,b)
q.write_text(s)
q=p/'app.js';s=q.read_text().replace('V4.27','V4.28').replace('v=4.27','v=4.28')
s=s.replace("const REQUIRED=['judul',...FIELDS];","const REQUIRED=['judul',...FIELDS.filter(name=>name!=='fakultas')];")
s=s.replace("document.querySelectorAll('[name=\"fakultas\"],[name=\"universitas\"],[name=\"jenis_dokumen\"],[name=\"prodi\"],[name=\"bulan_tahun\"]').forEach(e=>{e.required=!optionalCD;});", "document.querySelectorAll('[name=\"universitas\"],[name=\"jenis_dokumen\"],[name=\"prodi\"],[name=\"bulan_tahun\"]').forEach(e=>{e.required=!optionalCD;});\n const facultyInput=document.querySelector('[name=\"fakultas\"]');if(facultyInput)facultyInput.required=false;")
q.write_text(s)
q=p/'classifier.js';s=q.read_text().replace("['fakultas',fakultas],",'');q.write_text(s)
q=p/'index.html';s=q.read_text().replace('V4.27','V4.28').replace('v=4.27','v=4.28')
s=s.replace('<span>Fakultas <i>*</i></span><input name="fakultas" placeholder="Ekonomi dan Bisnis Islam" required/>','<span>Fakultas (opsional)</span><input name="fakultas" placeholder="Kosongkan jika kampus tidak memiliki fakultas"/>')
s=s.replace('  <div class="micro-note"><b>Upload otomatis:', '  <div class="micro-note"><b>Fakultas tidak wajib:</b> Jika kampus tidak mempunyai fakultas (misalnya STAI), kosongkan kolom Fakultas. Program studi, nama kampus, dan tahun tetap dicetak rapi tanpa tulisan FAKULTAS kosong. <b>Upload otomatis:')
q.write_text(s)
q=p/'README.md';s=q.read_text().replace('V4.27','V4.28');s='''# ZAIN.NET COVER V4.28 — Fakultas Opsional\n\nKampus yang tidak memiliki fakultas (contoh Sekolah Tinggi Agama Islam) boleh membiarkan kolom Fakultas kosong.\nJika diisi, tata letak tetap seperti sebelumnya. Jika kosong, baris Fakultas tidak dicetak; prodi mengisi baris fakultas agar identitas bawah tidak berjarak kosong.\nMencakup Polos V1/V2, Merah, Maroon, Custom, UNIRA, Dummybook, dan Soft Cover IPS. Cover CD tetap tidak menggunakan kolom fakultas.\n\nCatatan: pendeteksian otomatis data dari foto/PDF/Word tetap perlu diverifikasi manual.\n\n'''+s;q.write_text(s)
(p/'PERUBAHAN_V4_28.txt').write_text('''ZAIN.NET COVER V4.28 — FAKULTAS OPSIONAL\n- Formulir: fakultas tidak wajib untuk semua jenis cover.\n- Validator PDF: tidak menolak fakultas kosong.\n- Klasifikasi OCR: ketiadaan fakultas bukan data hilang.\n- Generator: tidak pernah mencetak awalan FAKULTAS tanpa nama.\n- Identitas bawah: jika tanpa fakultas, baris prodi digeser turun satu baris agar tetap rapi.\n- Template lama dan jarak punggung tidak diubah.\n''')
