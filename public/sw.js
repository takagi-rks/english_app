const CACHE_NAME = "english-trainer-v1";
const STATIC_CACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

const OFFLINE_HTML = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>オフラインです - 英会話トレーナー</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: Arial, "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
        background: #f7f7f4;
        color: #1e2528;
      }
      main {
        max-width: 520px;
        padding: 24px;
        border: 1px solid #d7ddd8;
        border-radius: 8px;
        background: #ffffff;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      p {
        margin: 0;
        line-height: 1.7;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>オフラインです</h1>
      <p>インターネット接続を確認してから、もう一度お試しください。学習データの取得には通信が必要です。</p>
    </main>
  </body>
</html>`;

function isSupabaseRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes("supabase.co") || url.pathname.includes("/rest/v1/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || isSupabaseRequest(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() =>
          caches.match(request).then((cachedResponse) => {
            return cachedResponse ?? new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html" } });
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        const url = new URL(request.url);

        if (response.ok && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      });
    })
  );
});
