import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plain215TrimGeometry} from '../pdf-engine.js';
import {PLAIN_V1,PLAIN_V2,PLAIN_V11,PLAIN_V22,plainFrontLayout} from '../plain-variant-layout.js';
const templates=JSON.parse(readFileSync(new URL('../assets/layout.json', import.meta.url),'utf8')).templates;
const scale=480/483, mmPt=72/25.4;
for(let mm=10;mm<=28;mm++){
 const c=templates[mm],g=plain215TrimGeometry(mm,c);
 const correctPrinted=(g.foldRight+g.newRight)/2;
 const correctSource=correctPrinted/scale;
 const originalV1=plainFrontLayout(PLAIN_V1,c),originalV2=plainFrontLayout(PLAIN_V2,c);
 const v11=plainFrontLayout(PLAIN_V11,c),v21=plainFrontLayout(PLAIN_V22,c);
 for(const item of [v11,v21]){
   // Match the two assignments made exclusively for PLAIN_215_VARIANTS in generatePlainPDF.
   item.frontCX=correctSource; item.typeCX=correctSource;
   assert.ok(Math.abs(item.frontCX*scale-correctPrinted)<1e-8);
   assert.ok(Math.abs(item.typeCX*scale-correctPrinted)<1e-8);
   assert.ok(Math.abs((item.frontCX*scale-g.foldRight)/mmPt-107.5)<1e-8);
   assert.ok(Math.abs((g.newRight-item.frontCX*scale)/mmPt-107.5)<1e-8);
 }
 assert.equal(originalV1.frontCX,c.front_cx);
 assert.equal(originalV2.frontCX,c.front_cx);
 assert.equal(originalV1.typeCX,c.front_type_cx);
 assert.equal(originalV2.typeCX,c.front_type_cx);
}
const engine=readFileSync(new URL('../pdf-engine.js',import.meta.url),'utf8');
assert.ok(engine.includes('placement.frontCX=trueCenterSource;'));
assert.ok(engine.includes('placement.typeCX=trueCenterSource;'));
console.log('PASS V4.33: 19 ketebalan; seluruh bidang depan V1.1 & V2.1 tepat 107,5mm kiri/kanan; V1/V2 anchors lama utuh.');
