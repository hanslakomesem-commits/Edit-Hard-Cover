/**
 * ZAIN.NET PDF engine, static-browser GitHub Pages edition V4.23.
 * Each page begins with the already cleaned ORIGINAL PDF vector master.
 * No template lines, crop marks, or cover geometry are re-created here.
 * Important: Tinos is not the commercial Times New Roman face used in the
 * supplied PDF. Production printing still requires a proof and font review.
 */
import {colorGuideGeometry, SOURCE_SPINE, mmPoint} from './guide-geometry.js';
import {threeLineReferenceStatus, withinSpine} from './color-spine-profile.js';
import {getAutomaticUnicodeFonts,getAutomaticUnicodeRegular} from './font-unicode.js';
import {getDummyArialFontBytes} from './font-arial-compatible.js';
import {DUMMY_SIZES,DUMMY_PAGE,dummySpineGeometry,chooseDummyBackText} from './dummybook-layout.js';
import {IPS_SIZES,IPS_REFERENCE,ipsSpineGeometry} from './soft-ips-layout.js';
import {CD_PAGE_MM,CD_PAGE_PT,CD_LAYOUT,assertCDData,computeCDTitle} from './cover-cd-layout.js';
import {canonicalUniversity} from './classifier.js';
const {PDFDocument, StandardFonts, degrees, rgb}=globalThis.PDFLib||{};
const ALL=Array.from({length:19},(_,i)=>i+10);
let LAYOUT=null,MASTER=null,COLOR_MASTERS=null,COLOR_TRANSPARENT=null,UNIRA_MASTER=null,UNIRA_LOGO=null,DUMMY_MASTER=null,IPS_MASTER=null;
const pagePt={width:483*72/25.4,height:330*72/25.4};
const PLAIN_PRINT_MM={width:480,height:330};
const COLOR_PRINT_MM={width:475,height:320};
const UNIRA_PRINT_MM={width:484,height:330};
const DUMMY_PRINT_MM={width:420,height:297};
const IPS_PRINT_MM={width:330,height:210};
const CD_PRINT_MM={width:CD_PAGE_MM,height:CD_PAGE_MM};
const mmPt=(v)=>v*72/25.4;
const YELLOW=rgb?.(1,0.9487449527,0);
const BLACK=rgb?.(0,0,0);
let userFontBold=null,userFontItalic=null;
export function setUserFonts(bold,italic){userFontBold=bold||null;userFontItalic=italic||null;}
async function loadAsset(url,kind='bytes'){
 const controller=new AbortController();const id=setTimeout(()=>controller.abort(),25000);
 try{const r=await fetch(new URL(url,import.meta.url),{signal:controller.signal});if(!r.ok)throw Error(`HTTP ${r.status} ${url}`);return kind==='json'?await r.json():new Uint8Array(await r.arrayBuffer());}
 finally{clearTimeout(id);}
}
async function ensureAssets(){
 if(LAYOUT&&MASTER&&COLOR_MASTERS&&COLOR_TRANSPARENT&&UNIRA_MASTER&&UNIRA_LOGO)return;
 if(!PDFDocument)throw Error('Pustaka pdf-lib gagal dimuat. Cek internet untuk memuat pustaka statis CDN, kemudian refresh.');
 const [lo,ma,co,tr,unira,uniraLogo]=await Promise.all([
  loadAsset('./assets/layout.json','json'),loadAsset('./assets/masters.pdf'),loadAsset('./assets/warna_clean.pdf'),loadAsset('./assets/warna_transparent_marks_logo.pdf'),loadAsset('./assets/unira_clean.pdf'),loadAsset('./assets/unira_logo_custom.png?v=4.22')]);
 LAYOUT=lo.templates;MASTER=ma;COLOR_MASTERS=co;COLOR_TRANSPARENT=tr;UNIRA_MASTER=unira;UNIRA_LOGO=uniraLogo;
}
export async function checkAssets(){await ensureAssets();return {thicknesses:ALL};}
const NEAR=0.18;
const LATIN_CHECK=/[\u0600-\u06ff\u0750-\u077f]/u;

export class PDFPreflightError extends Error {constructor(msg){super(msg);this.status=422;this.name='PDFPreflightError';}}
export const thicknesses=ALL;
export const calibration=LAYOUT;
function fail(msg){throw new PDFPreflightError(msg);}
function norm(s){return String(s??'').replace(/\s+/gu,' ').trim();}
function upper(s){return norm(s).toLocaleUpperCase('id-ID');}
function normalizeTitleSegments(data){
 const title=String(data.judul??'');
 if(!title.trim())fail('Kolom judul kosong.');
 let segs=Array.isArray(data.title_segments)?data.title_segments:Array.isArray(data.titleSegments)?data.titleSegments:null;
 if(!segs?.length)segs=[{text:title,italic:false}];
 segs=segs.map(x=>({text:String(x.text??''),italic:!!x.italic}));
 if(segs.map(x=>x.text).join('')!==title)fail('Format italic dan isi judul belum sinkron. Periksa kembali editor judul.');
 return segs;
}
function validate(data,thickness){
 if(!data||typeof data!=='object')fail('Data cover tidak valid.');
 if(!ALL.includes(Number(thickness)))fail('Pilihan ketebalan tidak tersedia di master PDF.');
 for(const name of ['judul','nama','nim','prodi','fakultas','universitas','jenis_dokumen','bulan_tahun']){
  if(!String(data[name]??'').trim())fail(`Kolom ${name} belum diisi.`);
  if(String(data[name]).length>2000)fail(`Kolom ${name} terlalu panjang.`);
  if(String(data[name]).includes('\u00ad'))fail(`Kolom ${name} mengandung soft hyphen (U+00AD). Koreksi manual sebelum ekspor.`);
  if(LATIN_CHECK.test(String(data[name])))fail('Aksara Arab langsung belum didukung engine PDF Node ini. Transliterasi Arab-Latin dapat digunakan.');
 }
 return normalizeTitleSegments(data);
}

