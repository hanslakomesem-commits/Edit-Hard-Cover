/** Pure Dummybook typography/geometry, testable without PDF/CDN. */
export const DUMMY_SIZES=Object.freeze([5,6,7,8,9,10]);
export const DUMMY_PAGE=Object.freeze({widthPt:595.27559,heightPt:841.88977,foldLeftPt:17,backXPt:152.8,backWidthPt:300,backTopPt:280,backBottomPt:580});
export const mmPt=v=>v*72/25.4;
export function dummySpineGeometry(mm){
 mm=Number(mm);if(!DUMMY_SIZES.includes(mm))throw Error('Punggung Dummybook hanya 5–10 mm');
 // Keep the outer edge of the pink reference at x=17pt. The fold at the
 // front side moves as requested, without shifting the campus photo/logo.
 const left=DUMMY_PAGE.foldLeftPt,right=left+mmPt(mm),center=(left+right)/2;
 if(right>=50)throw Error('Spine would intrude into front template');
 return {mm,left,right,center,widthPt:mmPt(mm)};
}
export function wrapByMetrics(text,size,maxWidth,widthFn){
 const words=String(text||'').trim().split(/\s+/u).filter(Boolean),rows=[];
 let current='';
 for(const word of words){
  if(widthFn(word,size)>maxWidth+.05)throw Error(`Kata abstrak terlalu panjang untuk lebar halaman: ${word}`);
  const next=current?current+' '+word:word;
  if(current&&widthFn(next,size)>maxWidth){rows.push(current);current=word;}
  else current=next;
 }
 if(current)rows.push(current);return rows;
}
export function chooseDummyBackText(paragraphs,widthFn,{width=DUMMY_PAGE.backWidthPt,top=DUMMY_PAGE.backTopPt,bottom=DUMMY_PAGE.backBottomPt}={}){
 const ps=paragraphs.map(p=>String(p||'').replace(/\s+/gu,' ').trim()).filter(Boolean);
 if(!ps.length)throw Error('Paragraf abstrak belum diisi. Paste atau unggah abstrak PDF/Word terlebih dahulu.');
 const count=Math.min(3,ps.length);
 const lineSpace=size=>size*1.47;
 const candidate=(n,size)=>{
  const used=ps.slice(-n).map(p=>wrapByMetrics(p,size,width,widthFn));
  const linePitch=lineSpace(size), gap=linePitch*.75;
  const height=used.reduce((s,lines)=>s+lines.length*linePitch,0)+(used.length-1)*gap;
  return {paragraphs:ps.slice(-n),lines:used,paragraphCount:n,size,linePitch,gap,height,
    totalLines:used.reduce((a,b)=>a+b.length,0),fits:height<=bottom-top-.5};
 };
 // Use 2 by default; 1 if too long; 3 if 2 are visually sparse.
 // Always respect full paragraphs: do not summarize, truncate, or invent text.
 let lastWordError='';
 for(const size of [10.5,10,9.5,9,8.5]){
  let two;
  try{two=candidate(Math.min(2,count),size);}catch(e){lastWordError=e.message;continue;}
  if(count>=3 && two.totalLines<10){
   try {const three=candidate(3,size);
    if(three.fits&&three.totalLines<=22)return three;
   } catch(e){lastWordError=e.message;}
  }
  if(two.fits && two.totalLines<=20)return two;
  if(count>=2 && !two.fits){
   try {const one=candidate(1,size);
    if(one.fits)return one;
   } catch(e){lastWordError=e.message;}
  }
  if(count===1 && two.fits)return two;
 }
 throw Error('Paragraf abstrak terlalu panjang untuk sisi belakang. '+(lastWordError?lastWordError+'. ':'')+'Periksa paragraf yang sebenarnya. Tidak ada teks yang dipotong.');
}
