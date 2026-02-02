const CACHE_NAME='member-vip-cache-v1';
const urlsToCache=['/','/exp.html','/stockid_script/exp.css','/stockid_suara/alert.mp3','/stockid_gambar/alert.jpg','https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css'];

self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(urlsToCache))); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });
self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('periodicsync', e=>{ if(e.tag==='check-members'){ e.waitUntil(sendMemberReminders()); } });
async function sendMemberReminders(){
    const clientsList=await self.clients.matchAll();
    clientsList.forEach(c=>{ c.postMessage({type:'check-reminder'}); });
}
