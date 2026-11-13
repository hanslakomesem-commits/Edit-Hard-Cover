#!/usr/bin/env python3
"""Patch the current public Edit-Hard-Cover site locally; never writes to GitHub.

Usage:
    python PASANG_COVER_ARTIKEL.py
    python PASANG_COVER_ARTIKEL.py --source /path/to/Edit-Hard-Cover-main

Outputs 3 complete replacement files in HASIL_UPLOAD_GITHUB/.
"""
import argparse
import pathlib
import urllib.request
import sys

REPO = 'https://raw.githubusercontent.com/hanslakomesem-commits/Edit-Hard-Cover/main/'
FILES = ('index.html','app.js','pdf-engine.js')

def replace_once(text, original, replacement, filename, label):
    count = text.count(original)
    if count != 1:
        raise ValueError(f'{filename}: pola {label} ditemukan {count} kali (seharusnya 1). '
                         'Versi GitHub kemungkinan telah berubah. Jangan lanjutkan update otomatis.')
    return text.replace(original, replacement, 1)

def patch_html(s):
    f='index.html'
    s=s.replace('V4.44','V4.45').replace('?v=4.44','?v=4.45')
    def c(a,b,l):
        nonlocal s
        s=replace_once(s,a,b,f,l)
    c('   <button class="cover-style" type="button" data-cover-style="covercd"><span class="swatch swatch-cd"></span><strong>Cover CD</strong><small>137 × 137 mm • tanpa punggung</small></button>',
      '   <button class="cover-style" type="button" data-cover-style="covercd"><span class="swatch swatch-cd"></span><strong>Cover CD</strong><small>137 × 137 mm • tanpa punggung</small></button>\n   <button class="cover-style" type="button" data-cover-style="coverartikel"><span class="swatch swatch-plain"></span><strong>Cover Artikel — Tanpa Punggung</strong><small>475 × 320 mm • putih, tanpa logo</small></button>', 'tombol pilihan')
    c('    <p class="template-msg hidden" id="cdCoverHint">Cover CD: <strong>nama, NIM, dan judul wajib</strong>. Prodi serta bulan/tahun bersifat opsional seperti pada Word contoh. Kolom fakultas, universitas, dan jenis dokumen tidak dicetak pada Cover CD. Tidak perlu memilih ketebalan.</p>',
      '    <p class="template-msg hidden" id="cdCoverHint">Cover CD: <strong>nama, NIM, dan judul wajib</strong>. Prodi serta bulan/tahun bersifat opsional seperti pada Word contoh. Kolom fakultas, universitas, dan jenis dokumen tidak dicetak pada Cover CD. Tidak perlu memilih ketebalan.</p>\n    <p class="template-msg hidden" id="articleCoverHint">Cover Artikel: kertas <strong>475 × 320 mm</strong>, sampul depan di kanan dan belakang putih kosong; <strong>tanpa punggung, tanpa logo, tanpa garis lipatan</strong>. Tulisan ARTIKEL otomatis. Judul, nama, NIM, prodi, fakultas, universitas dan bulan/tahun mengikuti PDF referensi.</p>', 'petunjuk artikel')
    c('<small>Warna/UIM/Custom Logo 475 × 320 · UNIRA 484 × 330', '<small>Warna/UIM/Custom Logo/Artikel 475 × 320 · UNIRA 484 × 330','format')
    c('Cover CD tanpa ketebalan; lainnya mengikuti punggung.', 'Cover CD dan Cover Artikel tanpa ketebalan; lainnya mengikuti punggung.','daftar pesanan')
    c('atau Cover CD</b>', 'Cover CD, atau Cover Artikel Tanpa Punggung</b>','bantuan batch')
    c('Cover CD: <strong>tanpa ketebalan</strong> (137 × 137 mm).','Cover CD: <strong>tanpa ketebalan</strong> (137 × 137 mm). Cover Artikel: <strong>tanpa ketebalan</strong> (475 × 320 mm).','ketebalan')
    c('<b>V4.45:</b> UIM dan pilihan warna/logo custom', '<b>V4.45:</b> Cover Artikel 475 × 320 mm ditambahkan: tanpa punggung, logo, dan penanda lipatan; posisi teks mengikuti PDF contoh pada sisi kanan, sisi kiri kosong. <b>V4.44:</b> UIM dan pilihan warna/logo custom','catatan versi')
    c('<p>Isi data, pilih ketebalan, lalu tekan “Buat & Lihat PDF”.</p>', '<p>Isi data, pilih ketebalan jika diperlukan, lalu tekan “Buat & Lihat PDF”.</p>', 'preview')
    return s