/** Embed Unicode fonts in every generated PDF; no silent character replacement. */
async function getFonts(pdf,warnings=[]){
 let boldBytes=userFontBold,italicBytes=userFontItalic;
 let source='font milik pengguna';
 if(!(boldBytes&&italicBytes)){
  const automatic=await getAutomaticUnicodeFonts(message=>{
   try{globalThis.dispatchEvent?.(new CustomEvent('zainnet-font-status',{detail:message}));}catch{}
  });
  boldBytes=automatic.bold;italicBytes=automatic.italic;
  source='Tinos Unicode otomatis';
 }
 const kit=globalThis.fontkit||globalThis.Fontkit;
 if(!kit)fail('Komponen fontkit gagal dimuat. Periksa jaringan CDN atau refresh website. Font Unicode tidak dapat digunakan tanpa komponen ini.');
 pdf.registerFontkit(kit);
 try{
  const [bold,italic]=await Promise.all([
   pdf.embedFont(boldBytes,{subset:true}),pdf.embedFont(italicBytes,{subset:true})
  ]);
  const boldSet=new Set(bold.getCharacterSet()), italicSet=new Set(italic.getCharacterSet());
  try{globalThis.dispatchEvent?.(new CustomEvent('zainnet-font-status',{detail:`Font Unicode aktif: ${source}. Siap membuat PDF.`}));}catch{}
  warnings.push(`Font PDF: ${source}. Pastikan tampilan sesuai contoh sebelum cetak.`);
  return {bold:[{font:bold,face:{hasGlyphForCodePoint:cp=>boldSet.has(cp)}}],
          italic:[{font:italic,face:{hasGlyphForCodePoint:cp=>italicSet.has(cp)}}]};
 }catch(err){fail('Font Unicode tidak berhasil ditanamkan ke PDF: '+String(err.message||err)+'. Gunakan TTF/OTF yang valid atau coba ulang saat jaringan stabil.');}
}
function chars(str){return Array.from(str);}
function selectGlyph(fonts,style,ch){
 const wanted=style?'italic':'bold';
 const cp=ch.codePointAt(0);
 // The bundled latin-ext fallback is only chosen when the primary lacks glyph.
 const chosen=fonts[wanted].find(e=>e.face.hasGlyphForCodePoint(cp));
 if(!chosen)fail(`Karakter ${ch} (U+${cp.toString(16).toUpperCase()}) belum didukung oleh font Unicode aktif. Pilih font TTF/OTF yang memiliki karakter ini, tanpa mengubah teks sumber.`);
 return chosen;
}
function runs(fonts,text,italic){
 const result=[];
 for(const ch of chars(text)){
  const ff=selectGlyph(fonts,italic,ch);
  if(result.length && result.at(-1).ff===ff)result.at(-1).text+=ch;
  else result.push({ff,text:ch,italic});
 }
 return result;
}
function pieces(fonts,segs){
 const result=[];
 for(const s of segs){
  for(const item of runs(fonts,String(s.text),!!s.italic)){
   if(result.length&&result.at(-1).ff===item.ff)result.at(-1).text+=item.text;
   else result.push(item);
  }
 }
 return result;
}
function measure(fonts,segs,size){return pieces(fonts,segs).reduce((a,x)=>a+x.ff.font.widthOfTextAtSize(x.text,size),0);}
function renderLine(page,fonts,segs,size,cx,baseline,vertical=false,ink=BLACK){
 const line=pieces(fonts,segs);
 const width=line.reduce((a,r)=>a+r.ff.font.widthOfTextAtSize(r.text,size),0);
 let position=baseline-width/2;
 if(!vertical){
  let x=cx-width/2;
  for(const part of line){page.drawText(part.text,{x,y:page.getHeight()-baseline,font:part.ff.font,size,color:ink});x+=part.ff.font.widthOfTextAtSize(part.text,size);}
 }else{
  for(const part of line){page.drawText(part.text,{x:cx,y:page.getHeight()-position,font:part.ff.font,size,rotate:degrees(270),color:ink});position+=part.ff.font.widthOfTextAtSize(part.text,size);}
 }
 return width;
}
function tokensFromSegments(segs){
 const t=[];for(const s of segs){for(const x of String(s.text).match(/\S+|\s+/gu)||[]){
   if(x.trim())t.push({text:x,italic:s.italic});else t.push({text:' ',italic:false});
 }}
 while(t[0]?.text===' ')t.shift();while(t.at(-1)?.text===' ')t.pop();
 return t;
}
function sliceTokens(tokens,a,b){
 const arr=tokens.slice(a,b);
 while(arr[0]?.text===' ')arr.shift();while(arr.at(-1)?.text===' ')arr.pop();
 return arr;
}
function greedyLines(fonts,segs,size,maxWidth){
 const tokens=tokensFromSegments(segs);let lines=[],current=[];
 const save=()=>{if(current.length){lines.push(sliceTokens(current,0,current.length));current=[];}};
 for(const t of tokens){
  if(!current.length&&t.text===' ')continue;
  if(current.length&&t.text!==' '&&measure(fonts,[...current,t],size)>maxWidth){save();}
  current.push(t);
  if(measure(fonts,current,size)>maxWidth+NEAR&&current.length===1)fail(`Kata ${t.text} tidak muat pada bagian depan.`);
 }
 save();return lines;
}
function frontTitle(fonts,segs,config,data,warnings){
 const sample=norm(config.sample_title);
 if(norm(data.judul).toLowerCase()===sample.toLowerCase() && !segs.some(s=>s.italic) && Array.isArray(config.sample_title_lines)){
  return {lines:config.sample_title_lines.map(text=>[{text,italic:false}]),size:12};
 }
 for(let sz=12;sz>=9.2-1e-5;sz=Math.round((sz-.2)*10)/10){
  const rows=greedyLines(fonts,segs,sz,375);
  if(rows.length<=7){if(sz<12)warnings.push(`Ukuran font judul depan turun ke ${sz.toFixed(1)} pt.`);return {lines:rows,size:sz};}
 }
 fail('Judul cover depan melebihi area yang tersedia pada template Serli; PDF tidak dibuat.');
}
export function spineRows(fonts,segs,size,maxLen,maxRows,minRows=1){
 const toks=tokensFromSegments(segs); if(!toks.length)fail('Judul punggung kosong.');
 const words=[];let acc=[];
 for(const t of toks){if(t.text===' '){if(acc.length){words.push(acc);acc=[];}} else acc.push(t);}
 if(acc.length)words.push(acc);
 const n=words.length;
 const combine=(start,end)=>{
  const parts=[];
  for(let i=start;i<end;i++){
   if(i>start)parts.push({text:' ',italic:false});
   parts.push(...words[i]);
  }
  return parts;
 };
 // Keep the most balanced valid line lengths, do not split words or diacritics.
 for(let lines=Math.min(minRows,n);lines<=Math.min(3,maxRows,n);lines++){
  let best=null;
  const check=(edges)=>{
   const result=[]; const lens=[];
   for(let i=0;i<edges.length-1;i++){
    const part=combine(edges[i],edges[i+1]);const len=measure(fonts,part,size);
    if(len>maxLen+NEAR)return;
    result.push(part);lens.push(len);
   }
   const max=Math.max(...lens),min=Math.min(...lens);
   const score=(max-min)**2 + 0.002*lens.reduce((a,v)=>a+v*v,0);
   if(!best||score<best.score)best={score,result};
  };
  if(lines===1)check([0,n]);
  if(lines===2){for(let a=1;a<n;a++)check([0,a,n]);}
  if(lines===3){for(let a=1;a<n-1;a++)for(let b=a+1;b<n;b++)check([0,a,b,n]);}
  if(best)return best.result;
 }
 fail(`Judul punggung tidak muat ${maxRows} baris dalam ${size} pt.`);
}
function spinePositions(size,mm,count,layout=LAYOUT?.[mm]){
 const c=layout,left=c.left,right=c.right;
 // Match the more stable colored-cover calibration a bit closer so the
 // plain spine rows stay visually centered between the two fold guides.
 const pitch=size*1.11;
 const span=(count-1)*pitch+(0.892-(-0.216))*size;
 if(span>right-left-.30+0.001)fail('Baris punggung akan melewati garis batas fisik.');
 const base=(left+right)/2-(0.892-.216)*size/2;
 return Array.from({length:count},(_,i)=>base+(count-1)*pitch/2-i*pitch);
}
/**
 * Visual-quality font selection. Never shrink a wide spine to 6 pt only
 * to preserve two lines when three lines of legible 9 pt would fit.
 *
 * 10–12 mm: prioritas 2 baris sampai 6 pt karena punggung sempit.
 * 13–22 mm: coba 2 baris 9 dan 8 pt, kemudian 3 baris 9 pt.
 * 23–28 mm: utamakan keterbacaan 9 pt: coba 2 baris 9 pt, lalu
 *           3 baris 9 pt SEBELUM mengecilkan ke 8/7/6 pt.
 *
 * Three lines are NEVER chosen if two lines fit at 9 pt. The trade-off
 * for other widths is explicit and tested.
 */
export function spineRowPreferences(base,minFont=6,thicknessMm=10){
 const sizes=[];
 for(let s=base;s>=minFont;s--)sizes.push(s);
 if(thicknessMm<=12){
  return [...sizes.map(size=>({rows:2,size})),...sizes.map(size=>({rows:3,size}))];
 }
 if(thicknessMm>=23){
  return sizes.flatMap(size=>[{rows:2,size},{rows:3,size}]);
 }
 // Moderate widths: retain 2 lines down to 8 pt, then prefer 9pt 3-lines
 // over reducing to 7 or 6pt just for the two-line target.
 const result=[];
 for(const size of sizes){
  if(size===base)result.push({rows:2,size});
  else if(size===base-1)result.push({rows:2,size});
 }
 result.push({rows:3,size:base});
 for(const size of sizes.filter(n=>n<=base-2)){
  result.push({rows:2,size});
  const previous=size+1;
  if(previous<base)result.push({rows:3,size:previous});
 }
 result.push({rows:3,size:minFont});
 // No repeated choices; maintain order.
 return result.filter((c,i,a)=>a.findIndex(x=>x.rows===c.rows&&x.size===c.size)===i);
}
/** The Serli references have a different calibrated center at several
 * thicknesses (e.g. 14-16 mm vs 17-18 mm). The values already exist in
 * assets/layout.json, extracted from the user's original reference pages.
 * NEVER add an arbitrary constant +6pt (the V4.15 regression).
 * Coordinate y is measured from the TOP of the 483x330mm source PDF.
 * The physical print master is rescaled to 480x330mm only after rendering.
 */
