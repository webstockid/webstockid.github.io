addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
  // Domain resmi yang diizinkan mengakses API ini
  const allowedOrigin = 'https://webstockid.github.io';
  
  // Ambil origin atau referer dari request browser
  const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';

  // 1. Tangani Preflight Request (OPTIONS) dari Browser
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 2. Proteksi Keamanan: Validasi Domain (Blokir jika bukan dari webstockid.github.io)
  if (!origin.includes('webstockid.github.io')) {
    return new Response(JSON.stringify({ 
      error: 'Akses Ditolak: API ini hanya dapat diakses dari domain Stock ID Screener.' 
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'null',
      },
    });
  }

  try {
    // 3. Ambil parameter Ticker / Symbol dari query URL
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'MDIA.JK';

    // Endpoint Yahoo Finance
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=5d`;

    // 4. Fetch data ke Yahoo Finance dengan User-Agent agar tidak diblokir Yahoo
    const yahooResponse = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // Jika menggunakan RapidAPI, hapus tanda komentar di 2 baris bawah ini:
        // 'x-rapidapi-host': 'yahoo-finance15.p.rapidapi.com',
        // 'x-rapidapi-key': 'PASTE_API_KEY_KAMU_DISINI'
      }
    });

    if (!yahooResponse.ok) {
      throw new Error(`Yahoo Finance mengembalikan status ${yahooResponse.status}`);
    }

    const data = await yahooResponse.json();

    // 5. Kirimkan respon sukses ke frontend dengan Header Keamanan CORS khusus
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin, // Hanya izinkan webstockid.github.io
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=60', // Cache di CDN Cloudflare 60 detik
      },
    });

  } catch (error) {
    // Response jika terjadi error fetching dari Yahoo
    return new Response(JSON.stringify({ 
      error: 'Gagal mengambil data dari bursa.', 
      details: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
      },
    });
  }
}













