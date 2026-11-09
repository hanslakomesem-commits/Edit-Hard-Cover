import React, { useState, useRef, useEffect } from 'react';
import {TogaCoupon, getCouponByNotaToken, type CouponInfo} from './TogaCoupon';
import {
  Printer,
  Share2,
  Copy,
  Check,
  X,
  Calendar,
  Download,
  Send,
  Loader2,
  CheckCircle2,
  Wallet,
  Hash,
  UserRound,
  Building,
  UploadCloud,
  MessageCircle,
  QrCode,
  FileCheck
} from 'lucide-react';
import {captureHardcoverReceipt} from '../utils/receiptCapture';
import {downloadTwoPhotos} from '../utils/downloadBundle';
import { OrderRecord, TransactionStatus } from '../types';
import { formatIDR, formatDisplayDate, createWhatsAppTextForAdmin, getAdminWhatsAppUrl } from '../utils/pricing';
import {longDateWIB} from '../utils/orderDateTime';
import {paymentPreferenceLabel} from '../utils/paymentPreference';
import { ADMIN_WHATSAPP, PERCETAKAN_NAME, PERCETAKAN_ADDRESS } from '../data/uinMaduraData';

interface InvoiceModalProps {
  order: OrderRecord;
  onClose: () => void;
  onViewSchema?: () => void;
  onUpdateStatus?: (
    orderId: string,
    status: OrderRecord['status'],
    transactionStatus: TransactionStatus,
    adminConfirmed: boolean,
    adminConfirmedBy?: string
  ) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose, onUpdateStatus }) => {
  const [copied, setCopied] = useState(false);
  const [coupon, setCoupon] = useState<CouponInfo|null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponRefresh, setCouponRefresh] = useState(0);
  const couponSectionRef = useRef<HTMLElement>(null);
  // V9.11.6: kupon terbit saat data nota tercatat, tidak tergantung pelunasan.
  const couponReady = order.orderKind !== 'reseller' && order.coverCount > 0 && order.verificationStatus !== 'REJECTED';
  useEffect(()=>{
    let active=true;
    setCoupon(null);
    setCouponError('');
    setCouponLoading(couponReady);
    if (!couponReady) return ()=>{active=false;};
    if (!order.couponTrackingToken) {
      setCouponError('Tautan pelacakan nota belum tersedia. Buka nota dari tautan mahasiswa asli.');
      setCouponLoading(false);
      return ()=>{active=false;};
    }
    getCouponByNotaToken(order.couponTrackingToken)
      .then(data=>{if(active)setCoupon(data);})
      .catch(e=>{if(active)setCouponError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setCouponLoading(false);});
    return()=>{active=false;};
  },[couponReady,order.couponTrackingToken,couponRefresh]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [currentTransStatus, setCurrentTransStatus] = useState<TransactionStatus>(order.transactionStatus);
  const [currentOrderStatus, setCurrentOrderStatus] = useState<OrderRecord['status']>(order.status);
  const [isAdminConfirmed, setIsAdminConfirmed] = useState<boolean>(order.adminConfirmed);
  const adminName = order.adminConfirmedBy || 'Admin ZAIN.NET';
  const receiptRef = useRef<HTMLDivElement>(null);
  const couponDownloadRef = useRef<null|(()=>Promise<string>)>(null);
  const isSoftCover = order.coverType === 'soft_cover';
  const grandTotal = order.totalCost;

  const sync = (status = currentOrderStatus, trans = currentTransStatus, confirmed = isAdminConfirmed) => {
    onUpdateStatus?.(order.orderId, status, trans, confirmed, confirmed ? adminName : undefined);
  };

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await captureHardcoverReceipt(receiptRef.current);
      const link = document.createElement('a');
      const cleanName = order.studentName.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Mahasiswa';
      link.download = `Nota_${PERCETAKAN_NAME}_${order.orderId}_${cleanName}.jpg`;
      link.href = dataUrl;
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch {
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadBundle = async () => {
    if (!receiptRef.current || !coupon?.code || !couponDownloadRef.current) return;
    setIsDownloading(true);
    try {
      const [nota,kupon]=await Promise.all([captureHardcoverReceipt(receiptRef.current),couponDownloadRef.current()]);
      await downloadTwoPhotos(nota,kupon,`NOTA_DAN_VOUCHER_${order.orderId}.zip`,coupon.code);
      setDownloadSuccess(true);
    } catch(e) {window.alert(`Gagal membuat berkas nota dan voucher: ${e instanceof Error?e.message:String(e)}`);}
    finally {setIsDownloading(false);}
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(
      createWhatsAppTextForAdmin({
        ...order,
        transactionStatus: currentTransStatus,
        status: currentOrderStatus,
        adminConfirmed: isAdminConfirmed,
        adminConfirmedBy: adminName,
      })
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleSendToAdminWhatsApp = () => {
    window.open(
      getAdminWhatsAppUrl({
        ...order,
        transactionStatus: currentTransStatus,
        status: currentOrderStatus,
        adminConfirmed: isAdminConfirmed,
        adminConfirmedBy: adminName,
      }),
      '_blank'
    );
  };

  return (
    <div className="invoice-overlay" role="presentation">
      <div className="invoice-shell" role="dialog" aria-modal="true" aria-label="Pratinjau dan unduh nota Hard Cover">
        <div className="invoice-toolbar">
          <div>
            <div className="toolbar-kicker">BUKTI STRUK TRANSAKSI</div>
            <div className="toolbar-title">Nota #{order.orderId}</div>
          </div>
          <button onClick={onClose} className="icon-close" aria-label="Tutup">
            <X />
          </button>
        </div>

        {couponReady && <div className="zc-nota-alert" role="status">
          <div><strong>🎟 KUPON DISKON TOGA 50%</strong><small>{coupon?.code
            ? 'Nota dan voucher tersimpan bersama dalam satu ZIP yang berisi 2 JPG.'
            : couponLoading ? 'Sedang memeriksa kupon digital...'
            : couponError ? 'Terjadi kendala saat mengambil kupon.'
            : coupon?.state==='NOT_AVAILABLE' ? 'Kupon belum diterbitkan untuk nota ini; periksa SQL V9.11.6.'
            : coupon?.state==='NOT_FOUND' ? 'Data kupon belum ditemukan.'
            : 'Kupon perlu diperiksa.'}</small></div>
          <button type="button" onClick={()=>couponSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}>Lihat Kupon ↓</button>
        </div>}
        <div className="invoice-stage" tabIndex={0} aria-label="Gulir untuk melihat nota dan voucher">
          <div ref={receiptRef} className={`receipt-card printable-invoice ${currentTransStatus === 'Belum Bayar' ? 'receipt-unpaid' : currentTransStatus === 'DP' ? 'receipt-partial' : ''}`}>
            {/* Header Brand */}
            <div className="receipt-brand">
              <div className="receipt-logo">
                <BookOpenIcon />
              </div>
              <div>
                <div className="receipt-shop">{PERCETAKAN_NAME}</div>
                <div className="receipt-tagline">JILID SKRIPSI • PERPUSTAKAAN • FOTOCOPY</div>
              </div>
              <div className="receipt-paid">
                {currentTransStatus === 'Lunas' || currentTransStatus === 'LUNAS' ? 'LUNAS' : currentTransStatus === 'Belum Bayar' ? 'BELUM BAYAR' : currentTransStatus}
              </div>
            </div>

            {currentTransStatus === 'Belum Bayar' && <div className="receipt-unpaid-warning">BELUM BAYAR — NOTA INI BUKAN BUKTI PELUNASAN</div>}
            <div className="receipt-divider" />

            {/* Meta Nota */}
            <div className="receipt-meta">
              <div>
                <span>NO. NOTA</span>
                <strong>{order.orderId}</strong>
              </div>
              <div>
                <span>TANGGAL NOTA DIBUAT</span>
                <strong>{longDateWIB(order.orderDate)}</strong>
              </div>
            </div>

            {order.receivedDate && order.receivedDate!==order.orderDate.slice(0,10) &&
              <div className="my-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-950">
                SAMPUL DITERIMA: {longDateWIB(order.receivedDate)} — Nota baru dicatat pada {longDateWIB(order.orderDate)}. Jadwal pengambilan dihitung sejak tanggal setor.
              </div>}

            {/* Customer & Campus Panel */}
            <div className="customer-panel">
              <div className="customer-icon">
                <UserRound />
              </div>
              <div className="flex-1 min-w-0">
                <span>DATA PEMESAN & KAMPUS</span>
                {order.orderKind === 'reseller' && <div className="mb-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[10px] font-extrabold text-teal-900">ASAL PERUSAHAAN: {order.resellerCompany}</div>}
                <strong className="truncate">{order.studentName}</strong>
                {order.orderKind === 'reseller' && <small className="block text-teal-900 font-black text-[10px] mt-1">{order.studentName} — sampul melalui {order.resellerCompany}</small>}
                <small className="truncate">
                  {order.prodi} • {order.fakultas}
                </small>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-indigo-900 bg-indigo-50/80 px-2 py-0.5 rounded inline-flex">
                  <Building className="w-3 h-3 text-indigo-600" />
                  <span>{order.university || 'UIN Madura'}</span>
                </div>
              </div>
            </div>

            {/* Delivery File & Payment Channel Badge */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold block">METODE BERKAS</span>
                <strong className="text-slate-800 flex items-center gap-1 mt-0.5">
                  {order.fileDeliveryMethod === 'upload_server' ? (
                    <>
                      <UploadCloud className="w-3 h-3 text-emerald-600" /> Upload ke Server ({order.uploadedFiles?.length || 0})
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-3 h-3 text-amber-600" /> Kirim via WhatsApp
                    </>
                  )}
                </strong>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold block">VERIFIKASI PEMBAYARAN</span>
                <strong className="text-slate-800 flex items-center gap-1 mt-0.5">
                  <Wallet className="w-3 h-3 text-indigo-600" />
                  {currentTransStatus === 'Belum Bayar' ? 'Belum Dibayar (Admin)' : 'Dikonfirmasi Admin'}
                </strong>
              </div>
            </div>

            {/* Uploaded files listing if any */}
            {order.uploadedFiles && order.uploadedFiles.length > 0 && (
              <div className="mt-2 p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-[10px] text-emerald-950">
                <span className="font-bold block text-emerald-800 mb-0.5">Lampiran Dokumen Server:</span>
                {order.uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span className="truncate pr-2">📄 {f.name}</span>
                    <span className="shrink-0 text-slate-500 font-mono">{(f.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            )}

            {order.orderKind === 'reseller' && !!order.resellerPriceLines?.length && <section className="my-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-[11px]">
              <div className="font-extrabold text-teal-900 mb-1">RINCIAN DISKON KHUSUS MITRA</div>
              {order.resellerPriceLines.map((line, i) => <div key={i} className="flex justify-between gap-2 py-1 border-b border-teal-100 last:border-0">
                <span>{line.name} × {line.qty}</span>
                <span className="flex gap-2">{line.normalPrice !== line.resellerPrice && <del className="text-rose-600">{formatIDR(line.normalPrice)} /unit</del>}<b className="text-teal-800">{formatIDR(line.resellerPrice)} /unit</b></span>
              </div>)}
              <div className="mt-2 text-right text-teal-900 font-bold">Total normal <del className="text-rose-600">{formatIDR(order.normalTotal ?? order.totalCost)}</del> → Mitra {formatIDR(order.totalCost)}</div>
            </section>}

            {order.resellerStudents?.length ? <section className="my-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-[11px]"><strong className="text-teal-900">DAFTAR MAHASISWA RESELLER ({order.resellerStudents.length} ORANG)</strong>{order.resellerStudents.map((m,i)=><div key={i} className="flex justify-between py-1 border-b border-teal-100 last:border-0"><span>{i+1}. {m.name} ({m.days} hari){m.services?.length ? ` • ${m.services.join(" + ")}` : ""}</span><b>{m.qty} HC</b></div>)}</section> : null}
            {/* Order Lines */}
            <div className="receipt-section-title">RINCIAN JILID & BIAYA</div>
            <div className="receipt-lines">
              {order.coversSubtotal > 0 && (
                <div>
                  <span>
                    {isSoftCover ? 'Soft Cover' : `Hard Cover (${order.coverColor})`} × {order.coverCount} eksemplar
                  </span>
                  <strong className="receipt-money">{formatIDR(order.coversSubtotal)}</strong>
                </div>
              )}

              {order.servicesBreakdown.map((s, idx) => (
                <div key={s.id || idx}>
                  <span>{s.label}</span>
                  <strong className="receipt-money">{formatIDR(s.price)}</strong>
                </div>
              ))}

              {(order.printCost || 0) > 0 && (
                <div>
                  <span>Biaya Cetak/Print Naskah</span>
                  <strong className="receipt-money">{formatIDR(order.printCost)}</strong>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="receipt-total">
              <div>
                <span>TOTAL PEMBAYARAN</span>
                <small className="block text-[10px] text-slate-500 mt-0.5 font-normal">
                  Pilihan: {paymentPreferenceLabel(order.paymentChoice)} | Status: {order.transactionStatus} (admin)
                </small>
              </div>
              <strong className="receipt-money">{formatIDR(grandTotal)}</strong>
            </div>

            {/* DP Breakdown */}
            {order.transactionStatus === 'DP' && (
              <div className="mt-2 py-2 px-3 bg-amber-50 rounded-lg border border-amber-200 flex justify-between text-xs font-mono">
                <span className="text-amber-900 font-bold">DP: {formatIDR(order.dpAmount)}</span>
                <span className="text-amber-950 font-bold">Sisa Pelunasan: {formatIDR(order.remainingAmount)}</span>
              </div>
            )}

            {/* Pickup Schedule */}
            <div className="receipt-pickup">
              <div className="pickup-icon">
                <Calendar />
              </div>
              <div>
                <span>JADWAL PENGAMBILAN NASKAH (PASTI)</span>
                <strong>{formatDisplayDate(order.pickupDate)}</strong>
              </div>
            </div>

            {/* Optional Notes */}
            {order.notes && (
              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                <span className="font-bold text-slate-900 block mb-0.5">Catatan Pesanan:</span>
                <span className="whitespace-pre-line">{order.notes}</span>
              </div>
            )}

            {/* Note */}
            <div className="receipt-note">
              <strong>MOHON TUNJUKKAN NOTA INI SAAT PENGAMBILAN</strong>
              <span>{PERCETAKAN_ADDRESS}</span>
              <span>WhatsApp Admin: {ADMIN_WHATSAPP}</span>
            </div>

            <div className="receipt-footer">
              Terima kasih telah mempercayakan kebutuhan jilid skripsi Anda kepada {PERCETAKAN_NAME}.
            </div>
          </div>

          {couponReady && <section ref={couponSectionRef} className="zc-status-area" aria-label="Kupon diskon toga digital">
          <h3>🎟 Kupon Sewa Toga Diskon 50%</h3>
          {coupon?.code ? <TogaCoupon coupon={coupon} registerDownload={fn=>{couponDownloadRef.current=fn;}}/>
          : <div className="zc-status-message" role="status">
              {couponLoading ? 'Sedang mengambil kode kupon dari database…'
                : couponError ? `Kupon gagal dimuat: ${couponError}`
                : coupon?.state==='NOT_AVAILABLE' ? 'Kupon belum terbit. Jalankan SQL pembaruan V9.11.6 agar nota yang belum lunas juga mendapatkan voucher.'
                : coupon?.state==='NOT_FOUND' ? 'Nomor pelacakan nota belum ditemukan di database. Periksa tautan nota dan hubungi admin.'
                : 'Kupon belum tersedia. Coba periksa ulang atau hubungi admin ZAIN.NET.'}
            </div>}
          {!coupon?.code && <button type="button" className="action-btn ghost zc-retry" onClick={()=>setCouponRefresh(v=>v+1)} disabled={couponLoading}>
            {couponLoading ? 'Memeriksa…' : '🔄 Periksa Ulang Kupon'}
          </button>}
          </section>}
        </div>
        {/* Action Buttons — always visible, independent of long nota/voucher previews */}
        <div className="invoice-actions">
          <button onClick={coupon?.code ? handleDownloadBundle : handleDownloadImage} disabled={isDownloading || (couponReady && !coupon?.code)} className="action-btn primary">
            {isDownloading ? <Loader2 className="spin" /> : downloadSuccess ? <CheckCircle2 /> : <Download />}
            {downloadSuccess ? 'Unduhan Siap' : couponReady ? coupon?.code ? 'Download Nota + Voucher (ZIP)' : 'Voucher belum siap — Periksa Ulang' : 'Download Nota (JPG)'}
          </button>
          <button onClick={handleCopyText} className="action-btn ghost">
            {copied ? <Check /> : <Copy />} {copied ? 'Tersalin' : 'Salin Teks'}
          </button>
          <button onClick={handleSendToAdminWhatsApp} className="action-btn whatsapp">
            <Send /> Kirim ke WhatsApp Admin
          </button>
          <button onClick={() => window.print()} className="action-btn ghost">
            <Printer /> Cetak / PDF
          </button>
        </div>
      </div>
    </div>
  );
};

const BookOpenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);