def patch_app(s):
    f='app.js'
    def c(a,b,l):
        nonlocal s
        s=replace_once(s,a,b,f,l)
    c("import {generatePDF,checkAssets,setUserFonts} from './pdf-engine.js?v=4.44';", "import {generatePDF,checkAssets,setUserFonts} from './pdf-engine.js?v=4.45';",'cache')
    c("'softips','covercd'];", "'softips','covercd','coverartikel'];",'cover types')
    c("const sizesForStyle=style=>style==='covercd'?[]", "const sizesForStyle=style=>['covercd','coverartikel'].includes(style)?[]",'size')
    c("const validThickness=o=>o?.style==='covercd'||", "const validThickness=o=>['covercd','coverartikel'].includes(o?.style)||",'cek ukuran')
    c("const isCoverCD=o=>o?.style==='covercd';\nconst coverDescriptor=o=>isCoverCD(o)?'COVER CD 137 × 137 mm':`${String(o.style).toUpperCase()} ${o.thickness} mm`;\nconst coverFileName=o=>`${String(orderNumber(o)).padStart(2,'0')}_${safeName(o.data.nama)}_${o.style.toUpperCase()}${isCoverCD(o)?'':`_${o.thickness}MM`}.pdf`;",
      "const isCoverCD=o=>o?.style==='covercd';\nconst isCoverArtikel=o=>o?.style==='coverartikel';\nconst isNoSpine=o=>isCoverCD(o)||isCoverArtikel(o);\nconst coverDescriptor=o=>isCoverCD(o)?'COVER CD 137 × 137 mm':isCoverArtikel(o)?'COVER ARTIKEL 475 × 320 mm (tanpa punggung)':`${String(o.style).toUpperCase()} ${o.thickness} mm`;\nconst coverFileName=o=>`${String(orderNumber(o)).padStart(2,'0')}_${safeName(o.data.nama)}_${o.style.toUpperCase()}${isNoSpine(o)?'':`_${o.thickness}MM`}.pdf`;", 'nama hasil')
    c("if(isCoverCD(o)){select.disabled=true;select.innerHTML='<option value=\"\">Tanpa punggung</option>';}", "if(isNoSpine(o)){select.disabled=true;select.innerHTML='<option value=\"\">Tanpa punggung</option>';}", 'dropdown ukuran')
    c("['covercd','Cover CD']])", "['covercd','Cover CD'],['coverartikel','Cover Artikel (Tanpa Punggung)']])",'dropdown style')
    c("if(isCoverCD(a)){const hint=document.createElement('p');hint.className='template-msg';hint.textContent='Cover CD: ukuran tetap 137 × 137 mm. Tidak memerlukan ketebalan/punggung. Nama dan NIM di atas, logo kiri–kanan, judul di bawah.';target.append(hint);}",
      "if(isNoSpine(a)){const hint=document.createElement('p');hint.className='template-msg';hint.textContent=isCoverCD(a)?'Cover CD: ukuran tetap 137 × 137 mm. Tidak memerlukan ketebalan/punggung. Nama dan NIM di atas, logo kiri–kanan, judul di bawah.':'Cover Artikel: ukuran tetap 475 × 320 mm. Tidak memakai punggung atau lipatan. Sampul depan di kanan, sisi kiri putih kosong.';target.append(hint);}", 'panel ketebalan')
    c("$('selectedSize').textContent=isCoverCD(a)?'COVER CD · 137 × 137 mm':a?.thickness", "$('selectedSize').textContent=isCoverCD(a)?'COVER CD · 137 × 137 mm':isCoverArtikel(a)?'COVER ARTIKEL · 475 × 320 mm':a?.thickness", 'label ukuran')
    c("const cdHint=$('cdCoverHint');if(cdHint)cdHint.classList.toggle('hidden',!optionalCD);",
      "const cdHint=$('cdCoverHint');if(cdHint)cdHint.classList.toggle('hidden',!optionalCD);\n const articleHint=$('articleCoverHint');if(articleHint)articleHint.classList.toggle('hidden',!isCoverArtikel(o));\n const documentTypeInput=document.querySelector('[name=\"jenis_dokumen\"]');if(documentTypeInput)documentTypeInput.readOnly=isCoverArtikel(o);", 'pesan artikel')
    c("const previous=o.style;o.style=style;", "const previous=o.style;o.style=style;\n if(style==='coverartikel'){\n  o.data.jenis_dokumen='ARTIKEL';\n  if(o.id===activeId)document.querySelector('[name=\"jenis_dokumen\"]').value='ARTIKEL';\n }", 'teks ARTIKEL')
    c("if(isCoverCD(o) && o.thickness!==null){o.thickness=null;reset=true;}\n if(!isCoverCD(o)&&o.thickness!==null&&!validThickness(o)){o.thickness=null;reset=true;}",
      "if(isNoSpine(o) && o.thickness!==null){o.thickness=null;reset=true;}\n if(!isNoSpine(o)&&o.thickness!==null&&!validThickness(o)){o.thickness=null;reset=true;}", 'reset ukuran')
    c("style==='covercd'?'137 × 137'", "style==='covercd'?'137 × 137':style==='coverartikel'?'475 × 320'", 'ukuran pada notifikasi')
    c("if(!validThickness(a))return notice('Pilih ketebalan punggung terlebih dahulu.','error');", "if(!validThickness(a))return notice('Pilih ketebalan punggung untuk jenis cover ini terlebih dahulu.','error');", 'validasi ekspor')
    c("$('spineFontResult').textContent=isCoverCD(a)?`Hasil Cover CD 137 × 137 mm • Judul ${result.details?.title_lines||'?'} baris • font ${result.details?.title_font_pt||'?'} pt • 2 logo`:",
      "$('spineFontResult').textContent=isCoverArtikel(a)?`Cover Artikel • 475 × 320 mm • tanpa punggung • judul ${result.details?.title_lines||'?'} baris • font ${result.details?.title_font_pt||'?'} pt`:isCoverCD(a)?`Hasil Cover CD 137 × 137 mm • Judul ${result.details?.title_lines||'?'} baris • font ${result.details?.title_font_pt||'?'} pt • 2 logo`:", 'hasil PDF')
    c("${isCoverCD(a)?'Periksa nama/NIM, dua logo, dan judul sebelum cetak.':`Judul punggung: ${result.details?.spine_lines||'?'} baris, font ${result.details?.spine_font_pt||'?'} pt. Periksa preview dan cetak uji.`}",
      "${isCoverArtikel(a)?'Tanpa punggung: periksa posisi judul, nama, NIM, dan identitas kampus sebelum cetak.':isCoverCD(a)?'Periksa nama/NIM, dua logo, dan judul sebelum cetak.':`Judul punggung: ${result.details?.spine_lines||'?'} baris, font ${result.details?.spine_font_pt||'?'} pt. Periksa preview dan cetak uji.`}", 'pesan sukses')
    return s

