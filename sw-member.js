const CACHE_NAME = 'stockid-member-v1';

// 1. Event Install: Memaksa Service Worker langsung aktif tanpa menunggu
self.addEventListener('install', (event) => {
	self.skipWaiting();
	console.log('[Service Worker] Berhasil di-install');
});

// 2. Event Activate: Mengambil kendali atas semua tab klien yang terbuka
self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
	console.log('[Service Worker] Aktif dan siap mengendalikan notifikasi');
});

// 3. Event Periodic Sync: Berjalan di latar belakang sesuai interval (misal 12 jam)
self.addEventListener('periodicsync', (event) => {
	if (event.tag === 'check-expiry-sync') {
		console.log('[Service Worker] Menjalankan pengecekan background...');
		event.waitUntil(checkReminderBackground());
	}
});

// 4. Logika Pengecekan Background & Notifikasi Mandiri
async function checkReminderBackground() {
	const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });

	if (clientsList && clientsList.length > 0) {
		clientsList.forEach(client => {
			client.postMessage({ type: 'check-reminder' });
		});
	} else {
		// Jika web ditutup total, Service Worker tetap memberikan pengingat umum agar user ingat melakukan cek ulang
		const title = 'Reminder Stock ID VIP ⚠️';
		const options = {
			body: 'Jangan lupa cek sisa masa aktif VIP kamu hari ini. Segera perpanjang agar akses tidak terputus!',
			icon: 'stockid_gambar/stockicon.jpg',
			badge: 'stockid_gambar/stockicon.jpg',
			vibrate: [200, 100, 200, 100, 200],
			data: { 
				url: 'https://webstockid.github.io/exp.html'
			}
		};
		await self.registration.showNotification(title, options);
	}
}

// 5. Event Click Notifikasi: Apa yang terjadi jika notifikasi di HP di-klik
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	
	const targetUrl = event.notification.data ? event.notification.data.url : 'https://webstockid.github.io/exp.html';

	event.waitUntil(
		self.clients.matchAll({ type: 'window' }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === targetUrl && 'focus' in client) {
					return client.focus();
				}
			}
			if (self.clients.openWindow) {
				return self.clients.openWindow(targetUrl);
			}
		})
	);
});

// 6. Event Push Server: Berjaga-jaga untuk push notifikasi eksternal
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
		icon: 'stockid_gambar/stockicon.jpg',
		badge: 'stockid_gambar/stockicon.jpg',
		vibrate: [200, 100, 200],
		data: { url: 'https://webstockid.github.io/exp.html' }
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});