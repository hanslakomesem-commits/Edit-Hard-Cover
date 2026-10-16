/* ZAIN.NET V4.6: helper murni OCR zona. Tidak memakai API/token.
 * Semua koordinat relatif terhadap foto yang sudah dinormalisasi orientasinya.
 */
export const COVER_ZONES = Object.freeze([
  {id:'judul', label:'Judul atas', x:0.035, y:0.025, width:0.93, height:0.255},
  {id:'identitas', label:'Nama, jenis dokumen, NIM', x:0.09, y:0.205, width:0.82, height:0.38},
  {id:'kampus', label:'Prodi, fakultas, universitas, tanggal', x:0.035, y:0.705, width:0.93, height:0.29}
]);
export function normalizedLines(text){
  return String(text||'').replace(/\r/gu,'').split('\n').map(s=>s.replace(/[\t\u00a0]+/gu,' ').replace(/\s+/gu,' ').trim()).filter(Boolean);
}
export function zoneBounds(zone,width,height){
  const x=Math.max(0,Math.min(width-1,Math.floor(zone.x*width)));
  const y=Math.max(0,Math.min(height-1,Math.floor(zone.y*height)));
  return {x,y,width:Math.max(1,Math.min(width-x,Math.round(zone.width*width))),height:Math.max(1,Math.min(height-y,Math.round(zone.height*height)))};
}
const TYPE=/^(?:SKRIPSI|TESIS|THESIS|DISERTASI|DISSERTATION|MAKALAH|TUGAS\s+AKHIR|LAPORAN(?:\s+AKHIR)?)$/iu;
const LABEL=/^(?:SKRIPSI|TESIS|THESIS|OLEH|NIM|N\.?I\.?M|FAKULTAS|PRODI|PROGRAM\s+STUDI|UNIVERSITAS|UIN|IAIN|AGUSTUS|JUNI|JULI|202\d)\b/iu;
const AMBIGUOUS = /[|{}<>]/u;
const normalize=s=>String(s||'').replace(/\s+/gu,' ').trim();
function goodTitle(text){
  const cleaned=normalize(text);
  return cleaned.length>20 && cleaned.split(' ').length>=4 && !AMBIGUOUS.test(cleaned);
}
export function titleFromZone(text){
  const lines=normalizedLines(text), candidate=[];
  for (const line of lines){
    const upper=line.toLocaleUpperCase('id-ID');
    if(TYPE.test(upper) || /^(OLEH\s*:?|N\s*\.?I\s*\.?M|NAMA\s*:?)/iu.test(upper)) break;
    if (/^(UNIVERSITAS|FAKULTAS|PROGRAM STUDI|PRODI|UIN\b)/iu.test(upper)) break;
    if (line.length>4 && !/^\d{4}$/u.test(line) && !/^\W+$/u.test(line))candidate.push(line);
  }
  const title=normalize(candidate.join(' '));
  return goodTitle(title)?title:'';
}
export function nimFromZone(text){
  const lines=normalizedLines(text);
  for (let i=0;i<lines.length;i++){
    // Jangan mengganti O→0 atau I→1 tanpa bukti. Semua digit harus hasil OCR asli.
    const line=lines[i];
    const hit=line.match(/\bN\s*\.?\s*[I1]\s*\.?\s*M\s*\.?\s*[:.\-\s]*([0-9][0-9\s.\-]{6,19}[0-9])\b/iu);
    if (hit) return hit[1].replace(/[^0-9]/gu,'');
    if (/^N\s*\.?\s*[I1]\s*\.?\s*M\s*\.?\s*[:.\-]?$/iu.test(line)) {
      const next=(lines[i+1]||'').replace(/[\s.\-]/gu,'');
      if (/^\d{8,16}$/u.test(next))return next;
    }
  }
  return '';
}
export function nameFromZone(text){
  const lines=normalizedLines(text);
  for (let i=0;i<lines.length;i++){
    const line=lines[i];
    const match=line.match(/^OLEH\s*[:.]?\s*(.*)$/iu);
    if (!match)continue;
    let value=(match[1]||'').trim();
    if(!value)value=lines[i+1]||'';
    if (!value || /^(?:NIM|N\.?I\.?M|SKRIPSI|TESIS|THESIS)/iu.test(value))return '';
    return value;
  }
  return '';
}
export function typeFromZone(text){
  return normalizedLines(text).find(line=>TYPE.test(line.toLocaleUpperCase('id-ID')))||'';
}
export function footerFromZone(text){
  const lines=normalizedLines(text);const result={};
  for(let i=0;i<lines.length;i++){
    const v=lines[i];
    for(const [key,regex] of [
      ['prodi',/^(?:PROGRAM\s+STUDI|PRODI|JURUSAN)\s*[:.]?\s*(.*)$/iu],
      ['fakultas',/^FAKULTAS\s*[:.]?\s*(.*)$/iu],
      ['universitas',/^(UNIVERSITAS\s+.+|INSTITUT\s+.+|UIN\s+.+|IAIN\s+.+)$/iu],
    ]){
      const m=v.match(regex);if(!m)continue;
      let val=key==='universitas'?m[1]:m[1]||(lines[i+1]||'');
      val=normalize(val);
      if(val && !LABEL.test(val))result[key]=val;
      else if (key==='universitas')result[key]=val;
    }
    const date=v.match(/\b(?:JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\s+\d{4}\b/iu);
    if(date)result.bulan_tahun=date[0];
    else if(!result.bulan_tahun && /^20\d{2}$/u.test(v))result.bulan_tahun=v;
  }
  return result;
}
export function mergeZones(base,zoneText={},confidences={}){
  const result={...base,warnings:[...(base.warnings||[])]};
  const title=titleFromZone(zoneText.judul), name=nameFromZone(zoneText.identitas);
  const nim=nimFromZone(zoneText.identitas),foot=footerFromZone(zoneText.kampus);
  const zoneValues={judul:title,nama:name,nim,jenis_dokumen:typeFromZone(zoneText.identitas)||typeFromZone(zoneText.judul),...foot};
  let recovered=0;let improvedTitle=false;
  const inconsistent=[];
  for(const [key,value] of Object.entries(zoneValues)){
    if(!value)continue;
    const existing=normalize(result[key]);
    if(!existing){result[key]=value;recovered++;continue;}
    if(existing.toLocaleUpperCase('id-ID')!==normalize(value).toLocaleUpperCase('id-ID')){
      // Jika judul penuh terpotong tetapi 75%+ kata sebelumnya muncul lagi pada zona,
      // zona dapat melengkapinya. Perbedaan tetap wajib ditandai untuk diperiksa.
      if(key==='judul'){
        const a=existing.toLocaleUpperCase('id-ID').split(/\s+/gu).filter(Boolean);
        const b=normalize(value).toLocaleUpperCase('id-ID').split(/\s+/gu).filter(Boolean);
        const found=a.filter(w=>b.includes(w)).length;
        if(a.length>=4 && b.length>=a.length+2 && found/a.length>=.75 && !/\b(?:OLEH|NIM|FAKULTAS|UNIVERSITAS)\b/iu.test(value)){
          result.judul=value;improvedTitle=true;continue;
        }
      }
      inconsistent.push(key);
    }
  }
  if(improvedTitle)result.warnings.push('Judul utama tampak terpotong; diganti dengan pembacaan zona yang lebih lengkap. WAJIB periksa foto asli.');
  if(recovered)result.warnings.push(`${recovered} kolom kosong berhasil diisi dari OCR per zona. Mohon verifikasi.`);
  if(inconsistent.length)result.warnings.push(`Perbedaan pembacaan halaman vs zona (${inconsistent.join(', ')}). Periksa foto asli; aplikasi tidak menebak versi mana yang benar.`);
  const confidence=Number(confidences.full);
  if(Number.isFinite(confidence) && confidence>=0 && confidence<60)result.warnings.push(`OCR halaman memiliki tingkat keyakinan rendah (${Math.round(confidence)}%). Periksa setiap huruf.`);
  result.title_segments=result.judul?[{text:result.judul,italic:false}]:[];
  // Jangan melakukan normalisasi NIM berdasar jumlah digit kampus karena bisa mengubah data.
  return result;
}
