import assert from 'node:assert/strict';
import {COLOR_THREE_LINE_REFS,threeLineReferenceStatus,withinSpine} from '../color-spine-profile.js';
import {colorGuideGeometry,mmPoint} from '../guide-geometry.js';
assert.equal(COLOR_THREE_LINE_REFS.length,19);
assert.deepEqual(COLOR_THREE_LINE_REFS.map(x=>x.mm),Array.from({length:19},(_,i)=>i+10));
assert.equal(threeLineReferenceStatus(25).sourcePage,1);
assert.equal(threeLineReferenceStatus(26).sourcePage,2);
assert.equal(threeLineReferenceStatus(25).source,'25-26 mm(1).pdf');
assert.equal(threeLineReferenceStatus(10).sampleFontPt,6);
assert.equal(threeLineReferenceStatus(12).sampleFontPt,7);
assert.equal(threeLineReferenceStatus(26).sampleFontPt,9);
for(let mm=10;mm<=28;mm++){
 const r=threeLineReferenceStatus(mm),g=colorGuideGeometry(mm);
 assert.equal(r.referenceAvailable,true);assert.equal(r.referencePage,mm-9);
 assert.equal(r.frontLayout,'PILIHAN WARNA.pdf');
 assert.equal(r.paper,'475 × 320 mm');
 assert.ok(Math.abs((g.right-g.left)/mmPoint(1)-mm)<1e-5);
 assert.equal(g.guidesLeft.length,4);assert.equal(g.guidesRight.length,4);
}
assert.equal(colorGuideGeometry(28).leftmostMarkClipped,true);
assert.equal(withinSpine(6,3,mmPoint(10)),true);
assert.equal(withinSpine(9,3,mmPoint(10)),false);
console.log('PASS V4.8: all 19 color three-line sizes; 25/26 supplied; front fixed; 28mm guard');
