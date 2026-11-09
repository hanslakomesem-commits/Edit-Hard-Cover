export interface FacultyData {
  id: string;
  name: string;
  code: string;
  defaultCoverColor: string;
  prodis: string[];
}

export type UniversityKey = 'uin_madura' | 'other';

export type FileDeliveryMethod = 'upload_server' | 'whatsapp_only';

export type PaymentChannel = 'Cash' | 'Transfer';

export type DurationKey = '1_day' | '2_day' | '3_day';

export interface DurationOption {
  key: DurationKey;
  label: string;
  days: number;
  pricePerCover: number;
  tag: string;
  description: string;
}

export interface ExtraServiceOption {
  id: string;
  label: string;
  price: number;
  requiresFile: boolean;
  description: string;
  badge?: string;
  promoTag?: string;
  // Specific prodi filters
  allowedProdiKeywords?: string[];
  specialProdiNote?: string;
}

export interface UploadedFileInfo {
  name: string;
  filename?: string;
  size: number;
  type: string;
  uploadedAt: string;
  serviceCategory?: string;
  url?: string;
  dataUrl?: string;
}

export type TransactionStatus = 'Lunas' | 'DP' | 'Belum Bayar' | 'LUNAS' | 'Bayar Sekarang' | 'Bayar Nanti';

export type CoverType = 'hard_cover' | 'soft_cover';

export interface OrderRecord {
  orderId: string;
  couponTrackingToken?: string;
  orderKind?: 'student' | 'reseller';
  resellerCompany?: string;
  resellerStudents?: Array<{name: string; qty: number; days: number; prodi?: string; packageId?: number; services?: string[]; subtotal?: number}>;
  normalTotal?: number;
  resellerPriceLines?: Array<{name: string; qty: number; normalPrice: number; resellerPrice: number}>;
  studentName: string;
  university: string;
  isCustomUniversity?: boolean;
  fakultas: string;
  isCustomFaculty?: boolean;
  prodi: string;
  isCustomProdi?: boolean;
  coverColor: string;
  isCustomCoverColor?: boolean;
  coverHex?: string;
  whatsapp: string;
  coverType?: CoverType;
  coverCount: number;
  durationKey: DurationKey;
  durationLabel: string;
  durationDays: number;
  pricePerCover: number;
  coversSubtotal: number;
  selectedServices: string[];
  servicesBreakdown: Array<{
    id: string;
    label: string;
    price: number;
  }>;
  servicesSubtotal: number;
  printCost: number; // Manual print cost
  totalCost: number;
  fileDeliveryMethod: FileDeliveryMethod;
  uploadedFiles?: UploadedFileInfo[];
  receivedDate?: string; // Tanggal fisik sampul disetor; bisa berbeda dari tanggal nota dibuat.
  orderDate: string; // YYYY-MM-DD HH:mm
  pickupDate: string; // YYYY-MM-DD HH:mm
  status: 'Menunggu' | 'Proses Jilid' | 'Siap Diambil' | 'Selesai';
  bindingCompletedOn?: string | null; // Tanggal selesai penyampulan nyata, YYYY-MM-DD WIB
  productionTrackingAvailable?: boolean;
  // Transaction and Payment specifications
  transactionStatus: TransactionStatus;
  paymentChoice?: 'Lunas' | 'DP' | 'Belum Bayar';
  paymentChannel?: PaymentChannel;
  dpAmount: number;
  remainingAmount: number;
  adminConfirmed: boolean;
  verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  adminConfirmedAt?: string;
  adminConfirmedBy?: string;
  notes?: string;
  items?: any[];
  extras?: any[];
  createdAt: number;
}
