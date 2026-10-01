import { db, auth, firebaseConfig } from "./firebase";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

const COLLECTIONS = {
  income: "incomes",
  expense: "expenses",
  debt: "debts",
  payment: "payments",
  support: "supportRequests",
  supplier: "suppliers",
  supplierTransaction: "supplierTransactions",
};

// ---------- سياق الحفظ: المتجر والعامل الحاليان ----------
// كل سجل جديد يُختم تلقائيًا بـ storeId (المتجر) و workerId/workerName (من نفّذ العملية)،
// فلا يعتمد الفصل بين المتاجر على ما تختاره الواجهة، وقواعد Firestore تتحقق منه أيضًا.
let ctx = { storeId: "", workerId: "", workerName: "" };
export function setDataContext(next) { ctx = { ...ctx, ...next }; }

// Subscribes to a collection (filtered by store) and calls `callback` with a live array.
// كل عنصر يحمل _pending: true إذا كان قد كُتب على هذا الهاتف ولم يصل إلى الخادم بعد.
export function subscribe(kind, callback, opts = {}) {
  const colRef = collection(db, COLLECTIONS[kind]);
  const constraints = [];
  if (opts.storeId) constraints.push(where("storeId", "==", opts.storeId));
  if (opts.senderUid) constraints.push(where("senderUid", "==", opts.senderUid));
  const source = constraints.length ? query(colRef, ...constraints) : colRef;
  return onSnapshot(
    source,
    { includeMetadataChanges: true },
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data(), _pending: d.metadata.hasPendingWrites }));
      callback(items, { fromCache: snap.metadata.fromCache });
    },
    (error) => {
      console.error(`subscribe(${kind}) failed:`, error);
    }
  );
}

export async function addItem(kind, data, opts = {}) {
  if (!ctx.storeId) throw new Error("لم يتم تحديد المتجر");
  const who = kind === "supplier" ? {} : { workerId: ctx.workerId || "", workerName: ctx.workerName || "" };
  const payload = { ...who, ...data, storeId: ctx.storeId };
  // معرّف ثابت: يمنع تكرار السجل (مثل دخل اليوم الواحد) لأن القواعد لا تسمح للعامل بالتعديل
  if (opts.id) return setDoc(doc(db, COLLECTIONS[kind], opts.id), payload);
  return addDoc(collection(db, COLLECTIONS[kind]), payload);
}

export async function updateItem(kind, id, patch) {
  // لا نسمح بتغيير المتجر عبر نموذج التعديل
  const { _pending, id: _drop, storeId: _store, ...clean } = patch;
  return updateDoc(doc(db, COLLECTIONS[kind], id), clean);
}

export async function deleteItem(kind, id) {
  return deleteDoc(doc(db, COLLECTIONS[kind], id));
}

// ---------- الجلسة: من هو المستخدم الحالي؟ ----------
export const workerEmail = (username) => `${String(username || "").trim().toLowerCase()}@workers.daftar.app`;
export const validUsername = (u) => /^[a-z0-9._-]{3,20}$/.test(String(u || "").trim().toLowerCase());

export async function resolveSession(user) {
  const a = await getDoc(doc(db, "admins", user.uid));
  if (a.exists()) return { role: "admin", uid: user.uid, email: user.email || "", workerName: a.data().name || "الأدمن" };
  const w = await getDoc(doc(db, "workers", user.uid));
  if (!w.exists()) return null;
  const d = w.data();
  if (d.active === false) return { blocked: true };
  let storeName = "";
  try { const st = await getDoc(doc(db, "stores", d.storeId)); storeName = st.exists() ? st.data().name || "" : ""; } catch {}
  return { role: "worker", uid: user.uid, storeId: d.storeId, storeName, workerName: d.name || d.username || "" };
}

// إنشاء حساب الأدمن لأول مرة. تسمح القواعد بذلك مرة واحدة فقط (قبل وجود meta/setup).
export async function bootstrapAdmin(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try {
    const batch = writeBatch(db);
    const at = new Date().toISOString();
    batch.set(doc(db, "admins", cred.user.uid), { name: name || "الأدمن", email, createdAt: at });
    batch.set(doc(db, "meta", "setup"), { done: true, by: cred.user.uid, at });
    await batch.commit();
  } catch (e) {
    await deleteUser(cred.user).catch(() => {});
    throw new Error("تم إنشاء حساب الأدمن مسبقًا — استخدم تسجيل الدخول");
  }
}

// تغيير كلمة مرور الحساب الحالي (أدمن أو عامل)
export async function changeMyPassword(current, next) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("لا توجد جلسة دخول");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}

// ---------- المتاجر والعمال ----------
export function subscribeStores(callback) {
  return onSnapshot(collection(db, "stores"), (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error("stores", e));
}
export function subscribeWorkers(callback) {
  return onSnapshot(collection(db, "workers"), (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error("workers", e));
}
export async function addStore({ name, type }) {
  const ref = await addDoc(collection(db, "stores"), { name: name.trim(), type: (type || "").trim(), createdAt: new Date().toISOString() });
  return ref.id;
}
export function subscribeStoreDoc(id, callback) {
  return onSnapshot(doc(db, "stores", id), (snap) => callback(snap.exists() ? snap.data() : null), (e) => console.error("store", e));
}
export const saveStoreHours = (id, incomeStart, incomeEnd) => updateDoc(doc(db, "stores", id), { incomeStart, incomeEnd, hoursSetAt: new Date().toISOString() });
export const setWorkerActive = (uid, active) => updateDoc(doc(db, "workers", uid), { active });

// نسخة Firebase ثانوية تُستخدم لإنشاء حسابات العمال فقط، كي لا يُسجَّل خروج الأدمن
function secondaryAuth() {
  const app = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
  return getAuth(app);
}
export async function createWorker({ name, username, pin, storeId }) {
  const uname = String(username).trim().toLowerCase();
  const sec = secondaryAuth();
  const cred = await createUserWithEmailAndPassword(sec, workerEmail(uname), pin);
  try {
    await setDoc(doc(db, "workers", cred.user.uid), { name: name.trim(), username: uname, storeId, active: true, createdAt: new Date().toISOString() });
  } catch (e) {
    await deleteUser(cred.user).catch(() => {});
    throw e;
  }
  await signOut(sec).catch(() => {});
}

// ---------- ترحيل البيانات القديمة (بلا storeId) إلى متجر ----------
export async function migrateLegacy(storeId) {
  let n = 0;
  for (const name of Object.values(COLLECTIONS)) {
    const snap = await getDocs(collection(db, name));
    const todo = snap.docs.filter((d) => !d.data().storeId);
    for (let i = 0; i < todo.length; i += 400) {
      const batch = writeBatch(db);
      const part = todo.slice(i, i + 400);
      part.forEach((d) => batch.update(d.ref, { storeId }));
      await batch.commit();
      n += part.length;
    }
  }
  return n;
}
