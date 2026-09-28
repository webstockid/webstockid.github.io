export default {
  async fetch(request, env, ctx) {
    // 1. Konfigurasi Keamanan (Proteksi Domain)
    const allowedOrigin = 'https://webstockid.github.io';
    const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // Tangani Preflight Request (OPTIONS) dari Browser
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Validasi Domain (Blokir jika bukan dari webstockid.github.io)
    if (origin && !origin.includes('webstockid.github.io')) {
      return new Response(JSON.stringify({ 
        error: 'Akses Ditolak: API ini hanya dapat diakses dari domain Stock ID Screener.' 
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'null',
        },
      });
    }

    // 2. Ambil parameter Ticker
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'MDIA.JK';

    // 3. Sistem Edge Caching Cloudflare yang Super Cepat
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);

    // Jika data tidak ada di cache, tarik dari Yahoo
    if (!response) {
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=5d`;
      
      // 4. Rotasi User-Agent untuk Mencegah Rate Limit Yahoo
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0"
      ];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

      try {
        const yahooResponse = await fetch(targetUrl, {
          headers: { 
            "User-Agent": randomUA, 
            "Accept": "application/json" 
          }
        });

        if (yahooResponse.ok) {
          const data = await yahooResponse.json();
          
          // Format respons untuk dikirim ke client
          response = new Response(JSON.stringify(data), {
            status: 200,
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json", 
              "Cache-Control": "public, s-maxage=90" // Menahan di server cloudflare selama 90 detik
            }
          });
          
          // 5. Simpan ke Cache Cloudflare tanpa memblokir respon ke client
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
          return new Response(JSON.stringify({
            error: `Yahoo Finance mengembalikan status ${yahooResponse.status}`
          }), { status: yahooResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Gagal mengambil data dari bursa.', 
          details: error.message 
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    
    // Kembalikan data (baik dari cache maupun dari Yahoo)
    return response;
  }
};