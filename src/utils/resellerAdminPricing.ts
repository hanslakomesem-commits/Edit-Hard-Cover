/** ZAIN.NET V9.12.2 — harga reseller untuk nota kolektif buatan admin.
 * Hanya preview. Server SQL memvalidasi dan menghitung ulang semua tarif.
 */
export const RESELLER_HC_UNIT: Readonly<Record<number, number>> = Object.freeze({1:35000,2:30000,3:25000});
export const RESELLER_ADDONS: Readonly<Record<string,number>> = Object.freeze({CD:7000,Artikel:10000,SKEK:3000,'Pisah-pisah File':5000});
export const RESELLER_PACKAGE_NAMES: Readonly<Record<number,string>> = Object.freeze({
  1:'Paket 1 — Hard Cover',
  2:'Paket 2 — Hard Cover + CD',
  3:'Paket 3 — Hard Cover + Artikel',
  4:'Paket 4 — Hard Cover + CD + Artikel',
  5:'Paket 5 — Hard Cover + CD + Artikel + SKEK',
  6:'Paket 6 — Lengkap (termasuk Pisah File)',
  7:'Custom — Pilih layanan tambahan',
});
const PACKAGE_ADDONS:Readonly<Record<number,readonly string[]>>=Object.freeze({
  1:[],2:['CD'],3:['Artikel'],4:['CD','Artikel'],5:['CD','Artikel','SKEK'],6:['CD','Artikel','SKEK','Pisah-pisah File']
});
export interface ResellerPricingMember {qty:number; days:number; packageId:number; services?:string[]}
export function resellerExtras(member:ResellerPricingMember):string[] {
  return member.packageId === 7 ? Object.keys(RESELLER_ADDONS).filter(s=>member.services?.includes(s))
    : [...(PACKAGE_ADDONS[member.packageId]||[])];
}
export function resellerMemberTotal(member:ResellerPricingMember):number {
  const hc=RESELLER_HC_UNIT[member.days];
  if(!hc || !Number.isInteger(member.qty) || member.qty<1 || member.qty>100)return 0;
  return hc*member.qty+resellerExtras(member).reduce((s,p)=>s+RESELLER_ADDONS[p],0);
}
/** Tanggal setor dihitung sebagai hari nol. Hari Minggu tidak dihitung. */
export function resellerPickupDate(startISO:string,days:number):string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)||![1,2,3].includes(days))return '';
  const [y,m,d]=startISO.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d,12));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==m||dt.getUTCDate()!==d)return '';
  let n=0;
  while(n<days){dt.setUTCDate(dt.getUTCDate()+1);if(dt.getUTCDay()!==0)n++;}
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}
export function getResellerDateWindow(nowWibISO:string):{min:string;max:string} {
  const max=nowWibISO.slice(0,10);
  const dt=new Date(`${max}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate()-30);
  return {min:dt.toISOString().slice(0,10),max};
}
