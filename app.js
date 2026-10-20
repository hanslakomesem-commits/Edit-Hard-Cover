import {readPDF,readWord,readPhoto,withTimeout,setOCRProgress} from './document-reader.js';
import {resetOCR} from './ocr-fast.js';
import {generatePDF,checkAssets,setUserFonts} from './pdf-engine.js?v=4.25';
import {canonicalUniversity} from './classifier.js';
import {readAbstractFromFile,isAbstractMetadata} from './abstract-reader.js';
import {chooseDummyBackText,DUMMY_PAGE} from './dummybook-layout.js';
import {setDummyArialFonts} from './font-arial-compatible.js';
import {DUMMY_SIZES} from './dummybook-layout.js';
import {IPS_SIZES} from './soft-ips-layout.js';

'use strict';
// V4.25: unggahan otomatis diproses + status yang tidak menggantung; semua input lokal tanpa API.
const $ = id => document.getElementById(id);
const FIELDS=['nama','nim','prodi','fakultas','universitas','jenis_dokumen','bulan_tahun'];
const REQUIRED=['judul',...FIELDS];
const COVER_TYPES=['polos','poloslogoatas','merah','maroon','custom','unira','dummybook','softips','covercd'];
const sizesForStyle=style=>style==='covercd'?[]:style==='dummybook'?DUMMY_SIZES:style==='softips'?IPS_SIZES:availableMM;
const validThickness=o=>o?.style==='covercd'||(sizesForStyle(o?.style).includes(Number(o?.thickness))&&o.thickness!==null);
const unsafeProduction=o=>o&&['merah','maroon','custom'].includes(o.style)&&o.thickness===28;
const isPdf=f=>!!f&&(/\.pdf$/iu.test(f.name)||f.type==='application/pdf');
const isWord=f=>!!f&&/\.docx$/iu.test(f.name);
const isPhoto=f=>!!f&&(['image/jpeg','image/png','image/webp'].includes(f.type)||/\.(jpg|jpeg|png|webp)$/iu.test(f.name));
const isAccepted=f=>isPhoto(f)||isPdf(f)||isWord(f);
const MAX_ORDERS=40, MAX_IMAGE_SIZE=25*1024*1024, MAX_TOTAL_SIZE=200*1024*1024;
const SAMPLE={judul:'KEMASLAHATAN DALAM SISTEM BAGI HASIL NELAYAN DI DESA BRANTA PESISIR KECAMATAN TLANAKAN KABUPATEN PAMEKASAN',nama:'SERLI ISTIQLALIA WAHDANIYAH',nim:'22383032023',prodi:'EKONOMI SYARIAH',fakultas:'EKONOMI DAN BISNIS ISLAM',universitas:'UNIVERSITAS ISLAM NEGERI MADURA',jenis_dokumen:'SKRIPSI',bulan_tahun:'AGUSTUS 2026',title_segments:[{text:'KEMASLAHATAN DALAM SISTEM BAGI HASIL NELAYAN DI DESA BRANTA PESISIR KECAMATAN TLANAKAN KABUPATEN PAMEKASAN',italic:false}]};
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let orders=[],nextId=1,activeId=null,availableMM=Array.from({length:19},(_,i)=>i+10);
let pdfURL=null,painting=false,ocrBatchRunning=false,zipRunning=false;
let autoReadTimer=null,autoReadPending=false;
let pendingName='COVER.pdf';
const downloadURLs={single:null,batch:null};
function releaseDownload(which){
 const area=$(which==='single'?'singleDownloadArea':'batchDownloadArea');
 const link=$(which==='single'?'singleDownloadLink':'batchDownloadLink');
 if(downloadURLs[which]){URL.revokeObjectURL(downloadURLs[which]);downloadURLs[which]=null;}
 link.removeAttribute('href');area.classList.add('hidden');
}
function offerDownload(blob,name,which){
 releaseDownload(which);
 const url=URL.createObjectURL(blob);downloadURLs[which]=url;
 const link=$(which==='single'?'singleDownloadLink':'batchDownloadLink');
 link.href=url;link.download=name;
 link.textContent=`↓ Download ${name}`;
 $(which==='single'?'singleDownloadArea':'batchDownloadArea').classList.remove('hidden');
 if(which==='batch')$('batchDownloadMessage').textContent=`Berkas ${name} sudah siap.`;
 return link;
}
function active(){return orders.find(o=>o.id===activeId)||null;}
function newData(){return {judul:'',title_segments:[],nama:'',nim:'',prodi:'',fakultas:'',universitas:'',jenis_dokumen:'',bulan_tahun:'',abstract_text:''};}
function notice(message,type='info'){
 const n=$('notice');n.textContent=message;n.className='notice '+type;
 const near=$('batchFeedback');
 if(near && type==='error') {near.textContent=message;near.classList.remove('hidden');near.classList.add('error');}
 if(near && type==='success'){near.textContent='';near.classList.add('hidden');near.classList.remove('error');}
}
function step(n){document.querySelectorAll('.stepper span').forEach(e=>e.classList.toggle('active',Number(e.dataset.step)===n));}
function progress(msg){$('batchProgress').classList.remove('hidden');$('batchProgress').textContent=msg;}
function clearProgress(){$('batchProgress').classList.add('hidden');}
function errorMessage(error){if(error?.detail?.errors?.length)return error.detail.errors.join('; ');if(typeof error?.detail==='string')return error.detail;return error?.message||'Terjadi kesalahan.';}
async function jsonError(response){const payload=await response.json().catch(()=>({detail:{errors:[`HTTP ${response.status}`]}}));return new Error(errorMessage(payload));}
function btnBusy(button,busy,message='Memproses...'){
  if(busy){button.dataset.originalText ??=button.textContent;button.textContent=message;button.disabled=true;}
  else{button.textContent=button.dataset.originalText||button.textContent;button.disabled=false;}
}
function safeName(value){return String(value||'MAHASISWA').toLocaleUpperCase('id-ID').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,45)||'MAHASISWA';}
const isCoverCD=o=>o?.style==='covercd';
const coverDescriptor=o=>isCoverCD(o)?'COVER CD 137 × 137 mm':`${String(o.style).toUpperCase()} ${o.thickness} mm`;
const coverFileName=o=>`${String(orderNumber(o)).padStart(2,'0')}_${safeName(o.data.nama)}_${o.style.toUpperCase()}${isCoverCD(o)?'':`_${o.thickness}MM`}.pdf`;

