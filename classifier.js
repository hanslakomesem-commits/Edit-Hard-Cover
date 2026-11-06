/** Deterministic local fields extraction; review fields before production. */
function compact(str){return String(str??'').replace(/\s+/gu,' ').trim();}
const TYPES=/^(SKRIPSI|TESIS|THESIS|DISERTASI|DISSERTATION|MAKALAH|LAPORAN(?:\s+(?:AKHIR|PENELITIAN|MAGANG))?|TUGAS AKHIR|KARYA TULIS ILMIAH|PROPOSAL(?:\s+PENELITIAN)?)$/iu;
const MONTHS='JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER|JANUARY|FEBRUARY|MARCH|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER';
/** Only expand the confirmed alias for the university in this project. */
export function canonicalUniversity(input){
 const value=compact(input);
 if(/^U\s*\.?I\s*\.?N\s*\.?\s*MADURA\s*\.?$/iu.test(value) || /^UIN\s*[-–]\s*MADURA$/iu.test(value)) return 'UNIVERSITAS ISLAM NEGERI MADURA';
 return value;
}
/** V4.30: avoid truncating multi-line college names; no guessed institution tokens. */
export function isInstitutionLine(value){return /^(?:UNIVERSITAS|INSTITUT|SEKOLAH\s+TINGGI|POLITEKNIK|UIN|IAIN|STAIN|STAI)\b/iu.test(compact(value));}
export function institutionLooksIncomplete(value){
 const v=compact(value);
 return /\b(?:STAI|STAIN|STIT|STIE|STIKES|IAIN)\s*[).]?$/iu.test(v)||
        /^(?:SEKOLAH\s+TINGGI\s+AGAMA\s+ISLAM|SEKOLAH\s+TINGGI\s+ILMU\s+|UNIVERSITAS\s+ISLAM|INSTITUT\s+AGAMA\s+ISLAM)\s*$/iu.test(v);
}
const CITY_LINE=/^(?:KOTA\s+|KABUPATEN\s+)?[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ' .-]{2,48}$/u;
const CITY_DENY=/\b(?:TAHUN|PROGRAM|STUDI|FAKULTAS|NIM|NPM|SKRIPSI|JURUSAN|SEKOLAH|UNIVERSITAS|INSTITUT|DOSEN|PEMBIMBING|OLEH)\b/iu;
const YEAR=/^(?:(?:JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\s+)?(?:19|20)\d{2}$/iu;
export function isPlausibleCampusCity(s){const v=compact(s);return CITY_LINE.test(v.toLocaleUpperCase('id-ID'))&&!CITY_DENY.test(v)&&!YEAR.test(v)&&v.length<=40;}
function institutionTail(s){
 const v=compact(s);
 if (!v||v.length>48||v.split(/\s+/u).length>6||!isPlausibleCampusCity(v)) return false;
 return /^(?:AL[-\s]|AS[-\s]|AN[-\s]|NUR\b|MUHAMMADIYAH\b|DARUL\b|MA\b|MAMBAUL\b|HIDAYAT\b|SYARIF\b)/iu.test(v);
}
export function campusIdentity(lines){
 const txt=lines.map(compact).filter(Boolean);
 const found=[];
 for(let i=0;i<txt.length;i++){
  if(!isInstitutionLine(txt[i]))continue;
  let val=txt[i],next=i+1;
  if(institutionLooksIncomplete(val)&&next<txt.length&&institutionTail(txt[next])){val+=' '+txt[next];next++;}
  const city=next<txt.length&&isPlausibleCampusCity(txt[next])&&!institutionTail(txt[next])?txt[next]:'';
  const score=(val.split(/\s+/u).length*2)+(institutionLooksIncomplete(val)?-12:12)+(city?3:0);
  found.push({universitas:canonicalUniversity(val),kota:city,score,index:i});
 }
 found.sort((a,b)=>b.score-a.score||b.index-a.index);
 return found[0]||{universitas:'',kota:'',score:-100,index:-1};
}
export function categorize(lines, hints=[]){
 const txt=lines.map(compact).filter(Boolean), warnings=[...hints];
 const upper=txt.map(x=>x.toLocaleUpperCase('id-ID'));
 const findIndex=(re)=>upper.findIndex(s=>re.test(s));
 const getAfter=(index,re)=>{if(index<0)return '';const str=txt[index].replace(re,'').trim().replace(/^[:.\-–\s]+/u,'');return str||txt[index+1]||'';};
 const kindIndex=findIndex(TYPES);const kind=kindIndex>=0?txt[kindIndex]:'';
 const nimIndex=findIndex(/\bN\s*\.?\s*(?:I|P)\s*\.?\s*M\s*\.?\s*[:.\s-]*\d{6,20}/iu);
 let nim='';if(nimIndex>=0)nim=(upper[nimIndex].match(/\bN\s*\.?\s*(?:I|P)\s*\.?\s*M\s*\.?\s*[:.\s-]*(\d{6,20})/iu)||[])[1]||'';
 if(!nim){
  const label=upper.findIndex(t=>/^(?:N\s*\.?\s*I\s*\.?\s*M\s*\.?|NO\.?\s*INDUK)(?:\s*[:.]\s*)?$/iu.test(t));
  if(label>=0)nim=(upper[label+1]||'').match(/^\d{6,20}$/u)?.[0]||'';
 }
 const olehIndex=findIndex(/^(?:OLEH\s*:?|OLEH\s+.+)$/u);
 let nama=olehIndex>=0?getAfter(olehIndex,/^OLEH\s*:?\s*/iu):'';
 if(nama&&/^(NIM|NAMA|SKRIPSI|TESIS)/iu.test(nama))nama='';
 if(!nama){const namaIndex=findIndex(/^NAMA\s*[:.]/u);if(namaIndex>=0)nama=getAfter(namaIndex,/^NAMA\s*[:.]\s*/iu);}
 const prodiIndex=findIndex(/^(?:PROGRAM\s+STUDI|PRODI|JURUSAN)\b/iu);
 const fakultasIndex=findIndex(/^FAKULTAS\b/iu);

 const prodi=getAfter(prodiIndex,/^(?:PROGRAM\s+STUDI|PRODI|JURUSAN)\s*:?\s*/iu);
 const fakultas=getAfter(fakultasIndex,/^FAKULTAS\s*:?\s*/iu);
 // Prefer complete institution text in the bottom block, including continued lines.
 const campus=campusIdentity(txt),universitas=campus.universitas,kota=campus.kota;
 if(institutionLooksIncomplete(universitas))warnings.push('Nama kampus mungkin terpotong. Bandingkan baris kampus dengan tulisan pada logo.');
 let date='';for(let i=upper.length-1;i>=0;i--){if(new RegExp(`^(?:${MONTHS})\\s+\\d{4}$|^\\d{4}$`,'iu').test(upper[i])){date=txt[i];break;}}
 let titleCandidates=txt.slice(0,kindIndex>=0?kindIndex:Math.min(5,txt.length));
 if(!titleCandidates.length && kindIndex===0){
  const nextKind=upper.findIndex((t,i)=>i>0&&TYPES.test(t));
  if(nextKind>1)titleCandidates=txt.slice(1,nextKind);
 }
 titleCandidates=titleCandidates.filter(s=> !/^UNIVERSITAS|^UIN |^KEMENTERIAN |^OLEH\b/iu.test(s));
 const judul=compact(titleCandidates.join(' '));
 const missing=[['judul',judul],['nama',nama],['nim',nim],['prodi',prodi],['universitas',universitas],['jenis_dokumen',kind],['bulan_tahun',date]].filter(([,v])=>!v).map(([k])=>k);
 if(missing.length)warnings.push('Periksa kolom belum terdeteksi: '+missing.join(', ')+'. Ekstraksi lokal tidak menebak isinya.');
 warnings.push('Teks PDF/Word dibaca tanpa Gemini. Periksa italic dan ejaan pada editor sebelum ekspor.');
 return {judul,nama,nim,prodi,fakultas,universitas,kota,jenis_dokumen:kind,bulan_tahun:date,bulan:(date.match(new RegExp(MONTHS,'iu'))||[])[0]||'',tahun:(date.match(/\d{4}/u)||[])[0]||'',title_segments:judul?[{text:judul,italic:false}]:[],warnings};
}