export const PLAIN_SPINE_TITLE_SAFE_TOP_PT=76;
export const PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT=513;
export const PLAIN_SPINE_TITLE_MARGIN_PT=1.0;
export function plainSpineTitleGeometry(lengthsPt,layout){
 if(!layout||!Number.isFinite(layout.spine_title_center_y)||
     !Number.isFinite(layout.left)||!Number.isFinite(layout.right)||layout.right<=layout.left){
   throw new PDFPreflightError('Kalibrasi posisi punggung polos tidak valid.');
 }
 if(!Array.isArray(lengthsPt)||lengthsPt.length<1||lengthsPt.length>3||
     lengthsPt.some(len=>!Number.isFinite(len)||len<=0)){
   throw new PDFPreflightError('Panjang baris punggung polos tidak valid.');
 }
 const centerTopPt=layout.spine_title_center_y;
 const topPt=lengthsPt.map(len=>centerTopPt-len/2);
 const bottomPt=lengthsPt.map(len=>centerTopPt+len/2);
 const safe=topPt.every(v=>v>=PLAIN_SPINE_TITLE_SAFE_TOP_PT+PLAIN_SPINE_TITLE_MARGIN_PT)&&
   bottomPt.every(v=>v<=PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT-PLAIN_SPINE_TITLE_MARGIN_PT);
 return {centerTopPt,topPt,bottomPt,safe,
   topLimitPt:PLAIN_SPINE_TITLE_SAFE_TOP_PT,
   bottomLimitPt:PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT};
}
export function chooseSpine(fonts,segs,mm,warnings,layout=LAYOUT?.[mm]){
 if(!layout)fail(`Data kalibrasi punggung ${mm} mm belum tersedia.`);
 const base=mm===10?8:9;
 const cy=layout.spine_title_center_y;
 if(!Number.isFinite(cy))fail(`Posisi punggung polos ${mm} mm tidak ditemukan.`);
 const maxLen=2*Math.min(cy-PLAIN_SPINE_TITLE_SAFE_TOP_PT,
                              PLAIN_SPINE_TITLE_SAFE_BOTTOM_PT-cy)-2*PLAIN_SPINE_TITLE_MARGIN_PT;
 for(const {rows,size} of spineRowPreferences(base,6,mm)){
  try{
   const result=spineRows(fonts,segs,size,maxLen,rows,rows);
   const xs=spinePositions(size,mm,result.length,layout);
   const geometry=plainSpineTitleGeometry(result.map(line=>measure(fonts,line,size)),layout);
   if(!geometry.safe)continue;
   if(result.length===3)warnings.push(`Judul punggung POLOS ${mm} mm memakai 3 baris pada ${size} pt agar tetap terbaca jelas.`);
   if(size<base)warnings.push(`Font judul punggung POLOS turun dari ${base} ke ${size} pt karena tidak muat pada ukuran lebih besar.`);
   return {result,xs,size,cy:geometry.centerTopPt,titleBoundsPt:{top:Math.min(...geometry.topPt),bottom:Math.max(...geometry.bottomPt)}};
  }catch(e){if(!(e instanceof PDFPreflightError))throw e;}
 }
 fail(`Judul tidak muat dalam zona aman punggung POLOS ${mm} mm (minimal 6 pt, maksimal 3 baris). Periksa judul sebelum dicetak.`);
}
function single(page,fonts,text,size,cx,y,maxWidth,label,warnings,minFont=size,rotated=false,ink=BLACK){
 text=String(text).trim();
 let final=size;const natural=measure(fonts,[{text,italic:false}],size);
 if(natural>maxWidth){final=Math.floor((size*maxWidth/natural*.994)*100)/100;
   if(final<minFont)fail(`${label} terlalu panjang untuk area yang tersedia. Diperlukan ${final} pt; batas aman ${minFont} pt.`);
   warnings.push(`${label} disesuaikan dari ${size} menjadi ${final} pt.`);
 }
 renderLine(page,fonts,[{text,italic:false}],final,cx,y,rotated,ink);
}

async function generatePlainPDF(data,mm){
 mm=Number(mm);const segs=validate(data,mm);const conf=LAYOUT[mm],warnings=[];
 const doc=await PDFDocument.create();const src=await PDFDocument.load(MASTER);
 if(src.getPageCount()!==ALL.length)fail('Jumlah master PDF tidak sama dengan konfigurasi 19 ukuran.');
 const [page]=await doc.copyPages(src,[conf.page]);doc.addPage(page);
 if(Math.abs(page.getWidth()-pagePt.width)>.55||Math.abs(page.getHeight()-pagePt.height)>.55)fail('Ukuran master bukan 483 × 330 mm.');
 const fonts=await getFonts(doc,warnings);
 for(const c of [...String(data.judul),...segs.map(s=>s.text)].join(''))if(LATIN_CHECK.test(c))fail('Aksara Arab belum mendukung shaping RTL.');
 const front=frontTitle(fonts,segs,conf,data,warnings);
 for(let i=0;i<front.lines.length;i++)renderLine(page,fonts,front.lines[i],front.size,conf.front_cx,conf.front_title_y+i*conf.front_title_pitch);
 single(page,fonts,upper(data.jenis_dokumen),17.8998,conf.front_type_cx,conf.front_type_y,240,'Jenis dokumen',warnings,13);
 single(page,fonts,'Oleh:',12,conf.front_cx,conf.front_label_y,180,'Label Oleh',warnings,12);
 single(page,fonts,upper(data.nama),12,conf.front_cx,conf.front_name_y,400,'Nama depan',warnings,9);
 single(page,fonts,`${conf.front_nim_prefix} ${norm(data.nim)}`,12,conf.front_cx,conf.front_nim_y,390,'NIM',warnings,9);
 single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,12,conf.front_cx,conf.front_prodi_y,395,'Prodi',warnings,9);
 single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,conf.front_cx,conf.front_fakultas_y,395,'Fakultas',warnings,9);
 single(page,fonts,upper(canonicalUniversity(data.universitas)),12,conf.front_cx,conf.front_universitas_y,395,'Universitas',warnings,9);
 single(page,fonts,upper(data.bulan_tahun),12,conf.front_cx,conf.front_year_y,395,'Tanggal',warnings,9.5);
 const spine=chooseSpine(fonts,segs,mm,warnings);
 for(let i=0;i<spine.result.length;i++)renderLine(page,fonts,spine.result[i],spine.size,spine.xs[i],spine.cy??conf.spine_title_center_y,true);
 single(page,fonts,upper(data.jenis_dokumen),conf.spine_type_pt,conf.spine_type_x,conf.spine_type_y,135,'Jenis dokumen punggung',warnings,6,true);
 single(page,fonts,upper(data.nama),conf.spine_name_pt,conf.spine_name_x,conf.spine_name_y,175,'Nama punggung',warnings,6,true);
 single(page,fonts,upper(data.bulan_tahun),conf.spine_year_pt,conf.spine_year_x,conf.spine_year_y,115,'Tanggal punggung',warnings,6,true);
 const bytes=await doc.save({useObjectStreams:true});
 // This is a structural preflight, NOT a substitute for a pixel-perfect print proof.
 const reopened=await PDFDocument.load(bytes);
 if(reopened.getPageCount()!==1)fail('PDF hasil harus terdiri dari tepat satu halaman.');
 const p=reopened.getPage(0);
 if(Math.abs(p.getWidth()-pagePt.width)>.55||Math.abs(p.getHeight()-pagePt.height)>.55)fail('PDF hasil tidak berukuran 483 × 330 mm.');
 return {bytes:new Uint8Array(bytes),warnings,details:{mm,spine_font_pt:spine.size,spine_lines:spine.result.length,spine_title_center_y:spine.cy??conf.spine_title_center_y,spine_title_bounds_pt:spine.titleBoundsPt}};
}


/** Printed plain sizes are 480×330 mm per latest requirement. The source
 * Serli master is 483×330 mm; we only apply a 0.62% horizontal reduction to
 * preserve ALL of the original lines and crop marks within 480 mm.
 * This is disclosed in the README; a 480 mm native master is preferable
 * if a pixel-identical proof is required. */
