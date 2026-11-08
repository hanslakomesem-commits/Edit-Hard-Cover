import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),enc=new TextEncoder(),dec=new TextDecoder();let saveLog=[];
const spec={};
for(const [file,pages,w,h] of [
 ['masters.pdf',19,483,330],['warna_clean.pdf',2,475,320],['warna_transparent_marks_logo.pdf',1,475,320],
 ['unira_clean.pdf',1,484,330],['soft_ips_clean.pdf',1,330,210],['dummybook_spread_clean_5-10mm.pdf',6,420,297]
])spec[(await stat(fileURLToPath(new URL('assets/'+file,root)))).size]={pages,w,h};
class Page{
 constructor(w,h){this.w=w;this.h=h;this.ops=[];}
 getWidth(){return this.w;}getHeight(){return this.h;}
 drawText(text,o){this.ops.push({type:'text',text,...o});}
 drawLine(o){this.ops.push({type:'line',...o});}
 drawRectangle(o){this.ops.push({type:'rect',...o});}
 drawImage(_o,o){this.ops.push({type:'image',...o});}
 drawPage(_o,o){this.ops.push({type:'page',...o});}
}
class Doc{
 constructor(){this.pages=[];}
 static async create(){return new Doc();}
 static async load(bytes){
  const d=new Doc(),b=Buffer.from(bytes);
  if(b.subarray(0,4).toString()==='%PDF'){
   const type=spec[b.length];assert(type,`unknown pdf asset bytes ${b.length}`);
   d.pages=Array.from({length:type.pages},()=>new Page(type.w*72/25.4,type.h*72/25.4));return d;
  }
  d.pages=JSON.parse(dec.decode(bytes)).pages.map(p=>{const page=new Page(p.w,p.h);page.ops=p.ops;return page;});return d;
 }
 getPageCount(){return this.pages.length;}getPage(n){return this.pages[n];}
 async copyPages(d,ns){return ns.map(i=>new Page(d.getPage(i).w,d.getPage(i).h));}
 addPage(p){const n=Array.isArray(p)?new Page(...p):p;this.pages.push(n);return n;}
 registerFontkit(){}
 async embedFont(){return {widthOfTextAtSize:(s,n)=>Array.from(s).reduce((a,c)=>a+(c===' '?.25:.53)*n,0),getCharacterSet:()=>Array.from({length:65536},(_,i)=>i)};}
 async embedPdf(){return [{}];}async embedPng(){return {width:100,height:100};}
 async save(){const pages=this.pages.map(p=>({w:p.w,h:p.h,ops:p.ops}));saveLog.push(pages);return enc.encode(JSON.stringify({pages}));}
}
globalThis.PDFLib={PDFDocument:Doc,rgb:(...a)=>a,degrees:a=>a};globalThis.fontkit={};
globalThis.fetch=async url=>{const b=await readFile(fileURLToPath(String(url)));return {ok:true,json:async()=>JSON.parse(b.toString()),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};};
const {generatePDF,setUserFonts}=await import('../pdf-engine.js');
setUserFonts(new Uint8Array([1,2]),new Uint8Array([3,4]));
const record={judul:'PENDIDIKAN DAN PENGARUH PEMBELAJARAN PADA ANAK USIA DINI',nama:'DINIA NAILUL FARAH',nim:'20215935021',prodi:'PENDIDIKAN ISLAM ANAK USIA DINI',fakultas:'',universitas:'SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA',kota:'PAMEKASAN',jenis_dokumen:'SKRIPSI',bulan_tahun:'2026',title_segments:[{text:'PENDIDIKAN DAN PENGARUH PEMBELAJARAN PADA ANAK USIA DINI',italic:false}]};
let cases=0;
for(const [mode,mm] of [['polos',18],['poloslogoatas',18],['polosv11',18],['polosv22',18],['merah',18],['maroon',18],['custom',18],['unira',18],['softips',5],['covercd',null]]){
 let off,on,plainOff=null,plainOn=null;
 try{saveLog=[];off=await generatePDF({...record,nama_garis_bawah:false},mm,mode,mode==='custom'?'#883344':null);plainOff=saveLog.slice();saveLog=[];on=await generatePDF({...record,nama_garis_bawah:true},mm,mode,mode==='custom'?'#883344':null);}
 catch(e){throw new Error(mode+': '+e.message,{cause:e});}
 plainOn=saveLog.slice();
 const p0=await Doc.load(off.bytes),p1=await Doc.load(on.bytes);
 const a=p0.getPage(0).ops.filter(o=>o.type==='line');
 const b=p1.getPage(0).ops.filter(o=>o.type==='line');
 // For Polos, additional external marks are placed in a re-scaled PDF; only the
 // 483mm source copy contains the new underlined name. The visual page embeds it.
 // Other modes add the underline to their working page directly.
 if(mode.startsWith('polos')){
  assert.equal(a.length,b.length,mode+' trim lines unchanged in final re-embed');
  const before=plainOff.find(p=>p[0]?.ops.some(op=>op.type==='text'));
  const after=plainOn.find(p=>p[0]?.ops.some(op=>op.type==='text'));
  assert(before&&after,mode+' original 483mm text page saved');
  const n0=before[0].ops.filter(op=>op.type==='line').length;
  const n1=after[0].ops.filter(op=>op.type==='line').length;
  assert.equal(n1,n0+1,mode+' original Polos PDF gets exactly one new name underline');
 }else assert.equal(b.length,a.length+1,mode+' exactly one new underline stroke');
 cases++;
}
console.log(`PASS V4.37: generated ${cases} modes both off/on; colored/UNIRA/IPS/CD produce exactly one additional underline; Polos paper/trim unaffected (mocked runtime).`);
