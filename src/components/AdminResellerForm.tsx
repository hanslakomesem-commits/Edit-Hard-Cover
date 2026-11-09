import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ArrowLeft, Plus, Trash2, Save, Store, AlertCircle} from 'lucide-react';
import {formatIDR} from '../utils/pricing';
import {listResellers, type ResellerAccount} from '../lib/partnerAdmin';
import type {AdminResellerMember, AdminResellerBatchInput} from '../lib/api';
import {createdAtWIB,longDateWIB} from '../utils/orderDateTime';
import {RESELLER_ADDONS,RESELLER_HC_UNIT,RESELLER_PACKAGE_NAMES,resellerExtras,resellerMemberTotal,resellerPickupDate,getResellerDateWindow} from '../utils/resellerAdminPricing';

const makeMember = (n:number):AdminResellerMember & {key:number} => ({key:n,name:'',qty:3,days:3,prodi:'',packageId:1,services:[]});

export function AdminResellerForm({onBack,onSubmit}: {
  onBack:()=>void;
  onSubmit:(order:AdminResellerBatchInput)=>Promise<void>;
}) {
  const [resellers,setResellers]=useState<ResellerAccount[]>([]);
  const [partnerId,setPartnerId]=useState('');
  const [loadingResellers,setLoadingResellers]=useState(true);
  const [resellerError,setResellerError]=useState('');
  const [faculty,setFaculty]=useState('Umum / Reseller');
  const [major,setMajor]=useState('Sampul Kolektif');
  const [notes,setNotes]=useState('');
  const [todayWib]=useState(()=>createdAtWIB(new Date()).slice(0,10));
  const [receivedDate,setReceivedDate]=useState(()=>createdAtWIB(new Date()).slice(0,10));
  const dateWindow=useMemo(()=>getResellerDateWindow(todayWib),[todayWib]);
  const [members,setMembers]=useState([makeMember(1)]);
  const [nextKey,setNextKey]=useState(2);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const available=useMemo(()=>resellers.filter(r=>r.approved).sort((a,b)=>a.company_name.localeCompare(b.company_name,'id')),[resellers]);
  const chosen=available.find(r=>r.user_id===partnerId);
  const refreshResellers=useCallback(async()=>{
    setLoadingResellers(true);setResellerError('');
    try {
      const accounts=await listResellers();
      setResellers(accounts);
      setPartnerId(current=>accounts.some(p=>p.user_id===current&&p.approved)?current:'');
    } catch(e) {
      setResellerError('Daftar reseller gagal dimuat: '+(e instanceof Error?e.message:String(e)));
      setResellers([]);setPartnerId('');
    } finally {setLoadingResellers(false);}
  },[]);
  useEffect(()=>{void refreshResellers();},[refreshResellers]);
  const total=useMemo(()=>members.reduce((sum,m)=>sum+resellerMemberTotal(m),0),[members]);
  const pickup=useMemo(()=>resellerPickupDate(receivedDate,Math.max(...members.map(m=>m.days))),[members,receivedDate]);
  const covers=useMemo(()=>members.reduce((sum,m)=>sum+(m.qty||0),0),[members]);
  function patch(key:number,field:'name'|'qty'|'days'|'prodi'|'packageId'|'services',value:string|number|string[]){
    setMembers(prev=>prev.map(m=>m.key===key?{...m,[field]:value}:m));
  }
  function addMember(){
    if(members.length>=100)return;
    setMembers(prev=>[...prev,makeMember(nextKey)]);
    setNextKey(n=>n+1);
  }
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');
    if(!chosen){setError('Pilih salah satu akun reseller aktif yang sudah terdaftar.');return;}
    if(!faculty.trim()||!major.trim()){setError('Fakultas dan prodi/keterangan harus diisi.');return;}
    if(!receivedDate||receivedDate<dateWindow.min||receivedDate>dateWindow.max){setError('Tanggal setor harus hari ini atau maksimal 30 hari yang lalu.');return;}
    if(members.length<1||members.some(m=>m.name.trim().length<2||m.name.trim().length>120||m.prodi.trim().length<2||m.prodi.trim().length>120||!Number.isInteger(m.qty)||m.qty<1||m.qty>100||![1,2,3].includes(m.days)||![1,2,3,4,5,6,7].includes(m.packageId)|| (m.packageId===7 && (m.services||[]).some(s=>!(s in RESELLER_ADDONS))))){
      setError('Setiap mahasiswa wajib mengisi nama, prodi, jumlah HC 1–100, lama pengerjaan 1–3 hari, dan paket yang valid.');return;
    }
    for(const day of [1,2,3]){
      if(members.filter(m=>m.days===day).reduce((sum,m)=>sum+m.qty,0)>100){
        setError(`Jumlah untuk paket ${day} hari melebihi 100 HC. Pisahkan menjadi dua nota.`);return;
      }
    }
    if(saving)return;
    setSaving(true);
    try {await onSubmit({partnerId:chosen.user_id,faculty:faculty.trim(),major:major.trim(),receivedDate,notes:notes.trim(),members:members.map(({name,qty,days,prodi,packageId,services})=>({name:name.trim(),qty,days,prodi:prodi.trim(),packageId,services:packageId===7?resellerExtras({qty,days,packageId,services}):[]}))});}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setSaving(false);}
  }
  return <main className="max-w-5xl mx-auto px-4 py-8 w-full">
    <button type="button" onClick={onBack} className="mb-5 flex items-center gap-2 text-sm text-slate-700 font-bold"><ArrowLeft size={17}/> Kembali ke Panel Admin</button>
    <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-8 space-y-6">
      <div className="flex items-center gap-3"><span className="bg-teal-100 p-3 rounded-xl text-teal-800"><Store size={23}/></span><div><h1 className="text-xl md:text-2xl font-black text-slate-900">Buat Nota Reseller dari Admin</h1><p className="text-sm text-slate-600">Pilih akun reseller yang sudah terdaftar. Tidak perlu mengetik nama percetakan atau nomor WhatsApp.</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm font-bold text-slate-700">Pilih Akun Reseller Terdaftar
          <select required value={partnerId} disabled={loadingResellers||available.length===0} onChange={e=>setPartnerId(e.target.value)} className="mt-1 block w-full border rounded-xl p-3 font-normal bg-white disabled:bg-slate-100">
            <option value="">{loadingResellers?'Memuat daftar reseller…':available.length?'— Pilih reseller aktif —':'Tidak ada reseller aktif'}</option>
            {available.map(r=><option key={r.user_id} value={r.user_id}>{r.company_name}{r.contact_email?` (${r.contact_email})`:''}</option>)}
          </select>
          {chosen&&<small className="block mt-1 font-normal text-teal-700">Terhubung ke akun: {chosen.company_name} (ID tersimpan otomatis)</small>}
          {resellerError&&<small role="alert" className="block mt-1 font-normal text-rose-700">{resellerError}</small>}
          {!loadingResellers&&available.length===0&&!resellerError&&<small className="block mt-1 font-normal text-amber-700">Buat atau aktifkan akun di menu Kelola Reseller terlebih dahulu.</small>}
          <button type="button" onClick={()=>void refreshResellers()} disabled={loadingResellers} className="mt-2 block border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-teal-800 disabled:opacity-50">{loadingResellers?'Memuat…':'Perbarui Daftar Reseller'}</button>
        </label>
        <label className="text-sm font-bold text-slate-700">Fakultas / Kategori<input required maxLength={160} value={faculty} onChange={e=>setFaculty(e.target.value)} className="mt-1 block w-full border rounded-xl p-3 font-normal"/></label>
        <label className="text-sm font-bold text-slate-700">Prodi / Keterangan<input required maxLength={160} value={major} onChange={e=>setMajor(e.target.value)} className="mt-1 block w-full border rounded-xl p-3 font-normal"/></label>
      </div>
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 space-y-2">
        <h2 className="font-black text-amber-900">Tanggal Setor Sampul — Boleh Dicatat Menyusul</h2>
        <label className="block text-sm font-bold text-slate-800">Tanggal asli reseller menyerahkan sampul
          <input type="date" required min={dateWindow.min} max={dateWindow.max} value={receivedDate} onChange={e=>setReceivedDate(e.target.value)} className="mt-1 block w-full max-w-xs border rounded-lg bg-white p-2.5" />
        </label>
        <p className="text-xs text-amber-950">Tanggal nota dibuat tetap dicatat sesuai jam sebenarnya (WIB). Pengambilan dihitung dari tanggal setor di atas, bukan dari hari admin mengisi nota. Hari Minggu tidak dihitung.</p>
        {pickup&&<p className="text-sm font-extrabold text-teal-900">Jadwal pengambilan: {longDateWIB(pickup)} • 08:00 WIB</p>}
        {receivedDate!==todayWib&&<p className="text-xs font-bold text-amber-900">Nota susulan: tanggal setor {longDateWIB(receivedDate)}, dibuat pada {longDateWIB(createdAtWIB(new Date()))}.</p>}
      </div>
      <div>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-3"><div><h2 className="font-black text-lg">Daftar Mahasiswa ({members.length})</h2><p className="text-sm text-slate-500">Isi prodi setiap mahasiswa agar rekap produksi per prodi akurat, selain jumlah dan lama pengerjaan.</p></div><button type="button" disabled={members.length>=100} onClick={addMember} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-xl text-sm font-bold disabled:opacity-50"><Plus size={16}/> Tambah Mahasiswa</button></div>
        <div className="space-y-3">
          {members.map((m,i)=><div key={m.key} className="border border-slate-200 bg-slate-50 rounded-2xl p-3 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1.5fr_85px_100px_90px_42px] items-end gap-3">
            <label className="text-xs font-bold text-slate-600">{i+1}. Nama Mahasiswa<input required minLength={2} maxLength={120} value={m.name} onChange={e=>patch(m.key,'name',e.target.value)} placeholder="Nama sesuai sampul" className="mt-1 block w-full border rounded-lg bg-white p-2.5 font-normal"/></label>
            <label className="text-xs font-bold text-slate-600">Prodi<input required minLength={2} maxLength={120} value={m.prodi} onChange={e=>patch(m.key,'prodi',e.target.value)} placeholder="Misal: MPI / Ekonomi Syariah" className="mt-1 block w-full border rounded-lg bg-white p-2.5 font-normal"/></label>
            <label className="text-xs font-bold text-slate-600">Jumlah HC<input type="number" min={1} max={100} required value={m.qty} onChange={e=>patch(m.key,'qty',Number(e.target.value))} className="mt-1 block w-full border rounded-lg bg-white p-2.5 font-normal"/></label>
            <label className="text-xs font-bold text-slate-600">Pengerjaan<select value={m.days} onChange={e=>patch(m.key,'days',Number(e.target.value))} className="mt-1 block w-full border rounded-lg bg-white p-2.5 font-normal"><option value={1}>1 hari</option><option value={2}>2 hari</option><option value={3}>3 hari</option></select></label>
            <div className="text-sm font-black text-teal-900 pb-2">{formatIDR(resellerMemberTotal(m))}</div>
            <button type="button" aria-label={`Hapus mahasiswa ${i+1}`} disabled={members.length===1} onClick={()=>setMembers(prev=>prev.filter(x=>x.key!==m.key))} className="border rounded-lg bg-white p-2.5 text-rose-600 disabled:opacity-25"><Trash2 size={17}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-3 items-start">
            <label className="text-xs font-bold text-slate-700">Pilih Paket / Layanan Mahasiswa
              <select value={m.packageId} onChange={e=>patch(m.key,'packageId',Number(e.target.value))} className="mt-1 block w-full border rounded-lg bg-white p-2.5 font-normal">
                {Object.entries(RESELLER_PACKAGE_NAMES).map(([id,name])=><option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <div className="text-xs text-slate-700">
              <strong>Harga Hard Cover: {formatIDR(RESELLER_HC_UNIT[m.days])} / jilid.</strong>
              {m.packageId===7 ? <div className="mt-2 flex flex-wrap gap-3">{Object.entries(RESELLER_ADDONS).map(([svc,price])=><label key={svc} className="flex items-center gap-1 rounded-lg border bg-white p-2"><input type="checkbox" checked={(m.services||[]).includes(svc)} onChange={e=>patch(m.key,'services',e.target.checked?[...(m.services||[]),svc]:(m.services||[]).filter(x=>x!==svc))}/>{svc} (+{formatIDR(price)})</label>)}</div>
                : <p className="mt-1">Tambahan: {resellerExtras(m).length?resellerExtras(m).map(s=>`${s} (${formatIDR(RESELLER_ADDONS[s])})`).join(' + '):'Tidak ada'}</p>}
              <p className="mt-2 font-extrabold text-teal-800">Subtotal {m.name||`Mahasiswa ${i+1}`}: {formatIDR(resellerMemberTotal(m))}</p>
            </div>
          </div>
          </div>)}
        </div>
      </div>
      <label className="text-sm font-bold text-slate-700 block">Catatan Admin (opsional)<textarea maxLength={450} value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Contoh: Reseller menyerahkan sampul langsung tanpa mengisi formulir" className="block mt-1 w-full border rounded-xl p-3 font-normal"/></label>
      <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 flex flex-wrap items-center justify-between gap-3"><div className="text-sm"><strong>{members.length} mahasiswa • {covers} hard cover</strong><p className="text-xs text-teal-800">HC 1 hari Rp35.000 • 2 hari Rp30.000 • 3 hari Rp25.000 per jilid. CD Rp7.000 • Artikel Rp10.000 • SKEK Rp3.000 • Pisah File Rp5.000 per mahasiswa sesuai pilihan.</p></div><strong className="text-2xl text-teal-900">{formatIDR(total)}</strong></div>
      <p className="text-xs text-slate-600">Nota tersimpan sebagai <strong>Belum Bayar — Menunggu Verifikasi</strong>. Setelah dibuat, admin dapat mencatat Lunas / DP dan memverifikasi lewat menu Verifikasi Nota. Harga dan jumlah divalidasi ulang oleh Supabase.</p>
      {error&&<div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 p-3 flex gap-2 text-sm"><AlertCircle size={18}/>{error}</div>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving||loadingResellers||!chosen} className="bg-teal-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50"><Save size={18}/>{saving?'Menyimpan…':'Simpan Nota Reseller'}</button><button type="button" onClick={onBack} className="border rounded-xl px-6 py-3 font-bold">Batal</button></div>
    </form>
  </main>;
}
