/* ZAIN.NET V4.4 — OCR lokal: satu worker yang dipakai ulang, resize sebelum OCR.
 * Tidak mengirim foto ke server/API. Tesseract dan model bahasa tetap perlu diunduh
 * pada penggunaan pertama kecuali file model di-host di situs sendiri. */
let worker = null;
let workerLanguage = null;
let loadingPromise = null;
let onProgress = () => {};

export function setOCRProgress(callback) {
  onProgress = typeof callback === 'function' ? callback : () => {};
}
function stage(label) { try { onProgress(label); } catch (_) {} }
function deadline(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} melewati ${Math.round(ms / 1000)} detik.`)), ms); })
  ]).finally(() => clearTimeout(timer));
}
const STATUSES = {
  'loading tesseract core': 'Menyiapkan engine OCR',
  'initializing tesseract': 'Memulai OCR lokal',
  'loading language traineddata': 'Mengunduh/memuat model bahasa (pertama kali bisa lama)',
  'initializing api': 'Mengaktifkan pembaca teks',
  'recognizing text': 'Mengenali tulisan'
};

export async function resetOCR() {
  const old = worker;
  worker = null;
  workerLanguage = null;
  loadingPromise = null;
  if (old) { try { await deadline(old.terminate(), 6000, 'Menutup worker OCR'); } catch (_) {} }
}
export async function getOCRWorker(lang = 'ind') {
  if (!globalThis.Tesseract?.createWorker) {
    throw new Error('Pustaka Tesseract belum termuat. Pastikan internet untuk pemuatan pertama dan muat ulang situs. Tidak memerlukan token API.');
  }
  if (worker && workerLanguage === lang) return worker;
  if (loadingPromise) {
    try { await loadingPromise; } catch (_) {}
    if (worker && workerLanguage === lang) return worker;
  }
  if (worker) await resetOCR();
  stage('Menyiapkan model OCR lokal');
  const loader = globalThis.Tesseract.createWorker(lang, 1, {
    logger(message) {
      const name = STATUSES[message.status] || message.status || 'Memproses OCR';
      const progress = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : '';
      stage(`${name}${progress}`);
    }
  });
  loadingPromise = loader;
  try {
    const fresh = await deadline(loader, 90000, 'Mempersiapkan model OCR pertama kali');
    worker = fresh;
    workerLanguage = lang;
    stage('Model OCR siap; dipakai ulang untuk foto berikutnya');
    return fresh;
  } catch (error) {
    loader.then(w => w.terminate()).catch(() => {});
    worker = null;
    workerLanguage = null;
    throw new Error(`Model OCR gagal dimuat: ${error.message}. Coba internet stabil atau unggah Word/PDF dengan teks asli.`);
  } finally {
    if (loadingPromise === loader) loadingPromise = null;
  }
}

async function imageBitmap(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (_) { /* decode with HTMLImageElement below */ }
  }
  const src = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await deadline(new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Foto tidak dapat dibuka sebagai gambar.'));
      img.src = src;
    }), 15000, 'Membuka foto');
    return img;
  } finally { URL.revokeObjectURL(src); }
}

export async function prepareOCRImage(blob, { maxSide = 1900, contrast = true } = {}) {
  stage('Menyiapkan foto resolusi efisien');
  const bitmap = await deadline(imageBitmap(blob), 20000, 'Dekode foto');
  try {
    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height) throw new Error('Dimensi foto tidak terbaca.');
    const ratio = Math.min(1, maxSide / Math.max(width, height), Math.sqrt(2500000 / (width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) throw new Error('Browser tidak dapat mengalokasikan kanvas gambar. Coba tutup tab lain.');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (contrast && 'filter' in ctx) ctx.filter = 'grayscale(1) contrast(1.2)';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const output = await deadline(new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Kompresi foto gagal.')), 'image/jpeg', 0.87);
    }), 12000, 'Kompresi foto');
    // Release large canvas memory promptly (important for Android devices).
    canvas.width = 0; canvas.height = 0;
    stage(`Gambar siap ${Math.round(width * ratio)}×${Math.round(height * ratio)} px`);
    return output;
  } finally { if (typeof bitmap.close === 'function') bitmap.close(); }
}

export async function recognizeLocal(blob, { detail = false, isPrepared = false } = {}) {
  const language = detail ? 'ind+eng' : 'ind';
  const img = isPrepared ? blob : await prepareOCRImage(blob);
  const reader = await getOCRWorker(language);
  stage('Membaca teks dari gambar');
  try {
    const result = await deadline(reader.recognize(img), 50000, 'Pengenalan tulisan');
    const text = result?.data?.text || '';
    if (!text.trim()) throw new Error('Tidak ada teks terdeteksi. Coba foto lebih terang atau isi data manual.');
    stage('Pengenalan selesai');
    return text;
  } catch (error) {
    // If recognition hung/crashed, do not reuse a broken worker next time.
    await resetOCR();
    throw new Error(`OCR tidak berhasil: ${error.message}. Coba mode Cepat atau gunakan PDF/Word asli.`);
  }
}
