// يربط حالة React (المصفوفات القادمة من Firestore) بالتخزين المحلي في localStore.js.
// - persist(...) تُستدعى في useEffect كلما تغيّرت البيانات، فتحفظ:
//     • آخر 50 عملية (محمية: العناصر غير المرفوعة بعد لا تُحذف أبدًا) لعرض فوري بلا إنترنت.
//     • آخر إجماليات معروفة (للتقارير) وقائمة الديون المفتوحة (لنموذج السداد).
// - loadCached() تُستدعى مرة عند فتح التطبيق لتهيئة العرض قبل وصول بيانات Firestore.
import { LOCAL_KEEP, tsOf, buildAgg } from "./logic.js";
import { getOps, saveOps, getMeta, setMeta, setCacheScope } from "./localStore.js";
export { setCacheScope };

const KINDS = ["income", "expense", "debt", "payment"];

// لا نكرر الصور داخل تخزيننا المحلي (Firestore يحتفظ بها في ذاكرته المحلية أصلًا)
function stripImage(it) {
  if (!it.image && !it.attachments) return it;
  const { image, attachments, ...rest } = it;
  return { ...rest, hasImage: true, attachmentCount: Array.isArray(attachments) ? attachments.length : (image ? 1 : 0) };
}

function toRecords(kind, items) {
  return items.map((it) => ({
    key: `${kind}:${it.id}`,
    kind,
    ts: tsOf(it),
    pending: !!it._pending,
    item: stripImage(it),
  }));
}

export async function persist({ incomes, expenses, debts, payments }) {
  const byKind = { income: incomes, expense: expenses, debt: debts, payment: payments };
  const records = KINDS.flatMap((k) => toRecords(k, byKind[k]));
  await saveOps(records, LOCAL_KEEP);

  const agg = buildAgg(incomes, expenses, debts, payments);
  const openDebts = debts.filter((d) => d.status !== "paid");
  await Promise.all([setMeta("agg", agg), setMeta("openDebts", openDebts)]);
}

// يعيد بناء آخر مصفوفات معروفة لكل نوع (حتى 50 عنصرًا إجمالًا موزّعة بحسب النوع)
// بالإضافة إلى الإجماليات وقائمة الديون المفتوحة — لعرض التطبيق فور فتحه بلا إنترنت.
export async function loadCached() {
  const [ops, agg, openDebts] = await Promise.all([
    getOps().catch(() => []),
    getMeta("agg").catch(() => undefined),
    getMeta("openDebts").catch(() => undefined),
  ]);
  const byKind = { income: [], expense: [], debt: [], payment: [] };
  ops
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .forEach((r) => { if (byKind[r.kind]) byKind[r.kind].push(r.item); });
  return {
    incomes: byKind.income,
    expenses: byKind.expense,
    debts: byKind.debt,
    payments: byKind.payment,
    agg: agg || {},
    openDebts: openDebts || [],
  };
}
