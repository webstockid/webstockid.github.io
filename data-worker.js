self.addEventListener('message', async function(e) {
	const { tickers } = e.data;
	const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
	
	// Optimasi ukuran batch: 10 per siklus (lebih cepat tetapi tetap aman dari API rate limit)
	const BATCH_SIZE = 10;

	for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
		const batch = tickers.slice(i, i + BATCH_SIZE);

		await Promise.allSettled(batch.map(async (ticker) => {
			try {
				const targetSymbol = `${ticker}.JK`;
				const controller = new AbortController();
				
				// Hentikan request otomatis jika melampaui 4 detik
				const timeoutId = setTimeout(() => controller.abort(), 4000);

				let res = await fetch(`${WORKER_URL}?symbol=${targetSymbol}`, { signal: controller.signal })
					.catch(() => null);

				if (res && res.ok) {
					const json = await res.json();
					self.postMessage({ status: 'success', ticker: ticker, rawData: json });
				} else {
					// Fallback Darurat: Jika Worker utama sedang down / timeout
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
		
		// Jeda 1 Detik antar siklus agar web tidak mengalami Freeze & menghindari IP Block
		if (i + BATCH_SIZE < tickers.length) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}
	
	self.postMessage({ status: 'done' });
});