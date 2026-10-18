import assert from 'node:assert/strict';
import {colorSpine,spineRowPreferences,spineRows,calibrateColorSpineTitleRows} from '../pdf-engine.js';
import {colorGuideGeometry} from '../guide-geometry.js';

const fixedFont={widthOfTextAtSize(text,size){return [...text].length*size*.65;}};
const face={hasGlyphForCodePoint(){return true;}};
const fonts={bold:[{font:fixedFont,face}],italic:[{font:fixedFont,face}]};
const plain=text=>[{text,italic:false}];
const sample=(count)=>Array.from({length:count},(_,i)=>`KATA${i+1}`).join(' ');
const get=(text,mm)=>colorSpine(fonts,plain(text),mm,[]);

assert.deepEqual(spineRowPreferences(9).map(x=>`${x.rows}/${x.size}`),
 ['2/9','2/8','2/7','2/6','3/9','3/8','3/7','3/6']);
assert.deepEqual(spineRowPreferences(8).map(x=>`${x.rows}/${x.size}`),
 ['2/8','2/7','2/6','3/8','3/7','3/6']);
assert.equal(spineRows(fonts,plain('SISTEM BAGI HASIL'),9,320,2,2).length,2);
assert.equal(spineRows(fonts,plain('SKRIPSI'),9,320,2,2).length,1,'One-word title cannot be divided into two');

// Find examples deterministically instead of hand-picking an arbitrary title width.
let normal,downsized,fallback,rejected;
for(let n=8;n<=90;n++){
 const text=sample(n);
 try{
  const t=get(text,20);
  if(!normal && t.count===2 && t.size===9)normal={text,t};
  if(!downsized && t.count===2 && t.size<9)downsized={text,t};
  if(!fallback && t.count===3)fallback={text,t};
 }catch(error){if(!rejected)rejected={text,error};}
}
assert.ok(normal,'Should fit 2 lines at default font');
assert.ok(downsized,'Should fit 2 lines at a smaller font');
assert.ok(fallback,'Should allow 3 lines only when 2 lines fail at 6pt');
assert.ok(rejected,'Should reject impossible titles rather than clip');
assert.equal(normal.t.count,2);
assert.equal(downsized.t.count,2);
assert.equal(fallback.t.count,3);
assert.ok(fallback.t.size>=6);

// Specifically prove 3 lines at the original 9 pt can fit, but 2 lines at
// smaller font are still chosen when the user prioritizes two rows.
let strongCase;
for(let n=8;n<=90;n++){
 const text=sample(n);
 try{
  const t=get(text,20);
  if(t.count!==2||t.size===9)continue;
  const threeAt9=spineRows(fonts,plain(text),9,320,3,3);
  const length=threeAt9.map(line=>[...line.map(p=>p.text).join('')].length*9*.65);
  if(length.every(x=>x<=320)){strongCase={text,t};break;}
 }catch{}
}
assert.ok(strongCase,'Should prefer 2 rows at reduced font over 3 at larger font');
assert.equal(strongCase.t.count,2);

for(let mm=10;mm<=28;mm++){
 const g=colorGuideGeometry(mm);
 for(const item of [normal,downsized,fallback]){
  // Very narrow gutters can reject an otherwise valid case; only test valid outputs.
  try{
   const v=get(item.text,mm);
   assert.ok(v.count===2||v.count===3);
   assert.ok(v.size>=6);
   assert.ok(v.x.every(x=>x>g.left && x<g.right));
   assert.ok(v.titleBoundsPt.top>=30*72/25.4);
   assert.ok(v.titleBoundsPt.bottom<=181*72/25.4);
   assert.ok(v.count!==3 || !spineRowPreferences(mm===10?8:9).filter(c=>c.rows===2).some(c=>{
    try{
     const r=spineRows(fonts,plain(item.text),c.size,320,2,2);
     const pitch=c.size*1.11;
     const width=((r.length-1)*pitch + c.size*1.15);
     const lens=r.map(line=>[...line.map(p=>p.text).join('')].length*c.size*.65);
     const cal=calibrateColorSpineTitleRows(lens);
     return width<=g.right-g.left-1.1 && cal.safe;
    }catch{return false;}
   }),`Incorrectly used 3 rows at ${mm}mm`);
  }catch(error){if(!/tidak muat/.test(error.message)) throw error;}
 }
}
console.log('PASS V4.12: 2 lines prioritized at all font sizes; 3-line fallback; safety and 19 spine widths');
console.log('Examples:', JSON.stringify({default2:normal.t.size,downsized2:downsized.t.size,fallback3:fallback.t.size}));

// Plain cover must follow the same two-rows-first rule.
const {chooseSpine}=await import('../pdf-engine.js');
const {readFileSync}=await import('node:fs');
const {fileURLToPath}=await import('node:url');
const {join,dirname}=await import('node:path');
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const plainLayouts=JSON.parse(readFileSync(join(root,'assets','layout.json'),'utf8')).templates;
let plainCases=0;
for(let mm=10;mm<=28;mm++){
  for(let n=6;n<=50;n+=4){
    const text=sample(n),layout=plainLayouts[mm];
    try{
      const output=chooseSpine(fonts,plain(text),mm,[],layout);
      assert.ok(output.result.length<=3);
      assert.ok(output.size>=6);
      if(output.result.length===3){
        const maxLen=Math.min(460,2*(layout.spine_title_center_y-54.5),2*(530-layout.spine_title_center_y));
        for(const twoChoice of spineRowPreferences(mm===10?8:9).filter(x=>x.rows===2)){
          assert.throws(()=>{
            const result=spineRows(fonts,plain(text),twoChoice.size,maxLen,2,2);
            // Confirm the real horizontal bound, not just the line lengths.
            const span=(result.length-1)*twoChoice.size*1.13+(0.892-(-0.216))*twoChoice.size;
            if(span>layout.right-layout.left-.30+0.001)throw Error('Spine overflow');
          },undefined,`plain ${mm}mm should NOT choose 3 rows while 2 fit`);
        }
      }
      plainCases++;
    }catch(error){
      if(!/tidak muat|batas fisik/.test(error.message)) throw error;
    }
  }
}
assert.ok(plainCases>100);
console.log(`PASS V4.12: ${plainCases} plain layout selections valid; color + plain use 2 rows if possible`);
