# دفتر — Android / Capacitor

هذا المشروع مجهز ليعمل كتطبيق Android عبر Capacitor مع الإبقاء على React/Vite وFirebase/Firestore.

## ما تم تجهيزه

- `capacitor.config.json` مضبوط على `dist` كمجلد WebView النهائي.
- `androidScheme` مضبوط على `https` حتى يبقى WebView في سياق آمن، وهو مهم لمسار WebAuthn/البصمة الموجود في التطبيق.
- App ID: `com.daftar.app`
- سكربتات جاهزة للبناء والمزامنة:
  - `npm run cap:add`
  - `npm run cap:sync`
  - `npm run cap:open`
  - `npm run cap:run`
- Firebase/Firestore يبقى داخل التطبيق نفسه؛ Capacitor لا يغيّر طريقة المزامنة.

## إنشاء مجلد Android أول مرة

يتطلب ذلك Node.js وAndroid Studio وAndroid SDK.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

بعد فتح Android Studio:

1. انتظر انتهاء Gradle Sync.
2. اختر `Build > Build APK(s)` لإنشاء نسخة debug.
3. للنسخة النهائية اختر `Build > Generate Signed Bundle / APK` ثم APK.

## المزامنة والعمل بدون إنترنت

التطبيق يستخدم Firestore persistent local cache. عمليات الكتابة التي تتم دون اتصال تبقى محليًا ثم يرفعها Firestore عند عودة الاتصال، بينما `onSnapshot` يحدّث البيانات محليًا ومن السحابة.

لا تستخدم `http://` لسيرفر خارجي داخل التطبيق. إعداد Capacitor الحالي يستخدم `https` لسياق Android.

## البصمة وكلمة المرور

التطبيق يحتوي أصلًا على كلمة مرور الأدمن ومسار WebAuthn للبصمة. في Android يجب أن يكون الجهاز قد فعّل قفل الشاشة/بصمة أو وسيلة تحقق مدعومة. كلمة المرور تبقى بديلًا إذا لم تتوفر البصمة أو تم إلغاؤها.

## ملاحظة عن الصور والنسخ الاحتياطي

Firebase Storage/Firestore يعملان داخل WebView مثل الويب طالما أن إعدادات Firebase وقواعد Firestore/Storage صحيحة. بعض عمليات تنزيل الملفات والمشاركة قد تحتاج لاحقًا إلى Capacitor Filesystem/Share إذا أردت حفظ ملفات APK/النسخ الاحتياطية في مجلدات Android الأصلية.


## البصمة الأصلية في Android

نسخة Android تستخدم `@rolster/capacitor-native-biometric` مع Capacitor 6 لاستدعاء شاشة التحقق الحيوي الأصلية في Android، بينما يبقى WebAuthn للويب/PWA. بعد `npm install` نفّذ `npx cap sync android`. إذا احتاج المشروع إضافة الإذن يدويًا، أضف `android.permission.USE_BIOMETRIC` إلى `android/app/src/main/AndroidManifest.xml`.

هذه البصمة قفل محلي للتطبيق وليست تسجيل دخول Firebase؛ Firebase والمزامنة يعملان مستقلين عنها. كلمة مرور الأدمن تبقى مسار الاسترداد.
