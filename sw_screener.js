// ============================================================
// SERVICE WORKER - STOCK ID SCREENER (PWA, PUSH & APP BADGE)
// ============================================================

const CACHE_NAME = 'stockid-screener-v2.08';
const DEFAULT_URL = 'screener_ok.html';
const DEFAULT_ICON = 'stockid_gambar/192x192.png';
const FALLBACK_ICON = 'stockid_gambar/512x512.png';

// Daftar file inti agar aplikasi tetap bisa diinstal & dimuat cepat
const CORE_ASSETS = [
	'screener_ok.html',
	'manifest.json',
	'app.js',
	'ticker.js',
	'stockid_gambar/192x192.png'
];

// 1. INSTALL: Menyimpan aset inti secara aman tanpa gagal jika ikon tambahan belum dibuat
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(async (cache) => {
			// Cache aset wajib satu per satu agar tidak error jika salah satu file opsional belum ada
			await Promise.allSettled(
				CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
			);
			// Coba cache ikon PNG PWA jika sudah tersedia
			await cache.add(DEFAULT_ICON).catch(() => {});
		})
	);
	self.skipWaiting();
});

// 2. ACTIVATE: Membersihkan cache versi lama & langsung mengambil alih kontrol halaman
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name !== CACHE_NAME)
					.map((oldName) => caches.delete(oldName))
			);
		}).then(() => self.clients.claim())
	);
});

// 3. FETCH: Network-First untuk data & script agar harga saham/radar selalu real-time
self.addEventListener('fetch', (event) => {
	const req = event.request;

	// Abaikan request selain GET (seperti POST ke API/Telegram/Worker)
	if (req.method !== 'GET') return;

	const url = new URL(req.url);

	// Strategi Cache-First khusus untuk aset gambar & efek suara lokal
	if (
		url.origin === location.origin &&
		(url.pathname.includes('/stockid_gambar/') || url.pathname.includes('/stockid_suara/'))
	) {
		event.respondWith(
			caches.match(req).then((cached) => {
				return cached || fetch(req).then((networkRes) => {
					const resClone = networkRes.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
					return networkRes;
				});
			})
		);
		return;
	}

	// Strategi Network-First untuk HTML, JS (app.js, ticker.js), dan data pasar
	event.respondWith(
		fetch(req)
			.then((networkRes) => {
				if (url.origin === location.origin && networkRes.status === 200) {
					const resClone = networkRes.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
				}
				return networkRes;
			})
			.catch(() => caches.match(req))
	);
});

// 4. PUSH EVENT: Menerima sinyal Whales / Lonjakan Volume saat browser/aplikasi ditutup total
self.addEventListener('push', (event) => {
	let payload = {
		title: '🐋 Whale & Volume Spike Detected!',
		body: 'Terdeteksi akumulasi bandar & lonjakan volume pada saham pantauan.',
		badgeCount: 1,
		ticker: '',
		url: DEFAULT_URL
	};

	if (event.data) {
		try {
			const parsed = event.data.json();
			payload = { ...payload, ...parsed };
		} catch (e) {
			payload.body = event.data.text();
		}
	}

	// Nyalakan bulatan notifikasi (App Badge) di ikon aplikasi layar utama
	const badgeTask = ('setAppBadge' in self.registration)
		? self.registration.setAppBadge(Number(payload.badgeCount) || 1).catch(() => {})
		: Promise.resolve();

	// Tampilkan notifikasi sistem perangkat
	const notifTask = self.registration.showNotification(payload.title, {
		body: payload.body,
		icon: DEFAULT_ICON,
		badge: DEFAULT_ICON,
		vibrate: [200, 100, 200, 100, 300],
		tag: payload.ticker ? `whale-${payload.ticker}` : 'stockid-whale-alert',
		renotify: true,
		requireInteraction: true,
		data: {
			url: payload.url || DEFAULT_URL,
			ticker: payload.ticker || ''
		}
	});

	event.waitUntil(Promise.all([badgeTask, notifTask]));
});

// 5. MESSAGE BRIDGE: Menerima perintah langsung dari app.js (saat tab aktif/minimize)
self.addEventListener('message', (event) => {
	const data = event.data;
	if (!data || !data.type) return;

	// Menyalakan bulatan notif di logo aplikasi dari app.js
	if (data.type === 'SET_BADGE') {
		if ('setAppBadge' in self.registration) {
			self.registration.setAppBadge(Number(data.count) || 1).catch(() => {});
		}
	}

	// Menghapus bulatan notif saat user kembali melihat aplikasi
	if (data.type === 'CLEAR_BADGE') {
		if ('clearAppBadge' in self.registration) {
			self.registration.clearAppBadge().catch(() => {});
		}
	}

	// Menampilkan notifikasi via SW (wajib untuk Android PWA agar notif tidak diblokir)
	if (data.type === 'SHOW_NOTIFICATION') {
		const count = Number(data.badgeCount) || 1;
		if ('setAppBadge' in self.registration) {
			self.registration.setAppBadge(count).catch(() => {});
		}

		self.registration.showNotification(data.title || 'Stock ID Screener Alert', {
			body: data.body || '',
			icon: DEFAULT_ICON,
			badge: DEFAULT_ICON,
			vibrate: [150, 80, 150],
			tag: data.tag || 'stockid-live-alert',
			renotify: true,
			data: {
				url: data.url || DEFAULT_URL,
				ticker: data.ticker || ''
			}
		});
	}
});

// 6. NOTIFICATION CLICK: Hapus bulatan notif & buka langsung ke aplikasi/emiten terkait
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	// Matikan bulatan notif di logo begitu notifikasi diketuk
	if ('clearAppBadge' in self.registration) {
		self.registration.clearAppBadge().catch(() => {});
	}

	const targetUrl = event.notification.data?.url || DEFAULT_URL;
	const targetTicker = event.notification.data?.ticker || '';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
			// Jika jendela Stock ID Screener sudah terbuka, fokuskan & kirim kode sahamnya
			for (const client of windowClients) {
				if (client.url.includes('screener') && 'focus' in client) {
					if (targetTicker) {
						client.postMessage({ type: 'OPEN_TICKER', ticker: targetTicker });
					}
					return client.focus();
				}
			}
			// Jika aplikasi sedang tertutup, buka jendela baru
			if (clients.openWindow) {
				const openPath = targetTicker ? `${targetUrl}?ticker=${encodeURIComponent(targetTicker)}` : targetUrl;
				return clients.openWindow(openPath);
			}
		})
	);
});