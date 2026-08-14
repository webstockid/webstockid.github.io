// List Saham Populer untuk Di-Index Secara Otomatis
const TARGET_TICKERS = [
  'MDIA', 'KOTA', 'BNBR', 'ELTY', 'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM',
  'ASII', 'GOTO', 'AMMN', 'BREN', 'TPIA', 'BYAN', 'BRPT', 'MDKA', 'PGAS', 
  'ANTM', 'INCO', 'MEDC', 'ADRO', 'PTBA', 'ITMG', 'HRUM', 'AKRA', 'UNVR', 
  'ICBP', 'INDF', 'CPIN', 'AMRT', 'ACES', 'ERAA', 'KLBF', 'CUAN', 'PTRO', 
  'PANI', 'BSDE', 'CTRA', 'PWON', 'SMRA', 'KPIG', 'BRIS', 'ARTO', 'AUTO'
];

function getBEITickSize(price) {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

function roundToBEITick(price, direction = 'round') {
  if (!price || price <= 0) return 0;
  const tick = getBEITickSize(price);
  if (direction === 'floor') return Math.floor(price / tick) * tick;
  if (direction === 'ceil') return Math.ceil(price / tick) * tick;
  return Math.round(price / tick) * tick;
}

async function fetchAndCalculateStock(ticker) {
  const symbol = `${ticker}.JK`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=5d`;
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const quote = result.indicators?.quote?.[0];
    const prices = quote?.close?.filter(p => p !== null && p !== undefined) || [];
    const volumes = quote?.volume?.filter(v => v !== null && v !== undefined) || [];
    const highs = quote?.high?.filter(h => h !== null && h !== undefined) || [];
    const lows = quote?.low?.filter(l => l !== null && l !== undefined) || [];

    if (prices.length < 5) return null;

    const currentPrice = roundToBEITick(result.meta?.regularMarketPrice || prices[prices.length - 1]);
    const previousClose = roundToBEITick(result.meta?.chartPreviousClose || prices[prices.length - 2]);
    const changePct = parseFloat((((currentPrice - previousClose) / previousClose) * 100).toFixed(2));

    const getMA = (p) => roundToBEITick(prices.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, prices.length));
    const ma5 = getMA(5);
    const ma10 = getMA(10);
    const ma20 = getMA(20);

    const currentVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
    const volSlice10 = volumes.slice(-10);
    const volMA10 = volSlice10.length > 0 ? Math.round(volSlice10.reduce((a, b) => a + b, 0) / volSlice10.length) : 1;
    const volRatio = volMA10 > 0 ? parseFloat((currentVolume / volMA10).toFixed(2)) : 1.0;

    const high20 = highs.length >= 20 ? roundToBEITick(Math.max(...highs.slice(-20))) : roundToBEITick(Math.max(...highs));
    const low20 = lows.length >= 20 ? roundToBEITick(Math.min(...lows.slice(-20))) : roundToBEITick(Math.min(...lows));

    return {
      ticker,
      price: currentPrice,
      prevClose: previousClose,
      changePct,
      ma5, ma10, ma20,
      currentVolume, volMA10, volRatio,
      high20, low20,
      updatedAt: new Date().toISOString()
    };
  } catch (e) {
    return null;
  }
}

export default {
  // 1. Dijalankan oleh Cron Trigger setiap 2 Menit (Background Indexer)
  async scheduled(event, env, ctx) {
    const allData = {};
    
    // Process paralel per batch 5 saham
    for (let i = 0; i < TARGET_TICKERS.length; i += 5) {
      const batch = TARGET_TICKERS.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(t => fetchAndCalculateStock(t)));
      
      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          allData[res.value.ticker] = res.value;
          // Simpan per-ticker ke KV
          ctx.waitUntil(env.STOCK_KV.put(`stock_${res.value.ticker}`, JSON.stringify(res.value)));
        }
      });
    }

    // Simpan master JSON gabungan untuk Radar Bandar
    ctx.waitUntil(env.STOCK_KV.put('master_stock_data', JSON.stringify(allData)));
  },

  // 2. HTTP Endpoint untuk dipanggil Web Utama
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker')?.toUpperCase();
    const mode = url.searchParams.get('mode');

    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, max-age=60'
    };

    // (A) Mode Master: Ambil semua data sekaligus untuk Radar Bandar
    if (mode === 'all') {
      const masterData = await env.STOCK_KV.get('master_stock_data');
      return new Response(masterData || '{}', { headers });
    }

    // (B) Mode Single Ticker: Ambil 1 saham
    if (ticker) {
      let data = await env.STOCK_KV.get(`stock_${ticker}`);
      
      // Jika belum ter-index di KV, fetch on-the-fly & simpan
      if (!data) {
        const fresh = await fetchAndCalculateStock(ticker);
        if (fresh) {
          data = JSON.stringify(fresh);
          ctx.waitUntil(env.STOCK_KV.put(`stock_${ticker}`, data));
        }
      }

      return new Response(data || JSON.stringify({ error: 'Ticker not found' }), { headers });
    }

    return new Response(JSON.stringify({ status: 'Stock ID Indexer API Active' }), { headers });
  }
};