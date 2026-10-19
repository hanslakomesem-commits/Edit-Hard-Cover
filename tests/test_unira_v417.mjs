import assert from 'node:assert/strict';
// Import without network: this tests pure geometry + selection logic, not live PDF rendering.
globalThis.PDFLib={PDFDocument:{},StandardFonts:{},degrees:n=>n,rgb:(r,g,b)=>({r,g,b})};
const {uniraSpineGeometry,UNIRA_REFERENCE,validateCoverMode,colorSpinePreferences,printSizes,coverTypes}=await import('../pdf-engine.js');
assert.equal(printSizes.unira.width,484);
assert.equal(printSizes.unira.height,330);
assert.equal(validateCoverMode('unira').type,'unira');
assert.equal(coverTypes.includes('unira'),true);
const mmToPt=72/25.4;
for(let mm=10;mm<=28;mm++){
 const g=uniraSpineGeometry(mm);
 assert.equal(g.mm,mm);
 assert.ok(Math.abs(g.observedMm-mm)<0.05,`width ${mm} mm actual ${g.observedMm}`);
 assert.ok(g.leftGuides[0]>0 && g.rightGuides.at(-1)<UNIRA_REFERENCE.pageWidthPt);
 assert.ok(Math.abs(g.left-(UNIRA_REFERENCE.leftGuides.at(-1)-(mm-10)*mmToPt))<1e-6);
 assert.equal(g.right,UNIRA_REFERENCE.rightGuides[0]);
 assert.ok(g.left<g.center&&g.center<g.right);
}
const prefs10=colorSpinePreferences(10,8,6);
assert.deepEqual(prefs10[0],{rows:2,size:8});
const prefs23=colorSpinePreferences(23,9,6);
assert.deepEqual(prefs23.slice(0,2),[{rows:2,size:9},{rows:3,size:9}]);
console.log('PASS UNIRA: 19 spine sizes 10–28mm, front-side fixed, left marks shift, NPM mode, row-size policies');
