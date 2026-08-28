self.onmessage = async function(e) {
    const { tickers } = e.data;
    if (!tickers || !Array.isArray(tickers)) return;

    // API KEY EODHD
    const API_KEY = '6a91a3cf320808.54624172';
    
    for (const ticker of tickers) {
        try {
            const targetSymbol = `${ticker}.JK`;
            const eodhdUrl = `https://eodhd.com/api/eod/${targetSymbol}?api_token=${API_KEY}&fmt=json&period=d&order=d&limit=30`;
            
            const response = await fetch(eodhdUrl);
            
            if (response.ok) {
                const rawData = await response.json();
                // Mengirimkan kembali ke app.js
                self.postMessage({ 
                    status: 'success', 
                    ticker: ticker, 
                    rawData: rawData 
                });
            }
        } catch (error) {
            console.warn(`Worker EODHD error saat menarik data untuk ${ticker}:`, error);
        }
        
        // Jeda waktu (delay) 300 ms antar request.
        // Sangat penting untuk menjaga agar request tidak dicurigai sebagai spam/DDoS oleh API EODHD
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Semua antrean emiten selesai dicek
    self.postMessage({ status: 'done' });
};