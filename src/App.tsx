import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Header} from './components/Header';
import {OrderForm} from './components/OrderForm';
import {AdminPanel} from './components/AdminPanel';
import {AdminResellerForm} from './components/AdminResellerForm';
import {InvoiceModal} from './components/InvoiceModal';
import {AdminLogin} from './components/AdminLogin';
import {OrderHistory} from './components/OrderHistory';
import {DatabaseInfo} from './components/DatabaseInfo';
import type {OrderRecord, TransactionStatus} from './types';
import {parsePaymentPreference, serializePaymentPreference} from './utils/paymentPreference';
import {adminAuthorized, asOrder, createOnlineOrder,createAdminResellerBatch, confirmOverduePayments, database, fetchAdminOrders, getPublicStatus, rejectOnlineOrder, verifyOnlineOrder, updateProductionStatus, type V8Row, type AdminNotaEdit, updateAdminNota, deleteAdminNota} from './lib/api';

const TOKEN_KEY = 'zainnet_v9_tracking_token';
const OWN_KEY = 'zainnet_v9_own_order';
const TOKEN_REGEX = /^[a-f0-9-]{36}$/i;
type Tab = 'order'|'admin'|'reseller'|'history'|'schema';
function readToken(): string {
  const h=location.hash.match(/^#nota=([a-f0-9-]{36})$/i);
  if(h) return h[1];
  try { return localStorage.getItem(TOKEN_KEY)||localStorage.getItem('zainnet_order_token_v8')||''; } catch {return '';}
}
function readOwnOrder(token: string):OrderRecord|null {
  try {const value=localStorage.getItem(OWN_KEY);const pair=value?JSON.parse(value):null;return pair?.token===token?pair.order:null;}catch{return null;}
}
function setTokenLink(token:string){
  history.replaceState(null,'',`${location.pathname}${location.search}${token?`#nota=${token}`:''}`);
}

export default function App(){
  const [tab,setTab]=useState<Tab>(()=>location.hash==='#admin'?'admin':readOwnOrder(readToken())?.orderKind==='reseller'?'reseller':'order');
  const [token,setToken]=useState(readToken);
  const [ownOrder,setOwnOrder]=useState<OrderRecord|null>(()=>readOwnOrder(readToken()));
  const [publicState,setPublicState]=useState<'PENDING'|'APPROVED'|'REJECTED'|'NOT_FOUND'>('PENDING');
  const [rejectionMessage,setRejectionMessage]=useState('');
  const [notice,setNotice]=useState('');
  const [admin,setAdmin]=useState(false);
  const [adminResellerOpen,setAdminResellerOpen]=useState(false);
  const [authChecked,setAuthChecked]=useState(false);
  const [rows,setRows]=useState<V8Row[]>([]);
  const [invoice,setInvoice]=useState<OrderRecord|null>(null);
  const checking=useRef(false);
  const adminLoading=useRef(false);
  const orders=rows.map(asOrder);

  // Follow a new tracking link even if this single-page app is already open.
  useEffect(()=>{
    const onHash=()=>{const current=readToken();setToken(current);setOwnOrder(readOwnOrder(current));setPublicState('PENDING');};
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);

  const loadAdmin=useCallback(async()=>{
    if(adminLoading.current) return;
    adminLoading.current=true;
    try {setRows(await fetchAdminOrders());}
    catch(e){setNotice(`Gagal sinkron data admin: ${e instanceof Error?e.message:String(e)}`);}
    finally{adminLoading.current=false;}
  },[]);

  useEffect(()=>{let live=true;(async()=>{
    try {const ok=await adminAuthorized(); if(live){setAdmin(ok);if(ok)await loadAdmin();}}
    catch(e){if(live)setNotice(e instanceof Error?e.message:String(e));}
    finally{if(live)setAuthChecked(true);}
  })();return()=>{live=false;};},[loadAdmin]);

  useEffect(()=>{
    if(!admin)return;
    const id=window.setInterval(()=>{void loadAdmin()},12000);
    return()=>window.clearInterval(id);
  },[admin,loadAdmin]);

  useEffect(()=>{
    if(!token || !TOKEN_REGEX.test(token))return;
    let alive=true;
    async function poll(){
      if(checking.current)return;
      checking.current=true;
      try {
        const data=await getPublicStatus(token);
        if(!alive)return;
        setPublicState(data.state);
        if(data.state==='APPROVED'&&data.order){
          const mapped={...asOrder(data.order),couponTrackingToken:token};
          setOwnOrder(mapped);
          try {localStorage.setItem(OWN_KEY,JSON.stringify({token,order:mapped}));}catch{}
        }
        if(data.state==='REJECTED')setRejectionMessage(data.message||'Hubungi admin ZAIN.NET untuk informasi lebih lanjut.');
      }catch(e){if(alive)setNotice('Tidak dapat memeriksa status online: '+(e instanceof Error?e.message:String(e)));}
      finally{checking.current=false;}
    }
    void poll();
    const timer=window.setInterval(()=>{void poll()},7000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[token]);

  async function submitOnline(order:OrderRecord):Promise<OrderRecord>{
    // Supabase RPC validates price, date, quantity and payment; only save on success.
    const data=await createOnlineOrder(order);
    const accepted={...order,orderId:data.id,couponTrackingToken:data.token};
    try{localStorage.setItem(TOKEN_KEY,data.token);localStorage.setItem(OWN_KEY,JSON.stringify({token:data.token,order:accepted}));}catch{}
    setTokenLink(data.token);
    setToken(data.token);
    setOwnOrder(accepted);
    setPublicState('PENDING');
    return accepted;
  }
  function newOrder(){
    if(token && !confirm('Buat pesanan baru? Salin tautan pelacakan pesanan sebelumnya agar tetap bisa dibuka nanti.'))return;
    try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(OWN_KEY);localStorage.removeItem('zainnet_order_token_v8');}catch{}
    setTokenLink('');setToken('');setOwnOrder(null);setPublicState('PENDING');setRejectionMessage('');setTab('order');
  }
  async function updateStatus(id:string,_status:OrderRecord['status'],transactionStatus:TransactionStatus,_confirmed:boolean,_by?:string,amount?:number){
    const o=rows.find(r=>r.id===id);if(!o)return;
    try {
      const target=transactionStatus==='Lunas'||transactionStatus==='LUNAS'?'Lunas':transactionStatus==='DP'?'DP':'Belum Bayar';
      if (await verifyOnlineOrder(o,target,amount)) {
        await loadAdmin();
        setNotice('Pembayaran berhasil dicatat oleh admin.');
      }
    }catch(e){setNotice(`Gagal verifikasi: ${e instanceof Error?e.message:String(e)}`);}
  }
  async function confirmOverdueBatch(ids:string[]):Promise<number> {
    const total = await confirmOverduePayments(ids);
    await loadAdmin();
    setNotice(`${total} nota terlambat berhasil dikonfirmasi lunas dan tersimpan dalam audit admin.`);
    return total;
  }
  async function editNota(id:string, data:AdminNotaEdit) {
    // Pertahankan pilihan pembayaran mahasiswa saat admin memperbaiki catatan pesanan.
    const existing = rows.find(row=>row.id===id);
    const pref = parsePaymentPreference(existing?.notes || '').choice;
    await updateAdminNota(id,{...data,notes:serializePaymentPreference(data.notes, pref)});
    await loadAdmin();
    setNotice('Perubahan nota berhasil disimpan dan dihitung ulang.');
  }
  async function deleteNota(id:string) {
    const row=rows.find(r=>r.id===id);
    if(!row)return false;
    const deleted=await deleteAdminNota(row);
    if(deleted){await loadAdmin();setNotice('Nota berhasil dihapus permanen.');}
    return deleted;
  }
  async function reject(id:string,note:string){
    const row=rows.find(r=>r.id===id);if(!row)return;
    try{await rejectOnlineOrder(row,note);await loadAdmin();setNotice('Status penolakan berhasil disimpan.');}
    catch(e){setNotice(`Gagal menolak pesanan: ${e instanceof Error?e.message:String(e)}`);}
  }
  async function saveProduction(id:string,status:OrderRecord['status'],completedOn:string|null){
    await updateProductionStatus(id,status,completedOn);
    await loadAdmin();
    setNotice('Status pengerjaan dan tanggal selesai berhasil disimpan.');
  }
  async function createResellerByAdmin(data:import('./lib/api').AdminResellerBatchInput){
    await createAdminResellerBatch(data);
    setAdminResellerOpen(false);
    await loadAdmin();
    setNotice('Nota kolektif reseller berhasil disimpan. Silakan buka Verifikasi Nota untuk memeriksa pembayaran.');
  }
  async function logout(){
    try{await database().auth.signOut();}catch(e){setNotice(e instanceof Error?e.message:String(e));}
    setAdmin(false);setRows([]);setTab('order');setInvoice(null);setAdminResellerOpen(false);
  }
  function navigate(next:Tab){
    setAdminResellerOpen(false);
    setTab(next);
    // Partner login and admin login share one Supabase Auth session. Always re-check
    // membership when visiting protected admin screens, never trust stale React state.
    if(next==='admin'||next==='history'||next==='schema') {
      setAuthChecked(false);
      setAdmin(false);
      setRows([]);
      void (async()=>{try{const ok=await adminAuthorized();setAdmin(ok);if(ok)await loadAdmin();}
        catch(e){setNotice(e instanceof Error?e.message:String(e));}
        finally{setAuthChecked(true);}})();
    }
  }

  const publicOrders=ownOrder?[ownOrder]:[];
  return <div className={`app-shell min-h-screen flex flex-col${invoice ? ' invoice-open' : ''}`}>
    <Header currentTab={tab} setCurrentTab={navigate} orderCount={admin?orders.length:0} pendingCount={admin?rows.filter(r=>r.verification_status==='PENDING').length:0}/>
    {notice&&<div role="alert" className="max-w-7xl mx-auto w-full mt-3 px-4"><div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 justify-between text-sm"><span>{notice}</span><button onClick={()=>setNotice('')} className="font-bold" aria-label="Tutup pesan">✕</button></div></div>}
    <div className="flex-1">
      {tab==='order'&&<>
        {token&&publicState==='REJECTED'?<div className="max-w-xl mx-auto p-5 mt-8 text-center bg-white rounded-3xl border border-rose-200 shadow"><h1 className="text-2xl font-black text-rose-700">Pesanan Memerlukan Perbaikan</h1><p className="my-5 text-sm">{rejectionMessage}</p><button className="bg-teal-500 rounded-xl px-5 py-3 font-bold" onClick={newOrder}>Buat Pesanan Baru</button></div>:
        token&&publicState==='NOT_FOUND'?<div className="max-w-xl mx-auto p-5 mt-8 text-center bg-white rounded-3xl"><h1 className="text-xl font-black">Tautan Pesanan Tidak Ditemukan</h1><p className="my-4">Periksa token pelacakan atau hubungi admin ZAIN.NET.</p><button className="bg-teal-400 p-3 rounded-xl" onClick={newOrder}>Buat Pesanan Baru</button></div>:
        token&&!ownOrder?<div className="max-w-xl mx-auto p-6 mt-8 text-center bg-white rounded-3xl shadow space-y-4"><div className="text-4xl">⏳</div><h1 className="text-2xl font-black">Memeriksa Verifikasi Admin</h1><p>Status diperiksa otomatis setiap 7 detik. Simpan tautan halaman ini untuk cek pesanan.</p><button className="p-3 rounded-xl bg-slate-900 text-white" onClick={()=>navigator.clipboard.writeText(location.href)}>Salin Tautan Pelacakan</button><button className="p-3 rounded-xl border ml-2" onClick={newOrder}>Pesanan Baru</button></div>:
        <>
          {token&&<div className="max-w-7xl mx-auto px-4 pt-4 flex flex-wrap gap-2"><button onClick={()=>navigator.clipboard.writeText(location.href)} className="text-xs bg-teal-50 border border-teal-300 text-teal-800 p-2 rounded-lg">🔗 Salin tautan cek pesanan</button><button onClick={newOrder} className="text-xs bg-white border p-2 rounded-lg">+ Buat Pesanan Baru</button>{ownOrder?.adminConfirmed&&<button onClick={()=>setInvoice(ownOrder)} className="text-xs bg-emerald-500 text-white p-2 rounded-lg">🎟 Buka Nota + Kupon 50%</button>}</div>}
          <OrderForm key={token||'fresh'} mode="student" orders={publicOrders} onOrderCreated={submitOnline} initialSubmittedOrderId={token&&ownOrder?ownOrder.orderId:undefined} />
        </>}
      </>}
      {tab==='reseller'&&<>
        {token&&ownOrder?.orderKind==='reseller'&&<div className="max-w-7xl mx-auto px-4 pt-4 flex flex-wrap gap-2">
          <button onClick={()=>navigator.clipboard.writeText(location.href)} className="text-xs bg-teal-50 border border-teal-300 p-2 rounded-lg">🔗 Salin tautan cek pesanan mitra</button>
          <button onClick={()=>{newOrder();setTab('reseller')}} className="text-xs bg-white border p-2 rounded-lg">+ Pesanan Baru Mitra</button>
          {publicState==='APPROVED'&&<button onClick={()=>setInvoice(ownOrder)} className="text-xs bg-emerald-500 text-white p-2 rounded-lg">⬇ Nota JPG</button>}
        </div>}
        <OrderForm key={ownOrder?.orderKind==='reseller'?token:'reseller-form'} mode="reseller" orders={ownOrder?.orderKind==='reseller'?[ownOrder]:[]}
          onOrderCreated={submitOnline} initialSubmittedOrderId={ownOrder?.orderKind==='reseller'?ownOrder.orderId:undefined}
          onPartnerAuthenticated={()=>{setAdmin(false);setRows([]);}}/>
      </>}
      {tab==='admin'&&(authChecked ? admin ? adminResellerOpen ? <AdminResellerForm onBack={()=>setAdminResellerOpen(false)} onSubmit={createResellerByAdmin}/> : <AdminPanel orders={orders} onSelectOrder={setInvoice} onRejectOrder={reject} onLogout={logout} onUpdateStatus={updateStatus} onProductionChange={saveProduction} onEditOrder={editNota} onDeleteOrder={deleteNota} onConfirmOverdueBatch={confirmOverdueBatch} onSwitchToOrderForm={()=>setTab('order')} onCreateResellerOrder={()=>setAdminResellerOpen(true)}/>:<AdminLogin onAuthenticated={()=>{setAdmin(true);void loadAdmin();}}/>:<div className="text-center p-10">Memeriksa sesi admin…</div>)}
      {tab==='history'&&(admin?<OrderHistory orders={orders} onSelectOrder={setInvoice} onCreateNew={()=>setTab('order')}/>:<AdminLogin onAuthenticated={()=>{setAdmin(true);void loadAdmin();}}/>)}
      {tab==='schema'&&(admin?<DatabaseInfo/>:<AdminLogin onAuthenticated={()=>{setAdmin(true);void loadAdmin();}}/>)}
    </div>
    {invoice&&<InvoiceModal order={invoice} onClose={()=>setInvoice(null)}/>}
    <footer className="no-print text-center border-t bg-white text-xs text-slate-500 p-5 mt-10">ZAIN.NET • Nota Otomatis V9.12.2 • Data online Supabase • Pengambilan Senin–Sabtu</footer>
  </div>;
}