ARTICLE_RENDERER = r'''/** Cover Artikel 475 × 320 mm: editable front on right, blank left.
 * Reference baselines extracted from the user's sample PDF, no spine or guides.
 */
async function generateArticleCoverPDF(data){
 if(!data||typeof data!=='object')fail('Data Cover Artikel tidak valid.');
 for(const field of ['judul','nama','nim','prodi','universitas','bulan_tahun']){
  const v=String(data[field]??'');
  if(!v.trim())fail('Cover Artikel: kolom '+field+' wajib diisi.');
  if(v.length>2000||v.includes('\u00ad')||LATIN_CHECK.test(v))
   fail('Cover Artikel: koreksi kolom '+field+' (teks terlalu panjang atau karakter belum didukung).');
 }
 if(String(data.fakultas??'').length>2000)fail('Cover Artikel: kolom fakultas terlalu panjang.');
 const segments=normalizeTitleSegments(data).map(s=>({text:s.text.toLocaleUpperCase('id-ID'),italic:s.italic}));
 const warnings=[];
 const doc=await PDFDocument.create();
 const page=doc.addPage([mmPt(475),mmPt(320)]);
 const fonts=await getFonts(doc,warnings);
 const cx=1000.7;
 let title=null;
 for(let pt=12;pt>=9.5;pt-=.25){
  const rows=greedyLines(fonts,segments,pt,425);
  if(rows.length<=4){title={rows,pt};break;}
 }
 if(!title)fail('Judul Cover Artikel terlalu panjang untuk empat baris; periksa teks judul.');
 title.rows.forEach((line,i)=>renderLine(page,fonts,line,title.pt,cx,117.31+i*13.29,false,BLACK));
 if(title.pt<12)warnings.push('Cover Artikel: font judul disesuaikan menjadi '+title.pt+' pt.');
 single(page,fonts,'ARTIKEL',17.9,cx,244.17,420,'Label ARTIKEL',warnings,17.9);
 single(page,fonts,'Oleh:',12,cx,613.83,420,'Oleh',warnings);
 single(page,fonts,upper(data.nama),12,cx,627.12,425,'Nama Artikel',warnings,9,false,BLACK,nameUnderlineEnabled(data));
 single(page,fonts,'NIM: '+norm(data.nim),12,cx,640.41,425,'NIM Artikel',warnings,9);
 const prefixed=(prefix,value)=>{const clean=upper(value);return clean.startsWith(prefix+' ')?clean:prefix+' '+clean;};
 const footer=[prefixed('PROGRAM STUDI',data.prodi),...(norm(data.fakultas)?[prefixed('FAKULTAS',data.fakultas)]:[]),upper(canonicalUniversity(data.universitas)),upper(data.bulan_tahun)];
 const firstBaseline=801.24-(footer.length-1)*13.29;
 footer.forEach((line,i)=>single(page,fonts,line,12,cx,firstBaseline+i*13.29,425,'Identitas Artikel '+(i+1),warnings,9));
 const bytes=new Uint8Array(await doc.save({useObjectStreams:true}));
 const checked=await PDFDocument.load(bytes);
 if(checked.getPageCount()!==1||Math.abs(checked.getPage(0).getWidth()-mmPt(475))>.3||Math.abs(checked.getPage(0).getHeight()-mmPt(320))>.3)fail('PDF Cover Artikel gagal pemeriksaan ukuran kertas 475 × 320 mm.');
 return {bytes,warnings,details:{mode:'coverartikel',mm:null,paper_mm:COLOR_PRINT_MM,pages:1,has_spine:false,has_logo:false,title_lines:title.rows.length,title_font_pt:title.pt}};
}

'''

