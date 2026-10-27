const CACHE_NAME = 'stockid-member-v2';
const ASSETS_TO_CACHE = [
	'./member.html',
	'./data-member.js',
	'./stockid_gambar/stockidmember.jpeg',
	'./stockid_suara/exp.mp3',
	'./stockid_suara/notif.mp3'
];

// 1. Event Install: Pre-cache asset penting dan skip waiting
self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS_TO_CACHE).catch(() => {
				console.log('[Service Worker] Beberapa file tidak ditemukan saat precache, lanjut instalasi.');
			});
		})
	);
});

// 2. Event Activate: Bersihkan cache versi lama & ambil kendali client
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cache) => {
					if (cache !== CACHE_NAME) {
						console.log('[Service Worker] Hapus cache lama:', cache);
						return caches.delete(cache);
					}
				})
			);
		}).then(() => self.clients.claim())
	);
});

// 3. Event Fetch: Stale-While-Revalidate untuk performa cepat dan fitur offline
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	
	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			const networkFetch = fetch(event.request).then((networkResponse) => {
				if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
					const responseToCache = networkResponse.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});
				}
				return networkResponse;
			}).catch(() => cachedResponse);

			return cachedResponse || networkFetch;
		})
	);
});

// 4. Event Periodic Sync: Pengecekan reminder di background
self.addEventListener('periodicsync', (event) => {
	if (event.tag === 'check-expiry-sync') {
		event.waitUntil(checkReminderBackground());
	}
});

// 5. Logika Pengecekan Background Notifikasi
async function checkReminderBackground() {
	const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });

	if (clientsList && clientsList.length > 0) {
		clientsList.forEach(client => {
			client.postMessage({ type: 'check-reminder' });
		});
	} else {
		const title = 'Reminder Stock ID VIP ⚠️';
		const options = {
			body: 'Jangan lupa cek sisa masa aktif VIP kamu hari ini. Segera perpanjang agar akses tidak terputus!',
			icon: 'stockid_gambar/stockidmember.jpeg',
			badge: 'stockid_gambar/stockidmember.jpeg',
			vibrate: [200, 100, 200, 100, 200],
			data: { 
				url: self.registration.scope || 'https://webstockid.github.io/member.html'
			}
		};
		await self.registration.showNotification(title, options);
	}
}

// 6. Event Click Notifikasi
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	
	const targetUrl = (event.notification.data && event.notification.data.url) 
		? event.notification.data.url 
		: 'https://webstockid.github.io/member.html';

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url.includes('member.html') && 'focus' in client) {
					return client.focus();
				}
			}
			if (self.clients.openWindow) {
				return self.clients.openWindow(targetUrl);
			}
		})
	);
});

// 7. Event Push Notification dari Server
self.addEventListener('push', (event) => {
	let data = { title: 'Info Stock ID VIP', body: 'Ada info terbaru dari komunitas Stock ID!' };
	
	if (event.data) {
		try {
			data = event.data.json();
		} catch (e) {
			data.body = event.data.text();
		}
	}

	const options = {
		body: data.body,
		icon: 'stockid_gambar/stockidmember.jpeg',
		badge: 'stockid_gambar/stockidmember.jpeg',
		vibrate: [200, 100, 200],
		data: { url: 'https://webstockid.github.io/member.html' }
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});