async function resizePlainToPrint(bytes) {
 const d=await PDFDocument.create();
 const [ep]=await d.embedPdf(bytes);
 const page=d.addPage([mmPt(PLAIN_PRINT_MM.width),mmPt(PLAIN_PRINT_MM.height)]);
 page.drawPage(ep,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
 return new Uint8Array(await d.save({useObjectStreams:true}));
}

const COLOR_TYPES=['merah','maroon','custom'];
export const coverTypes=['polos',...COLOR_TYPES,'unira','dummybook','softips','covercd'];
export const printSizes={polos:PLAIN_PRINT_MM,merah:COLOR_PRINT_MM,maroon:COLOR_PRINT_MM,custom:COLOR_PRINT_MM,unira:UNIRA_PRINT_MM,dummybook:DUMMY_PRINT_MM,softips:IPS_PRINT_MM,covercd:CD_PRINT_MM};
export function validateCoverMode(mode,customColor) {
 const type=String(mode||'polos').toLowerCase();
 if(!coverTypes.includes(type))fail('Pilihan jenis cover tidak dikenal.');
 if(type!=='custom')return {type,color:null};
 const hex=String(customColor||'').trim();
 if(!/^#[0-9A-Fa-f]{6}$/.test(hex))fail('Pilih kode warna custom dalam format #RRGGBB.');
 return {type,color:hex.toUpperCase()};
}
function hexRgb(value) {
 const h=value.replace('#','');
 return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);
}
function splitFrontTitle(fonts,segs,maxWidth=405,maxRows=5){
 for(let pt=12;pt>=9.8-1e-6;pt=Math.round((pt-.2)*10)/10){
  const lines=greedyLines(fonts,segs,pt,maxWidth);
  if(lines.length<=maxRows)return {lines,size:pt};
 }
 fail('Judul cover depan warna terlalu panjang untuk maksimal lima baris di posisi asli. Periksa dan ringkas hanya bila sesuai naskah.');
}
/** Color 3-line title anchor calibrated from all 19 reference PDF pages.
 * PDF coordinates here are POINTS measured from the TOP of the page.
 * The other engine uses bottom-origin coordinates, so only renderLine()
 * converts a top-origin center to a PDF page drawing coordinate.
 */
export const COLOR_SPINE_TITLE_CENTER_TOP_PT=295.0;
export const COLOR_SPINE_TITLE_SAFE_TOP_PT=30*72/25.4;
export const COLOR_SPINE_TITLE_SAFE_BOTTOM_PT=181*72/25.4;
/**
 * Return true visual bounds for rotated title lines; useful both during
 * production and for tests. Each line has its own actual font advance width.
 * The engine draws each line centered on centerTopPt, not shifted by half its
 * advance twice. This fixes the title entering the top crop-mark region.
 */
export function calibrateColorSpineTitleRows(lengthsPt,centerTopPt=COLOR_SPINE_TITLE_CENTER_TOP_PT){
 if(!Array.isArray(lengthsPt)||!lengthsPt.length||lengthsPt.length>3||
     lengthsPt.some(w=>!Number.isFinite(w)||w<=0)||!Number.isFinite(centerTopPt)){
   throw new Error('Geometri judul punggung tidak valid.');
 }
 const topPt=lengthsPt.map(width=>centerTopPt-width/2);
 const bottomPt=lengthsPt.map(width=>centerTopPt+width/2);
 const safe=topPt.every(v=>v>=COLOR_SPINE_TITLE_SAFE_TOP_PT)&&
            bottomPt.every(v=>v<=COLOR_SPINE_TITLE_SAFE_BOTTOM_PT);
 return {centerTopPt:lengthsPt.map(()=>centerTopPt),topPt,bottomPt,safe,
   topLimitPt:COLOR_SPINE_TITLE_SAFE_TOP_PT,
   bottomLimitPt:COLOR_SPINE_TITLE_SAFE_BOTTOM_PT};
}

/**
 * V4.14: a SEPARATE font preference policy for colored covers.
 * The front cover and the plain-cover path do not use this function.
 *
 * 10–12mm: attempt 2 lines with shrinking fonts, then 3 lines as a fallback.
 * 13–28mm: attempt 2 lines at 9pt, and if they cannot fit, attempt
 * 3 lines at 9pt BEFORE reducing font size. Use 8/7/6pt only if both
 * 9pt layouts fail their actual physical and vertical-space checks.
 */
export function colorSpinePreferences(thicknessMm,base=thicknessMm===10?8:9,minFont=6){
 const sizes=Array.from({length:base-minFont+1},(_,i)=>base-i);
 if(thicknessMm<=12)return [
  ...sizes.map(size=>({rows:2,size})),
  ...sizes.map(size=>({rows:3,size}))
 ];
 return sizes.flatMap(size=>[{rows:2,size},{rows:3,size}]);
}
/**
 * Calculate the usable LENGTH of a colored spine-title row from the real
 * printable title zone. An old hard-coded 320pt limit caused needless
 * down-sizing to 7pt/6pt even when the title was safely inside the zone.
 * The top and bottom safety checks remain authoritative for every line.
 */
export function colorTitleMaxLengthPt(safety=2){
 const center=COLOR_SPINE_TITLE_CENTER_TOP_PT;
 return 2*Math.min(center-COLOR_SPINE_TITLE_SAFE_TOP_PT,
                   COLOR_SPINE_TITLE_SAFE_BOTTOM_PT-center)-safety;
}
/** Color title layout: front design is NEVER modified here.
 * Punggung stays centered between its two INNER yellow fold guides.
 * Printed title center = 295pt from the top of the 475×320mm master.
 */
export function colorSpine(fonts,segs,mm,warnings){
 const {right,left,center:middle}=colorGuideGeometry(mm);
 const base=mm===10?8:9;
 const maxLineLength=colorTitleMaxLengthPt();
 const centerTop=COLOR_SPINE_TITLE_CENTER_TOP_PT;
 let lastError='';
 for(const choice of colorSpinePreferences(mm,base,6)){
  try{
   const lines=spineRows(fonts,segs,choice.size,maxLineLength,choice.rows,choice.rows);
   if(!withinSpine(choice.size,lines.length,right-left,1.1))continue;
   const pitch=choice.size*1.11;
   const x=lines.map((_,i)=>middle+(lines.length-1)*pitch/2-i*pitch);
   const geometry=calibrateColorSpineTitleRows(
      lines.map(line=>measure(fonts,line,choice.size)),centerTop);
   if(!geometry.safe)continue;
   if(lines.length===3)warnings.push(`Judul punggung WARNA ${mm} mm memakai 3 baris pada ${choice.size} pt; 2 baris pada ukuran tersebut tidak cukup.`);
   if(choice.size<base)warnings.push(`Judul punggung WARNA turun dari ${base} pt ke ${choice.size} pt karena tidak muat pada font yang lebih besar.`);
   return {lines,x,fromTop:geometry.centerTopPt,size:choice.size,middle,
     edges:[left,right],count:lines.length,
     titleBoundsPt:{top:Math.min(...geometry.topPt),bottom:Math.max(...geometry.bottomPt)},
     titleCenterTopPt:centerTop,
     maxLineLengthPt:maxLineLength};
  }catch(error){if(!(error instanceof PDFPreflightError))throw error;lastError=error.message;}
 }
 fail(`Judul punggung warna ${mm} mm tidak muat 2–3 baris pada 9/8/7/6 pt dalam batas garis kuning dan zona cetak. ${lastError} File tidak dibuat.`);
}
/** Original yellow crop ticks are replaced after covering only the top/bottom
 * strips of the CLEAN original master. Every LEFT tick, including the far
 * back-cover trim/hinge, shifts by the exact difference in thickness.
 * All right/front-side ticks stay fixed. Logo and full color-front layout stay.
 */
export function drawPrecisionColorGuides(page,mm,background){
 const geom=colorGuideGeometry(mm);
 const w=page.getWidth(),h=page.getHeight(), yellow=YELLOW;
 // Cover the existing reference ticks; never obscure text, logo, or cover data.
 page.drawRectangle({x:0,y:h-36,width:w,height:36,color:background});
 page.drawRectangle({x:0,y:0,width:w,height:36,color:background});
 const line=(x,top)=>page.drawLine({start:{x,y:top?h:0},end:{x,y:top?h-32.2:32.2},thickness:.5,color:yellow});
 for(const x of [...geom.guidesLeft,...geom.guidesRight]){
  if(x>=0 && x<=w){line(x,true);line(x,false);}
 }
 const leftCorner=geom.guidesLeft[0],rightCorner=geom.guidesRight.at(-1);
 for(const y of [h-32.2,32.2]){
  page.drawLine({start:{x:Math.max(0,leftCorner-45),y},end:{x:Math.max(0,leftCorner),y},thickness:.5,color:yellow});
  page.drawLine({start:{x:rightCorner,y},end:{x:w,y},thickness:.5,color:yellow});
 }
 return geom;
}
async function generateColorPDF(data,mm,mode,customColor){
 mm=Number(mm);
 const segs=validate(data,mm),warnings=[];
 const {type,color}=validateCoverMode(mode,customColor);
 if(type==='polos')fail('Kesalahan mode cover warna.');
 const doc=await PDFDocument.create();
 const src=await PDFDocument.load(type==='custom'?COLOR_TRANSPARENT:COLOR_MASTERS);
 const sourceIndex=type==='maroon'?1:0;
 if(type==='custom'){
  const pg=doc.addPage([mmPt(475),mmPt(320)]);
  pg.drawRectangle({x:0,y:0,width:pg.getWidth(),height:pg.getHeight(),color:hexRgb(color)});
  const [stamp]=await doc.embedPdf(COLOR_TRANSPARENT,[0]);
  pg.drawPage(stamp,{x:0,y:0,width:pg.getWidth(),height:pg.getHeight()});
 } else {
  const [page]=await doc.copyPages(src,[sourceIndex]);doc.addPage(page);
 }
 const page=doc.getPage(0);
 const background=type==='merah'?rgb(1,0,0):type==='maroon'?rgb(139/255,0,0):hexRgb(color);
 // A shifted yellow crop mark falling OUTSIDE the 475mm page is a
 // production safety failure, not a cosmetic warning. 28mm on the supplied
 // color master has this problem; never export a PDF with a missing trim mark.
 const anticipatedMarks=colorGuideGeometry(mm);
 const refStatus=threeLineReferenceStatus(mm);
 if(refStatus.warning)warnings.push(refStatus.warning);
 // Physical page clipping: the left horizontal corner segment can run past
 // x=0 even before the vertical guide does. Never conceal this adjustment.
 const leftCornerStart=anticipatedMarks.guidesLeft[0]-45;
 if(leftCornerStart<0){
  warnings.push(`Tanda sudut potong belakang dipendekkan ${(-leftCornerStart/mmPt(1)).toFixed(2)} mm agar tidak keluar kertas 475 mm. Jika tanda sudut harus panjang penuh, perlu revisi master cetak.`);
 }
 // Full 3-row reference is incomplete/unsafe; generate only from calibrated
 // original yellow guidelines and reject any truly missing vertical tick.
 if(anticipatedMarks.leftmostMarkClipped){
   fail(`Mode warna ${mm} mm: garis potong kiri terluar keluar dari kertas 475 mm sebanyak ${(-anticipatedMarks.guidesLeft[0]/mmPt(1)).toFixed(2)} mm. PDF diblokir. Perlu master belakang yang diperbaiki atau penyesuaian trim yang disetujui operator.`);
 }
 if(anticipatedMarks.guidesLeft[0]<mmPt(1.1))
   warnings.push(`Tanda potong belakang kiri hanya ${(anticipatedMarks.guidesLeft[0]/mmPt(1)).toFixed(2)} mm dari tepi kertas; periksa sebelum cetak.`);
 const marks=drawPrecisionColorGuides(page,mm,background);
 if(Math.abs(page.getWidth()-mmPt(475))>.3||Math.abs(page.getHeight()-mmPt(320))>.3)fail('Template warna bukan 475 × 320 mm.');
 const fonts=await getFonts(doc,warnings);
 const front=splitFrontTitle(fonts,segs);
 // Cover front layout follows *color reference*, NOT Serli/plain layout.
 for(let i=0;i<front.lines.length;i++)renderLine(page,fonts,front.lines[i],front.size,1000.7,120.2+i*13.29,false,YELLOW);
 single(page,fonts,upper(data.jenis_dokumen),17.9,1000.7,248.4,230,'Jenis dokumen warna',warnings,14,false,YELLOW);
 single(page,fonts,'Oleh',12,1000.7,614.8,165,'Label Oleh',warnings,12,false,YELLOW);
 single(page,fonts,norm(data.nama),12,1000.7,628.1,330,'Nama warna',warnings,8,false,YELLOW);
 single(page,fonts,`NIM. ${norm(data.nim)}`,12,1000.7,641.4,330,'NIM warna',warnings,9,false,YELLOW);
 single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,12,1000.7,767.1,395,'Prodi warna',warnings,9,false,YELLOW);
 single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,1000.7,780.4,395,'Fakultas warna',warnings,9,false,YELLOW);
 single(page,fonts,upper(canonicalUniversity(data.universitas)),12,1000.7,793.7,395,'Universitas warna',warnings,9,false,YELLOW);
 // Original colored samples print the YEAR only, not the month name.
 const yearMatch=norm(data.bulan_tahun).match(/\b\d{4}\b/u);
 const year=yearMatch?yearMatch[0]:norm(data.bulan_tahun);
 single(page,fonts,year,12,1000.7,807,250,'Tahun warna',warnings,9,false,YELLOW);
 const spine=colorSpine(fonts,segs,mm,warnings);
 for(let i=0;i<spine.lines.length;i++)renderLine(page,fonts,spine.lines[i],spine.size,spine.x[i],spine.fromTop[i],true,YELLOW);
 // Two vertical lanes for document type and name, and a separate year below.
 // These are calculated from the ACTUAL available width for each order.
 const pitch=mm>=13?8.9:6.2;
 const spineTypeSize=Math.max(6,Math.min(9,mm-2));
 single(page,fonts,upper(data.jenis_dokumen),spineTypeSize,spine.middle+pitch/2,661,100,'Jenis dokumen punggung warna',warnings,6,true,YELLOW);
 single(page,fonts,upper(data.nama),spineTypeSize,spine.middle-pitch/2,661,175,'Nama punggung warna',warnings,6,true,YELLOW);
 single(page,fonts,year,Math.min(8,spineTypeSize),spine.middle,798,75,'Tahun punggung warna',warnings,6,true,YELLOW);
 const out=new Uint8Array(await doc.save({useObjectStreams:true}));
 const reread=await PDFDocument.load(out);
 if(reread.getPageCount()!==1||Math.abs(reread.getPage(0).getWidth()-mmPt(475))>.3||Math.abs(reread.getPage(0).getHeight()-mmPt(320))>.3)fail('PDF warna gagal validasi ukuran 475 × 320 mm.');
 return {bytes:out,warnings,details:{mode:type,mm,spine_font_pt:spine.size,spine_lines:spine.lines.length,reference_3row_page:refStatus.referencePage,reference_3row_verified:refStatus.referenceAvailable,
    title_anchor_pt:spine.titleCenterTopPt,title_bounds_pt:spine.titleBoundsPt,
    guide_left:marks.left,guide_right:marks.right,paper_mm:COLOR_PRINT_MM,logo:'logo asli dari PDF warna'}};
}

