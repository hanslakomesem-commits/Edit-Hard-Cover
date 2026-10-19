import assert from 'node:assert/strict';
import {dummySpineGeometry,DUMMY_SIZES,chooseDummyBackText} from '../dummybook-layout.js';
import {parseAbstractParagraphs,docxAbstractParagraphs} from '../abstract-reader.js';
import {dummyTitleSpine,coverTypes,printSizes} from '../pdf-engine.js';
const width=(str,size)=>String(str).length*size*.49;
const words=(n)=>Array.from({length:n},(_,i)=>`kata${i}`).join(' ')+'.';
let assertions=0;
assert(coverTypes.includes('dummybook'));assertions++;
assert.equal(printSizes.dummybook.width,210);assertions++;
for(const mm of DUMMY_SIZES){
 const g=dummySpineGeometry(mm);
 assert(Math.abs(g.right-g.left-mm*72/25.4)<1e-9);
 assert(g.left>=17&&g.right<=50);assertions+=2;
}
const small=['Ringkas hasil 1.','Ringkas hasil 2.','Ringkas hasil 3.'];
const choseShort=chooseDummyBackText(small,width);
assert.equal(choseShort.paragraphCount,3);assertions++;
const medium=[words(110),words(58),words(55)];
const choseMed=chooseDummyBackText(medium,width);
assert.equal(choseMed.paragraphCount,2);assertions++;
const large=[words(70),words(250),words(22)];
const choseLong=chooseDummyBackText(large,width);
assert.equal(choseLong.paragraphCount,1);assertions++;
assert.equal(choseLong.paragraphs[0],large.at(-1));assertions++;
assert.throws(()=>chooseDummyBackText([],width),/abstrak/i);assertions++;
assert.throws(()=>dummySpineGeometry(11),/5–10/);assertions++;
const blocks=['JUDUL','ABSTRAK','Hasil penelitian yang membahas beberapa kondisi dengan uraian cukup panjang dan banyak hasil pengamatan.','Penelitian memberikan kesimpulan yang panjang untuk kebutuhan abstrak akademik.','KATA KUNCI: sekolah'];
const filtered=parseAbstractParagraphs(blocks);
assert.equal(filtered.length,2);assertions++;
const xml='<w:document><w:body><w:p><w:r><w:t>ABSTRAK</w:t></w:r></w:p><w:p><w:r><w:t>Hasil penelitian menunjukkan bahwa pendidikan karakter berkembang dengan baik.</w:t></w:r></w:p><w:p><w:r><w:t>Temuan lain memperkuat hasil penelitian melalui pendampingan yang dilakukan.</w:t></w:r></w:p><w:p><w:r><w:t>Kata kunci</w:t></w:r></w:p><w:p><w:r><w:t>BAB I</w:t></w:r></w:p></w:body></w:document>';
assert.equal(docxAbstractParagraphs(xml).length,2);assertions++;
const mockFace={hasGlyphForCodePoint:()=>true};
const mockF={widthOfTextAtSize:(s,n)=>s.length*n*.47};
const fonts={bold:[{font:mockF,face:mockFace}],italic:[{font:mockF,face:mockFace}]};
const title='PENGARUH MEDIA PAPELMATH PAPAN TEMPEL MATEMATIKA TERHADAP KEMAMPUAN MATEMATIKA PERMULAAN PADA ANAK USIA EMPAT SAMPAI LIMA TAHUN DI PADEMAWU PAMEKASAN';
for(const mm of DUMMY_SIZES){
 const warnings=[];
 const ret=dummyTitleSpine(fonts,[{text:title,italic:false}],mm,warnings);
 assert(ret.lines.length===2||ret.lines.length===3);
 assert(ret.size>=4.5);
 assert(ret.xs.every(x=>x>=ret.geometry.left&&x<=ret.geometry.right));
 assertions+=3;
}
console.log(`PASS V4.19: ${assertions} paragraph, size, spine, parser, routing assertions`);
