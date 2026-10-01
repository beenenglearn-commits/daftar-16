// يضغط صورة مُختارة من الهاتف إلى Data URL صغير (JPEG) قابل للتخزين كحقل داخل
// مستند Firestore مباشرة، فيستفيد تلقائيًا من الحفظ والرفع بلا إنترنت.
// الهدف: البقاء تحت ~160 كيلوبايت لكل صورة.
const MAX_BYTES = 160 * 1024;
const START_DIM = 1280;
const MIN_DIM = 400;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

// ---- حماية فتح الكاميرا/المعرض ----
// عند فتح تطبيق الكاميرا يصبح التطبيق "مخفيًا" (document.hidden)، وقفل التطبيق
// التلقائي كان يعيد المستخدم لشاشة الاختيار فتضيع النافذة والصورة. هذه العلامة
// تُخبر القفل بأن الإخفاء ناتج عن اختيار صورة وليس عن خروج المستخدم.
let pickingUntil = 0;
export const beginPicking = () => { pickingUntil = Date.now() + 3 * 60 * 1000; };
export const endPicking = () => { pickingUntil = 0; };
export const isPicking = () => Date.now() < pickingUntil;

// بعض كاميرات أندرويد ترجع ملفًا بلا نوع MIME (type فارغ) — نقبله إن كان امتداده صورة
export const isImageFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  if (!file.type || file.type === "application/octet-stream") return IMAGE_EXT.test(file.name || "") || !file.name;
  return false;
};

function bytesOfDataUrl(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

// يحاول عدة طرق لفك ترميز الصورة (الكاميرات تختلف في الصيغة والحجم)
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close && bmp.close() };
    } catch { /* ننتقل للطريقة التالية */ }
  }
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = await imageFromUrl(url);
      return { src: img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, close() {} };
    } finally { URL.revokeObjectURL(url); }
  } catch { /* ننتقل للطريقة التالية */ }
  try {
    const img = await imageFromUrl(await readAsDataUrl(file));
    return { src: img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, close() {} };
  } catch {
    throw new Error("تعذّرت قراءة الصورة. إن كانت بصيغة HEIC فغيّر إعداد الكاميرا إلى JPEG أو اختر صورة أخرى");
  }
}

// يرجع { name, type: "image/jpeg", dataUrl } أو يرمي خطأ بعبارة عربية واضحة
export async function compressImage(file) {
  const dec = await decode(file);
  try {
    let dim = START_DIM;
    while (dim >= MIN_DIM) {
      const scale = Math.min(1, dim / Math.max(dec.w, dec.h));
      const w = Math.max(1, Math.round(dec.w * scale));
      const h = Math.max(1, Math.round(dec.h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("تعذّر تجهيز الصورة على هذا الجهاز");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(dec.src, 0, 0, w, h);
      for (const q of [0.8, 0.65, 0.5, 0.35]) {
        const dataUrl = canvas.toDataURL("image/jpeg", q);
        if (!dataUrl.startsWith("data:image/jpeg")) break; // فشل الكانفاس (ذاكرة)
        if (bytesOfDataUrl(dataUrl) <= MAX_BYTES) {
          const base = (file.name || "photo").replace(/\.[^.]+$/, "");
          return { name: `${base}.jpg`, type: "image/jpeg", dataUrl };
        }
      }
      dim = Math.round(dim * 0.75);
    }
    throw new Error("الصورة كبيرة جدًا حتى بعد الضغط — جرّب صورة أخرى");
  } finally { dec.close(); }
}
