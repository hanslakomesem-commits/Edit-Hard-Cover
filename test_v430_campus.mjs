import assert from 'node:assert/strict';
import {categorize,campusIdentity,institutionLooksIncomplete} from '../classifier.js';
import {footerFromZone,mergeZones} from '../ocr-zones.js';
const title='PENDEKATAN PEDAGOGIS GURU DALAM MENANGANI PERILAKU TANTRUM PADA ANAK USIA DINI DI RA AS SAKINAH';
const head=[title,'SKRIPSI','OLEH:','DINIA NAILUL FARAH','NIM: 20215935021','PROGRAM STUDI PENDIDIKAN ISLAM ANAK USIA DINI'];
const end=['PAMEKASAN','2026'];
for(let i=0;i<200;i++){
 const split=i%2===0;
 const middle=split?['SEKOLAH TINGGI AGAMA ISLAM (STAI)','AL MUJTAMA']:['SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA'];
 const data=categorize([...head,...middle,...end]);
 assert.equal(data.universitas,'SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA');
 assert.equal(data.kota,'PAMEKASAN');
 assert.equal(data.fakultas,'');
 assert.equal(data.jenis_dokumen,'SKRIPSI');
}
const incomplete=categorize([...head,'SEKOLAH TINGGI AGAMA ISLAM (STAI)',...end]);
assert.equal(incomplete.universitas,'SEKOLAH TINGGI AGAMA ISLAM (STAI)');
assert.ok(institutionLooksIncomplete(incomplete.universitas));
const repaired=mergeZones(incomplete,{kampus:'PROGRAM STUDI PENDIDIKAN ISLAM ANAK USIA DINI\nSEKOLAH TINGGI AGAMA ISLAM (STAI)\nAL MUJTAMA\nPAMEKASAN\n2026',logo:'AL MUJTAMA PAMEKASAN'});
assert.equal(repaired.universitas,'SEKOLAH TINGGI AGAMA ISLAM (STAI) AL MUJTAMA');
assert.equal(repaired.kota,'PAMEKASAN');
const normal=categorize([...head,'UNIVERSITAS ISLAM NEGERI MADURA','2026']);
assert.equal(normal.kota,'');
const other=categorize([...head,'UNIVERSITAS MADURA','PAMEKASAN','2026']);
assert.equal(other.universitas,'UNIVERSITAS MADURA');assert.equal(other.kota,'PAMEKASAN');
console.log('PASS V4.30: 200 synthetic cover line variants, optional city, STAI continuation and zone rescue');