// Debounce agar banyak foto/PDF/DOCX yang dipilih bersama dibaca sebagai satu antrean.
function scheduleAutoRead(){
  if(autoReadTimer!==null)clearTimeout(autoReadTimer);
  autoReadTimer=setTimeout(()=>{
    autoReadTimer=null;
    if(ocrBatchRunning){autoReadPending=true;return;}
    void readAll({automatic:true});
  },150);
}
function processingHint(order){
  return isPdf(order?.file)?'PDF halaman 1':isWord(order?.file)?'Word DOCX cover':isPhoto(order?.file)?'Foto OCR lokal':'berkas';
}
function addOrders(files){
  const list=Array.from(files||[]);if(!list.length)return;
  releaseDownload('batch');
  let added=0,rejected=[];
  for(const file of list){
    if(orders.length>=MAX_ORDERS){rejected.push(`${file.name}: maksimal ${MAX_ORDERS} pesanan`);continue;}
    if(!isAccepted(file)){rejected.push(`${file.name}: format tidak didukung`);continue;}
    if(file.size>MAX_IMAGE_SIZE){rejected.push(`${file.name}: lebih dari 25 MB`);continue;}
    if(orders.reduce((n,o)=>n+(o.file?.size||0),0)+file.size>MAX_TOTAL_SIZE){rejected.push(`${file.name}: total unggahan melebihi 200 MB`);continue;}
    const order={id:nextId++,file,imageURL:isPhoto(file)?URL.createObjectURL(file):null,data:newData(),thickness:null,style:'polos',custom_color:'#1458A8',status:'baru',verified:false,warnings:[],revision:0,pdfBlob:null};
    orders.push(order);added++;
    if(activeId===null)activeId=order.id;
  }
  if(added){selectOrder(activeId,false);step(1);}
  if(rejected.length)notice(`${added} berkas ditambahkan. ${rejected.length} tidak dimasukkan:\n${rejected.slice(0,5).join('\n')}`,'error');
  else notice(`${added} berkas diterima dan otomatis akan mulai dibaca. Tidak perlu menekan tombol Baca Semua.`,'success');
  renderOrders();
  if(added){
    progress(`Menyiapkan pembacaan otomatis ${orders.filter(o=>o.file&&o.status==='baru').length} berkas…`);
    scheduleAutoRead();
  }
}
function addManual(){
  releaseDownload('batch');
  if(orders.length>=MAX_ORDERS)return notice(`Maksimal ${MAX_ORDERS} pesanan.`,'error');
  const order={id:nextId++,file:null,imageURL:null,data:newData(),thickness:null,style:'polos',custom_color:'#1458A8',status:'periksa',verified:false,warnings:[],revision:0,pdfBlob:null};
  orders.push(order);selectOrder(order.id);renderOrders();notice('Pesanan manual ditambahkan. Isi identitas, pilih ketebalan, lalu verifikasi.');
}
function orderNumber(order){return orders.indexOf(order)+1;}
function statusLabel(o){
  if(o.status==='membaca')return ['Sedang dibaca','waiting'];
  if(o.status==='gagal')return ['Pembacaan / ekspor gagal','error'];
  if(o.pdfBlob && o.verified)return ['PDF berhasil','ready'];
  if(o.verified)return ['Siap dibuat','ready'];
  if(o.status==='baru')return ['Belum dibaca','waiting'];
  return ['Perlu diperiksa','waiting'];
}
function renderOrders(){
  const target=$('ordersList');const oldScroll=target.scrollTop;target.replaceChildren();$('orderCount').textContent=`(${orders.length})`;
  if(!orders.length){const el=document.createElement('p');el.className='empty-orders';el.textContent='Belum ada pesanan. Pilih banyak foto dari galeri atau ambil foto menggunakan kamera.';target.append(el);return;}
  for(const o of orders){
    const row=document.createElement('div');row.className='order-row'+(activeId===o.id?' active':'');
    const open=document.createElement('button');open.type='button';open.className='order-open';open.title='Buka dan edit pesanan';
    const num=document.createElement('span');num.className='order-index';num.textContent=String(orderNumber(o)).padStart(2,'0');
    const desc=document.createElement('span');desc.className='order-description';
    const title=document.createElement('strong');title.textContent=o.data.nama?.trim()||o.file?.name||'PESANAN MANUAL';
    const [label,kind]=statusLabel(o);const sub=document.createElement('small');
    sub.className='order-badge '+kind;sub.textContent=`${label} · ${o.style.toUpperCase()} · ${o.data.nim||(o.style==='unira'?'NPM belum terbaca':'NIM belum terbaca')}`;
    desc.append(title,sub);open.append(num,desc);open.addEventListener('click',()=>selectOrder(o.id));
    const select=document.createElement('select');select.className='order-select';select.setAttribute('aria-label',`Ketebalan pesanan ${orderNumber(o)}`);
    const blank=document.createElement('option');blank.value='';blank.textContent='Pilih mm';select.append(blank);
    for(const mm of sizesForStyle(o.style)){const opt=document.createElement('option');opt.value=String(mm);opt.textContent=`${mm} mm`;if(['merah','maroon','custom'].includes(o.style)&&mm===28){opt.disabled=true;opt.textContent='28 mm (warna: perlu master)';}select.append(opt);}
    if(isCoverCD(o)){select.disabled=true;select.innerHTML='<option value="">Tanpa punggung</option>';}
    else select.value=o.thickness===null?'':String(o.thickness);
    select.addEventListener('change',()=>setThickness(o.id,select.value?Number(select.value):null));
    const styleChoice=document.createElement('select');styleChoice.className='order-style';styleChoice.setAttribute('aria-label',`Jenis cover pesanan ${orderNumber(o)}`);
    for(const [v,label] of [['polos','Polos V1 (Lama, tanpa logo)'],['poloslogoatas','Polos V2 (Baru, tanpa logo)'],['merah','Merah'],['maroon','Maroon'],['custom','Custom'],['unira','UNIRA'],['dummybook','Dummybook'],['softips','Soft Cover IPS'],['covercd','Cover CD']]){const opt=document.createElement('option');opt.value=v;opt.textContent=label;styleChoice.append(opt);}
    styleChoice.value=o.style;styleChoice.addEventListener('change',()=>setStyle(o.id,styleChoice.value));
    const remove=document.createElement('button');remove.type='button';remove.className='order-remove';remove.textContent='✕';remove.title=`Hapus pesanan ${orderNumber(o)}`;remove.addEventListener('click',()=>removeOrder(o.id));
    row.append(open,styleChoice,select,remove);target.append(row);
  }
  target.scrollTop=oldScroll;
}
function renderThickness(){
  const target=$('thicknessOptions');target.replaceChildren();const a=active();
  if(isCoverCD(a)){const hint=document.createElement('p');hint.className='template-msg';hint.textContent='Cover CD: ukuran tetap 137 × 137 mm. Tidak memerlukan ketebalan/punggung. Nama dan NIM di atas, logo kiri–kanan, judul di bawah.';target.append(hint);}
  for(const mm of sizesForStyle(a?.style)){
    const btn=document.createElement('button');btn.type='button';btn.className='size-button'+(a?.thickness===mm?' selected':'');
    btn.innerHTML=`<b>${mm}</b><span>mm</span><small>${['merah','maroon','custom'].includes(a?.style)&&mm===28?'Perlu master':'Tersedia'}</small>`;
    btn.disabled=!a||(['merah','maroon','custom'].includes(a.style)&&mm===28);btn.addEventListener('click',()=>setThickness(a.id,mm));target.append(btn);
  }
  $('selectedSize').textContent=isCoverCD(a)?'COVER CD · 137 × 137 mm':a?.thickness ? `${String(a.style||'polos').toUpperCase()} · ${a.thickness} mm` : 'Belum dipilih';
}
function renderPhoto(order){
  const im=$('imagePreview');const empty=$('emptyPreview');
  if(order?.imageURL){im.src=order.imageURL;im.classList.remove('hidden');empty.classList.add('hidden');}
  else if(order?.file){im.removeAttribute('src');im.classList.add('hidden');empty.classList.remove('hidden');empty.querySelector('h3').textContent=(isPdf(order.file)?'📄 PDF':'📝 WORD')+' — '+order.file.name;}
  else{im.removeAttribute('src');im.classList.add('hidden');empty.classList.remove('hidden');empty.querySelector('h3').textContent='Klik pilih foto, atau gunakan tombol PDF/Word di bawah';}
}
function paintData(obj){
  painting=true;
  for(const key of FIELDS){document.querySelector(`[name="${key}"]`).value=String(obj?.[key]??'');}
  const editor=$('titleEditor');const segments=obj?.title_segments||obj?.titleSegments;
  if(Array.isArray(segments)&&segments.length&&segments.map(s=>s.text||'').join('')===(obj?.judul||'')){
    editor.innerHTML=segments.map(s=>`${s.italic?'<em>':''}${escapeHTML(s.text||'')}${s.italic?'</em>':''}`).join('');
  } else editor.textContent=obj?.judul||'';
  $('abstractText').value=String(obj?.abstract_text||'');
  painting=false;
}
function extractSegments(){
  const segments=[];
  function push(text,italic){if(!text)return;if(segments.at(-1)?.italic===italic)segments.at(-1).text+=text;else segments.push({text,italic});}
  function walk(node,italic){
    if(node.nodeType===3){push(node.nodeValue||'',italic);return;}
    if(node.nodeType!==1)return;
    const tag=node.tagName.toLowerCase();const useItalic=italic||tag==='em'||tag==='i'||node.style?.fontStyle==='italic';
    if(tag==='br'){push('\n',italic);return;}
    if(['div','p'].includes(tag)&&segments.length&&!segments.at(-1).text.endsWith('\n'))push('\n',italic);
    for(const child of node.childNodes)walk(child,useItalic);
  }
  for(const node of $('titleEditor').childNodes)walk(node,false);
  if(segments.length)segments[0].text=segments[0].text.replace(/^\s+/gu,'');
  if(segments.length)segments.at(-1).text=segments.at(-1).text.replace(/\s+$/gu,'');
  return segments.filter(s=>s.text);
}
function currentData(){
  const title_segments=extractSegments();const result={judul:title_segments.map(s=>s.text).join(''),title_segments};
  for(const field of FIELDS)result[field]=document.querySelector(`[name="${field}"]`).value.trim();
  result.abstract_text=$('abstractText').value.trim();
  result.universitas=canonicalUniversity(result.universitas);
  result.tahun=(result.bulan_tahun.match(/\b\d{4}\b/u)||[])[0]||'';return result;
}
function clearPDFPreview(){
  if(pdfURL){URL.revokeObjectURL(pdfURL);pdfURL=null;}
  $('pdfPreview').removeAttribute('src');$('pdfPreview').classList.add('hidden');$('previewEmpty').classList.remove('hidden');releaseDownload('single');
}
function updatePDFPreview(o){
  clearPDFPreview();if(!o?.pdfBlob)return;
  pdfURL=URL.createObjectURL(o.pdfBlob);$('pdfPreview').src=pdfURL+'#view=FitH';$('pdfPreview').classList.remove('hidden');$('previewEmpty').classList.add('hidden');
  offerDownload(o.pdfBlob,coverFileName(o),'single');
  pendingName=coverFileName(o);
}
function showWarnings(o){const w=$('ocrWarnings');w.textContent=o?.warnings?.length?'Perlu diperiksa: '+o.warnings.join('; '):'';w.classList.toggle('hidden',!o?.warnings?.length);}
function selectOrder(id,paint=true){
  const o=orders.find(e=>e.id===id);if(!o){activeId=null;paintData(newData());renderPhoto(null);clearPDFPreview();renderOrders();renderThickness();renderCoverStyle();$('activeOrderHeader').textContent='Belum ada pesanan';return;}
  activeId=o.id;
  if(paint)paintData(o.data); else paintData(o.data);
  renderPhoto(o);renderOrders();renderThickness();renderCoverStyle();showWarnings(o);updatePDFPreview(o);
  $('activeOrderHeader').textContent=`Pesanan ${String(orderNumber(o)).padStart(2,'0')} · ${o.file?.name||'Input manual'}`;
  $('approveOrder').textContent=o.verified?'✓ Sudah diperiksa (klik untuk ulang)':'✓ Tandai data sudah diperiksa';
}
function invalidateOrder(o){$('spineFontResult').textContent='Data diubah; buat PDF lagi untuk memeriksa ukuran font punggung.';releaseDownload('batch');o.pdfBlob=null;o.verified=false;if(o.status!=='membaca')o.status=(o.file&&!o.data.judul?'baru':'periksa');}
function markDirty(){
  if(painting)return;const o=active();if(!o)return;
  o.data=currentData();o.revision++;invalidateOrder(o);clearPDFPreview();
  $('approveOrder').textContent='✓ Tandai data sudah diperiksa';renderOrders();updateDummyParagraphPreview();
}
function updateDummyParagraphPreview(){
 const el=$('dummyParagraphPreview');if(!el)return;
 const o=active();if(!o||o.style!=='dummybook'){el.textContent='';return;}
 const paragraphs=String(o.data.abstract_text||'').split(/\n\s*\n/u).map(x=>x.replace(/\s+/gu,' ').trim()).filter(Boolean).filter(p=>!isAbstractMetadata(p));
 if(!paragraphs.length){el.textContent='Belum ada PARAGRAF ISI ABSTRAK yang valid. Informasi nama, NIM, judul, dan pembimbing tidak boleh digunakan sebagai isi belakang.';return;}
 try{
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  // Approximate preview only. Actual PDF rechecks with embedded font metrics.
  const fit=chooseDummyBackText(paragraphs,(txt,size)=>{context.font=`${size}px Arial, sans-serif`;return context.measureText(txt).width;});
  el.textContent=`PRATINJAU ${fit.paragraphCount} PARAGRAF TERAKHIR (hasil PDF dihitung ulang dengan font yang ditanam):\n\n${fit.paragraphs.join('\n\n')}`;
 }catch(e){el.textContent='Paragraf akhir belum muat atau pemisahan meragukan: '+(e.message||e);}
}
function renderCoverStyle(){
 const o=active();
 document.querySelectorAll('[data-cover-style]').forEach(b=>{b.classList.toggle('selected',b.dataset.coverStyle===(o?.style||'polos'));b.disabled=!o;});
 $('studentIdLabel').innerHTML=o?.style==='unira'?'NPM <i>*</i>':'NIM <i>*</i>';
 const optionalCD=isCoverCD(o);
 document.querySelectorAll('[name="fakultas"],[name="universitas"],[name="jenis_dokumen"],[name="prodi"],[name="bulan_tahun"]').forEach(e=>{e.required=!optionalCD;});
 const cdHint=$('cdCoverHint');if(cdHint)cdHint.classList.toggle('hidden',!optionalCD);
 $('dummyAbstractPanel').classList.toggle('hidden',o?.style!=='dummybook');
 $('dummyAbstractStatus').textContent=o?.abstractStatus||'Tempel abstrak asli; pisahkan antarparagraf dengan satu baris kosong. Otomatis: 2 paragraf terakhir, atau 1/3 jika perlu.';
 updateDummyParagraphPreview();
 const show=o?.style==='custom';$('customColorRow').classList.toggle('hidden',!show);$('customColorPicker').value=o?.custom_color||'#1458A8';$('customColorCode').textContent=o?.custom_color||'#1458A8';
}
function setStyle(id,style){
 const o=orders.find(x=>x.id===id);if(!o||!COVER_TYPES.includes(style))return;
 if(o.id===activeId)o.data=currentData();
 const previous=o.style;o.style=style;invalidateOrder(o);
 let reset=false;
 if(isCoverCD(o) && o.thickness!==null){o.thickness=null;reset=true;}
 if(!isCoverCD(o)&&o.thickness!==null&&!validThickness(o)){o.thickness=null;reset=true;}
 if(unsafeProduction(o)){o.thickness=null;reset=true;}
 if(o.id===activeId){renderCoverStyle();renderThickness();clearPDFPreview();}
 renderOrders();
 notice(`Pesanan ${orderNumber(o)}: cover ${style.toUpperCase()} (${style==='dummybook'?'spread 420 × 297':style==='softips'?'330 × 210':style==='covercd'?'137 × 137':['polos','poloslogoatas'].includes(style)?'480 × 330':style==='unira'?'484 × 330':'475 × 320'} mm).`+(reset?' Ukuran punggung lama direset; pilih ukuran yang berlaku.':''),'info');
 if(style==='dummybook'&&!o.data.abstract_text && o.file&&(isPdf(o.file)||isWord(o.file)))void populateAbstract(o,o.file);
}
function setThickness(id,mm){
 const o=orders.find(x=>x.id===id);if(!o)return;
 if(mm!==null&&!sizesForStyle(o.style).includes(mm))return notice(`Ukuran punggung ${mm} mm tidak tersedia untuk ${o.style}.`,'error');
 if(mm===28&&['merah','maroon','custom'].includes(o.style))return notice('Warna 28 mm diblokir: garis potong belakang kiri keluar kertas.','error');
 o.thickness=mm;invalidateOrder(o);
 if(o.id===activeId){clearPDFPreview();renderThickness();$('approveOrder').textContent='✓ Tandai data sudah diperiksa';}
 renderOrders();step(3);
}
async function populateAbstract(order,file,{replace=false}={}){
 if(!file)return;
 const canReplace=replace && (!order.data.abstract_text?.trim()||confirm('Ganti seluruh isi abstrak yang sedang ada dengan hasil pembacaan file baru? Jika gagal, teks lama tetap dipertahankan.'));
 if(replace&&!canReplace)return;
 const rev=order.revision;
 order.abstractStatus='Sedang mencari paragraf ABSTRAK dari '+file.name+' ...';
 if(activeId===order.id)renderCoverStyle();
 try{
  const result=await withTimeout(readAbstractFromFile(file,{onProgress:s=>{
    if(activeId===order.id){$('dummyAbstractStatus').textContent=s;}
  }}),165000,'Pencarian abstrak lengkap');
  if(!orders.includes(order)||order.style!=='dummybook')return;
  if(order.revision!==rev || (!canReplace && order.data.abstract_text?.trim())){
   order.abstractStatus=`Abstrak ditemukan (${result.paragraphs.length} paragraf), tetapi edit manual dipertahankan. Gunakan tombol baca ulang untuk mencoba mengganti teks.`;
   if(activeId===order.id)renderCoverStyle();return;
  }
  order.data.abstract_text=result.paragraphs.join('\n\n');
  order.abstractStatus=`Ditemukan ${result.paragraphs.length} paragraf ISI ABSTRAK dari ${result.source}. Generator hanya memilih paragraf TERAKHIR. ${result.warnings?.join(' ')||''} Periksa kotak pratinjau akhir.`;
  invalidateOrder(order);
  if(activeId===order.id){paintData(order.data);renderCoverStyle();showWarnings(order);}
  notice(`Abstrak: ${result.paragraphs.length} paragraf isi ditemukan. Periksa PRATINJAU PARAGRAF TERAKHIR sebelum mencetak.`, 'success');
 }catch(e){
  order.abstractStatus='Tidak terbaca otomatis: '+(e?.message||e)+'. Tempel paragraf abstrak manual pada kotak teks.';
  if(activeId===order.id)renderCoverStyle();
 }
}
function removeOrder(id){
  const o=orders.find(x=>x.id===id);if(!o)return;
  if(!confirm(`Hapus pesanan ${String(orderNumber(o)).padStart(2,'0')} (${o.data.nama||o.file?.name||'manual'})?`))return;
  releaseDownload('batch');
  if(o.imageURL)URL.revokeObjectURL(o.imageURL);
  if(activeId===o.id)releaseDownload('single');
  orders=orders.filter(x=>x.id!==id);
  if(activeId===id)selectOrder(orders[0]?.id||null);
  else renderOrders();
}
function validData(data,style='polos'){const fields=style==='covercd'?['judul','nama','nim']:[...REQUIRED,...(style==='dummybook'?['abstract_text']:[])];return fields.filter(f=>!String(data?.[f]??'').trim());}
async function ocrOne(order){
  if(!order.file){order.status='periksa';order.warnings=['Pesanan manual. Isi data pada editor.'];renderOrders();return false;}
  const revision=order.revision;order.status='membaca';order.warnings=[];renderOrders();
  try{
    // Dokumen lokal, tidak ada request backend atau token; batas waktu membebaskan UI.
    const kind=isPdf(order.file)?'PDF':isWord(order.file)?'Word':isPhoto(order.file)?'Foto':null;
    if(!kind)throw Error('Format berkas tidak didukung.');
    const method=kind==='PDF'?readPDF:kind==='Word'?readWord:readPhoto;
    const timeout=kind==='Foto'?($('ocrAccuracy')?.value==='detail'?250000:220000):kind==='PDF'?250000:70000;
    const setStage=message=>{
      if (order.status!=='membaca') return;
      const label=`${orderNumber(order)}/${orders.length} · ${order.file.name} — ${message}`;
      progress(label);
    };
    setOCRProgress(setStage);
    const options={ detail:$('ocrAccuracy')?.value==='detail', onProgress:setStage };
    const ocr=await withTimeout(method(order.file,options),timeout,`Pembacaan ${kind}`);
    if(revision!==order.revision){order.warnings=['Data berubah saat proses berlangsung; koreksi Anda dipertahankan.'];order.status='periksa';}
    else {order.data={...newData(),...ocr,universitas:canonicalUniversity(ocr.universitas),abstract_text:order.data.abstract_text||ocr.abstract_text||''};order.warnings=Array.isArray(ocr.warnings)?ocr.warnings:[];order.status='periksa';order.verified=false;order.pdfBlob=null;}
    if(activeId===order.id){paintData(order.data);showWarnings(order);clearPDFPreview();}
    renderOrders();
    if(!order.data?.judul && !order.data?.nama && !order.data?.nim){
      order.status='gagal';
      order.warnings=[...(order.warnings||[]),'Tidak ada identitas yang terbaca. Pastikan PDF/Word memiliki teks, atau coba OCR lokal untuk foto/scan. Anda tetap boleh mengisi formulir manual.'];
      if(activeId===order.id)showWarnings(order);
      renderOrders();
      return false;
    }
    return true;
  }catch(error){if(/melewati|timeout|waktu proses/iu.test(String(error?.message||error)))void resetOCR();order.status='gagal';order.warnings=[String(error?.message||error)];if(activeId===order.id)showWarnings(order);renderOrders();return false;}
}
async function readSelected(){
  if(ocrBatchRunning)return notice('Antrean otomatis masih memproses berkas. Tunggu hingga selesai atau pilih berkas setelahnya.','info');
  const a=active();if(!a)return notice('Tambahkan foto terlebih dahulu.','error');
  if(!a.file)return notice('Pesanan ini manual; tidak ada foto untuk dianalisis.','error');
  const btn=$('ocrButton');btnBusy(btn,true,'Membaca...');
  try{const success=await ocrOne(a);notice(success?`Berkas pesanan ${orderNumber(a)} terbaca. Periksa data dan pilih ketebalan.`:`Pembacaan gagal: ${a.warnings.join('; ')}`,success?'success':'error');if(success)step(2);}finally{btnBusy(btn,false);clearProgress();}
}
async function readAll({automatic=false}={}){
  if(ocrBatchRunning){if(automatic)autoReadPending=true;return;}
  releaseDownload('batch');
  // Otomatis tidak mengulang file gagal tanpa henti. Tombol manual mengulang file gagal.
  const queue=orders.filter(o=>o.file && (automatic?o.status==='baru':['baru','gagal'].includes(o.status)));
  if(!queue.length){if(!automatic)notice('Tidak ada berkas baru atau gagal yang perlu dibaca.','info');return;}
  notice(`${queue.length} berkas sedang dibaca ${automatic?'otomatis':''}. PDF/Word diproses lokal, foto memakai OCR lokal.`, 'info');
  
  ocrBatchRunning=true;btnBusy($('ocrAllButton'),true,'Sedang baca...');
  let completed=0,success=0;
  progress(`Membaca berkas 0/${queue.length} ...`);
  // Serial di HP: DOCX/PDF lokal tidak membebani memori dan progres selalu bergerak.
  let cursor=0;
  async function worker(){
    while(cursor<queue.length){const o=queue[cursor++];if(await ocrOne(o))success++;
      completed++;progress(`Membaca berkas ${completed}/${queue.length} · berhasil ${success} · gagal ${completed-success}`);
    }
  }
  try{await worker();notice(`Pembacaan selesai: ${success}/${queue.length} berhasil. Periksa setiap nama/NIM/judul dan tentukan ukuran punggung masing-masing.`,success===queue.length?'success':'info');step(2);}
  catch(error){notice('Antrean terhenti: '+String(error?.message||error),'error');}
  finally{
    for(const o of queue){if(o.status==='membaca'){o.status='gagal';o.warnings=['Proses terhenti tanpa hasil; coba satu berkas kembali.'];}}
    renderOrders();ocrBatchRunning=false;btnBusy($('ocrAllButton'),false);clearProgress();
    // Bila pengguna menambah file saat antrean sebelumnya berjalan, baca berkas baru setelahnya.
    if(autoReadPending||orders.some(o=>o.file&&o.status==='baru')){autoReadPending=false;scheduleAutoRead();}
  }
}
function approveActive(){
  const a=active();if(!a)return notice('Pilih pesanan terlebih dahulu.','error');
  a.data=currentData();const missing=validData(a.data,a.style);
  if(missing.length)return notice(`Pesanan ${orderNumber(a)} belum lengkap: ${missing.join(', ')}.`,'error');
  if(!validThickness(a))return notice(`Pilih ukuran punggung untuk pesanan ${orderNumber(a)} terlebih dahulu.`,'error');
  if(unsafeProduction(a))return notice('Warna 28 mm memerlukan master baru yang tidak memotong tanda belakang.','error');
  a.verified=true;a.status='disetujui';renderOrders();
  $('approveOrder').textContent='✓ Sudah diperiksa (klik untuk ulang)';
  notice(`Pesanan ${orderNumber(a)} ${a.data.nama} disetujui: ${coverDescriptor(a)}.`,'success');
}
async function makeSelectedPDF({downloadAfter=false}={}){
 const a=active();if(!a)return notice('Pilih pesanan terlebih dahulu.','error');
 a.data=currentData();const missing=validData(a.data,a.style);
 if(missing.length)return notice(`Lengkapi: ${missing.join(', ')}.`,'error');
 if(!validThickness(a))return notice('Pilih ketebalan punggung terlebih dahulu.','error');
 if(unsafeProduction(a))return notice('Warna 28 mm belum aman; garis potong terpotong.','error');
 const button=$('generateButton');btnBusy(button,true,'Membuat PDF...');
 try{
  const result=await withTimeout(generatePDF(a.data,a.thickness,a.style,a.custom_color),90000,'Pembuatan PDF lokal');
  a.pdfBlob=new Blob([result.bytes],{type:'application/pdf'});
  $('spineFontResult').textContent=isCoverCD(a)?`Hasil Cover CD 137 × 137 mm • Judul ${result.details?.title_lines||'?'} baris • font ${result.details?.title_font_pt||'?'} pt • 2 logo`:`Hasil aktual: ${a.style.toUpperCase()} ${a.thickness} mm • ${result.details?.spine_lines??'?'} baris • font punggung ${result.details?.spine_font_pt??'?'} pt`+(a.style==='dummybook'?` • ${result.details?.back_paragraph_count} paragraf abstrak • 1 halaman 420 × 297 mm`:``);

  updatePDFPreview(a);renderOrders();step(4);
  if(downloadAfter)triggerDownload(a.pdfBlob,coverFileName(a));
  notice(`PDF ${a.data.nama} — ${coverDescriptor(a)} berhasil. ${isCoverCD(a)?'Periksa nama/NIM, dua logo, dan judul sebelum cetak.':`Judul punggung: ${result.details?.spine_lines||'?'} baris, font ${result.details?.spine_font_pt||'?'} pt. Periksa preview dan cetak uji.`}`+(result.warnings?.length?'\n'+result.warnings.join('\n'):''),result.warnings?.length?'info':'success');
 }catch(error){a.status='gagal';a.warnings=[String(error.message||error)];renderOrders();showWarnings(a);notice(`PDF gagal: ${error.message||error}`,'error');}
 finally{btnBusy(button,false);}
}
/** Best effort auto-save; the persistent manual <a download> is the reliable fallback. */
function triggerDownload(blob,name){
 const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.style.display='none';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(link.href),120000);
}
async function makeOrderZIP(){
 if(zipRunning)return;
 // Never silently treat the green Download Batch button as an inert control.
 // Show actionable validation and explicit verification for every ready order.
 if(!orders.length)return notice('Tambahkan berkas atau pesanan manual terlebih dahulu.','error');
 const incomplete=orders.filter(o=>validData(o.data,o.style).length || !validThickness(o) || unsafeProduction(o));
 const eligible=orders.filter(o=>!incomplete.includes(o));
 if(incomplete.length){
  const details=incomplete.slice(0,4).map(o=>`Pesanan ${orderNumber(o)} (${o.data.nama||o.file?.name||'belum terbaca'}): ${[...validData(o.data,o.style),...(!validThickness(o)?['pilih ketebalan']:[]),...(unsafeProduction(o)?['warna 28 mm belum aman']:[])].join(', ')}`).join('\n');
  if(!eligible.length){
   notice(`Belum bisa ekspor batch: semua pesanan belum lengkap. Perbaiki:\n${details}${incomplete.length>4?'\n...':''}`,'error');
   selectOrder(incomplete[0].id);return;
  }
  if(!confirm(`${incomplete.length} pesanan masih belum lengkap dan akan dilewati. Ekspor ${eligible.length} pesanan yang siap saja?\n\nBelum siap:\n${details}`)){
   notice('Batch belum dimulai. Perbaiki pesanan yang belum lengkap, atau ulangi dan pilih lewati.','error');
   selectOrder(incomplete[0].id);return;
  }
 }
 const unchecked=eligible.filter(o=>!o.verified);
 if(unchecked.length){
  if(!confirm(`${unchecked.length} pesanan belum ditandai diperiksa. Apakah Anda sudah memeriksa judul, nama, NIM, universitas, jenis cover, dan ketebalan tiap pesanan, lalu SETUJU membuat PDF?`))return;
  for(const o of unchecked){o.verified=true;o.status='disetujui';}
  renderOrders();
 }
 const output=$('batchOutputMode').value;
 if(output!=='combined'&&!globalThis.JSZip)return notice('JSZip belum termuat. Periksa koneksi pustaka CDN.','error');
 if(!globalThis.PDFLib?.PDFDocument)return notice('pdf-lib belum termuat. Periksa CDN.','error');
 releaseDownload('batch');zipRunning=true;btnBusy($('batchJobsButton'),true,'Menyiapkan batch...');
 progress(`Mempersiapkan 0/${eligible.length} PDF.`);
 const archive=output==='combined'?null:new globalThis.JSZip(),generated=[],failures=[];
 try{
  for(let i=0;i<eligible.length;i++){
   const order=eligible[i],name=coverFileName(order);
   try{
    const result=await withTimeout(generatePDF(order.data,order.thickness,order.style,order.custom_color),90000,`PDF pesanan ${i+1}`);
    generated.push({bytes:result.bytes,name});
    if(output!=='combined')archive.file(name,result.bytes);
   }catch(error){failures.push(`${name} : ${error.message||error}`);order.status='gagal';order.warnings=[String(error.message||error)];}
   progress(`Memproses ${i+1}/${eligible.length} • berhasil ${generated.length} • gagal ${failures.length}`);renderOrders();
   await new Promise(r=>setTimeout(r,0));
  }
  if(!generated.length)throw Error('Tidak ada PDF yang berhasil. '+failures.join('; ').slice(0,500));
  if(output==='combined'||output==='both'){
   const joined=await globalThis.PDFLib.PDFDocument.create();
   for(const item of generated){const part=await globalThis.PDFLib.PDFDocument.load(item.bytes);const idx=Array.from({length:part.getPageCount()},(_,j)=>j);const pages=await joined.copyPages(part,idx);for(const page of pages)joined.addPage(page);}
   const combined=new Uint8Array(await joined.save());
   if(output==='combined'){const filename=`ZAINNET_GABUNG_${generated.length}_COVER.pdf`;const blob=new Blob([combined],{type:'application/pdf'});offerDownload(blob,filename,'batch');triggerDownload(blob,filename);}
   else archive.file(`ZAINNET_GABUNG_${generated.length}_COVER.pdf`,combined);
  }
  if(output!=='combined'){
    archive.file('LAPORAN_BATCH.txt',`ZAIN.NET • ${generated.length} PDF berhasil; ${failures.length} gagal.\n`+failures.join('\n'));
    const bytes=await archive.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
    const filename=`ZAINNET_${generated.length}_COVER_${output.toUpperCase()}.zip`;offerDownload(bytes,filename,'batch');triggerDownload(bytes,filename);
  }
  notice(`Selesai: ${generated.length} PDF berhasil dan ${failures.length} gagal.${failures.length?'\n'+failures.slice(0,4).join('\n'):''}`,failures.length?'info':'success');
 }catch(error){notice('Batch gagal: '+String(error.message||error),'error');}
 finally{zipRunning=false;btnBusy($('batchJobsButton'),false);clearProgress();}
}
// File intake
$('universalInput').addEventListener('change',event=>{addOrders(event.target.files);event.target.value='';});
$('cameraInput').addEventListener('change',event=>{addOrders(event.target.files);event.target.value='';});
$('cameraButton').addEventListener('click',()=>$('cameraInput').click());
$('manualButton').addEventListener('click',addManual);
$('dummyAbstractFile').addEventListener('change',e=>{const a=active();const f=e.target.files?.[0];if(a&&f&&a.style==='dummybook')void populateAbstract(a,f,{replace:true});e.target.value='';});
$('dummyReadAbstract').addEventListener('click',()=>{const a=active();if(a?.style==='dummybook'&&a.file&&(isPdf(a.file)||isWord(a.file)))void populateAbstract(a,a.file,{replace:true});else notice('Untuk ekstraksi otomatis, gunakan PDF atau DOCX berisi ABSTRAK. Foto perlu disalin manual.','info');});
for(const evt of ['dragenter','dragover'])$('dropzone').addEventListener(evt,event=>{event.preventDefault();$('dropzone').classList.add('dragover');});
for(const evt of ['dragleave','drop'])$('dropzone').addEventListener(evt,event=>{event.preventDefault();$('dropzone').classList.remove('dragover');if(evt==='drop')addOrders(event.dataTransfer.files);});
$('clearPhoto').addEventListener('click',()=>{const a=active();if(a)removeOrder(a.id);else notice('Tidak ada pesanan yang dipilih.');});
$('ocrButton').addEventListener('click',readSelected);$('ocrAllButton').addEventListener('click',()=>readAll({automatic:false}));
$('titleEditor').addEventListener('input',markDirty);
$('abstractText').addEventListener('input',()=>{markDirty();updateDummyParagraphPreview();});
$('titleEditor').addEventListener('paste',event=>{event.preventDefault();document.execCommand('insertText',false,(event.clipboardData||window.clipboardData).getData('text/plain'));});
document.querySelectorAll('#dataForm input').forEach(input=>input.addEventListener('input',markDirty));
document.querySelector('[name="universitas"]').addEventListener('blur',event=>{
 const value=canonicalUniversity(event.target.value);
 if(value!==event.target.value){event.target.value=value;markDirty();notice('Nama perguruan tinggi ditulis lengkap: '+value,'info');}
});
$('italicButton').addEventListener('mousedown',event=>event.preventDefault());
$('italicButton').addEventListener('click',()=>{
  const editor=$('titleEditor'),sel=window.getSelection();
  if(!sel||!sel.rangeCount||sel.isCollapsed||!editor.contains(sel.anchorNode))return notice('Blok kata di dalam judul terlebih dahulu.','error');
  document.execCommand('italic',false,null);markDirty();
});
$('clearFormatting').addEventListener('click',()=>{$('titleEditor').textContent=$('titleEditor').innerText;markDirty();});
$('fillExample').addEventListener('click',()=>{
  if(!active())addManual();const a=active();a.data=JSON.parse(JSON.stringify(SAMPLE));a.verified=false;a.status='periksa';a.revision++;
  selectOrder(a.id);step(2);notice('Data Serli dimasukkan hanya untuk uji coba, bukan hasil OCR. Pilih ketebalan terlebih dahulu.');
});
$('resetForm').addEventListener('click',()=>{
  const a=active();if(!a)return;
  if(!confirm('Kosongkan data mahasiswa pada pesanan ini saja?'))return;
  a.data=newData();a.revision++;invalidateOrder(a);a.warnings=[];selectOrder(a.id);
});
document.querySelectorAll('[data-cover-style]').forEach(b=>b.addEventListener('click',()=>{const a=active();if(a)setStyle(a.id,b.dataset.coverStyle);}));
$('customColorPicker').addEventListener('input',e=>{const a=active();if(!a)return;a.custom_color=e.target.value.toUpperCase();invalidateOrder(a);renderCoverStyle();clearPDFPreview();renderOrders();});
$('approveOrder').addEventListener('click',approveActive);
$('generateButton').addEventListener('click',()=>makeSelectedPDF());
$('batchJobsButton').addEventListener('click',makeOrderZIP);
$('downloadButton').addEventListener('click',()=>{
  const a=active();if(!a)return notice('Unggah atau pilih pesanan terlebih dahulu.','error');
  if(!a.pdfBlob){makeSelectedPDF({downloadAfter:true});return;}
  triggerDownload(a.pdfBlob,coverFileName(a));
  notice('PDF telah disiapkan. Jika browser tidak langsung mengunduh, gunakan tombol hijau "Download" di bawah pratinjau.','success');
});
async function loadStatus(){
 $('connection').textContent='GitHub Pages V4.25 • Dummybook spread A3 5–10 mm • Tanpa token';
 $('serverDot').classList.add('online');
 notice('Mode lokal: Word dan PDF teks dibaca di browser tanpa OCR lokal. Foto dan PDF scan memakai OCR Tesseract lokal (model bahasa mungkin perlu diunduh).','info');
 // JANGAN menunggu template saat memuat UI; tidak membuat tombol membaca macet.
 renderThickness();renderOrders();
 checkAssets().catch(error=>notice('Master PDF belum termuat: '+error.message+'. Upload seluruh folder assets saat deploy.','error'));
}
const fontBold=$('fontBoldInput'),fontItalic=$('fontItalicInput');
window.addEventListener('zainnet-font-status',event=>{if($('fontStatus'))$('fontStatus').textContent=String(event.detail||'Sedang memuat font Unicode…');});
async function updateFonts(){
 try{
 const [b,i]=await Promise.all([fontBold.files[0]?.arrayBuffer(),fontItalic.files[0]?.arrayBuffer()]);
 if(Boolean(b)!==Boolean(i)){$('fontStatus').textContent='Unggah kedua font Bold dan Bold Italic. Sementara itu font Unicode otomatis tetap digunakan.';setUserFonts(null,null);return;}
 setUserFonts(b?new Uint8Array(b):null,i?new Uint8Array(i):null);
 $('fontStatus').textContent=b?'Font kustom siap dipakai untuk PDF Unicode.':'Font Unicode Tinos otomatis akan diambil saat membuat PDF pertama; internet diperlukan jika belum tersimpan di cache browser.';
 }catch(error){$('fontStatus').textContent='Font gagal dibaca: '+error.message;}
}
fontBold.addEventListener('change',updateFonts);fontItalic.addEventListener('change',updateFonts);
const arialRegular=$('dummyArialRegularInput'),arialBold=$('dummyArialBoldInput');
async function updateDummyArial(){
 try{
  const [reg,bold]=await Promise.all([arialRegular.files[0]?.arrayBuffer(),arialBold.files[0]?.arrayBuffer()]);
  if(!!reg!==!!bold){$('dummyArialStatus').textContent='Unggah Arial Regular dan Arial Bold sekaligus; font otomatis tetap berlaku.';setDummyArialFonts(null,null);return;}
  setDummyArialFonts(reg?new Uint8Array(reg):null,bold?new Uint8Array(bold):null);
  $('dummyArialStatus').textContent=reg?'Arial asli dari komputer siap dipakai untuk Dummybook.':'Otomatis memakai Arimo (metrik kompatibel Arial); font Arial tidak ikut dibagikan.';
 }catch(e){$('dummyArialStatus').textContent='Gagal membaca font: '+(e.message||e);}
}
if(arialRegular&&arialBold){arialRegular.addEventListener('change',updateDummyArial);arialBold.addEventListener('change',updateDummyArial);}
paintData(newData());renderCoverStyle();loadStatus();
globalThis.__zainnetAppBooted=true;
