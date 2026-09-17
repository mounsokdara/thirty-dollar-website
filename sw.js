/* Thirty Dollar Website (Remade) — offline cache */
const VERSION = "tdw-offline-v3";
const SCOPE = new URL("./", self.location.href).pathname;

const PRECACHE = [
  SCOPE,
  SCOPE + "favicon.svg",
  SCOPE + "favicon.png",
  SCOPE + "apple-touch-icon.png",
  SCOPE + "icon-192.png",
  SCOPE + "icon-512.png",
  SCOPE + "icon-512-maskable.png",
  SCOPE + "manifest.webmanifest",
  SCOPE + "fonts/lato-400.woff2",
  SCOPE + "fonts/lato-700.woff2",
  SCOPE + "fonts/lato-900.woff2",
  SCOPE + "fonts/discord-emoji.woff2",
  SCOPE + "assets/🗿.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  const p = url.pathname;
  return (
    p.startsWith(SCOPE + "sounds/") ||
    p.startsWith(SCOPE + "icons/") ||
    p.startsWith(SCOPE + "assets/") ||
    p.startsWith(SCOPE + "fonts/") ||
    p.startsWith(SCOPE + "twemoji/") ||
    p.startsWith(SCOPE + "icon-") ||
    p === SCOPE + "favicon.svg" ||
    p === SCOPE + "favicon.png" ||
    p === SCOPE + "apple-touch-icon.png" ||
    p === SCOPE + "manifest.webmanifest" ||
    /\.(wav|png|svg|woff2|json|js|css|mjs|webmanifest)$/i.test(p)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/__grok/") || url.pathname.includes("/auth/")) return;

  if (isAsset(url)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          caches.open(VERSION).then((c) => c.put(SCOPE, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match(SCOPE))),
  );
});
