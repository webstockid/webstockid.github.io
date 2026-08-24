// File: data-worker.js

self.addEventListener('message', async function(e) {
	const { tickers } = e.data;
	const WORKER_URL = 'https://stockid-api-proxy.accespy-mail.workers.dev';

	for (const ticker of tickers) {
		try {
			const targetSymbol = `${ticker}.JK`;
			
			// 1. Coba tembak API Cloudflare kamu
			const res = await fetch(`${WORKER_URL}?symbol=${targetSymbol}`);
			
			if (res.ok) {
				const json = await res.json();
				// Kirim raw data JSON kembali ke Main Thread (app.js)
				self.postMessage({ status: 'success', ticker: ticker, rawData: json });
			} else {
				// 2. Jika API Worker gagal/limit, gunakan AllOrigins Fallback
				const yahooProxyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?interval=15m&range=5d`;
				const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooProxyUrl)}`;
				
				const resFallback = await fetch(allOriginsUrl);
				if (resFallback.ok) {
					const wrapper = await resFallback.json();
					const json = JSON.parse(wrapper.contents);
					self.postMessage({ status: 'success', ticker: ticker, rawData: json });
				}
			}
		} catch (err) {
			self.postMessage({ status: 'error', ticker: ticker, error: err.message });
		}
		
		// Jeda 800ms antar saham agar tidak diblokir sistem Yahoo Finance
		await new Promise(resolve => setTimeout(resolve, 800));
	}
	
	// Lapor kalau semua tugas sudah selesai
	self.postMessage({ status: 'done' });
});