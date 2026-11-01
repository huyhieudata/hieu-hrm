const CACHE_NAME = "onhrm-v3";

self.addEventListener("install", (event) => {
  // Không precache HTML: lần mở đầu trên mạng chậm không bị SW kéo thêm bản sao của trang.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isAsset = (pathname) =>
  /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico|webmanifest)$/i.test(pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/storage/")) {
    return;
  }
  if (url.pathname.startsWith("/src/") || url.pathname.startsWith("/@")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => (await caches.match("/")) ?? (await caches.match(request))),
    );
    return;
  }

  if (!isAsset(url.pathname)) return;

  // Có cache thì trả ngay, vẫn cập nhật nền. Lần đầu không cache thì đi mạng, không chặn bằng precache.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
