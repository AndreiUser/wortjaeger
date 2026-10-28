/* Offline cache for the Wortkette phone app (zuma.html).
   Bump VERSION when files are added or removed so the list is fetched again. */
const VERSION = "wk-2";
const FILES = ["zuma.html", "wj.css", "wj-core.js", "words-b1.json", "zuma.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable.png",
  "audio/w001.mp3", "audio/w002.mp3", "audio/w003.mp3", "audio/w004.mp3", "audio/w005.mp3", "audio/w006.mp3", "audio/w007.mp3", "audio/w008.mp3", "audio/w009.mp3", "audio/w010.mp3", "audio/w011.mp3", "audio/w012.mp3", "audio/w013.mp3", "audio/w014.mp3", "audio/w015.mp3", "audio/w016.mp3", "audio/w017.mp3", "audio/w018.mp3", "audio/w019.mp3", "audio/w020.mp3", "audio/w021.mp3", "audio/w022.mp3", "audio/w023.mp3", "audio/w024.mp3", "audio/w025.mp3", "audio/w026.mp3", "audio/w027.mp3", "audio/w028.mp3", "audio/w029.mp3", "audio/w030.mp3", "audio/w031.mp3", "audio/w032.mp3", "audio/w033.mp3", "audio/w034.mp3", "audio/w035.mp3", "audio/w036.mp3", "audio/w037.mp3", "audio/w038.mp3", "audio/w039.mp3", "audio/w040.mp3", "audio/w041.mp3", "audio/w042.mp3", "audio/w043.mp3", "audio/w044.mp3", "audio/w045.mp3", "audio/w046.mp3", "audio/w047.mp3", "audio/w048.mp3", "audio/w049.mp3", "audio/w050.mp3", "audio/w051.mp3", "audio/w052.mp3", "audio/w053.mp3", "audio/w054.mp3", "audio/w055.mp3", "audio/w056.mp3", "audio/w057.mp3", "audio/w058.mp3", "audio/w059.mp3", "audio/w060.mp3", "audio/w061.mp3", "audio/w062.mp3", "audio/w063.mp3", "audio/w064.mp3", "audio/w065.mp3", "audio/w066.mp3", "audio/w067.mp3", "audio/w068.mp3", "audio/w069.mp3", "audio/w070.mp3", "audio/w071.mp3", "audio/w072.mp3", "audio/w073.mp3", "audio/w074.mp3", "audio/w075.mp3", "audio/w076.mp3", "audio/w077.mp3", "audio/w078.mp3", "audio/w079.mp3", "audio/w080.mp3", "audio/w081.mp3", "audio/w082.mp3", "audio/w083.mp3", "audio/w084.mp3", "audio/w085.mp3", "audio/w086.mp3", "audio/w087.mp3", "audio/w088.mp3", "audio/w089.mp3", "audio/w090.mp3", "audio/w091.mp3", "audio/w092.mp3", "audio/w093.mp3", "audio/w094.mp3", "audio/w095.mp3", "audio/w096.mp3", "audio/w097.mp3", "audio/w098.mp3", "audio/w099.mp3", "audio/w100.mp3"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first so updates show up when online; the cache answers when offline.
// Google Fonts are cached on first use too.
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  e.respondWith(fetch(req).then(res => {
    if (res.status === 200 || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
