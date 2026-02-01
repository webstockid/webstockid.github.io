const CACHE_NAME = 'member-vip-cache-v1';
const urlsToCache = [
  '/',
  '/expire.html',
  '/stockid_script/exp.css',
  '/stockid_gambar/alert.jpg',
  '/stockid_suara/alert.mp3',
  'https://fonts.googleapis.com/css2?family=Fredoka&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => {
    return response || fetch(event.request);
  }));
});

// LISTENER PUSH NOTIF (ini bisa digunakan untuk notifikasi schedule)
self.addEventListener('periodicsync', event => {
  if(event.tag === 'check-members') {
    event.waitUntil(sendMemberReminders());
  }
});

// Helper sederhana untuk trigger notifikasi
async function sendMemberReminders(){
  const clientsList = await self.clients.matchAll();
  clientsList.forEach(client => {
    client.postMessage({type:'check-reminder'});
  });
}
