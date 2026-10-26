const C = "train-v3";
const FILES = ["./", "./index.html", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// شبكة أولاً ثم الكاش (يعمل دون اتصال). الطلبات الخارجية (Supabase/Anthropic) لا نعترضها.
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)).catch(() => {}); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
});

/* ---- تخزين بسيط (IndexedDB) لإعدادات التذكير ---- */
function idb() { return new Promise((res, rej) => { const q = indexedDB.open("train-sw", 1);
  q.onupgradeneeded = () => q.result.createObjectStore("kv"); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function kvGet(k) { const d = await idb(); return new Promise(r => { const q = d.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(undefined); }); }
async function kvSet(k, v) { const d = await idb(); return new Promise(r => { const t = d.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => r(); t.onerror = () => r(); }); }

self.addEventListener("message", e => { if (e.data && e.data.type === "cfg") e.waitUntil(kvSet("cfg", e.data.cfg)); });

function dk(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const NOTE_OPTS = { icon: "icon.svg", badge: "icon.svg", lang: "ar", dir: "rtl", vibrate: [120, 60, 120] };

// فحص دوري (Periodic Background Sync) — يعمل فقط حين يسمح المتصفح للتطبيق المثبّت؛ التوقيت يقرره المتصفح.
async function swCheck() {
  const cfg = await kvGet("cfg"); if (!cfg || !cfg.on) return;
  const now = new Date(), date = dk(now), nowM = now.getHours() * 60 + now.getMinutes();
  let fired = (await kvGet("fired")) || {};
  Object.keys(fired).forEach(k => { if (!k.startsWith(date)) delete fired[k]; });
  for (const it of cfg.items) {
    if (it.days && !it.days.includes(now.getDay())) continue;
    const [h, m] = it.time.split(":").map(Number), t = h * 60 + m, key = date + it.id;
    if (nowM < t || nowM >= t + 45 || fired[key]) continue;
    fired[key] = 1;
    if (cfg.date === date && it.blocks && it.blocks.some(b => (cfg.done || []).includes(b))) continue;
    if (cfg.date === date && it.med && (cfg.medsDone || []).map(String).includes(String(it.med))) continue;
    await self.registration.showNotification(it.title, { ...NOTE_OPTS, body: it.body, tag: key });
  }
  await kvSet("fired", fired);
}
self.addEventListener("periodicsync", e => { if (e.tag === "train-remind") e.waitUntil(swCheck()); });

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => "focus" in x); return c ? c.focus() : self.clients.openWindow("./index.html");
  }));
});