/** UNIRA/Universitas Madura cover, measured from the uploaded 484x330mm reference.\n * Coordinates are in PDF points, origin at the upper-left for all text.\n * The supplied sample is a 10mm spine; all LEFT crop guides move by the\n * width delta while the RIGHT front cover and its title remain unchanged.\n * At 28mm, the leftmost horizontal corner is shortened if it crosses x=0.\n */
/** Original UNIRA PDF image rect: x685.215–697.172, y772.634–784.927 (top origin).
 * Original year text box: y787.9–796.4. User requested both slightly LOWER
 * than the prior generated output, so use a small explicit +3pt correction;
 * front cover text and all fold marks remain unchanged.
 */
export const UNIRA_SPINE_MEDIA=Object.freeze({logoTop:772.6344,logoWidth:11.9572,logoHeight:12.2925,yearBaseline:796.4,dropPt:3.0});
export const UNIRA_REFERENCE=Object.freeze({
 pageWidthPt:mmPt(484),pageHeightPt:mmPt(330),baseMm:10,
 leftGuides:[62.65,367.96,649.41,677.37],
 rightGuides:[705.62,733.64,999.18,1321.41],
 frontCenterX:1013.63,
 spineTitleCenterTopPt:374.0,
 spineSafeTopPt:187.0,
 spineSafeBottomPt:531.0
});
export function uniraSpineGeometry(mm){
 mm=Number(mm);
 if(!ALL.includes(mm))throw new PDFPreflightError('UNIRA: ketebalan hanya 10–28 mm.');
 const u=UNIRA_REFERENCE,delta=mmPt(mm-u.baseMm);
 const leftGuides=u.leftGuides.map(v=>v-delta),rightGuides=[...u.rightGuides];
 const left=leftGuides.at(-1),right=rightGuides[0],center=(left+right)/2;
 const observedMm=(right-left)/mmPt(1);
 if(Math.abs(observedMm-mm)>.7)throw new PDFPreflightError('Geometri punggung UNIRA tidak sesuai ketebalan pesanan.');
 if(leftGuides[0]<0||rightGuides.at(-1)>u.pageWidthPt)
  throw new PDFPreflightError('Penanda potong UNIRA keluar batas halaman.');
 return {mm,delta,leftGuides,rightGuides,left,right,center,observedMm};
}
function drawUniraCropGuides(page,mm,warnings){
 const g=uniraSpineGeometry(mm),h=page.getHeight(),w=page.getWidth();
 // Cover only the original trim strips; preserve the small UNIRA emblem.
 page.drawRectangle({x:0,y:h-53,width:w,height:53,color:rgb(1,1,1)});
 page.drawRectangle({x:0,y:0,width:w,height:53,color:rgb(1,1,1)});
 const line=(x,top)=>page.drawLine({start:{x,y:top?h-47:0},end:{x,y:top?h-14.6:32.4},thickness:.7,color:BLACK});
 for(const x of [...g.leftGuides,...g.rightGuides]){line(x,true);line(x,false);}
 // Original 10mm UNIRA PDF includes L-shaped corner ticks.
 for(const top of [true,false]){
  const y=top?h-47:47;
  const first=g.leftGuides[0],last=g.rightGuides.at(-1);
  const start=Math.max(0,first-44.1),end=Math.min(w,last+37.7);
  page.drawLine({start:{x:start,y},end:{x:first,y},thickness:.7,color:BLACK});
  page.drawLine({start:{x:last,y},end:{x:end,y},thickness:.7,color:BLACK});
 }
 if(g.leftGuides[0]-44.1<0)warnings.push('UNIRA: garis sudut kiri diperpendek agar tidak melewati halaman pada '+mm+' mm. Periksa proof sebelum cetak.');
 return g;
}
export function chooseUniraSpine(fonts,segs,mm,warnings){
 const geom=uniraSpineGeometry(mm),u=UNIRA_REFERENCE;
 const base=mm<=12?8:9;
 const maxLen=2*Math.min(u.spineTitleCenterTopPt-u.spineSafeTopPt,u.spineSafeBottomPt-u.spineTitleCenterTopPt)-4;
 for(const {rows,size} of colorSpinePreferences(mm,base,6)){
  try{
   const lines=spineRows(fonts,segs,size,maxLen,rows,rows);
   if(!withinSpine(size,lines.length,geom.right-geom.left,1.2))continue;
   const pitch=size*1.11;
   const xs=lines.map((_,i)=>geom.center+(lines.length-1)*pitch/2-i*pitch);
   const lens=lines.map(line=>measure(fonts,line,size));
   if(lens.some(len=>u.spineTitleCenterTopPt-len/2<u.spineSafeTopPt+1||u.spineTitleCenterTopPt+len/2>u.spineSafeBottomPt-1))continue;
   if(lines.length===3)warnings.push(`UNIRA ${mm} mm: judul memakai 3 baris ${size} pt karena tidak muat 2 baris pada font prioritas.`);
   if(size<base)warnings.push(`UNIRA ${mm} mm: font judul berkurang menjadi ${size} pt agar tetap di zona aman.`);
   return {lines,xs,size,centerTop:u.spineTitleCenterTopPt,geometry:geom};
  }catch(err){if(!(err instanceof PDFPreflightError))throw err;}
 }
 fail(`UNIRA ${mm} mm: judul tidak muat dalam batas punggung dan zona aman meski memakai 3 baris 6 pt.`);
}
async function generateUniraPDF(data,mm){
 mm=Number(mm);const segs=validate(data,mm),warnings=[];
 const doc=await PDFDocument.create();const src=await PDFDocument.load(UNIRA_MASTER);
 if(src.getPageCount()!==1)fail('Master UNIRA tidak berisi tepat satu halaman.');
 const [page]=await doc.copyPages(src,[0]);doc.addPage(page);
 const u=UNIRA_REFERENCE;
 if(Math.abs(page.getWidth()-u.pageWidthPt)>.35||Math.abs(page.getHeight()-u.pageHeightPt)>.35)fail('Ukuran master UNIRA bukan 484×330 mm.');
 const g=drawUniraCropGuides(page,mm,warnings);
 const fonts=await getFonts(doc,warnings);
 // Front coordinates calibrated from CONTOH COVER UNIRA.pdf; never move front.
 const cx=u.frontCenterX;
 let front=null;
 for(let sz=12;sz>=9.8-1e-6;sz=Math.round((sz-.2)*10)/10){
  const lines=greedyLines(fonts,segs,sz,375);
  if(lines.length<=5){front={lines,size:sz};break;}
 }
 if(!front)fail('Judul depan UNIRA terlalu panjang untuk zona judul. Periksa judul.');
 for(let i=0;i<front.lines.length;i++)renderLine(page,fonts,front.lines[i],front.size,cx,134.4+13.29*i,false,BLACK);
 single(page,fonts,upper(data.jenis_dokumen),15.9,cx,265,240,'Jenis dokumen UNIRA',warnings,11,false,BLACK);
 single(page,fonts,'Oleh :',12,cx,570,170,'Label Oleh UNIRA',warnings,12,false,BLACK);
 single(page,fonts,upper(data.nama),12,cx,583.3,330,'Nama UNIRA',warnings,8,false,BLACK);
 single(page,fonts,`NPM. ${norm(data.nim)}`,12,cx,596.6,330,'NPM UNIRA',warnings,8,false,BLACK);
 single(page,fonts,`PRODI ${upper(data.prodi)}`,12,cx,781.3,390,'Prodi UNIRA',warnings,9,false,BLACK);
 single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,12,cx,794.6,390,'Fakultas UNIRA',warnings,9,false,BLACK);
 const institution=upper(canonicalUniversity(data.universitas));
 if(institution!=='UNIVERSITAS MADURA')warnings.push('Mode UNIRA dipilih tetapi nama universitas bukan UNIVERSITAS MADURA. Periksa sebelum cetak.');
 single(page,fonts,institution,12,cx,807.8,390,'Universitas UNIRA',warnings,9,false,BLACK);
 single(page,fonts,'PAMEKASAN',12,cx,821.1,390,'Kota UNIRA',warnings,12,false,BLACK);
 const yearMatch=norm(data.bulan_tahun).match(/\b\d{4}\b/u),year=yearMatch?.[0]||norm(data.bulan_tahun);
 single(page,fonts,year,12,cx,834.4,150,'Tahun UNIRA',warnings,9,false,BLACK);
 // In the UNIRA reference, the spine type is at the top, title in the middle,
 // name+NPM underneath, and the small original logo immediately above YEAR.
 const spine=chooseUniraSpine(fonts,segs,mm,warnings);
 for(let i=0;i<spine.lines.length;i++)renderLine(page,fonts,spine.lines[i],spine.size,spine.xs[i],spine.centerTop,true,BLACK);
 single(page,fonts,upper(data.jenis_dokumen),8,g.center,116.4,140,'Jenis dokumen punggung UNIRA',warnings,6,true,BLACK);
 const metaSize=mm<=12?6.9:9;
 const pitch=mm<=12?6.2:Math.min(9,mmPt(mm)/3.1);
 single(page,fonts,upper(data.nama),metaSize,g.center+pitch/2,673,180,'Nama punggung UNIRA',warnings,6,true,BLACK);
 single(page,fonts,`NPM. ${norm(data.nim)}`,metaSize,g.center-pitch/2,673,175,'NPM punggung UNIRA',warnings,6,true,BLACK);
 // User-supplied replacement UNIVERSITY MADURA crest with transparency.
 // Embed PNG alpha natively; do not composite to black or white backgrounds.
 // Spine media stay fixed vertically across 10–28 mm; only X tracks center.
 const emblem=await doc.embedPng(UNIRA_LOGO);
 const im=UNIRA_SPINE_MEDIA;
 page.drawImage(emblem,{x:g.center-im.logoWidth/2,
   y:page.getHeight()-(im.logoTop+im.dropPt+im.logoHeight),width:im.logoWidth,height:im.logoHeight});
 single(page,fonts,year,8.5,g.center,im.yearBaseline+im.dropPt,90,'Tahun punggung UNIRA',warnings,6,false,BLACK);
 const out=new Uint8Array(await doc.save({useObjectStreams:true}));
 const check=await PDFDocument.load(out);
 if(check.getPageCount()!==1||Math.abs(check.getPage(0).getWidth()-mmPt(484))>.35||Math.abs(check.getPage(0).getHeight()-mmPt(330))>.35)fail('PDF UNIRA gagal verifikasi ukuran.');
 return {bytes:out,warnings,details:{mode:'unira',mm,paper_mm:UNIRA_PRINT_MM,spine_font_pt:spine.size,spine_lines:spine.lines.length,guide_left:g.left,guide_right:g.right,logo:'logo UNIRA transparan baru dari pengguna',logo_year_drop_pt:UNIRA_SPINE_MEDIA.dropPt}};
}


