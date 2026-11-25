/* Ice Time Playbook: offline support.
   Change VERSION whenever you upload a new index.html so phones pick up the update. */
const VERSION = "icetime-v2";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pages: show the saved copy right away (works with no signal), refresh it in the background.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(VERSION).then(async cache => {
        const cached = await cache.match("./index.html");
        const fresh = fetch(req).then(res => { if (res.ok) cache.put("./index.html", res.clone()); return res; }).catch(() => null);
        return cached || (await fresh) || new Response("You're offline. Open the app once with internet first.", {headers: {"Content-Type": "text/plain"}});
      })
    );
    return;
  }

  // Fonts and app files: use the saved copy, otherwise download and save it.
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (isFont || url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
  }
});
