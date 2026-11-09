import React, {useEffect, useMemo, useState} from 'react';
import {
  Archive, ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardCopy, Clock3, CreditCard, Pencil, Trash2,
  FileText, LayoutDashboard, LogOut, Phone, Plus, Search, ShieldCheck,
  Store, Users, Wallet, X, Eye, AlertCircle, Layers,
} from 'lucide-react';
import type {OrderRecord, TransactionStatus} from '../types';
import type {AdminNotaEdit} from '../lib/api';
import {formatIDR} from '../utils/pricing';
import {summarizeWorkInProgress} from '../utils/workloadReport';
import {paymentPreferenceLabel} from '../utils/paymentPreference';
import {longDateWIB,orderToPickupCalendarDays} from '../utils/orderDateTime';
import {PartnerManager} from './PartnerManager';
import {PRODUCTS} from './OrderForm';
import {ProductionCalendar} from './ProductionCalendar';
import {ProductionStatusEditor, type ProductionChange} from './ProductionStatusEditor';
import {
  archivedForDashboard, covers, dashboardPickupBuckets, dateISO, inProgressPickupWindow, overduePaymentOrders, isActiveOrder, pickupCustomerCount, pickupDay,
  pickupNoticeText, pickupSource, sortByPickupPriority, upcomingISO,
} from '../utils/orderPriority';

interface AdminPanelProps {
  orders: OrderRecord[];
  onSelectOrder: (order: OrderRecord) => void;
  onRejectOrder: (orderId: string, note: string) => void;
  onLogout: () => void;
  onUpdateStatus: (orderId: string, status: OrderRecord['status'], transactionStatus: TransactionStatus,
    adminConfirmed: boolean, adminConfirmedBy?: string, dpAmount?: number) => void;
  onSwitchToOrderForm: () => void;
  onCreateResellerOrder: () => void;
  onProductionChange: ProductionChange;
  onEditOrder: (id:string, edit:AdminNotaEdit) => Promise<void>;
  onDeleteOrder: (id:string) => Promise<boolean>;
  onConfirmOverdueBatch: (ids:string[]) => Promise<number>;
}

type MenuId = 'physical'|'home'|'calendar'|'today'|'day1'|'day2'|'day3'|'future'|'in_progress'|'overdue'|'pending'|'orders'|'archive'|'payments'|'pay_lunas'|'pay_dp'|'pay_unpaid'|'partners';
type PaymentFilter = 'all'|'lunas'|'dp'|'belum_bayar';
type VerificationFilter = 'all'|'pending'|'verified';

function dateLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Belum dijadwalkan';
  return new Intl.DateTimeFormat('id-ID', {weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(`${iso}T12:00:00Z`));
}
function statusPayment(order: OrderRecord): PaymentFilter {
  const v = String(order.transactionStatus || '').toLowerCase();
  return v.includes('lunas') ? 'lunas' : v.includes('dp') ? 'dp' : 'belum_bayar';
}
function orderMatches(order: OrderRecord, text: string): boolean {
  const query = text.trim().toLocaleLowerCase('id-ID');
  if (!query) return true;
  return [order.orderId,order.studentName,order.whatsapp,order.prodi,order.fakultas,
    order.resellerCompany || '',...(order.resellerStudents||[]).map(m=>m.name)].some(field => String(field || '').toLocaleLowerCase('id-ID').includes(query));
}

