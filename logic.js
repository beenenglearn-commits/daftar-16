// دوال نقية (بدون اعتماد على المتصفح أو Firebase) — سهلة الاختبار.

// عدد العمليات التي يحتفظ بها الهاتف محليًا بعد كل رفع ناجح
export const LOCAL_KEEP = 50;

// معرّف فريد يُنشأ على الهاتف نفسه. يُستخدم أيضًا كمعرّف للمستند في Firebase،
// فإذا أُعيد الرفع بعد انقطاع لا يتكرر السجل (نفس المعرّف = نفس المستند).
export function newId() {
  const c = typeof crypto !== "undefined" ? crypto : null;
  let rnd;
  if (c && c.randomUUID) rnd = c.randomUUID().replace(/-/g, "");
  else rnd = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  return "l" + rnd.slice(0, 24);
}

// وقت السجل بالمللي ثانية (للترتيب): createdAt ثم date
export function tsOf(item) {
  const t = Date.parse((item && (item.createdAt || item.date)) || "");
  return Number.isNaN(t) ? 0 : t;
}

export function sortOldestFirst(list) {
  return list.slice().sort((a, b) => tsOf(a) - tsOf(b));
}

// يدمج قائمتين بالمعرّف: عناصر primary تتقدم على secondary
export function mergeById(primary, secondary) {
  const ids = new Set(primary.map((x) => x.id));
  return [...primary, ...secondary.filter((x) => !ids.has(x.id))];
}

// records: [{ key, ts }] — يرجع المفاتيح التي يجب حذفها للإبقاء على أحدث `keep` سجل
export function selectDrop(records, keep) {
  return records
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(keep)
    .map((r) => r.key);
}

// ---------- إجماليات التقارير حسب اليوم ----------
const emptyBucket = () => ({ inc: 0, exp: 0, debt: 0, recv: 0, pay: 0, payment: 0, paid: 0, partial: 0, unpaid: 0 });

export function buildAgg(incomes, expenses, debts, payments = []) {
  const agg = {};
  const at = (d) => agg[d] || (agg[d] = emptyBucket());
  for (const i of incomes) if (i.date) at(i.date).inc += Number(i.amount) || 0;
  for (const e of expenses) if (e.date) at(e.date).exp += Number(e.amount) || 0;
  for (const p of payments) {
    if (!p.date || p.status !== "confirmed") continue;
    at(p.date).payment += Number(p.amount) || 0;
  }
  for (const d of debts) {
    if (!d.date) continue;
    const b = at(d.date);
    const a = Number(d.amount) || 0;
    b.debt += a;
    if (d.type === "receivable") b.recv += a;
    else if (d.type === "payable") b.pay += a;
    if (d.status === "paid") b.paid += 1;
    else if (d.status === "unpaid") b.unpaid += 1;
    else if (d.status === "partial") b.partial += 1;
  }
  return agg;
}

export function mergeAgg(a, b) {
  const out = {};
  for (const src of [a || {}, b || {}]) {
    for (const [date, bucket] of Object.entries(src)) {
      const o = out[date] || (out[date] = emptyBucket());
      for (const k of Object.keys(o)) o[k] += bucket[k] || 0;
    }
  }
  return out;
}

// يجمع أيام agg التي تحقق inRange(date) ويرجع أرقام التقرير
export function reportFromAgg(agg, inRange) {
  const r = { incTotal: 0, expTotal: 0, debtTotal: 0, paymentTotal: 0, receivable: 0, payable: 0, paid: 0, partial: 0, unpaid: 0 };
  for (const [date, b] of Object.entries(agg)) {
    if (!inRange(date)) continue;
    r.incTotal += b.inc;
    r.expTotal += b.exp;
    r.debtTotal += b.debt;
    r.paymentTotal += b.payment || 0;
    r.receivable += b.recv;
    r.payable += b.pay;
    r.paid += b.paid;
    r.partial += b.partial;
    r.unpaid += b.unpaid;
  }
  r.net = r.incTotal + r.paymentTotal - r.expTotal - r.debtTotal;
  return r;
}

// records: [{ key, ts, pending }] — يبقي كل السجلات "pending" (غير مرفوعة بعد، لا تُحذف أبدًا)
// بالإضافة إلى أحدث `keep` سجل من المرفوعة (pending=false). يرجع مصفوفة المفاتيح المطلوب حذفها.
export function selectKeepDrop(records, keep) {
  const synced = records.filter((r) => !r.pending).sort((a, b) => b.ts - a.ts);
  const dropSet = new Set(synced.slice(keep).map((r) => r.key));
  return records.filter((r) => dropSet.has(r.key)).map((r) => r.key);
}
