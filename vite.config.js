import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// البنية المسطّحة: كل ملفات المشروع في جذر المستودع (بدون مجلدي src و public).
// Vite ينسخ مجلد public إلى dist كما هو، لذلك ننشئه هنا تلقائيًا قبل البناء من
// الملفات الموجودة في الجذر — بنفس المسارات التي يتوقعها التطبيق (icons/... إلخ).
// إن كان مجلد public موجودًا أصلًا بملفاته فلا يُستبدل شيء.
const STATIC_FILES = {
  "manifest.json": "manifest.json",
  "sw.js": "sw.js",
  "icon-192.png": "icon-192.png",
  "icon-512.png": "icon-512.png",
  "logout.png": "icons/logout.png",
  "more.png": "icons/more.png",
  "notification.png": "icons/notification.png",
  "search.png": "icons/search.png",
  "settings.png": "icons/settings.png",
  "support.png": "icons/support.png",
};
const root = process.cwd();
for (const [from, to] of Object.entries(STATIC_FILES)) {
  const src = path.join(root, from);
  const dest = path.join(root, "public", to);
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

export default defineConfig({
  plugins: [react()],
  base: "./", // important for Capacitor: assets must use relative paths
});
