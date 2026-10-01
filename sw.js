const CACHE_NAME = "daftar-cache-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation and app files, falling back to cache when offline.
// (Data itself comes from Firestore, which has its own offline queue.)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // لا نتدخل في طلبات Firebase/Google (بيانات حيّة أو خطوط): نخدم ملفات التطبيق نفسها فقط
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
