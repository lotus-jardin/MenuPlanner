// Service Worker：オフラインでもアプリが開けるようにするための仕組み。
// 「まずネットから最新を取りに行き、取れなければキャッシュ（保存済み）を使う」方式にして、
// 電波があるときは常に最新版が表示されるようにする。
// 番号は js/shared.js の APP_VERSION と同じにそろえる。
const CACHE_NAME = "menu-app-v25";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./pantry.html",
  "./dislikes.html",
  "./menus.html",
  "./family.html",
  "./css/style.css",
  "./js/shared.js",
  "./js/period.js",
  "./js/ingredient-utils.js",
  "./js/stock.js",
  "./js/shopping-list.js",
  "./js/info-panel.js",
  "./js/wishlist.js",
  "./js/feedback.js",
  "./js/preference.js",
  "./js/review.js",
  "./js/onboarding.js",
  "./js/tabs.js",
  "./js/photo-import.js",
  "./js/ai-prompt.js",
  "./js/ai-parse.js",
  "./js/ai-load.js",
  "./js/period-notes.js",
  "./js/side-dishes.js",
  "./js/save-menu.js",
  "./js/backup.js",
  "./js/pantry.js",
  "./js/dislikes.js",
  "./js/menus.js",
  "./js/family.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // 新しいバージョンをすぐ有効にする
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      ),
      self.clients.claim(), // 開いているページをすぐ新しいバージョンに切り替える
    ])
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const networkFetch = fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
      // 後で（タイムアウト後に）このPromiseが失敗しても無視してよい
      networkFetch.catch(() => {});

      try {
        // 完全なオフラインならすぐに失敗するが、電波が弱いだけだとfetchがずっと
        // 待たされることがあるので、3秒待っても返事がなければキャッシュを使う。
        return await Promise.race([
          networkFetch,
          new Promise((_, reject) => setTimeout(() => reject(new Error("slow network")), 3000)),
        ]);
      } catch {
        const cached = await caches.match(event.request);
        return cached || networkFetch;
      }
    })()
  );
});
