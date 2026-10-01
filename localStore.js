// تخزين محلي خفيف على الهاتف (IndexedDB) لعرض فوري عند فتح التطبيق بلا إنترنت.
// ملاحظة: طابور الكتابة نفسه (حفظ العمليات الجديدة بلا إنترنت ثم رفعها) تتولاه
// مكتبة Firestore تلقائيًا عبر persistentLocalCache في firebase.js — هذا الملف
// لا يكرر تلك الوظيفة، بل يحتفظ فقط بـ"آخر 50 عملية" للعرض السريع + بآخر إجماليات
// معروفة (للتقارير) وقائمة الديون المفتوحة (لنموذج تسجيل السداد بلا إنترنت).
import { selectKeepDrop } from "./logic.js";

let dbName = "daftar-local";
// كل متجر له تخزين محلي مستقل، كي لا تظهر بيانات متجر لعامل متجر آخر على الجهاز نفسه
export function setCacheScope(storeId) {
  const next = "daftar-local-" + (storeId || "none");
  if (next !== dbName) { dbName = next; dbPromise = null; }
}
const STORES = { ops: "key", meta: "k" };

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB غير متاح"));
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function run(storeNames, mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeNames, mode);
        const stores = storeNames.map((n) => t.objectStore(n));
        let out;
        try {
          out = work(...stores);
        } catch (e) {
          try { t.abort(); } catch (_) { /* ignore */ }
          reject(e);
          return;
        }
        t.oncomplete = () => resolve(out && typeof out === "object" && "result" in out ? out.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("أُلغيت المعاملة"));
      })
  );
}

let chain = Promise.resolve();
function serial(fn) {
  const p = chain.then(fn);
  chain = p.catch(() => {});
  return p;
}

// ---------- ops (آخر العمليات، مع حماية غير المرفوع) ----------
export const getOps = () => run(["ops"], "readonly", (s) => s.getAll());

// records: [{ key, kind, ts, pending, item }]
// يحفظ كل السجلات الجديدة، ثم يحذف الأقدم من المرفوعة فقط لإبقاء العدد ضمن `keep`.
// كل ذلك داخل معاملة واحدة (put ثم getAll ثم delete) حتى لا تُقفل المعاملة قبل التقليم.
export const saveOps = (records, keep) =>
  serial(() =>
    run(["ops"], "readwrite", (s) => {
      records.forEach((r) => s.put(r));
      let count = 0;
      const getAllReq = s.getAll();
      getAllReq.onsuccess = () => {
        const all = getAllReq.result;
        const drop = selectKeepDrop(all, keep);
        drop.forEach((k) => s.delete(k));
        count = all.length - drop.length;
      };
      return { get result() { return count; } };
    })
  );

// ---------- meta (إجماليات التقارير، الديون المفتوحة، ...) ----------
export const getMeta = (k) =>
  run(["meta"], "readonly", (s) => s.get(k)).then((r) => (r ? r.v : undefined));
export const setMeta = (k, v) => serial(() => run(["meta"], "readwrite", (s) => { s.put({ k, v }); }));
