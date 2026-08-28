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

// 4. Logika Pengecekan Background & Notifikasi
async function checkReminderBackground() {
	// Cari apakah ada tab web Stock ID yang sedang terbuka
	const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });

	if (clients && clients.length > 0) {
		// Jika web terbuka (meski di background tab), suruh web yang memproses via localStorage
		clients.forEach(client => {
			client.postMessage({ type: 'check-reminder' });
		});
	} else {
		// Jika web tertutup total, Service Worker kirim notifikasi PUSH bawaan
		const title = 'Reminder Stock ID VIP ⚠️';
		const options = {
			body: 'Jangan lupa cek sisa masa aktif VIP kamu hari ini. Segera perpanjang agar akses tidak terputus!',
			icon: 'stockid_gambar/stockicon.jpg', // Pastikan path icon ini benar
			badge: 'stockid_gambar/stockicon.jpg',
			vibrate: [200, 100, 200, 100, 200], // Efek getar di HP
			data: { 
				url: 'https://webstockid.github.io/exp' // URL tujuan saat notif diklik
			}
		};
		await self.registration.showNotification(title, options);
	}
}

// 5. Event Click Notifikasi: Apa yang terjadi jika notifikasi di HP di-klik
self.addEventListener('notificationclick', (event) => {
	event.notification.close(); // Tutup notifnya
	
	const targetUrl = event.notification.data ? event.notification.data.url : '/';

	event.waitUntil(
		self.clients.matchAll({ type: 'window' }).then((clientList) => {
			// Jika tab sudah pernah dibuka, arahkan fokus ke tab tersebut
			for (const client of clientList) {
				if (client.url === targetUrl && 'focus' in client) {
					return client.focus();
				}
			}
			// Jika belum ada tab terbuka, buka window/tab baru
			if (self.clients.openWindow) {
				return self.clients.openWindow(targetUrl);
			}
		})
	);
});

// 6. Event Push (Opsional): Berjaga-jaga jika kamu punya server backend sendiri kedepannya
self.addEventListener('push', (event) => {
	let data = { title: 'Info Stock ID VIP', body: 'Ada info terbaru dari komunitas!' };
	
	if (event.data) {
		data = event.data.json();
	}

	const options = {
		body: data.body,
		icon: 'stockid_gambar/stockicon.jpg',
		badge: 'stockid_gambar/stockicon.jpg',
		vibrate: [200, 100, 200],
		data: { url: 'https://webstockid.github.io/exp' }
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});