const navSections: Array<{label:string; entries:Array<{id:MenuId; name:string; icon:typeof LayoutDashboard}>}> = [
  {label:'UTAMA',entries:[
    {id:'home',name:'Beranda',icon:LayoutDashboard},
    {id:'calendar',name:'Kalender',icon:CalendarDays},
  ]},
  {label:'JADWAL PENGAMBILAN',entries:[
    {id:'today',name:'Pengambilan Hari Ini',icon:Clock3},
    {id:'day1',name:'Pengambilan Besok',icon:CalendarDays},
    {id:'day2',name:'Pengambilan 2 Hari Lagi',icon:CalendarDays},
    {id:'day3',name:'Pengambilan 3 Hari Lagi',icon:CalendarDays},
    {id:'future',name:'Pengambilan Mendatang (4+ Hari)',icon:CalendarDays},
    {id:'in_progress',name:'Daftar Jilid Dikerjakan (Hari Ini–4 Hari)',icon:BookOpen},
  ]},
  {label:'STATUS PEMBAYARAN',entries:[
    {id:'pay_lunas',name:'SUDAH BAYAR — LUNAS',icon:CheckCircle2},
    {id:'pay_dp',name:'DP — KURANG BAYAR',icon:CreditCard},
    {id:'pay_unpaid',name:'BELUM BAYAR',icon:AlertCircle},
    {id:'overdue',name:'Pengingat Pelunasan',icon:Bell},
  ]},
  {label:'PENGELOLAAN',entries:[
    {id:'pending',name:'Verifikasi Nota',icon:ShieldCheck},
    {id:'orders',name:'Semua Nota',icon:FileText},
    {id:'archive',name:'Arsip',icon:Archive},
    {id:'payments',name:'Pembayaran',icon:Wallet},
    {id:'partners',name:'Kelola Reseller',icon:Store},
    {id:'physical',name:'Kupon Fisik Toga',icon:ShieldCheck},
  ]},
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  orders,onSelectOrder,onRejectOrder,onLogout,onUpdateStatus,onSwitchToOrderForm,onCreateResellerOrder,onProductionChange,onEditOrder,onDeleteOrder,onConfirmOverdueBatch,
}) => {
  const [menu,setMenu] = useState<MenuId>('home');
  const [search,setSearch] = useState('');
  const [paymentFilter,setPaymentFilter] = useState<PaymentFilter>('all');
  const [verificationFilter,setVerificationFilter] = useState<VerificationFilter>('all');
  const [calendarFilter,setCalendarFilter] = useState('');
  const [expanded,setExpanded] = useState<string|null>(null);
  const [dpEditId,setDpEditId] = useState<string|null>(null);
  const [dpInput,setDpInput] = useState('');
  const [editing,setEditing] = useState<string|null>(null);
  const [editData,setEditData] = useState<AdminNotaEdit|null>(null);
  const [editBusy,setEditBusy] = useState(false);
  const [editError,setEditError] = useState('');
  const [copied,setCopied] = useState(false);
  const [now,setNow] = useState(()=>Date.now());
  const [showOverdueModal,setShowOverdueModal] = useState(false);
  const [overdueModalShown,setOverdueModalShown] = useState(false);
  const [overdueSelected,setOverdueSelected] = useState<string[]>([]);
  const [overdueBusy,setOverdueBusy] = useState(false);
  const [overdueError,setOverdueError] = useState('');

  useEffect(()=>{
    const timer = window.setInterval(()=>setNow(Date.now()),60000);
    return ()=>window.clearInterval(timer);
  },[]);
  const today = useMemo(()=>dateISO(new Date(now)),[now]);
  const dates = useMemo(()=>[0,1,2,3].map(offset=>upcomingISO(offset,new Date(now))),[now]);
  const pendingOrders = useMemo(()=>orders.filter(o=>o.verificationStatus==='PENDING' || (!o.verificationStatus&&!o.adminConfirmed)),[orders]);
  const archiveOrders = useMemo(()=>orders.filter(o=>archivedForDashboard(o,today)),[orders,today]);
  const active = useMemo(()=>orders.filter(o=>isActiveOrder(o)&&!archivedForDashboard(o,today)),[orders,today]);
  const daily = useMemo(()=>dashboardPickupBuckets(orders,new Date(now)),[orders,dates]);
  // An order may be freshly registered but its pickup is more than 3 days away.
  // Keep 0..3 day groups accurate; offer a separate upcoming group.
  const future = useMemo(()=>sortByPickupPriority(active.filter(o=>pickupDay(o)>dates[3])),[active,dates]);
  const undated = useMemo(()=>active.filter(o=>!pickupDay(o)),[active]);
  const workboard = useMemo(()=>inProgressPickupWindow(orders,new Date(now)),[orders,today]);
  const workloadRecap = useMemo(()=>summarizeWorkInProgress(workboard),[workboard]);
  const overdue = useMemo(()=>overduePaymentOrders(orders,new Date(now)),[orders,today]);
  useEffect(()=>{
    // On first successful admin load, show the overdue notice once per admin
    // screen session. Closing it never mutates payment data.
    if(overdue.length>0 && !overdueModalShown){
      setShowOverdueModal(true);
      setOverdueModalShown(true);
    }
  },[overdue.length,overdueModalShown]);
  const totalBooks = covers(active);
  const currentList = useMemo(()=>{
    let list: OrderRecord[];
    switch(menu){
      case 'today': list=daily[0]; break;
      case 'day1': list=daily[1]; break;
      case 'day2': list=daily[2]; break;
      case 'day3': list=daily[3]; break;
      case 'future': list=future; break;
      case 'in_progress': list=workboard; break;
      case 'overdue': list=overdue; break;
      case 'pending': list=pendingOrders; break;
      case 'archive': list=archiveOrders; break;
      case 'payments': list=orders; break;
      case 'pay_lunas': list=orders.filter(o=>statusPayment(o)==='lunas'); break;
      case 'pay_dp': list=orders.filter(o=>statusPayment(o)==='dp'); break;
      case 'pay_unpaid': list=orders.filter(o=>statusPayment(o)==='belum_bayar'); break;
      case 'orders': list=calendarFilter ? orders.filter(o=>pickupDay(o)===calendarFilter) : orders; break;
      default: list=[];
    }
    const matched = list.filter(o=>
      orderMatches(o,search) &&
      (verificationFilter==='all' || (verificationFilter==='pending' ? (o.verificationStatus==='PENDING'||(!o.verificationStatus&&!o.adminConfirmed)) : o.adminConfirmed)) &&
      (paymentFilter==='all' || statusPayment(o)===paymentFilter)
    );
    return menu==='archive' ? matched.sort((a,b)=>b.pickupDate.localeCompare(a.pickupDate)) : sortByPickupPriority(matched);
  },[menu,orders,daily,future,workboard,overdue,pendingOrders,archiveOrders,calendarFilter,search,verificationFilter,paymentFilter]);
  const dayMenu = menu==='today'||menu==='day1'||menu==='day2'||menu==='day3';
  const upcomingMenu = menu==='future';
  const workboardMenu = menu==='in_progress';
  const overdueMenu = menu==='overdue';
  const listingMenu = dayMenu||upcomingMenu||workboardMenu||overdueMenu||menu==='pending'||menu==='archive'||menu==='orders'||menu==='payments'||menu==='pay_lunas'||menu==='pay_dp'||menu==='pay_unpaid';
  const dayIndex = menu==='today'?0:menu==='day1'?1:menu==='day2'?2:3;
  const pageTitles:Record<MenuId,string> = {
    home:'Ringkasan Operasional', calendar:'Kalender Produksi', today:'Pengambilan Hari Ini',
    day1:'Pengambilan Besok',day2:'Pengambilan 2 Hari Lagi',day3:'Pengambilan 3 Hari Lagi',
    future:'Pengambilan Mendatang (4+ Hari)',in_progress:'Daftar Seluruh Jilid yang Sedang Dikerjakan (Hari Ini–4 Hari Lagi)',overdue:'Pengingat Pelunasan Terlambat',
    pending:'Menunggu Verifikasi',orders:'Semua Nota',archive:'Arsip Nota',
    payments:'Data Pembayaran',pay_lunas:'Sudah Bayar — Lunas',pay_dp:'Sudah DP',pay_unpaid:'Belum Bayar',partners:'Kelola Reseller',physical:'Kupon Fisik Toga',
  };
  const menuCounts: Partial<Record<MenuId,number>> = {
    today:daily[0].length,day1:daily[1].length,day2:daily[2].length,day3:daily[3].length,future:future.length,in_progress:workboard.length,overdue:overdue.length,
    pending:pendingOrders.length,orders:orders.length,archive:archiveOrders.length,
    pay_lunas:orders.filter(o=>statusPayment(o)==='lunas').length,
    pay_dp:orders.filter(o=>statusPayment(o)==='dp').length,
    pay_unpaid:orders.filter(o=>statusPayment(o)==='belum_bayar').length,
  };

  async function confirmOverdueSelected(ids:string[]) {
    const unique=[...new Set(ids)].filter(id=>overdue.some(o=>o.orderId===id));
    if(!unique.length){setOverdueError('Centang minimal satu nota yang sudah benar-benar dilunasi.');return;}
    const total=overdue.filter(o=>unique.includes(o.orderId)).reduce((sum,o)=>sum+Math.max(0,o.totalCost-(o.dpAmount||0)),0);
    if(!window.confirm(`Pastikan uang pelunasan sebesar ${formatIDR(total)} benar-benar SUDAH diterima untuk ${unique.length} nota. Konfirmasi sebagai LUNAS?`))return;
    setOverdueBusy(true);setOverdueError('');
    try {
      await onConfirmOverdueBatch(unique);
      setOverdueSelected([]);
      setShowOverdueModal(false);
    } catch(err){setOverdueError(err instanceof Error ? err.message : String(err));}
    finally{setOverdueBusy(false);}
  }
  function openMenu(target:MenuId){
    setMenu(target);setSearch('');setVerificationFilter('all');setPaymentFilter('all');
    setCalendarFilter('');setExpanded(null);setDpEditId(null);setEditing(null);
    // Keep the active area visible when changing menus from a long customer list.
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function filterCalendar(day:string){
    openMenu('orders');setCalendarFilter(day);
  }
  function verify(o:OrderRecord, type:TransactionStatus, dp?:number){
    onUpdateStatus(o.orderId,'Proses Jilid',type,true,'Admin ZAIN.NET',
      type==='Lunas'?o.totalCost:(dp===undefined?o.dpAmount:dp));
    setDpEditId(null);
  }
  function beginEdit(order:OrderRecord){
    setEditing(order.orderId);
    setEditError('');
    setEditData({customerName:order.studentName,phone:order.whatsapp,faculty:order.fakultas,
      major:order.prodi,notes:order.notes || '',pickupDate:order.pickupDate.slice(0,10),
      quantities:(order.items || []).map((i:any)=>Number(i.qty || 1)),
      durations:(order.items || []).map((i:any)=>Number(i.days || 3)),
      packageIds:(order.items || []).map((i:any)=>{const index=PRODUCTS.indexOf(i.product);return index<6&&index>=0?index+1:0;}),
      extras:(order.extras || []).map((e:any)=>({label:String(e.description || ''),amount:Number(e.amount||0)})),
    });
  }
  async function saveEdit(){
    if(!editing || !editData)return;
    setEditBusy(true);setEditError('');
    try {await onEditOrder(editing,editData);setEditing(null);setEditData(null);}
    catch(err){setEditError(err instanceof Error ? err.message : String(err));}
    finally{setEditBusy(false);}
  }
  async function removeNota(order:OrderRecord){
    setEditBusy(true);setEditError('');
    try {if(await onDeleteOrder(order.orderId)){setEditing(null);setExpanded(null);}}
    catch(err){setEditError(err instanceof Error ? err.message : String(err));}
    finally{setEditBusy(false);}
  }
  async function copyReminder(){
    try {
      await navigator.clipboard.writeText(pickupNoticeText(orders,new Date(now)));
      setCopied(true);
      window.setTimeout(()=>setCopied(false),2000);
    }catch{window.alert('Gagal menyalin pengingat. Periksa izin clipboard browser.');}
  }
  const quickActions:Array<{id:MenuId;icon:typeof CalendarDays;sub:string;count:number|string;tone:string}>=[
    {id:'today',icon:Clock3,sub:dateLabel(dates[0]),count:pickupCustomerCount(daily[0]),tone:'sky'},
    {id:'day1',icon:CalendarDays,sub:dateLabel(dates[1]),count:pickupCustomerCount(daily[1]),tone:'amber'},
    {id:'day2',icon:CalendarDays,sub:dateLabel(dates[2]),count:pickupCustomerCount(daily[2]),tone:'violet'},
    {id:'day3',icon:CalendarDays,sub:dateLabel(dates[3]),count:pickupCustomerCount(daily[3]),tone:'mint'},
  ];

  return <div className="zain-admin no-print">
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Menu administrasi ZAIN.NET">
        <div className="admin-sidebar-brand"><div className="admin-side-icon"><Layers size={23}/></div><div><strong>ZAIN.NET</strong><span>Workspace Admin • V9.12.2</span></div></div>
        <div className="admin-sidebar-groups">
          {navSections.map(section=><div className="admin-nav-group" key={section.label}>
            <p>{section.label}</p>
            {section.entries.map(({id,name,icon:Icon})=><button type="button" key={id}
              className={`admin-side-link${menu===id?' is-current':''}${id==='pay_lunas'?' admin-nav-paid':id==='pay_dp'?' admin-nav-deposit':id==='pay_unpaid'?' admin-nav-unpaid':''}`} aria-current={menu===id?'page':undefined} onClick={()=>openMenu(id)}>
              <Icon size={17}/><span>{name}</span>{menuCounts[id]!==undefined&&<b>{menuCounts[id]}</b>}
            </button>)}
          </div>)}
        </div>
        <div className="admin-sidebar-footer"><button type="button" onClick={onCreateResellerOrder}><Plus size={17}/> Buat Nota Reseller</button><button type="button" onClick={onSwitchToOrderForm}><Plus size={17}/> Buat Nota Baru</button><button type="button" onClick={onLogout}><LogOut size={16}/> Keluar</button></div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div><span className="admin-eyebrow"><span className="admin-live-dot"/> DASHBOARD ADMIN · WAKTU WIB</span><h1>{pageTitles[menu]}</h1><p>Kelola nota, jadwal pengambilan, dan produksi dalam satu tempat.</p></div>
          <div className="admin-top-actions"><button className="admin-action-outline" type="button" onClick={()=>openMenu('calendar')}><CalendarDays size={16}/> Kalender</button><button className="admin-action-primary" type="button" onClick={onSwitchToOrderForm}><Plus size={17}/> Buat Nota</button><button className="admin-action-outline" type="button" onClick={onCreateResellerOrder}><Store size={16}/> Nota Reseller</button></div>
        </div>
        <div className="admin-mobile-menu" aria-label="Pilih menu admin">
          {navSections.flatMap(section=>section.entries).map(({id,name,icon:Icon})=><button key={id} type="button" className={`${menu===id?'selected':''} ${id==='pay_lunas'?'admin-nav-paid':id==='pay_dp'?'admin-nav-deposit':id==='pay_unpaid'?'admin-nav-unpaid':''}`} onClick={()=>openMenu(id)} aria-pressed={menu===id}><Icon size={15}/>{name}{menuCounts[id]!==undefined&&<small>{menuCounts[id]}</small>}</button>)}
        </div>

        {menu==='home'&&<div className="admin-page-area">
          <section className="admin-welcome">
            <div><span className="admin-welcome-chip"><span/> SISTEM AKTIF</span><h2>Selamat datang di panel kerja ZAIN.NET</h2><p>Pilih satu menu untuk membuka pekerjaan. Daftar pelanggan tidak memenuhi layar sebelum diperlukan.</p><button type="button" onClick={()=>openMenu('pending')}>Periksa verifikasi <ArrowRight size={16}/></button></div>
            <div className="admin-welcome-deco" aria-hidden="true"><CalendarDays size={65}/></div>
          </section>
          <div className="admin-metric-row">
            <div><span>Pesanan aktif</span><strong>{active.length}</strong><small>Belum diarsipkan</small></div>
            <div><span>Butuh verifikasi</span><strong>{pendingOrders.length}</strong><small>Perlu ditinjau admin</small></div>
            <div><span>Hard cover aktif</span><strong>{totalBooks}</strong><small>Total eksemplar</small></div>
            <div><span>Sudah diarsipkan</span><strong>{archiveOrders.length}</strong><small>Jadwal lewat / selesai</small></div>
          </div>
          <div className="admin-section-heading"><div><h2>Jadwal pengambilan</h2><p>Dikelompokkan menurut tanggal pengambilan, bukan durasi paket pada nota.</p></div><button type="button" onClick={()=>openMenu('calendar')}>Lihat kalender <ArrowRight size={16}/></button></div>
          <div className="admin-day-grid">
            {quickActions.map(({id,icon:Icon,sub,count,tone})=><button type="button" key={id} className={`admin-day-card admin-tone-${tone}`} onClick={()=>openMenu(id)}><div className="admin-day-head"><span><Icon size={20}/></span><ChevronRight size={19}/></div><p>{pageTitles[id]}</p><strong>{count} <small>pelanggan</small></strong><span className="admin-card-date">{sub}</span><span className="admin-card-more">Buka daftar <ArrowRight size={14}/></span></button>)}
          </div>
          <section className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div><strong className="text-sm text-cyan-950">Jadwal setelah 3 hari: {future.length} nota / {covers(future)} HC</strong><p className="text-xs mt-1 text-cyan-800">Nota baru dengan tanggal ambil lebih dari tiga hari tidak masuk kartu Hari Ini–3 Hari Lagi. {future[0] ? `Pengambilan berikutnya: ${dateLabel(pickupDay(future[0]))}.` : ''}{undated.length ? ` ${undated.length} nota belum memiliki tanggal pengambilan.` : ''}</p></div>
            <button className="shrink-0 rounded-xl bg-cyan-800 px-4 py-2 text-white text-xs font-bold" type="button" onClick={()=>openMenu('future')}>Lihat Jadwal Mendatang →</button>
          </section>
          <section className="admin-v9120-summary">
            <button type="button" onClick={()=>openMenu('in_progress')}><BookOpen size={20}/><span><strong>{workboard.length} nota dalam pengerjaan</strong><small>Pengambilan hari ini sampai 4 hari ke depan • {covers(workboard)} hard cover</small></span><ArrowRight size={17}/></button>
            <button type="button" onClick={()=>openMenu('overdue')}><Bell size={20}/><span><strong>{overdue.length} nota perlu konfirmasi pelunasan</strong><small>Sudah lewat setidaknya 1 hari dari jadwal pengambilan</small></span><ArrowRight size={17}/></button>
          </section>
          <div className="admin-section-heading"><div><h2>Menu pengelolaan</h2><p>Buka fitur tambahan saat dibutuhkan.</p></div></div>
          <div className="admin-feature-grid">
            {([['calendar',CalendarDays,'Lihat kalender lengkap'],['pending',ShieldCheck,'Konfirmasi pembayaran'],['payments',CreditCard,'Lunas, DP, belum bayar'],['orders',FileText,'Cari semua nota'],['archive',Archive,'Pengambilan yang sudah lewat'],['partners',Store,'Akun dan data percetakan'],['future',CalendarDays,'Pengambilan mulai 4 hari lagi'],['in_progress',BookOpen,'Seluruh jilid belum selesai dari hari ini sampai 4 hari'],['overdue',Bell,'Nota lewat jadwal ambil yang belum lunas']] as const).map(([id,Icon,description])=><button type="button" key={id} onClick={()=>openMenu(id)}><span className="admin-feature-icon"><Icon size={20}/></span><span><strong>{pageTitles[id]}</strong><small>{description}</small></span><ArrowRight size={16}/></button>)}
          </div>
        </div>}

        {menu==='calendar'&&<div className="admin-page-area"><div className="admin-content-intro"><CalendarDays size={22}/><div><h2>Kalender jadwal & pengerjaan</h2><p>Klik tanggal untuk memeriksa pengambilan atau pekerjaan yang selesai disampul.</p></div></div><ProductionCalendar orders={orders} now={now} onSelectOrder={onSelectOrder} onFilterDate={filterCalendar}/></div>}

        {menu==='physical'&&<div className="admin-page-area"><section className="admin-list-intro"><div className="admin-list-symbol"><ShieldCheck size={24}/></div><div className="admin-list-copy"><h2>Verifikasi Kupon Fisik Sewa Toga</h2><p>Kupon kertas promo lama masih diterima. Admin harus memeriksa, menarik kupon ASLI, dan memberi tanda SUDAH DIPAKAI. Pengesahan dan penguncian satu-kali-pakai berlangsung pada panel Sewa Toga dengan akun admin ZAIN.NET yang sama.</p></div></section><div style={{padding:'20px',background:'#fff',border:'1px solid #dae7ed',borderRadius:16,marginTop:14}}><p style={{marginBottom:12}}>Langkah: mahasiswa daftar sewa toga → pilih kupon fisik → tunjukkan kertas asli ke loket → admin buka menu Verifikasi Kupon Fisik di Panel Sewa Toga → cek dan sahkan → setelah pembayaran Rp100.000, nota sewa bisa diterbitkan dengan harga Rp15.000 + jaminan Rp85.000.</p><a className="admin-action-primary" href="https://sewatoga.pages.dev/admin.html" target="_blank" rel="noopener noreferrer">Buka Panel Sewa Toga ↗</a><p style={{marginTop:14,fontSize:13,color:'#64748b'}}>Kupon digital hasil nota hard cover tetap diterbitkan otomatis dan menggunakan kode unik tersendiri.</p></div></div>}
        {menu==='partners'&&<div className="admin-page-area"><div className="admin-content-intro"><Store size={22}/><div><h2>Manajemen reseller</h2><p>Kelola pendaftaran, harga, dan akses mitra percetakan.</p></div></div><button type="button" className="admin-action-primary mb-4" onClick={onCreateResellerOrder}><Plus size={16}/> Buat Nota Reseller dari Admin</button><PartnerManager/></div>}

        {listingMenu&&<div className="admin-page-area">
          <section className="admin-list-intro">
            <div className="admin-list-symbol">{menu==='overdue'?<Bell size={23}/>:menu==='in_progress'?<BookOpen size={23}/>:menu==='archive'?<Archive size={23}/>:menu==='pending'?<ShieldCheck size={23}/>:menu==='payments'?<Wallet size={23}/>:dayMenu?<CalendarDays size={23}/>:<FileText size={23}/>}</div>
            <div className="admin-list-copy"><h2>{pageTitles[menu]}</h2><p>{dayMenu ? `${dateLabel(dates[dayIndex])} • ${daily[dayIndex].length} nota • ${pickupCustomerCount(daily[dayIndex])} pelanggan • ${covers(daily[dayIndex])} hard cover` : upcomingMenu ? `Pengambilan mulai ${dateLabel(upcomingISO(4,new Date(now)))} • ${future.length} nota. Tanggal lebih dari 3 hari memang tidak muncul di kartu harian.` : workboardMenu ? `${workboard.length} nota berstatus Proses Jilid • ${covers(workboard)} hard cover • Jadwal pengambilan ${dateLabel(dates[0])} sampai ${dateLabel(upcomingISO(4,new Date(now)))}. Diurutkan dari pengambilan terdekat.` : overdueMenu ? `${overdue.length} nota belum lunas yang jadwal pengambilannya sudah lewat minimal 1 hari WIB. Centang hanya nota yang benar-benar sudah dibayar.` : menu==='archive'?'Nota yang telah melewati tanggal pengambilan atau sudah diambil, otomatis tersusun di arsip tanpa menghapus data.':menu==='pending'?'Periksa pesanan sebelum nota resmi dinyatakan terverifikasi.':menu==='payments'?'Pantau pembayaran lunas, DP, dan yang belum dibayar.':calendarFilter?`Jadwal tanggal ${dateLabel(calendarFilter)}`:'Semua nota tersimpan, termasuk yang sudah diarsipkan.'}</p></div>
            <strong className="admin-list-counter">{currentList.length} nota</strong>
          </section>

          {workboardMenu&&<section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm" aria-label="Rekap jilid hard cover per sumber pesanan dan prodi">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4"><div><h3 className="text-base sm:text-lg font-black text-slate-900">REKAP JILID BERDASARKAN SUMBER & PRODI</h3><p className="text-xs text-slate-600 mt-1">Hanya Proses Jilid • Jadwal hari ini sampai 4 hari lagi (WIB) • Jumlah eksemplar HC, bukan jumlah nota.</p></div><span className="text-xs font-bold rounded-full bg-slate-100 text-slate-700 px-3 py-1.5">{workloadRecap.totalNotes} nota</span></div>
            {workloadRecap.sources.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Belum ada jilid Hard Cover yang sedang dikerjakan pada rentang tanggal ini.</p>:<div className="space-y-3">
              {workloadRecap.sources.map((group,i)=><div key={group.id} className={`rounded-xl border p-4 ${group.kind==='direct'?'bg-emerald-50 border-emerald-200':'bg-amber-50 border-amber-200'}`}>
                <div className="flex flex-wrap gap-2 items-baseline justify-between"><h4 className="text-sm sm:text-base font-extrabold text-slate-900">{i+1}. {group.kind==='direct'?'Masuk Langsung ke ZAIN.NET':`Masuk dari Reseller ${group.label.replace(/^Reseller /,'')}`}</h4><strong className="text-base text-slate-900">{group.covers} Jilid HC</strong></div>
                <p className="text-xs font-medium text-slate-600 mt-1">{group.covers} jilid terdiri dari {group.prodi.length} kategori prodi • {group.notes} nota</p>
                <div className="mt-3 space-y-1.5">{group.prodi.map(p=><div key={p.prodi} className="flex items-baseline justify-between gap-3 border-b border-slate-200/80 py-1.5 text-sm"><span className={p.prodi==='Prodi belum dicatat'?'text-amber-800 italic':'text-slate-800'}>Prodi {p.prodi==='Prodi belum dicatat'?'belum dicatat':p.prodi}</span><strong className="whitespace-nowrap text-slate-950">{p.covers} Jilid</strong></div>)}</div>
                {group.hasUnspecifiedProdi&&<p className="mt-2 text-xs text-amber-900">Nota lama belum menyimpan prodi per mahasiswa. Jumlahnya tetap masuk total, tetapi tidak diperkirakan sebagai prodi tertentu.</p>}
              </div>)}
            </div>}
            <div className="mt-4 flex flex-wrap justify-between gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white"><strong className="text-sm sm:text-base">TOTAL KESELURUHAN JILID HARD COVER</strong><strong className="text-xl">{workloadRecap.totalCovers} Jilid</strong></div>
          </section>}
          {menu==='overdue'&&<section className="admin-overdue-inline"><Bell size={20}/><div><strong>{overdue.length} nota masih perlu konfirmasi</strong><p>Popup pelunasan juga dapat dibuka kembali dari menu ini. Tidak ada pembayaran yang berubah sebelum admin mengonfirmasi uang diterima.</p></div><button type="button" onClick={()=>{setOverdueSelected([]);setOverdueError('');setShowOverdueModal(true);}}>Buka Konfirmasi Pelunasan</button></section>}
          {menu==='day1'&&<section className="admin-notice-bar"><div><Bell size={19}/><span>Pengingat untuk {pickupCustomerCount(daily[1])} pelanggan yang dijadwalkan mengambil besok.</span></div><button type="button" onClick={()=>void copyReminder()}><ClipboardCopy size={15}/>{copied?'Tersalin ✓':'Salin pengingat'}</button></section>}
          {menu==='archive'&&<p className="admin-archive-note"><Archive size={17}/> Nota otomatis masuk menu ini berdasarkan tanggal ambil yang telah lewat, tanpa mengubah status pengerjaan asli pada database. Status masih bisa diperiksa atau diperbarui pada rincian nota.</p>}

          <div className="admin-filter-bar"><label className="admin-search"><Search size={18}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, nota, prodi, reseller atau WhatsApp..." aria-label="Cari nota"/>{search&&<button aria-label="Hapus pencarian" type="button" onClick={()=>setSearch('')}><X size={15}/></button>}</label>
            {(menu==='orders'||menu==='archive'||menu==='payments')&&<select aria-label="Filter status verifikasi" value={verificationFilter} onChange={e=>setVerificationFilter(e.target.value as VerificationFilter)}><option value="all">Semua verifikasi</option><option value="pending">Belum diverifikasi</option><option value="verified">Sudah diverifikasi</option></select>}
            <select aria-label="Filter pembayaran" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value as PaymentFilter)}><option value="all">Semua pembayaran</option><option value="lunas">Lunas</option><option value="dp">DP</option><option value="belum_bayar">Belum bayar</option></select>
            {calendarFilter&&<button type="button" className="admin-filter-reset" onClick={()=>setCalendarFilter('')}>Tanggal {calendarFilter} <X size={13}/></button>}
          </div>
          {menu==='payments'&&<div className="admin-payment-summary">{(['lunas','dp','belum_bayar'] as const).map(type=><button type="button" key={type} onClick={()=>setPaymentFilter(paymentFilter===type?'all':type)} className={paymentFilter===type?'on':''}><span>{type==='lunas'?'Lunas':type==='dp'?'DP':'Belum Bayar'}</span><strong>{orders.filter(o=>statusPayment(o)===type).length}</strong></button>)}</div>}

          {!currentList.length?<div className="admin-empty"><BookOpen size={36}/><h3>Tidak ada nota pada menu ini</h3><p>{search||paymentFilter!=='all'||verificationFilter!=='all'?'Coba ganti pencarian atau filter di atas.':'Daftar akan otomatis terisi ketika ada nota yang sesuai.'}</p>{(search||paymentFilter!=='all'||verificationFilter!=='all')&&<button type="button" onClick={()=>{setSearch('');setPaymentFilter('all');setVerificationFilter('all');}}>Bersihkan filter</button>}</div>:
          <div className="admin-order-list">{currentList.map(o=>{
            const open=expanded===o.orderId;
            const pending=o.verificationStatus==='PENDING'||(!o.verificationStatus&&!o.adminConfirmed);
            const archived=archivedForDashboard(o,today);
            const trans=statusPayment(o);
            const isReseller=o.orderKind==='reseller'||Boolean(o.resellerCompany);
            const shortfall=Math.max(0,Number(o.remainingAmount ?? (o.totalCost-(o.dpAmount||0))));
            const calendarDays=orderToPickupCalendarDays(o.receivedDate||o.orderDate,o.pickupDate);
            return <article className={`admin-order-card${open?' is-expanded':''}${pending?' is-pending':''}${isReseller?' is-reseller':' is-direct'}`} key={o.orderId}>
              <div className="admin-order-head"><div className="admin-order-avatar"><Users size={20}/></div><div className="admin-order-ident">
                {/* V9.11.9: tampilkan nama dan jumlah JILID masing-masing, bukan judul "Kolektif ...". */}
                {o.resellerStudents?.length ?
                  <div className="admin-collective-students" aria-label={`Daftar ${o.resellerStudents.length} mahasiswa reseller`}>
                    {o.resellerStudents.map((m,i)=><div className="admin-collective-student" key={`${o.orderId}-student-${i}`}>
                      <strong>{m.name}</strong><span>{Number(m.qty)||0} Jilid</span>
                    </div>)}
                  </div>
                  : <strong>{o.studentName}</strong>}
                <span className={`admin-source-tag ${isReseller?'admin-source-reseller':'admin-source-direct'}`}>{isReseller?`RESELLER: ${o.resellerCompany||'Percetakan'}`:'LANGSUNG ZAIN.NET'}</span>
                <small>{o.resellerStudents?.length?`${o.resellerStudents.length} mahasiswa • ${o.resellerStudents.reduce((n,m)=>n+Number(m.qty||0),0)} HC`:o.prodi||'Prodi belum diisi'}</small>
                <span className="admin-order-id">#{o.orderId}</span></div><div className="admin-order-badges"><span className={`admin-state admin-state-${pending?'waiting':o.verificationStatus==='REJECTED'?'rejected':'approved'}`}>{pending?'Perlu verifikasi':o.verificationStatus==='REJECTED'?'Ditolak':'Terverifikasi'}</span><span className={`admin-state admin-pay-signal admin-pay-${trans}`}>{trans==='lunas'?'✓ SUDAH BAYAR — LUNAS':trans==='dp'?`● DP • KURANG ${formatIDR(shortfall)}`:`! BELUM BAYAR • KURANG ${formatIDR(shortfall)}`}</span>{archived&&<span className="admin-state admin-state-archived">Diarsipkan</span>}</div></div>
              <div className="admin-order-meta"><div><span>TANGGAL NOTA DIBUAT (WIB REALTIME)</span><strong>{longDateWIB(o.orderDate)}</strong></div>{o.receivedDate && o.receivedDate!==o.orderDate.slice(0,10)&&<div className="admin-backdated-date"><span>TANGGAL SETOR SAMPUL (ASLI)</span><strong>{longDateWIB(o.receivedDate)}</strong><small>Dicatat menyusul oleh admin</small></div>}<div><span>TANGGAL PENGAMBILAN</span><strong>{longDateWIB(o.pickupDate)}</strong></div><div><span>LAMA PENGERJAAN</span><strong>Paket {o.durationDays} hari • {o.coverCount} hard cover</strong><small>{calendarDays===null?'—':`Jarak pengambilan: ${calendarDays} hari kalender`}</small></div><div><span>TOTAL BIAYA</span><strong>{formatIDR(o.totalCost)}</strong></div></div>
              <div className="admin-order-bar"><div><span className="admin-progress-dot"/>{archived&&o.status!=='Selesai'?'Arsip berdasarkan tanggal ambil':o.status}{o.bindingCompletedOn&&<small> • Sampul selesai {o.bindingCompletedOn}</small>}</div><button type="button" aria-expanded={open} onClick={()=>{setExpanded(open?null:o.orderId);setDpEditId(null);}}>{open?'Tutup rincian':'Rincian & tindakan'} {open?<ChevronDown size={16} className="rotate-180"/>:<ChevronDown size={16}/>}</button></div>
              {open&&<div className="admin-order-expanded">
                {o.resellerStudents?.length ? <div className="p-3 my-2 rounded-xl border border-teal-200 bg-teal-50 text-xs"><strong>DAFTAR PESANAN KOLEKTIF RESELLER</strong>{o.resellerStudents.map((m,i)=><div key={i} className="py-1 border-b">{i+1}. {m.name} — {m.qty} HC ({m.days} hari) • {m.prodi || "Prodi belum dicatat"}{m.services?.length ? ` • Tambahan: ${m.services.join(", ")}` : ""}{m.subtotal ? ` • Rp${Number(m.subtotal).toLocaleString("id-ID")}` : ""}</div>)}<p className="mt-2 text-amber-800">Jumlah per mahasiswa tersimpan sebagai arsip kolektif. Jangan ubah jumlah lewat editor nota umum karena akan membuat daftar nama tidak cocok. Hubungi pengembang untuk koreksi rincian kolektif.</p></div> : null}
                <div className="admin-detail-grid"><div><span>DATA PELANGGAN</span><strong>{o.studentName}</strong><p>{o.university} • {o.fakultas} • {o.prodi}</p><p>{pickupSource(o)}</p>{o.whatsapp&&<a target="_blank" rel="noreferrer" href={`https://wa.me/${o.whatsapp.replace(/\D/g,'').replace(/^0/,'62')}`}><Phone size={14}/> Chat WhatsApp ({o.whatsapp})</a>}</div>
                  <div><span>RINCIAN PRODUKSI</span><strong>{o.coverCount} × hard cover ({o.coverColor})</strong><p>{o.durationLabel} • {o.durationDays} hari (paket asli)</p><p>Layanan: {o.servicesBreakdown?.map(s=>s.label).join(', ')||'Hard Cover'}</p><p>Nota dibuat: {longDateWIB(o.orderDate)}</p>{o.receivedDate&&o.receivedDate!==o.orderDate.slice(0,10)&&<p className="font-bold text-amber-800">Sampul disetor: {longDateWIB(o.receivedDate)}</p>}<p>Ambil: {longDateWIB(o.pickupDate)}</p></div>
                  <div><span>PEMBAYARAN</span><strong>{formatIDR(o.totalCost)}</strong><p>Pilihan mahasiswa: {paymentPreferenceLabel(o.paymentChoice)}</p><p>Status terverifikasi admin: {o.transactionStatus}</p><p>DP: {formatIDR(o.dpAmount||0)}</p><p>Sisa: {formatIDR(o.remainingAmount||0)}</p><p>Verifikasi: {o.adminConfirmedBy||'—'}</p></div></div>
                <div className="admin-detail-actions">
                  <button type="button" className="admin-outline-btn" onClick={()=>onSelectOrder(o)}><Eye size={16}/> Lihat & Unduh Nota JPG</button>
                  {pending&&<><button className="admin-success-btn" type="button" onClick={()=>verify(o,'Lunas')}><CheckCircle2 size={16}/> Verifikasi Lunas</button>
                    <button className="admin-warning-btn" type="button" onClick={()=>{setDpEditId(o.orderId);setDpInput(String(Math.min(o.totalCost-1, Math.max(1, o.dpAmount || Math.ceil(o.totalCost*0.5/1000)*1000))));}}><CreditCard size={16}/> Verifikasi DP</button>
                    <button className="admin-outline-btn" type="button" onClick={()=>verify(o,'Belum Bayar')}><Clock3 size={16}/> Belum Bayar</button>
                    <button className="admin-danger-btn" type="button" onClick={()=>{const reason=window.prompt('Alasan penolakan pesanan (wajib diisi):');if(reason?.trim())onRejectOrder(o.orderId,reason.trim());}}>Tolak Pesanan</button></>}
                  {!pending&&o.verificationStatus==='APPROVED'&&trans!=='lunas'&&<button className="admin-success-btn" type="button" onClick={()=>verify(o,'Lunas')}><CheckCircle2 size={16}/> Tandai Pelunasan</button>}
                  {!pending&&o.verificationStatus==='APPROVED'&&trans!=='lunas'&&<button type="button" className="admin-warning-btn" onClick={()=>{setDpEditId(o.orderId);setDpInput(String(Math.min(o.totalCost-1, Math.max(1, o.dpAmount || Math.ceil(o.totalCost*0.5/1000)*1000))));}}><CreditCard size={16}/> Ubah/Catat DP</button>}
                  {!o.resellerStudents?.length && <button type="button" className="admin-outline-btn" onClick={()=>beginEdit(o)}><Pencil size={16}/> Edit Data Nota</button>}
                  <button type="button" className="admin-danger-btn" onClick={()=>void removeNota(o)} disabled={editBusy}><Trash2 size={16}/> Hapus Nota</button>
                </div>
                {editError && <p role="alert" className="text-xs text-rose-700 font-bold p-2 bg-rose-50 rounded-lg">{editError}</p>}
                {editing===o.orderId && editData && <section className="mt-4 rounded-xl border border-teal-300 bg-teal-50/70 p-4 space-y-3" aria-label="Form edit data nota">
                  <h3 className="font-black text-sm text-teal-950">Edit Data Nota • {o.studentName}</h3>
                  <p className="text-[11px] text-slate-600">Perbaiki identitas, pilihan paket, lama pengerjaan, jumlah, biaya dan tanggal ambil. Harga resmi dihitung ulang oleh database.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([['customerName','Nama pelanggan'],['phone','WhatsApp'],['faculty','Fakultas'],['major','Program studi']] as const).map(([field,label])=><label key={field} className="text-xs font-bold text-slate-700">{label}<input className="block w-full mt-1 bg-white rounded-lg border border-slate-300 p-2.5" value={editData[field]} maxLength={field==='customerName'?120:field==='phone'?17:160} onChange={e=>setEditData({...editData,[field]:e.target.value})} /></label>)}
                    <label className="text-xs font-bold text-slate-700">Tanggal Pengambilan<input type="date" min={o.orderDate.slice(0,10)} className="block w-full mt-1 bg-white rounded-lg border border-slate-300 p-2.5" value={editData.pickupDate} onChange={e=>setEditData({...editData,pickupDate:e.target.value})}/></label>
                  </div>
                  {editData.quantities.map((qty,i)=><div key={i} className="rounded-lg bg-white border border-slate-200 p-2 space-y-2">
                    <p className="text-xs font-bold text-slate-800">Pesanan {i+1}: {(o.items?.[i] as any)?.product || 'Lainnya'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="text-[11px] font-bold text-slate-700">Paket
                        <select disabled={editData.packageIds[i]===0} className="block w-full mt-1 p-2 rounded-lg border border-slate-300 bg-white text-xs" value={editData.packageIds[i]} onChange={e=>setEditData({...editData,packageIds:editData.packageIds.map((x,j)=>j===i?Number(e.target.value):x)})}>
                          {editData.packageIds[i]===0?<option value={0}>Layanan manual</option>:PRODUCTS.slice(0,6).map((p,j)=><option key={j} value={j+1}>{j+1}. {p}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] font-bold text-slate-700">Pengerjaan
                        <select className="block w-full mt-1 p-2 rounded-lg border border-slate-300 bg-white text-xs" value={editData.durations[i]} onChange={e=>setEditData({...editData,durations:editData.durations.map((x,j)=>j===i?Number(e.target.value):x)})}>{[1,2,3].map(n=><option key={n} value={n}>{n} Hari</option>)}</select>
                      </label>
                      <label className="text-[11px] font-bold text-slate-700">Jumlah (1–100)
                        <input className="block w-full mt-1 p-2 rounded-lg border border-slate-300 bg-white text-xs" type="number" min={1} max={100} value={qty} onChange={e=>setEditData({...editData,quantities:editData.quantities.map((x,j)=>j===i?Number(e.target.value):x)})}/>
                      </label>
                    </div>
                  </div>)}
                  {editData.extras.map((ex,i)=><div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2 items-center"><input aria-label={`Nama biaya tambahan ${i+1}`} placeholder="Nama biaya tambahan" className="min-w-0 bg-white rounded-lg border border-slate-300 p-2 text-xs" maxLength={100} value={ex.label} onChange={e=>setEditData({...editData,extras:editData.extras.map((x,j)=>j===i?{...x,label:e.target.value}:x)})}/><input aria-label={`Nominal biaya tambahan ${i+1}`} className="min-w-0 bg-white rounded-lg border border-slate-300 p-2 text-xs" type="number" min={0} value={ex.amount} onChange={e=>setEditData({...editData,extras:editData.extras.map((x,j)=>j===i?{...x,amount:Number(e.target.value)}:x)})}/><button type="button" className="p-2 rounded-lg bg-rose-100 text-rose-900" aria-label={`Hapus biaya ${i+1}`} onClick={()=>setEditData({...editData,extras:editData.extras.filter((_,j)=>j!==i)})}><Trash2 size={16}/></button></div>)}
                  <button type="button" className="text-xs font-bold rounded-lg bg-white border border-teal-300 text-teal-800 px-3 py-2" disabled={editData.extras.length>=20} onClick={()=>setEditData({...editData,extras:[...editData.extras,{label:'',amount:0}]})}><Plus size={13} className="inline"/> Tambah biaya manual</button>
                  <label className="block text-xs font-bold text-slate-700">Catatan<textarea rows={3} maxLength={450} className="block w-full mt-1 bg-white rounded-lg border border-slate-300 p-2.5" value={editData.notes} onChange={e=>setEditData({...editData,notes:e.target.value})}/></label>
                  <div className="flex flex-wrap gap-2"><button type="button" disabled={editBusy} onClick={()=>void saveEdit()} className="rounded-lg bg-teal-700 text-white px-4 py-2 text-xs font-bold">{editBusy?'Menyimpan…':'Simpan Perubahan'}</button><button type="button" disabled={editBusy} onClick={()=>{setEditing(null);setEditError('')}} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold">Batal</button></div>
                </section>}
                {dpEditId===o.orderId&&<div className="admin-dp-form"><label>Nominal DP masuk (Rp) <input type="number" min="0" max={o.totalCost} step="1000" value={dpInput} onChange={e=>setDpInput(e.target.value)}/></label><button type="button" onClick={()=>{const value=Number(dpInput);if(!Number.isFinite(value)||value<=0||value>=o.totalCost){window.alert('DP harus lebih dari Rp0 dan kurang dari total tagihan.');return;}verify(o,'DP',value);}}>Simpan & Verifikasi DP</button><button type="button" onClick={()=>setDpEditId(null)}>Batal</button></div>}
                <ProductionStatusEditor order={o} onSave={onProductionChange}/>
              </div>}
            </article>;
          })}</div>}
          <p className="admin-list-footnote"><AlertCircle size={15}/> Jadwal bersumber dari pesanan online yang dimuat. Perubahan oleh admin langsung disimpan ke database setelah dikonfirmasi.</p>
        </div>}
      </main>
    </div>
    {showOverdueModal && overdue.length>0 && <div className="admin-v9120-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget && !overdueBusy)setShowOverdueModal(false);}}>
      <section className="admin-v9120-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-v9120-reminder-title">
        <header className="admin-v9120-dialog-head"><div><span className="admin-v9120-eyebrow"><Bell size={15}/> PENGINGAT PELUNASAN</span><h2 id="admin-v9120-reminder-title">Konfirmasi Nota Belum Lunas</h2><p>{overdue.length} nota sudah melewati jadwal pengambilan minimal satu hari dan masih memiliki sisa tagihan.</p></div><button type="button" aria-label="Tutup pengingat" disabled={overdueBusy} onClick={()=>setShowOverdueModal(false)}><X size={22}/></button></header>
        <p className="admin-v9120-dialog-hint">Apakah mahasiswa berikut sudah melunasi tagihan? <strong>Centang hanya yang uangnya benar-benar sudah diterima.</strong> Nota yang tidak dicentang tetap DP atau Belum Bayar dan akan diingatkan pada kunjungan admin berikutnya.</p>
        <div className="admin-v9120-dialog-list">
          {overdue.map((o,index)=>{
            const remain=Math.max(0,Number(o.totalCost||0)-Number(o.dpAmount||0));
            const selected=overdueSelected.includes(o.orderId);
            return <label key={o.orderId} className={`admin-v9120-item${selected?' is-selected':''}`}>
              <input type="checkbox" checked={selected} disabled={overdueBusy} onChange={event=>setOverdueSelected(existing=>event.target.checked?[...existing,o.orderId]:existing.filter(id=>id!==o.orderId))}/>
              <span className="admin-v9120-item-body"><strong>{index+1}. {o.resellerStudents?.length ? o.resellerStudents.map(m=>m.name).join(', ') : o.studentName}</strong><small>{o.resellerCompany ? `RESELLER: ${o.resellerCompany} • ` : ''}Nota #{o.orderId.slice(0,8)} • Jadwal: {dateLabel(pickupDay(o))}{o.resellerStudents?.length?' • Satu pembayaran untuk nota kolektif':''}</small></span>
              <span className="admin-v9120-money"><strong>{formatIDR(remain)}</strong><small>{Number(o.dpAmount||0)>0?'DP / Kurang bayar':'Belum bayar'}</small></span>
            </label>;
          })}
        </div>
        {overdueError&&<p className="admin-v9120-dialog-error" role="alert">{overdueError}</p>}
        <footer className="admin-v9120-dialog-foot">
          <div className="admin-v9120-selected">{overdueSelected.length} dari {overdue.length} nota dipilih sebagai lunas</div>
          <div className="admin-v9120-dialog-actions"><button type="button" className="admin-v9120-cancel" disabled={overdueBusy} onClick={()=>setShowOverdueModal(false)}>Masih Belum Lunas / Tutup</button><button type="button" className="admin-v9120-selected-btn" disabled={!overdueSelected.length||overdueBusy} onClick={()=>void confirmOverdueSelected(overdueSelected)}>{overdueBusy?'Menyimpan…':`Konfirmasi ${overdueSelected.length} Dipilih Lunas`}</button><button type="button" className="admin-v9120-all-btn" disabled={overdueBusy} onClick={()=>void confirmOverdueSelected(overdue.map(o=>o.orderId))}>Semua Sudah Melunasi</button></div>
        </footer>
      </section>
    </div>}
  </div>;
};
