/** ZAIN.NET V4.19: read real abstract paragraphs. Never fabricate summaries.
 * PDF text layers: first 25 pages maximum; DOCX paragraph XML: targeted region.
 * No scan OCR here; user can paste abstract into editor when source is image.
 */
import {withTimeout} from './document-reader.js';

export function cleanParagraph(text){return String(text||'').replace(/[\u00a0\u200b]/gu,' ').replace(/\s+/gu,' ').trim();}
export function parseAbstractParagraphs(blocks,{allowWithoutHeading=false}={}){
 const lines=(blocks||[]).map(cleanParagraph).filter(Boolean);
 const header=/^(?:ABSTRAK|ABSTRACT)(?:\s*[:：])?$/iu;
 const keyword=/^(?:KATA\s*KUNCI|KEYWORDS?|KATA\s*PENGANTAR|PENDAHULUAN|BAB\s+[IVX]+|DAFTAR\s+ISI|DAFTAR\s+PUSTAKA|ACKNOWLEDGEMENTS?)\b/iu;
 const idx=lines.findIndex(s=>header.test(s));
 if(idx<0&&!allowWithoutHeading)return [];
 const relevant=idx>=0?lines.slice(idx+1):lines;
 const out=[];
 for(const s of relevant){
  if(keyword.test(s)||header.test(s))break;
  // Abstracts may start with a metadata line, but do not mistake it for prose.
  if(s.length<55 && !/[.!?。]$/u.test(s))continue;
  out.push(s);
  if(out.length>=30)break;
 }
 return out;
}
function decodeXML(s){return String(s||'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/giu,(m,a)=>{
 if(a==='amp')return '&';if(a==='lt')return '<';if(a==='gt')return '>';if(a==='quot')return '"';if(a==='apos')return "'";
 if(a.startsWith('#')){const hex=a[1].toLowerCase()==='x',n=parseInt(a.slice(hex?2:1),hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):m;}
 return m;
});}
export function docxAbstractParagraphs(xml){
 // Extract only the section between the first ABSTRAK and the next heading.
 const start=String(xml).search(/<w:t(?:\s[^>]*)?>\s*ABSTRAK\s*<\/w:t>/iu);
 if(start<0)return [];
 const after=xml.slice(start);
 const end=after.search(/<w:t(?:\s[^>]*)?>\s*(?:Kata\s+kunci|Keywords?|ABSTRACT|KATA\s+PENGANTAR|BAB\s+I)\b/iu);
 const region=end>=0?after.slice(0,end):after.slice(0,160000);
 const paragraphs=[];
 for(const match of region.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gu)){
  const text=cleanParagraph([...match[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map(x=>decodeXML(x[1])).join(''));
  if(text)paragraphs.push(text);
  if(paragraphs.length>45)break;
 }
 return parseAbstractParagraphs(['ABSTRAK',...paragraphs]);
}
function pdfLines(items){
 const spans=(items||[]).filter(o=>String(o.str||'').trim()).map(o=>({text:cleanParagraph(o.str),x:o.transform?.[4]||0,y:o.transform?.[5]||0}));
 spans.sort((a,b)=>b.y-a.y||a.x-b.x);
 const groups=[];
 for(const s of spans){let g=groups.find(g=>Math.abs(g.y-s.y)<2.4);if(!g){g={y:s.y,x:s.x,items:[]};groups.push(g);}g.items.push(s);g.x=Math.min(g.x,s.x);}
 return groups.sort((a,b)=>b.y-a.y).map(g=>({...g,text:cleanParagraph(g.items.sort((a,b)=>a.x-b.x).map(s=>s.text).join(' '))}));
}
export function groupPdfParagraphs(lines){
 if(!lines.length)return [];
 const positive=lines.slice(1).map((x,i)=>lines[i].y-x.y).filter(v=>v>1&&v<65).sort((a,b)=>a-b);
 const median=positive[Math.floor(Math.max(0,positive.length-1)*.25)]||13;
 const grouped=[];let current='',prev=null;
 for(const l of lines){
  if(prev){
   const gap=prev.y-l.y;
   const indent=l.x-prev.x;
   const newPara=gap>median*1.55 || (indent>13&&/[.!?。]$/u.test(current)) ||
      (gap>=median*.98&&l.x>prev.x+10&&/[.!?。]$/u.test(current));
   if(newPara&&current){grouped.push(cleanParagraph(current));current='';}
  }
  current+=(current?' ':'')+l.text;prev=l;
 }
 if(current)grouped.push(cleanParagraph(current));
 return grouped;
}
export async function readAbstractFromFile(file,{onProgress}={}){
 if(!file)throw Error('Pilih file PDF/DOCX abstrak terlebih dahulu.');
 const progress=s=>{try{onProgress?.(s);}catch{}};
 if(/\.docx$/iu.test(file.name||'')){
  if(!globalThis.JSZip)throw Error('JSZip belum termuat.');
  progress('Mencari bagian ABSTRAK di Word');
  const zip=await withTimeout(globalThis.JSZip.loadAsync(await file.arrayBuffer()),25000,'Membaca DOCX abstrak');
  const xml=zip.file('word/document.xml');if(!xml)throw Error('Word tidak memiliki document.xml');
  const pars=docxAbstractParagraphs(await withTimeout(xml.async('string'),30000,'Ekstraksi teks Word'));
  if(!pars.length)throw Error('Bagian ABSTRAK dalam DOCX tidak ditemukan. Tempel paragraf abstrak secara manual.');
  return {paragraphs:pars,source:`DOCX: ${file.name}`};
 }
 if(/\.pdf$/iu.test(file.name||'')||file.type==='application/pdf'){
  if(!globalThis.pdfjsLib)throw Error('PDF.js belum termuat.');
  progress('Mencari halaman ABSTRAK dalam PDF');
  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await withTimeout(globalThis.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableStream:true,disableAutoFetch:true}).promise,30000,'Membuka PDF abstrak');
  try{
   const limit=Math.min(pdf.numPages,25);let found=false,lines=[];
   for(let i=1;i<=limit;i++){
    progress(`Mencari ABSTRAK: halaman ${i}/${limit}`);
    const page=await withTimeout(pdf.getPage(i),12000,`Halaman PDF ${i}`);
    const entries=pdfLines((await withTimeout(page.getTextContent(),12000,`Teks PDF ${i}`)).items);
    const heading=entries.findIndex(e=>/^(?:ABSTRAK|ABSTRACT)(?:\s*[:：])?$/iu.test(e.text));
    if(heading>=0){found=true;lines.push(...entries.slice(heading+1));continue;}
    if(found){
      if(entries.some(e=>/^(?:KATA\s*KUNCI|KEYWORDS?|ABSTRACT|BAB\s+[IVX]+|KATA\s+PENGANTAR)\b/iu.test(e.text)))break;
      lines.push(...entries);
      if(lines.length>90)break;
    }
   }
   if(!found)throw Error('Heading ABSTRAK tidak ditemukan pada 25 halaman pertama PDF. Jika PDF berupa scan, tempel abstrak manual.');
   // Split into spans/paragraphs and stop on keyword heading.
   const paragraphs=[];let current=[];let last=null;
   const distances=lines.slice(1).map((e,i)=>lines[i].y-e.y).filter(v=>v>1&&v<65).sort((a,b)=>a-b);
   const median=distances[Math.floor(Math.max(0,distances.length-1)*.25)]||13;
   for(const item of lines){
    if(/^(?:KATA\s*KUNCI|KEYWORDS?|ABSTRACT|BAB\s+[IVX]+|KATA\s+PENGANTAR)\b/iu.test(item.text))break;
    const gap=last?last.y-item.y:0;
    if(last&&(gap>median*1.55||gap<-median*2||item.x>last.x+13&&/[.!?。]$/u.test(current.at(-1)||''))){
      if(current.length)paragraphs.push(cleanParagraph(current.join(' ')));current=[];
    }
    current.push(item.text);last=item;
   }
   if(current.length)paragraphs.push(cleanParagraph(current.join(' ')));
   const text=paragraphs.filter(p=>p.length>=55);
   if(!text.length)throw Error('Teks ABSTRAK tidak terbaca dengan jelas. Isi manual untuk keamanan.');
   return {paragraphs:text,source:`PDF: ${file.name} (${limit} halaman maksimum diperiksa)`};
  }finally{await pdf.destroy().catch(()=>{});}
 }
 throw Error('File abstrak harus PDF atau DOCX. Untuk teks lain gunakan kolom Tempel Abstrak.');
}
