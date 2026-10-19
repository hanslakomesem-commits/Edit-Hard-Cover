import assert from 'node:assert/strict';
import {readAbstractFromFile} from '../abstract-reader.js';
const xml=`<w:document><w:body><w:p><w:r><w:t>ABSTRAK</w:t></w:r></w:p><w:p><w:r><w:t>Paragraf pertama penelitian ini menjelaskan metode dan pengujian yang digunakan oleh penulis.</w:t></w:r></w:p><w:p><w:r><w:t>Paragraf kedua penelitian ini menjelaskan temuan dan pembahasan yang diperoleh.</w:t></w:r></w:p><w:p><w:r><w:t>Paragraf ketiga penelitian ini berisi kesimpulan dan saran untuk penelitian selanjutnya.</w:t></w:r></w:p><w:p><w:r><w:t>Kata kunci</w:t></w:r></w:p><w:p><w:r><w:t>HALAMAN LAIN</w:t></w:r></w:p></w:body></w:document>`;
globalThis.JSZip={loadAsync:async()=>({file:()=>({async:async()=>xml})})};
const file={name:'abstrak.docx',arrayBuffer:async()=>new Uint8Array([3,2,1]).buffer};
const obj=await readAbstractFromFile(file);
assert.equal(obj.paragraphs.length,3);
assert.equal(obj.paragraphs.at(-1).startsWith('Paragraf ketiga'),true);
const pdfItems=[
 {str:'ABSTRAK',transform:[1,0,0,1,200,700]},
 {str:'Paragraf pertama penelitian ini menjelaskan tentang',transform:[1,0,0,1,145,660]},
 {str:'pengumpulan data, metode, dan hasil pengamatan.',transform:[1,0,0,1,145,644]},
 {str:'Paragraf kedua penelitian ini menyajikan temuan',transform:[1,0,0,1,145,600]},
 {str:'dan kesimpulan serta saran bagi peneliti berikutnya.',transform:[1,0,0,1,145,584]},
 {str:'KATA KUNCI',transform:[1,0,0,1,145,530]}
];
const state={pages:0,destroyed:false};
globalThis.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async(i)=>{state.pages++;return{getTextContent:async()=>({items:i===1?[]:pdfItems})};},destroy:async()=>{state.destroyed=true;}})})};
const pdf=await readAbstractFromFile({name:'skripsi.pdf',arrayBuffer:async()=>new Uint8Array([1]).buffer});
assert.equal(pdf.paragraphs.length,2);
assert.equal(state.pages,2);
assert.equal(state.destroyed,true);
console.log('PASS V4.19: DOCX paragraph extraction, PDF heading scan, keyword stop and resource cleanup');
