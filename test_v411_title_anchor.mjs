import assert from 'node:assert/strict';
import {calibrateColorSpineTitleRows,COLOR_SPINE_TITLE_CENTER_TOP_PT,
 COLOR_SPINE_TITLE_SAFE_TOP_PT,COLOR_SPINE_TITLE_SAFE_BOTTOM_PT} from '../pdf-engine.js';
import {colorGuideGeometry,mmPoint} from '../guide-geometry.js';
import {withinSpine} from '../color-spine-profile.js';

assert.equal(COLOR_SPINE_TITLE_CENTER_TOP_PT,295.0);
// Long title that would be shifted to the TOP crop marks by V4.10.
for(const widths of [[345,321,234],[300,200],[122],[310,289,240]]){
 const p=calibrateColorSpineTitleRows(widths);
 assert.equal(p.safe,true);
 assert.ok(p.topPt.every((top,i)=>Math.abs((top+p.bottomPt[i])/2-295)<1e-9));
 assert.ok(p.topPt.every(t=>t>=COLOR_SPINE_TITLE_SAFE_TOP_PT));
 assert.ok(p.bottomPt.every(t=>t<=COLOR_SPINE_TITLE_SAFE_BOTTOM_PT));
 assert.ok(Math.abs(p.topPt[0]-(295-widths[0]/2))<1e-9);
 if(widths[0]>=300){
   // The old bug yields 295-width, which hits/approaches top guides.
   const oldStart=295-widths[0];
   assert.ok(oldStart<COLOR_SPINE_TITLE_SAFE_TOP_PT);
 }
}
assert.equal(calibrateColorSpineTitleRows([510]).safe,false);
assert.throws(()=>calibrateColorSpineTitleRows([0,10]));
assert.throws(()=>calibrateColorSpineTitleRows([90,90,90,90]));
for(let mm=10;mm<=28;mm++){
 const g=colorGuideGeometry(mm);
 const count=mm<13?2:3;
 const size=mm===10?6:9;
 if(!withinSpine(size,count,g.right-g.left,1.1)) continue;
 const pitch=size*1.11;
 const x=Array.from({length:count},(_,i)=>g.center+(count-1)*pitch/2-i*pitch);
 assert.ok(x.every(v=>v>g.left&&v<g.right),`Guide collision on ${mm} mm`);
 const y=calibrateColorSpineTitleRows(Array.from({length:count},()=>310));
 assert.ok(y.safe);
 assert.ok(y.centerTopPt.every(v=>v===295));
}
console.log('PASS V4.11: corrected title center; vertical safety bounds; 10-28 mm widths');
