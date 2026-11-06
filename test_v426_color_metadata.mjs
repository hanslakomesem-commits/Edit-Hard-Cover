import assert from 'node:assert/strict';
import {colorGuideGeometry} from '../guide-geometry.js';
// Lightweight environment: geometry test does not need external CDN/PDF fonts.
globalThis.PDFLib={rgb:(...x)=>x};
const {colorSpineMetadataLanes}=await import('../pdf-engine.js');
let passed=0;
for(let mm=10;mm<=28;mm++){
  const result=colorSpineMetadataLanes(mm);
  const g=colorGuideGeometry(mm);
  assert(result.nameX<result.typeX,`Order lanes ${mm}`);
  assert(result.gapPt>=1.5*72/25.4-0.00001,`Gap ${mm}`);
  assert(result.leftPrinted>=g.left+result.marginPt-0.00001,`Left safe ${mm}`);
  assert(result.rightPrinted<=g.right-result.marginPt+0.00001,`Right safe ${mm}`);
  assert(result.size>=6 && result.size<=9,`Font ${mm}`);
  if(mm>=13)assert.equal(result.size,9,`Wide color spine default 9 pt at ${mm}`);
  passed++;
}
const b=colorSpineMetadataLanes(23);
assert(b.gapPt>4.25 && b.pitch>8.9);
console.log(`PASS V4.26: ${passed} spine widths; ≥1.5 mm metadata clearance and safe-fold margins`);
