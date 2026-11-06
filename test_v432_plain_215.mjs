import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plain215TrimGeometry,coverTypes,printSizes,validateCoverMode} from '../pdf-engine.js';
import {PLAIN_V1,PLAIN_V2,PLAIN_V11,PLAIN_V22,plainFrontLayout} from '../plain-variant-layout.js';
const layout=JSON.parse(readFileSync(new URL('../assets/layout.json', import.meta.url),'utf8')).templates;
for(const mm of Array.from({length:19},(_,i)=>i+10)){
 const c=layout[mm],g=plain215TrimGeometry(mm,c);
 assert.ok(Math.abs(g.leftPanelMM-215)<1e-9 && Math.abs(g.rightPanelMM-215)<1e-9);
 assert.ok(g.newLeft>g.originalLeft && g.newRight<g.originalRight);
 for(const v of [PLAIN_V1,PLAIN_V2,PLAIN_V11,PLAIN_V22]){
  assert.ok(coverTypes.includes(v));
  assert.deepEqual(printSizes[v],{width:480,height:330});
  assert.equal(validateCoverMode(v).type,v);
  assert.ok(plainFrontLayout(v,c).frontCX);
 }
 const same1=plainFrontLayout(PLAIN_V1,c),new1=plainFrontLayout(PLAIN_V11,c);
 const same2=plainFrontLayout(PLAIN_V2,c),new2=plainFrontLayout(PLAIN_V22,c);
 assert.equal(same1.titleY,new1.titleY);assert.equal(same2.titleY,new2.titleY);
}
console.log('PASS: 19 ketebalan x 2 varian baru; V1/V2 tidak berubah dalam pemilihan layout');
