import { initializeApp } from "firebase/app";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ============================================================
// ⚠️ ضع هنا إعدادات مشروعك في Firebase:
// Firebase Console → أيقونة الترس (⚙) → Project settings
// → مرّر للأسفل إلى "Your apps" → إن لم يوجد تطبيق ويب اضغط </> لإضافته
// → انسخ الكائن firebaseConfig وألصقه مكان القيم أدناه
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyCf9J171Q0GIluclYnNS-G5biC0hSWGJQM",
  authDomain: "dafter-v3.firebaseapp.com",
  projectId: "dafter-v3",
  storageBucket: "dafter-v3.firebasestorage.app",
  messagingSenderId: "567540152191",
  appId: "1:567540152191:web:9e02ad453acffe4304cc4a",
  measurementId: "G-T9JJSDP2ME",
};

const app = initializeApp(firebaseConfig);

// persistentLocalCache: يحفظ Firestore بيانات القراءة والكتابة على الهاتف تلقائيًا،
// ويرفع أي عملية جديدة بمجرد توفر الإنترنت من تلقاء نفسه (بلا كود إضافي منا).
// persistentSingleTabManager: مناسب لتطبيق يفتح تبويبًا واحدًا فقط (متصفح أو تطبيق هاتف).
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  });
} catch (e) {
  // متصفحات قديمة جدًا أو وضع تصفح خاص قد لا تدعم التخزين الدائم — نستمر بدونه
  console.warn("تعذّر تفعيل التخزين المحلي الدائم، سيعمل التطبيق بدون حفظ محلي كامل:", e);
  db = getFirestore(app);
}
export { db };
export const auth = getAuth(app);
