self.addEventListener('message', async function(e) {
	const { tickers } = e.data;
	const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
	
	// Eksekusi 5 saham sekaligus dalam 1 gelombang (Batching)
	const BATCH_SIZE = 5;

	for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
		const batch = tickers.slice(i, i + BATCH_SIZE);

		await Promise.allSettled(batch.map(async (ticker) => {
			try {
				const targetSymbol = `${ticker}.JK`;
				const controller = new AbortController();
				// Auto-bunuh request jika lebih dari 4 detik (mencegah gantung)
				const timeoutId = setTimeout(() => controller.abort(), 4000);

				let res = await fetch(`${WORKER_URL}?symbol=${targetSymbol}`, { signal: controller.signal })
					.catch(() => null);

				if (res && res.ok) {
					const json = await res.json();
					self.postMessage({ status: 'success', ticker: ticker, rawData: json });
				} else {
					// Fallback ke AllOrigins jika Worker utama tumbang
					const yahooProxyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?interval=15m&range=5d`;
					const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooProxyUrl)}`;
					
					const resFallback = await fetch(allOriginsUrl, { signal: controller.signal })
						.catch(() => null);
						
					if (resFallback && resFallback.ok) {
						const wrapper = await resFallback.json();
						const json = JSON.parse(wrapper.contents);
						self.postMessage({ status: 'success', ticker: ticker, rawData: json });
					}
				}
				clearTimeout(timeoutId);
			} catch (err) {
				self.postMessage({ status: 'error', ticker: ticker, error: err.message });
			}
		}));
		
		// Jeda dinamis antar gelombang untuk mencegah serangan (DDoS) ke server sendiri
		if (i + BATCH_SIZE < tickers.length) {
			await new Promise(resolve => setTimeout(resolve, 800));
		}
	}
	
	self.postMessage({ status: 'done' });
});