/** V4.21 Dummybook: a SINGLE 420×297mm spread (back/spine/front).
 * Each size 5–10mm is copied from its corresponding original PDF reference
 * page, preserving the original photos, logo, pink background and fold marks.
 * Original student text and old abstract are removed from the clean master.
 */

async function getDummyFonts(pdf,warnings){
 const kit=globalThis.fontkit||globalThis.Fontkit;
 if(!kit)fail('Fontkit gagal dimuat, tidak bisa menanam font Arial pada Dummybook.');
 pdf.registerFontkit(kit);
 let bytes;try{bytes=await getDummyArialFontBytes();}catch(e){fail(e.message||String(e));}
 try{
  const [bold,italic,regular]=await Promise.all([
    pdf.embedFont(bytes.bold,{subset:true}),
    pdf.embedFont(bytes.italic,{subset:true}),
    pdf.embedFont(bytes.regular,{subset:true})]);
  const asFace=font=>({font,face:{hasGlyphForCodePoint:cp=>font.getCharacterSet().includes(cp)}});
  warnings.push('Dummybook: font '+bytes.label+'. Bila harus Arial asli, unggah font Arial Regular dan Bold yang berlisensi dari komputer.');
  return {regular,bold:[asFace(bold)],italic:[asFace(italic)],name:bytes.label};
 }catch(e){fail('Font Arial/Arimo tidak dapat dimasukkan ke PDF: '+String(e.message||e));}
}
export function dummyTitleSpine(fonts,segs,mm,warnings){
 const g=dummySpineGeometry(mm),centerTop=DUMMY_PAGE.spineTitleCenterPt;
 const top=DUMMY_PAGE.spineTitleTopPt,bottom=DUMMY_PAGE.spineTitleBottomPt;
 const maxLen=2*Math.min(centerTop-top,bottom-centerTop)-3;
 const start=mm<=6?4.7:mm<=8?5.5:6.5;
 for(const rows of [2,3])for(let size=start;size>=3.5;size=Math.round((size-.25)*100)/100){
  try{
   const lines=spineRows(fonts,segs,size,maxLen,rows,rows);
   const pitch=size*1.07;
   if((rows-1)*pitch+size*1.12>g.widthPt-1.0)continue;
   if(lines.some(line=>{const width=measure(fonts,line,size);return centerTop-width/2<top||centerTop+width/2>bottom;}))continue;
   if(rows===3)warnings.push('Judul punggung Dummybook memakai tiga baris hanya karena pilihan dua baris tidak muat.');
   if(size<start)warnings.push(`Font punggung Dummybook turun ke ${size} pt karena sempit.`);
   return {lines,size,xs:lines.map((_,i)=>g.center+(rows-1)*pitch/2-i*pitch),fromTop:centerTop,geometry:g};
  }catch(e){if(!(e instanceof PDFPreflightError))throw e;}
 }
 fail(`Judul terlalu panjang untuk punggung Dummybook ${mm} mm (batas font 3.5 pt). Tidak dipotong demi keselamatan cetak.`);
}
function drawJustifiedBackLine(page,font,line,size,x,y,width,justify){
 const words=line.split(/\s+/u);
 if(!justify||words.length<2){page.drawText(line,{x,y:page.getHeight()-y,size,font,color:BLACK});return;}
 const wsum=words.reduce((sum,w)=>sum+font.widthOfTextAtSize(w,size),0);
 const gap=(width-wsum)/(words.length-1);
 if(gap<1||gap>19){page.drawText(line,{x,y:page.getHeight()-y,size,font,color:BLACK});return;}
 let pos=x;
 for(const w of words){page.drawText(w,{x:pos,y:page.getHeight()-y,size,font,color:BLACK});pos+=font.widthOfTextAtSize(w,size)+gap;}
}
async function generateDummyPDF(data,mm){
 mm=Number(mm);if(!DUMMY_SIZES.includes(mm))fail('Dummybook hanya tersedia ukuran 5–10 mm.');
 const segs=validate(data,10),warnings=[];
 const pars=String(data.abstract_text||'').split(/\n\s*\n/u).map(p=>p.replace(/\s+/gu,' ').trim()).filter(Boolean);
 if(!pars.length)fail('Abstrak belum ada. Baca abstrak asli dari PDF/DOCX lengkap atau isi kolom abstrak.');
 if(pars.length>50)fail('Pemisahan paragraf abstrak tampak salah. Periksa kolom abstrak sebelum ekspor.');
 if(!DUMMY_MASTER)DUMMY_MASTER=await loadAsset('./assets/dummybook_spread_clean_5-10mm.pdf');
 const src=await PDFDocument.load(DUMMY_MASTER),doc=await PDFDocument.create();
 if(src.getPageCount()!==6)fail('Master Dummybook baru harus berisi enam pilihan ukuran 5–10 mm.');
 const g=dummySpineGeometry(mm);
 const [page]=await doc.copyPages(src,[g.page]);doc.addPage(page);
 if(Math.abs(page.getWidth()-DUMMY_PAGE.widthPt)>.6||Math.abs(page.getHeight()-DUMMY_PAGE.heightPt)>.6)fail('Master Dummybook bukan 420×297 mm.');
 const fonts=await getDummyFonts(doc,warnings);
 const spine=dummyTitleSpine(fonts,segs,mm,warnings);
 // Front cover: measured from the right half of the new reference.
 let front=null;
 for(let sz=14;sz>=10;sz-=.5){
  const lines=greedyLines(fonts,segs,sz,460);
  if(lines.length<=4){front={lines,size:sz};break;}
 }
 if(!front)fail('Judul depan Dummybook terlalu panjang untuk zona atas. Periksa judul asli.');
 const cx=DUMMY_PAGE.frontCenterPt;
 const pitch=Math.min(15.7,(DUMMY_PAGE.titleBottomPt-DUMMY_PAGE.titleTopPt)/Math.max(1,front.lines.length));
 for(let i=0;i<front.lines.length;i++)renderLine(page,fonts,front.lines[i],front.size,cx,118+i*pitch,false,BLACK);
 single(page,fonts,'Oleh:',16,cx,579,300,'Oleh Dummybook',warnings,13,false,BLACK);
 single(page,fonts,upper(data.nama),16,cx,595,370,'Nama Dummybook',warnings,9,false,BLACK);
 single(page,fonts,`NIM. ${norm(data.nim)}`,14,cx,611,340,'NIM Dummybook',warnings,9,false,BLACK);
 single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,14,cx,707,420,'Prodi Dummybook',warnings,9,false,BLACK);
 single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,14,cx,722.6,420,'Fakultas Dummybook',warnings,9,false,BLACK);
 single(page,fonts,upper(canonicalUniversity(data.universitas)),14,cx,738.2,420,'Universitas Dummybook',warnings,9,false,BLACK);
 single(page,fonts,upper(data.bulan_tahun),14,cx,753.8,300,'Tanggal Dummybook',warnings,9,false,BLACK);
 // Spine text: centered inside the two ORIGINAL fold marks (no guessed shift).
 for(let i=0;i<spine.lines.length;i++)renderLine(page,fonts,spine.lines[i],spine.size,spine.xs[i],spine.fromTop,true,BLACK);
 const metaSize=mm<=6?3.9:4.5,step=metaSize*1.1;
 single(page,fonts,upper(data.nama),metaSize,g.center+step/2,170,93,'Nama punggung Dummybook',warnings,3.5,true,BLACK);
 single(page,fonts,`NIM. ${norm(data.nim)}`,metaSize,g.center-step/2,170,95,'NIM punggung Dummybook',warnings,3.5,true,BLACK);
 single(page,fonts,upper(data.bulan_tahun),metaSize,g.center,730,75,'Tahun punggung Dummybook',warnings,3.5,true,BLACK);
 // Exact final paragraphs, never summarized / invented / sliced mid-paragraph.
 const regular=fonts.regular;
 const characters=new Set(regular.getCharacterSet());
 const widthFn=(s,size)=>{
  for(const ch of s)if(!characters.has(ch.codePointAt(0)))fail(`Karakter abstrak '${ch}' tidak ada pada font Unicode. Pilih font yang sesuai.`);
  return regular.widthOfTextAtSize(s,size);
 };
 let layout;try{layout=chooseDummyBackText(pars,widthFn);}catch(e){fail(e.message||String(e));}
 const h=DUMMY_PAGE.backBottomPt-DUMMY_PAGE.backTopPt;
 let y=DUMMY_PAGE.backTopPt+(h-layout.height)/2+layout.size;
 for(const rows of layout.lines){
  for(let i=0;i<rows.length;i++){
   drawJustifiedBackLine(page,regular,rows[i],layout.size,DUMMY_PAGE.backXPt,y,DUMMY_PAGE.backWidthPt,i<rows.length-1);
   y+=layout.linePitch;
  }
  y+=layout.gap;
 }
 if(y-layout.gap>DUMMY_PAGE.backBottomPt+2)fail('Teks belakang melewati zona aman.');
 warnings.push(`Dummybook: ${layout.reason} ${layout.paragraphCount} paragraf terakhir, ${layout.totalLines} baris, ${layout.size} pt.`);
 const bytes=new Uint8Array(await doc.save({useObjectStreams:true}));
 const checked=await PDFDocument.load(bytes);
 if(checked.getPageCount()!==1)fail('Dummybook terbaru wajib 1 lembar 420×297 mm.');
 return {bytes,warnings,details:{mode:'dummybook',mm,paper_mm:DUMMY_PRINT_MM,pages:1,
  spine_font_pt:spine.size,spine_lines:spine.lines.length,back_paragraph_count:layout.paragraphCount,
  back_lines:layout.totalLines,back_font_pt:layout.size,dummy_font:fonts.name,source_reference_page:g.page+1}};
}

