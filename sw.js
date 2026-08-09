self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    return self.clients.claim();
});

// Mengecek pengingat secara berkala di background
self.addEventListener('periodicsync', (e) => {
    if (e.tag === 'check-expiry-sync') {
        e.waitUntil(kirimNotifikasiBackground());
    }
});

async function kirimNotifikasiBackground() {
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
        client.postMessage({ type: 'check-reminder' });
    });
}