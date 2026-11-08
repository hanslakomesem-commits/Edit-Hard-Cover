import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plain215MarkCleanupGeometry,plain215TrimGeometry} from '../pdf-engine.js';
import {PLAIN_215_VARIANTS,PLAIN_V1,PLAIN_V2} from '../plain-variant-layout.js';

const source=readFileSync(new URL('../pdf-engine.js',import.meta.url),'utf8');
const start=source.indexOf('async function adjustPlain215Trim(bytes,mm,conf){');
const end=source.indexOf('\nconst COLOR_TYPES=',start);
assert(start>=0 && end>start);
const makeFn=new Function('PDFDocument','plain215MarkCleanupGeometry','rgb',`return (${source.slice(start,end).trim().replace(/^async function adjustPlain215Trim/,'async function adjustPlain215Trim')});`);
const mmPt=n=>n*72/25.4;
const pageHeight=mmPt(330),pageWidth=mmPt(480);
const c=JSON.parse(readFileSync(new URL('../assets/layout.json',import.meta.url),'utf8')).templates;
assert.deepEqual(PLAIN_215_VARIANTS,['polosv11','polosv22']);
assert(!PLAIN_215_VARIANTS.includes(PLAIN_V1));
assert(!PLAIN_215_VARIANTS.includes(PLAIN_V2));
let nCases=0;
for(let mm=10;mm<=28;mm++){
 const calls={rect:[],line:[]};
 const page={getHeight:()=>pageHeight,getWidth:()=>pageWidth,
    drawRectangle:d=>calls.rect.push(d),drawLine:d=>calls.line.push(d)};
 const PDFDocument={load:async()=>({getPage:()=>page,save:async()=>new Uint8Array([37,80,68,70])})};
 const adjust=makeFn(PDFDocument,plain215MarkCleanupGeometry,(...x)=>({r:x[0],g:x[1],b:x[2]}));
 const out=await adjust(new Uint8Array([1]),mm,c[mm]);
 const g=plain215TrimGeometry(mm,c[mm]),p=plain215MarkCleanupGeometry(mm,c[mm]);
 assert.equal(out.geometry.newRight,g.newRight);
 assert.equal(calls.line.length,8,'4 outer vertical + 4 horizontal strokes');
 assert.equal(calls.rect.length,10,'2 old outer ticks + 4 center marks + 4 old horizontal masks');
 for(const x of [p.centerBack,p.centerFront]){
  const markErase=calls.rect.filter(r=>Math.abs(r.x+r.width/2-x)<.01);
  assert.equal(markErase.length,2,`both top/bottom center masks at ${mm}mm`);
  for(const r of markErase){assert.equal(r.width,5);assert.ok(r.height>=38);}
 }
 assert.ok(calls.rect.every(r=>Math.abs(r.x+r.width/2-g.foldLeft)>2.5 && Math.abs(r.x+r.width/2-g.foldRight)>2.5),
  'do not erase fold guides');
 for(const x of [g.newLeft,g.newRight]){
  assert.equal(calls.line.filter(l=>l.start.x===x && l.end.x===x).length,2,'2 new short vertical ticks');
 }
 assert.equal(calls.line.filter(l=>l.start.x===g.newRight && l.end.x>g.newRight).length,2,
  'right horizontals align exactly with 215mm trim mark');
 assert.equal(calls.line.filter(l=>l.end.x===g.newLeft && l.start.x<g.newLeft).length,2,
  'left horizontals align exactly with 215mm trim mark');
 assert.ok(Math.abs((g.newRight-g.foldRight)/mmPt(1)-215)<1e-9);
 assert.ok(Math.abs((g.foldLeft-g.newLeft)/mmPt(1)-215)<1e-9);
 nCases++;
}
assert.match(source,/if\(PLAIN_215_VARIANTS.includes\(c.type\)\)\{/);
console.log(`PASS V4.35: ${nCases} ketebalan x 2 pilihan: no middle ticks (4 masks), horizontals aligned 215mm, real folds preserved`);