/** V4.20 Soft Cover IPS, 330 × 210 mm, landscape.
 * Based on the user's original Soft Cover IPS.pdf. Only the first reference
 * page is used as a clean visual base; sample student's text was stripped
 * without affecting the original colored UIN Madura logo or vector marks.
 * Fold marks at 5 mm are measured. Sizes 6–10 mm are extrapolated, with
 * the front/right fold fixed and all FOUR left-side marks translated equally.
 */
function ipsTitleSpine(fonts,segs,mm,warnings){
 const g=ipsSpineGeometry(mm),r=IPS_REFERENCE;
 const centerTop=r.titleCenterTopPt;
 const maxLen=2*Math.min(centerTop-r.titleSafeTopPt,r.titleSafeBottomPt-centerTop)-3;
 const base=mm<=5?5.0:mm<=6?5.4:mm<=8?6.2:7.0;
 // 2 columns before 3 columns; don't split a word in the middle.
 for(const rows of [2,3]){
  for(let size=base;size>=3.5;size=Math.round((size-.25)*100)/100){
   try{
    const lines=spineRows(fonts,segs,size,maxLen,rows,rows);
    const pitch=size*1.08;
    const glyphHeight=size*1.11;
    if((rows-1)*pitch+glyphHeight>g.widthPt-1.1)continue;
    const widths=lines.map(line=>measure(fonts,line,size));
    if(widths.some(width=>centerTop-width/2<r.titleSafeTopPt || centerTop+width/2>r.titleSafeBottomPt))continue;
    const xs=lines.map((_,i)=>g.center+(rows-1)*pitch/2-i*pitch);
    if(rows===3)warnings.push('Soft Cover IPS: punggung memakai 3 kolom karena 2 kolom tidak muat pada batas ukuran minimum.');
    if(size<base)warnings.push(`Soft Cover IPS ${mm} mm: font judul turun menjadi ${size.toFixed(2)} pt karena lebar dan panjang judul.`);
    return {lines,xs,size,centerTop,geometry:g};
   }catch(e){if(!(e instanceof PDFPreflightError))throw e;}
  }
 }
 fail(`Judul terlalu panjang untuk punggung Soft Cover IPS ${mm} mm. Tidak dipecah di tengah kata dan tidak dipotong.`);
}
function ipsGuides(page,g){
 // The source has four independent left-side top and bottom ticks, plus
 // static right-side ticks and corner guides. Keep the latter untouched.
 const h=page.getHeight(),white=rgb(1,1,1),ink=BLACK;
 const old=IPS_REFERENCE.leftTicksPt;
 for(let i=0;i<old.length;i++){
  const x=old[i];
  const start=i===0?x-8.8:x-1.5;
  const width=i===0?11:3;
  page.drawRectangle({x:start,y:h-13.0,width,height:13.0,color:white});
  page.drawRectangle({x:start,y:0,width,height:13.0,color:white});
 }
 for(let i=0;i<g.leftTicksPt.length;i++){
  const x=g.leftTicksPt[i];
  if(x<1||x>page.getWidth()-1)fail('Garis tanda potong IPS di luar kertas.');
  page.drawLine({start:{x,y:h-4.1},end:{x,y:h-11.1},thickness:.52,color:ink});
  page.drawLine({start:{x,y:4.1},end:{x,y:11.1},thickness:.52,color:ink});
  if(i===0){
   page.drawLine({start:{x:x-7.0,y:h-8.4},end:{x,y:h-8.4},thickness:.52,color:ink});
   page.drawLine({start:{x:x-7.0,y:8.4},end:{x,y:8.4},thickness:.52,color:ink});
  }
 }
}
/** Exported pure/layout entry point for unit tests. */
export function ipsSpine(fonts,segs,mm,warnings=[]){return ipsTitleSpine(fonts,segs,mm,warnings);}
async function generateSoftIPSPDF(data,mm){
 mm=Number(mm);
 if(!IPS_SIZES.includes(mm))fail('Soft Cover IPS: punggung tersedia 5–10 mm.');
 const segs=validate(data,10),warnings=[];
 if(!IPS_MASTER)IPS_MASTER=await loadAsset('./assets/soft_ips_clean.pdf');
 const src=await PDFDocument.load(IPS_MASTER),doc=await PDFDocument.create();
 if(src.getPageCount()!==1)fail('Master Soft Cover IPS harus satu halaman.');
 const [page]=await doc.copyPages(src,[0]);doc.addPage(page);
 if(Math.abs(page.getWidth()-IPS_REFERENCE.pageWidthPt)>.4||Math.abs(page.getHeight()-IPS_REFERENCE.pageHeightPt)>.4)fail('Ukuran master IPS bukan 330 × 210 mm landscape.');
 const fonts=await getFonts(doc,warnings);
 const g=ipsSpineGeometry(mm);
 ipsGuides(page,g);
 const cx=IPS_REFERENCE.frontCenterXPt;
 // Original type sizes and anchors measured directly from reference PDF.
 // Keep all front fields in place even when spine changes.
 let front=null;
 for(let size=8.5;size>=6.5;size-=.25){
  const lines=greedyLines(fonts,segs,size,305);
  if(lines.length<=5){front={lines,size};break;}
 }
 if(!front)fail('Judul cover depan IPS terlalu panjang untuk kotak judul. Periksa judul asli.');
 const titlePitch=front.size*1.12;
 const firstTitleTop=70.4-(front.lines.length-1)*titlePitch/2;
 for(let i=0;i<front.lines.length;i++)renderLine(page,fonts,front.lines[i],front.size,cx,firstTitleTop+i*titlePitch,false,BLACK);
 single(page,fonts,upper(data.jenis_dokumen),12.4,cx,153,250,'Jenis dokumen depan IPS',warnings,9,false,BLACK);
 single(page,fonts,'Oleh:',8.35,cx,234.8,160,'Label Oleh IPS',warnings,8,false,BLACK);
 single(page,fonts,norm(data.nama),8.35,cx,243.8,270,'Nama depan IPS',warnings,7,false,BLACK);
 single(page,fonts,`NIM. ${norm(data.nim)}`,8.35,cx,252.9,270,'NIM depan IPS',warnings,7,false,BLACK);
 single(page,fonts,`PROGRAM STUDI ${upper(data.prodi)}`,8.35,cx,512.1,350,'Prodi IPS',warnings,6.5,false,BLACK);
 single(page,fonts,`FAKULTAS ${upper(data.fakultas)}`,8.35,cx,521.2,350,'Fakultas IPS',warnings,6.5,false,BLACK);
 single(page,fonts,upper(canonicalUniversity(data.universitas)),8.35,cx,530.3,350,'Universitas IPS',warnings,6.5,false,BLACK);
 const year=norm(data.bulan_tahun).match(/\b(?:19|20)\d{2}\b/u)?.[0]||norm(data.bulan_tahun);
 single(page,fonts,year,8.35,cx,539.3,160,'Tahun IPS',warnings,7,false,BLACK);
 const spine=ipsTitleSpine(fonts,segs,mm,warnings);
 for(let i=0;i<spine.lines.length;i++)renderLine(page,fonts,spine.lines[i],spine.size,spine.xs[i],spine.centerTop,true,BLACK);
 const metaPt=mm<=6?4.05:mm<=8?4.55:5.2;
 const metaPitch=metaPt*1.03;
 single(page,fonts,upper(data.nama),metaPt,g.center-metaPitch/2,391,97,'Nama punggung IPS',warnings,3.5,true,BLACK);
 single(page,fonts,upper(data.jenis_dokumen),metaPt,g.center+metaPitch/2,391,88,'Jenis punggung IPS',warnings,3.5,true,BLACK);
 single(page,fonts,year,metaPt,g.center,493,78,'Tahun punggung IPS',warnings,3.5,true,BLACK);
 if(mm!==5)warnings.push(`Ketebalan IPS ${mm} mm dihitung dari referensi 5 mm. Wajib cetak uji skala 100%.`);
 const bytes=new Uint8Array(await doc.save({useObjectStreams:true}));
 const verify=await PDFDocument.load(bytes);
 if(verify.getPageCount()!==1||Math.abs(verify.getPage(0).getWidth()-IPS_REFERENCE.pageWidthPt)>.4||Math.abs(verify.getPage(0).getHeight()-IPS_REFERENCE.pageHeightPt)>.4)fail('Hasil PDF Soft Cover IPS gagal verifikasi halaman dan ukuran.');
 return {bytes,warnings,details:{mode:'softips',mm,paper_mm:IPS_PRINT_MM,pages:1,spine_font_pt:spine.size,spine_lines:spine.lines.length,guide_left:g.left,guide_right:g.right}};
}


