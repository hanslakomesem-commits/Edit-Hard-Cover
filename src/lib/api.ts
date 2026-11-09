/**
 * ZAIN.NET V9 – adaptor for the EXISTING V8 Supabase schema.
 * Browser uses only a public/publishable key. Payments are priced and validated in SQL.
 * Anonymous users can call only create_nota_order/get_nota_status RPC, not list orders.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OrderRecord } from '../types';
import {parsePaymentPreference,serializePaymentPreference} from '../utils/paymentPreference';
import {createdAtWIB} from '../utils/orderDateTime';
import { getHcPrice, PACKAGES, PRODUCTS, CUSTOM_PACKAGE_PRODUCT, CUSTOM_PACKAGE_PARTS, ITEM_PRICES, RESELLER_SERVICE_RATES } from '../components/OrderForm';

interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
}
declare global {
  interface Window { ZAINNET_CONFIG?: Config }
}
let instance: SupabaseClient | undefined;
export function database(): SupabaseClient {
  if (instance) return instance;
  const conf = window.ZAINNET_CONFIG;
  const url = import.meta.env.VITE_SUPABASE_URL || conf?.supabaseUrl;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || conf?.supabaseAnonKey;
  if (!url || !/^https:\/\/.+\.supabase\.co\/?$/.test(url) || !key || /GANTI/i.test(key)) {
    throw new Error('Supabase belum dikonfigurasi. Periksa public/config.js atau environment Cloudflare Pages.');
  }
  if (/service_role|sb_secret_/i.test(key)) throw new Error('Jangan gunakan secret/service_role key di website publik.');
  instance = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return instance;
}

export type DbStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_FOUND';
export interface V8Row {
  id: string;
  access_token?: string;
  created_at: string;
  date_in: string;
  pickup_date: string;
  processing_days: number;
  customer_name: string;
  order_kind?: 'student' | 'reseller';
  reseller_company?: string;
  reseller_students?: Array<{name:string;qty:number;days:number;prodi?:string;packageId?:number;services?:string[];subtotal?:number}>;
  phone: string;
  faculty: string;
  major: string;
  items: Array<{kind: string; package_id?: number; label: string; qty: number; days: number; hard_cover_unit?: number; other_sum?: number; unit_price?: number; subtotal: number}>;
  extras: Array<{label: string; amount: number}>;
  notes: string;
  total: number;
  payment_choice: 'LUNAS' | 'DP' | 'BAYAR_SAAT_AMBIL';
  dp_requested: number;
  paid_confirmed: number;
  verification_status: Exclude<DbStatus, 'NOT_FOUND'>;
  verified_at: string | null;
  admin_note: string;
  production_status?: OrderRecord['status'] | null;
  binding_completed_on?: string | null;
}
function dateStr(value: string | null | undefined, defaultClock = '08:00') {
  if (!value) return '';
  const iso = value.slice(0, 10);
  return `${iso} ${defaultClock}`;
}
function pickupColor(f: string) {
  if (/TARBIYAH|FTIK/.test(f.toUpperCase())) return 'Hijau';
  if (/FASYA|SYARIAH/.test(f.toUpperCase())) return 'Merah Marun';
  if (/FEBI|EKONOMI/.test(f.toUpperCase())) return 'Kuning';
  if (/FAUD|USHULUDDIN/.test(f.toUpperCase())) return 'Biru';
  return 'Standar';
}
export function asOrder(row: V8Row): OrderRecord {
  const items = Array.isArray(row.items) ? row.items : [];
  const extras = Array.isArray(row.extras) ? row.extras : [];
  const coverCount = items.filter(i => i.kind === 'package').reduce((s,i) => s + Number(i.qty || 0), 0);
  const coversSubtotal = items.filter(i => i.kind === 'package').reduce((s,i) => s + Number(i.qty || 0) * Number(i.hard_cover_unit || 0), 0);
  const remaining = Math.max(0, Number(row.total) - Number(row.paid_confirmed || 0));
  const trans = remaining === 0 ? 'Lunas' : Number(row.paid_confirmed || 0) > 0 ? 'DP' : 'Belum Bayar';
  const preference = parsePaymentPreference(row.notes);
  // Paket Custom disimpan sebagai layanan satuan yang harganya dihitung SQL.
  // Tetap tampilkan selisih harga mitra untuk item non-HC setelah nota dimuat lagi.
  const serviceCustomNormal = (i: (typeof items)[number]): number | null =>
    row.order_kind === 'reseller' && i.kind === 'custom' &&
    Object.prototype.hasOwnProperty.call(RESELLER_SERVICE_RATES,i.label)
      ? ITEM_PRICES[i.label as keyof typeof ITEM_PRICES] : null;
  const breakdown = [
    ...items.map((item, index) => ({
      id: String(index),
      label: `${item.label} (${item.qty} ${item.kind === 'package' ? 'HC' : 'unit'})`,
      price: Number(item.subtotal || 0) - (item.kind === 'package' ? Number(item.qty || 0) * Number(item.hard_cover_unit || 0) : 0),
    })),
    ...extras.map((e, i) => ({id: `extra-${i}`, label: e.label, price: Number(e.amount || 0)})),
  ].filter(x => x.price > 0);
  return {
    orderId: row.id,
    couponTrackingToken: row.access_token,
    orderKind: row.order_kind === 'reseller' ? 'reseller' : 'student',
    resellerCompany: row.reseller_company || undefined,
    resellerStudents: Array.isArray(row.reseller_students) ? row.reseller_students : undefined,
    normalTotal: items.reduce((sum,i)=>sum + Number(serviceCustomNormal(i) ?? (i as any).standard_subtotal ?? i.subtotal ?? 0),0) + extras.reduce((sum,e)=>sum + Number(e.amount||0),0),
    resellerPriceLines: items.flatMap(i => [
      ...((i as any).price_breakdown || []).map((p:any)=>({name:p.name,qty:Number(p.qty),normalPrice:Number(p.normal_price),resellerPrice:Number(p.reseller_price)})),
      ...(serviceCustomNormal(i) !== null ? [{name:i.label,qty:1,normalPrice:serviceCustomNormal(i)!,resellerPrice:Number(i.subtotal||0)}] : []),
    ]),
    studentName: row.customer_name,
    university: 'UIN Madura / Umum',
    fakultas: row.faculty,
    prodi: row.major,
    coverColor: pickupColor(row.faculty),
    whatsapp: row.phone,
    coverType: 'hard_cover',
    coverCount,
    durationKey: `${row.processing_days}_day` as OrderRecord['durationKey'],
    durationLabel: `${row.processing_days} Hari Jadi`,
    durationDays: row.processing_days,
    pricePerCover: items.find(i => i.kind === 'package')?.hard_cover_unit || getHcPrice(row.processing_days, row.faculty),
    coversSubtotal,
    selectedServices: breakdown.map(i => i.label),
    servicesBreakdown: breakdown,
    servicesSubtotal: Number(row.total) - coversSubtotal,
    printCost: 0,
    totalCost: Number(row.total),
    fileDeliveryMethod: 'whatsapp_only',
    // `date_in` is SQL DATE (no hour). The authoritative real clock is created_at.
    orderDate: createdAtWIB(row.created_at) || dateStr(row.date_in, ''),
    receivedDate: (row.date_in || '').slice(0,10),
    pickupDate: dateStr(row.pickup_date),
    status: row.production_status || (row.verification_status === 'APPROVED' ? 'Proses Jilid' : 'Menunggu'),
    bindingCompletedOn: row.binding_completed_on || null,
    productionTrackingAvailable: Object.prototype.hasOwnProperty.call(row,'production_status'),
    transactionStatus: trans,
    paymentChoice: preference.choice,
    paymentChannel: undefined,
    dpAmount: Number(row.paid_confirmed || 0),
    remainingAmount: remaining,
    adminConfirmed: row.verification_status === 'APPROVED',
    verificationStatus: row.verification_status,
    adminConfirmedAt: row.verified_at ? dateStr(row.verified_at) : undefined,
    adminConfirmedBy: row.verification_status === 'APPROVED' ? 'Admin ZAIN.NET' : undefined,
    notes: preference.notes,
    items: items.map((i, n) => ({
      id: `db-${n}`,
      product: i.kind === 'package' ? PRODUCTS[Number(i.package_id || 1) - 1] || PRODUCTS[0] : PRODUCTS[PRODUCTS.length - 1],
      customName: i.kind === 'custom' ? i.label : '',
      qty: i.qty,
      days: i.days,
      price: i.unit_price || i.hard_cover_unit || 0,
    })),
    extras: extras.map((e,i) => ({id: `db-e-${i}`,description:e.label,amount:e.amount})),
    createdAt: new Date(row.created_at).valueOf(),
  };
}

export function toV8Payload(order: OrderRecord) {
  if (!order.studentName.trim() || order.studentName.length > 120) throw Error('Nama pelanggan wajib diisi (maksimal 120 karakter).');
  if (order.orderKind !== 'reseller' && !/^\+?[0-9]{8,17}$/.test(order.whatsapp)) throw Error('Nomor WhatsApp harus diisi dengan 8–17 angka.');
  if (!order.fakultas || !order.prodi) throw Error('Fakultas dan program studi wajib dipilih.');
  if ((order.notes || '').length > 450) throw Error('Catatan maksimal 450 karakter.');
  const items = (order.items || []).map((item: any) => {
    const idx = PRODUCTS.indexOf(item.product);
    const qty = Number(item.qty);
    const days = Number(item.days);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) throw Error('Jumlah tiap layanan harus 1–100.');
    if (![1,2,3].includes(days)) throw Error('Pilih durasi 1, 2 atau 3 hari.');
    if (idx >= 0 && idx < PACKAGES.length) return {kind: 'package', package_id: idx + 1, qty, days};
    if (item.product === CUSTOM_PACKAGE_PRODUCT) {
      const parts = item.customParts;
      if (!Array.isArray(parts) || parts.length < 1 || parts.length > CUSTOM_PACKAGE_PARTS.length ||
        new Set(parts).size !== parts.length || parts.some((p:string)=>!CUSTOM_PACKAGE_PARTS.includes(p as any))) {
        throw Error('Pilih minimal satu dari lima layanan paket custom.');
      }
      return {kind:'custom_combo', parts, qty:parts.includes('Hard Cover')?qty:1, days};
    }
    const label = String(item.customName || item.product || '').trim();
    const price = Number(item.price);
    if (label.length < 2 || label.length > 100) throw Error('Nama layanan manual harus 2–100 karakter.');
    if (!Number.isSafeInteger(price) || price < 0 || price > 99999999) throw Error('Harga layanan manual tidak valid.');
    return {kind: 'custom', label, unit_price: price, qty, days};
  });
  const extras = (order.extras || []).filter((e: any) => String(e.description || '').trim() || Number(e.amount) > 0).map((e: any) => {
    const label = String(e.description || '').trim();
    const amount = Number(e.amount);
    if (label.length < 2 || label.length > 100 || !Number.isSafeInteger(amount) || amount < 0 || amount > 99999999) throw Error('Biaya tambahan harus memiliki nama dan nominal valid.');
    return {label, amount};
  });
  if (!items.length && !extras.length) throw Error('Tambahkan minimal satu pesanan.');
  if (items.length > 20 || extras.length > 20) throw Error('Maksimal 20 pesanan dan 20 biaya tambahan.');
  const choice = 'BAYAR_SAAT_AMBIL';
  const dp = 0;
  return {p_customer_name: order.studentName.trim(), p_phone: order.whatsapp, p_faculty: order.fakultas, p_major: order.prodi,
    p_items: items, p_extras: extras, p_payment_choice: choice, p_dp_requested: dp, p_notes: serializePaymentPreference(order.notes || '', order.paymentChoice)};
}
export async function createOnlineOrder(order: OrderRecord): Promise<{id: string; token: string}> {
  const payload = toV8Payload(order);
  const customMode = payload.p_items.some((i: any)=>i.kind === 'custom_combo');
  const {data, error} = order.orderKind === 'reseller'
    ? order.resellerStudents?.length
      ? await database().rpc('create_nota_partner_batch_order_v9121', {...payload,p_partner_name: order.resellerCompany || '',p_members:order.resellerStudents})
      : await database().rpc(customMode ? 'create_nota_partner_custom_order' : 'create_nota_partner_order', {...payload,p_partner_name: order.resellerCompany || ''})
    : await database().rpc(customMode ? 'create_nota_custom_order' : 'create_nota_order', payload);
  if (error) throw new Error(error.message);
  if (!data?.id || !data?.token) throw Error('Database tidak mengembalikan nomor pesanan dan token pelacakan.');
  return {id: data.id, token: data.token};
}
export async function getPublicStatus(token: string): Promise<{state: DbStatus; order?: V8Row; message?: string}> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(token)) throw Error('Token pelacakan tidak valid.');
  const {data,error} = await database().rpc('get_nota_status', {p_token: token});
  if (error) throw Error(error.message);
  return data;
}
export async function adminAuthorized(): Promise<boolean> {
  const db=database();
  const {data: {user},error}=await db.auth.getUser();
  if (error || !user) return false;
  const res=await db.from('nota_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if (res.error) throw Error(res.error.message);
  return !!res.data;
}
export async function fetchAdminOrders(): Promise<V8Row[]> {
  // Include older months too; never silently truncate the calendar at 500 notes.
  const rows: V8Row[] = [];
  const pageSize = 500;
  const cutoff = new Date().toISOString();
  for (let offset = 0; ; offset += pageSize) {
    const {data,error}=await database().from('nota_orders').select('*').lte('created_at',cutoff)
      .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+pageSize-1);
    if (error) throw Error(error.message);
    rows.push(...(data || []) as V8Row[]);
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function updateProductionStatus(id: string, status: OrderRecord['status'], completedOn: string | null): Promise<void> {
  const {error} = await database().rpc('set_nota_production_status', {
    p_order_id: id, p_status: status, p_completed_on: completedOn,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42703') throw Error('Jalankan migrasi SQL V9.3 untuk mengaktifkan status produksi dan kalender.');
    throw Error(error.message);
  }
}
export async function verifyOnlineOrder(order: V8Row, target: 'Lunas'|'DP'|'Belum Bayar', amount?: number): Promise<boolean> {
  const paid = target === 'Lunas' ? Number(order.total) : target === 'DP' ? Number(amount) : 0;
  if (!Number.isSafeInteger(paid) || paid < 0 || paid > Number(order.total)) throw Error('Nominal pembayaran tidak valid.');
  if (target === 'DP' && (paid <= 0 || paid >= Number(order.total))) throw Error('DP harus lebih dari nol dan lebih kecil dari total.');
  if (!window.confirm(`Admin memastikan uang diterima Rp${paid.toLocaleString('id-ID')} dari ${order.customer_name}?`)) return false;
  const {error} = await database().rpc('admin_set_nota_payment', {p_order_id:order.id,p_paid:paid});
  if (error) throw new Error(`${error.message}. Pastikan migrasi SQL V9.9 telah dijalankan.`);
  return true;
}

export interface AdminNotaEdit {
  customerName: string;
  phone: string;
  faculty: string;
  major: string;
  notes: string;
  pickupDate: string;
  quantities: number[];
  durations: number[];
  packageIds: number[];
  extras: {label: string; amount: number}[];
}
export async function updateAdminNota(id: string, edit: AdminNotaEdit): Promise<void> {
  const {error} = await database().rpc('admin_update_nota', {
    p_order_id:id, p_customer_name:edit.customerName.trim(),p_phone:edit.phone.trim(),
    p_faculty:edit.faculty.trim(),p_major:edit.major.trim(),p_notes:edit.notes.trim(),
    p_pickup_date:edit.pickupDate,p_quantities:edit.quantities,
    p_durations:edit.durations,p_package_ids:edit.packageIds,p_extras:edit.extras,
  });
  if (error) throw new Error(`${error.message}. Pastikan migrasi SQL V9.9 telah dijalankan.`);
}
export async function deleteAdminNota(order: V8Row): Promise<boolean> {
  if (!window.confirm(`HAPUS PERMANEN nota ${order.customer_name} (#${order.id})? Data pesanan tidak bisa dikembalikan.`)) return false;
  const confirmation = window.prompt(`Konfirmasi penghapusan: ketik HAPUS untuk nota ${order.customer_name}.`);
  if (confirmation !== 'HAPUS') return false;
  const {error} = await database().rpc('admin_delete_nota', {p_order_id:order.id,p_confirmation:confirmation});
  if (error) throw new Error(`${error.message}. Pastikan migrasi SQL V9.9 telah dijalankan.`);
  return true;
}
export async function rejectOnlineOrder(order: V8Row, note: string): Promise<void> {
  if (order.verification_status === 'APPROVED') throw Error('Pesanan yang sudah disetujui tidak bisa ditolak.');
  if (!note.trim()) throw Error('Alasan penolakan wajib diisi.');
  if (!window.confirm(`Tolak pesanan atas nama ${order.customer_name}?`)) return;
  const {data: {user},error: authError}=await database().auth.getUser();
  if (authError || !user) throw Error('Admin belum login.');
  const {error}=await database().from('nota_orders').update({verification_status:'REJECTED',paid_confirmed:0,admin_note:note.trim(),verified_by:user.id,verified_at:new Date().toISOString()}).eq('id',order.id);
  if (error) throw Error(error.message);
}

/** Admin-only reseller collective order; price is calculated by the SQL RPC. */
export interface AdminResellerMember { name:string; qty:number; days:number; prodi:string; packageId:number; services?:string[] }
export interface AdminResellerBatchInput {
  partnerId:string; faculty:string; major:string; notes:string; receivedDate:string;
  members:AdminResellerMember[];
}
export async function createAdminResellerBatch(data:AdminResellerBatchInput):Promise<{id:string;token:string}> {
  const {data:result,error}=await database().rpc('admin_create_nota_reseller_batch_v9122',{
    p_partner_id:data.partnerId, p_faculty:data.faculty, p_major:data.major,
    p_notes:data.notes, p_members:data.members, p_received_date:data.receivedDate,
  });
  if(error) throw new Error(`${error.message}. Pastikan SQL V9.12.2 harga reseller dan tanggal setor sudah dijalankan.`);
  if(!result?.id||!result?.token) throw new Error('Nota gagal dibuat: ID / token tidak dikembalikan database.');
  return {id:result.id,token:result.token};
}


/** V9.12.0: admin-approved overdue full payment, atomic and audited by SQL. */
export async function confirmOverduePayments(orderIds: string[]): Promise<number> {
  const unique = [...new Set(orderIds)];
  if (unique.length < 1 || unique.length > 100 ||
      unique.some(id => !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))) {
    throw new Error('Pilih 1 sampai 100 nota dengan ID valid.');
  }
  const {data,error} = await database().rpc('admin_confirm_overdue_nota_batch', {p_order_ids: unique});
  if (error) throw new Error(`${error.message}. Pastikan SQL V9.12.0 sudah dijalankan.`);
  if (typeof data !== 'number' || data !== unique.length) {
    throw new Error('Hasil konfirmasi database tidak sesuai; muat ulang daftar nota sebelum melanjutkan.');
  }
  return data;
}
