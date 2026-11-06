import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.PDFLib={rgb:(...args)=>args};
const {plainSpineYearLayout}=await import('../pdf-engine.js');
const layout=JSON.parse(fs.readFileSync(new URL('../assets/layout.json',import.meta.url),'utf8')).templates;
let verified=0;
for(let mm=10;mm<=28;mm++){
 const conf=layout[mm];
 const actual=plainSpineYearLayout(mm,conf);
 const expected=mm===10?10.5:mm===11?11:12;
 assert.equal(actual.size,expected,`Font year at ${mm} mm`);
 assert.equal(actual.y,conf.spine_year_y,`Original year position Y at ${mm}mm`);
 assert(actual.x-conf.left>=actual.size*.6+1,`Left margin at ${mm}mm`);
 assert(conf.right-actual.x>=actual.size*.6+1,`Right margin at ${mm}mm`);
 if(mm>=12)assert.equal(actual.x,conf.spine_year_x,`Reference spine year baseline for ${mm}mm`);
 verified++;
}
const engine=fs.readFileSync(new URL('../pdf-engine.js',import.meta.url),'utf8');
assert.match(engine,/\(variant===PLAIN_V1\|\|variant===PLAIN_V11\)\?plainSpineYearLayout\(mm,conf\)/);
assert.match(engine,/\(variant===PLAIN_V1\|\|variant===PLAIN_V11\)\?yearPlacement.size:6/);
console.log(`PASS V4.27: ${verified} calibrated plain V1 spine years: 10.5/11/12pt; safe x margins; original Y retained`);
