self.addEventListener('install', function(event) {
	self.skipWaiting();
});

self.addEventListener('activate', function(event) {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
	const data = event.data ? event.data.json() : {};
	const title = data.title || "Stock ID Screener Alert";
	const options = {
		body: data.message || "Target Harga Tercapai / Sentuh Stop Loss!",
		icon: "stockid_gambar/stockicon.jpg",
		vibrate: [200, 100, 200, 100, 200, 100, 200],
		requireInteraction: true
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
	event.notification.close();
	event.waitUntil(
		clients.matchAll({ type: 'window' }).then(windowClients => {
			for (var i = 0; i < windowClients.length; i++) {
				var client = windowClients[i];
				if (client.url.indexOf('/') !== -1 && 'focus' in client) {
					return client.focus();
				}
			}
			if (clients.openWindow) {
				return clients.openWindow('/');
			}
		})
	);
});