def patch_engine(s):
    f='pdf-engine.js'
    s=replace_once(s,"'softips','covercd'];","'softips','covercd','coverartikel'];",f,'types')
    s=replace_once(s,'softips:IPS_PRINT_MM,covercd:CD_PRINT_MM};','softips:IPS_PRINT_MM,covercd:CD_PRINT_MM,coverartikel:COLOR_PRINT_MM};',f,'paper size')
    s=replace_once(s,'/** Main public API, backward-compatible with V3.8 */',ARTICLE_RENDERER+'/** Main public API, backward-compatible with V3.8 */',f,'renderer')
    s=replace_once(s," if(c.type==='covercd')return generateCoverCDPDF(data);"," if(c.type==='coverartikel')return generateArticleCoverPDF(data);\n if(c.type==='covercd')return generateCoverCDPDF(data);",f,'routing')
    return s

PATCHERS = {'index.html':patch_html,'app.js':patch_app,'pdf-engine.js':patch_engine}

def main():
    parser=argparse.ArgumentParser(description='Siapkan update Cover Artikel V4.45 untuk Edit-Hard-Cover.')
    parser.add_argument('--source',help='Folder hasil ekstrak GitHub ZIP (opsional). Jika kosong, download 3 file publik dari GitHub.')
    parser.add_argument('--output',default='HASIL_UPLOAD_GITHUB',help='Folder hasil (default: HASIL_UPLOAD_GITHUB)')
    args=parser.parse_args()
    source=pathlib.Path(args.source).resolve() if args.source else None
    output=pathlib.Path(args.output).resolve()
    originals={}
    print('Menyiapkan update Cover Artikel, tanpa mengubah repository GitHub langsung...')
    for filename in FILES:
        if source:
            originals[filename]=(source/filename).read_text(encoding='utf-8')
        else:
            url=REPO+filename
            print('Mengambil',url)
            request=urllib.request.Request(url,headers={'User-Agent':'ZAINNET-cover-article-patch/1.0'})
            with urllib.request.urlopen(request,timeout=30) as response:
                originals[filename]=response.read().decode('utf-8')
    patched={name:PATCHERS[name](originals[name]) for name in FILES}
    output.mkdir(parents=True,exist_ok=True)
    for name,content in patched.items():
        (output/name).write_text(content,encoding='utf-8',newline='\n')
        print('Siap:',output/name)
    print('\nSELESAI. Upload 3 file dari folder tersebut ke root GitHub Edit-Hard-Cover branch main.')
    print('Gunakan menu Add file -> Upload files di GitHub, lalu Commit changes.')

if __name__=='__main__':
    try:
        main()
    except Exception as error:
        print('\nGAGAL:',error,file=sys.stderr)
        sys.exit(1)
