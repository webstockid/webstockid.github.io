/* Service Worker Berkat Elektronik
   - Katalog & halaman: network-first (selalu coba data terbaru, cadangan dari cache saat offline)
   - Gambar, CSS, font, CDN: stale-while-revalidate (cepat, diperbarui di latar belakang)
   Naikkan CACHE_VERSION setiap kali ada perubahan besar agar cache lama dibersihkan. */
const CACHE_VERSION = 'berkat-elektronik-v1';
const APP_SHELL = ['./', 'index.html', 'manifest.json'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_VERSION)
			.then(cache => Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => null))))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

const cacheable = (res) => res && (res.ok || res.type === 'opaque');

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.hostname.endsWith('open-meteo.com') || url.hostname === 'wa.me') return;

	const isDocOrData = req.mode === 'navigate' || url.pathname.endsWith('.json') || url.pathname.endsWith('.html');

	if (isDocOrData) {
		event.respondWith(
			fetch(req)
				.then(res => {
					if (cacheable(res)) {
						const copy = res.clone();
						caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
					}
					return res;
				})
				.catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
		);
		return;
	}

	event.respondWith(
		caches.match(req).then(hit => {
			const network = fetch(req)
				.then(res => {
					if (cacheable(res)) {
						const copy = res.clone();
						caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
					}
					return res;
				})
				.catch(() => hit);
			return hit || network;
		})
	);
});
