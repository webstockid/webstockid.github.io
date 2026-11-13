const CACHE_NAME = 'tonton-cache-v1';
const urlsToCache = [
	'tonton.html',
	'tonton/logo.png',
	'tonton/site.webmanifest'
];

// Instalasi Service Worker & Caching File
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(urlsToCache);
		})
	);
});

// Mengambil data dari Cache jika offline
self.addEventListener('fetch', (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request);
		})
	);
});