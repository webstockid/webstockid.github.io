
self.addEventListener('message', async function(e) {
	const { tickers } = e.data;
	const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';

	for (const ticker of tickers) {
		try {
			// Menarik data saham satu per satu di latar belakang
			const res = await fetch(`${WORKER_URL}?symbol=${ticker}.JK`);
			if (res.ok) {
				const json = await res.json();
				// Kirim data matang kembali ke app.js (Main Thread)
				self.postMessage({ ticker: ticker, rawData: json });
			}
		} catch (err) {
			console.warn(`Gagal fetch background untuk ${ticker}`);
		}
		// Jeda 500ms antar panggilan agar server API tidak kepanasan (Rate Limit)
		await new Promise(resolve => setTimeout(resolve, 500));
	}
});