/** A single square CD cover based on the user's five-page Word reference.
 * Two original UIN Madura logos are preserved as a separate image asset.
 * A Cover CD has NO spine or hard-cover fold guides.
 */
async function generateCoverCDPDF(data){
 assertCDData(data);
 const warnings=[];
 const doc=await PDFDocument.create();
 const page=doc.addPage([CD_PAGE_PT,CD_PAGE_PT]);
 const fonts=await getFonts(doc,warnings);
 const logoBytes=await loadAsset('./assets/cover_cd_uin_logo.png');
 const logo=await doc.embedPng(logoBytes);
 const l=CD_LAYOUT;
 const bold=fonts.bold[0].font;
 function line(txt,size,top,maxWidth,minimum=7){
  const value=upper(txt);if(!value)return;
  let adjusted=size;
  while(adjusted>=minimum && bold.widthOfTextAtSize(value,adjusted)>maxWidth)adjusted-=.25;
  if(adjusted<minimum)fail('Teks Cover CD terlalu panjang: '+value.slice(0,75));
  page.drawText(value,{x:l.centerX-bold.widthOfTextAtSize(value,adjusted)/2,y:page.getHeight()-top-adjusted*.84,size:adjusted,font:bold,color:BLACK});
  if(adjusted<size)warnings.push('Cover CD: teks '+value.slice(0,25)+' disesuaikan menjadi '+adjusted+' pt.');
 }
 line(data.nama,9,l.nameTop,l.maxTextWidth,7);
 line('NIM: '+data.nim,9,l.nimTop,l.maxTextWidth,7);
 if(norm(data.prodi))line(data.prodi,9,l.studyTop,l.maxTextWidth,7);
 if(norm(data.bulan_tahun))line(data.bulan_tahun,9,l.dateTop,l.maxTextWidth,7);
 for(const box of [l.leftLogo,l.rightLogo]){
  page.drawImage(logo,{x:box.left,y:page.getHeight()-box.top-box.height,width:box.width,height:box.height});
 }
 const title=computeCDTitle(data.judul,(str,size)=>bold.widthOfTextAtSize(str,size));
 if(title.size<l.titleSize)warnings.push('Cover CD: font judul disesuaikan menjadi '+title.size+' pt agar tetap di bawah kedua logo.');
 title.lines.forEach((txt,i)=>line(txt,title.size,title.top+i*title.pitch,l.titleMaxWidth,title.size));
 const bytes=new Uint8Array(await doc.save({useObjectStreams:true}));
 const verify=await PDFDocument.load(bytes);
 if(verify.getPageCount()!==1||Math.abs(verify.getPage(0).getWidth()-CD_PAGE_PT)>.25||Math.abs(verify.getPage(0).getHeight()-CD_PAGE_PT)>.25)fail('Hasil Cover CD gagal pemeriksaan 137 × 137 mm.');
 return {bytes,warnings,details:{mode:'covercd',mm:null,paper_mm:CD_PRINT_MM,pages:1,title_lines:title.lines.length,title_font_pt:title.size,logo_count:2}};
}

/** Main public API, backward-compatible with V3.8 */
export async function generatePDF(data,mm,mode='polos',customColor=null){
 await ensureAssets();
 const c=validateCoverMode(mode,customColor);
 if(c.type==='covercd')return generateCoverCDPDF(data);
 if(c.type==='dummybook')return generateDummyPDF(data,mm);
 if(c.type==='softips')return generateSoftIPSPDF(data,mm);
 if(c.type==='unira')return generateUniraPDF(data,mm);
 if(c.type!=='polos')return generateColorPDF(data,mm,c.type,c.color);
 const plain=await generatePlainPDF(data,mm);
 const out=await resizePlainToPrint(plain.bytes);
 const reopened=await PDFDocument.load(out);
 if(Math.abs(reopened.getPage(0).getWidth()-mmPt(480))>.3||Math.abs(reopened.getPage(0).getHeight()-mmPt(330))>.3)fail('PDF polos gagal validasi ukuran 480 × 330 mm.');
 return {...plain,bytes:out,details:{...plain.details,mode:'polos',paper_mm:PLAIN_PRINT_MM}};
}
