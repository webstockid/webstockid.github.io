// Global In-Memory Cache: Menahan gempuran request massal dari fitur Radar (Sangat Cepat)
const memoryCache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // Cache bertahan 3 Menit (180.000 ms)

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
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const url = new URL(request.url);
		const symbol = url.searchParams.get('symbol') || 'MDIA.JK';

		// 2. LAYER 1: CEK IN-MEMORY CACHE (Sangat krusial untuk fitur Radar BSJP/Whales)
		if (memoryCache.has(symbol)) {
			const cached = memoryCache.get(symbol);
			if (Date.now() - cached.timestamp < CACHE_TTL) {
				return new Response(JSON.stringify(cached.data), {
					status: 200,
					headers: { 
						...corsHeaders, 
						"Content-Type": "application/json", 
						"X-Cache-Status": "HIT-MEMORY" 
					}
				});
			} else {
				// Hapus cache jika sudah kedaluwarsa (> 3 menit)
				memoryCache.delete(symbol);
			}
		}

		// 3. LAYER 2: CEK CLOUDFLARE EDGE CACHE (Sebagai fallback sekunder)
		const cache = caches.default;
		const cacheKey = new Request(url.toString(), request);
		let response = await cache.match(cacheKey);

		if (response) {
			try {
				// Kloning respons untuk disimpan ulang ke In-Memory Cache agar request selanjutnya lebih cepat
				const clonedRes = response.clone();
				const data = await clonedRes.json();
				memoryCache.set(symbol, { timestamp: Date.now(), data: data });
			} catch(e) {}
			
			const newHeaders = new Headers(response.headers);
			newHeaders.set("X-Cache-Status", "HIT-EDGE");
			return new Response(response.body, { status: response.status, headers: newHeaders });
		}

		// 4. LAYER 3: FETCH LANGSUNG KE YAHOO FINANCE (Jika semua cache kosong)
		const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=5d`;
		
		// Rotasi User-Agent untuk menghindari rate-limit
		const userAgents = [
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
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
				
				// Simpan ke In-Memory Cache (Untuk menahan request Radar selanjutnya)
				memoryCache.set(symbol, {
					timestamp: Date.now(),
					data: data
				});
				
				// Buat respons akhir dan set header instruksi cache
				const finalResponse = new Response(JSON.stringify(data), {
					status: 200,
					headers: { 
						...corsHeaders, 
						"Content-Type": "application/json", 
						"Cache-Control": "public, max-age=180, s-maxage=180", // 180 detik = 3 Menit
						"X-Cache-Status": "MISS"
					}
				});
				
				// Simpan ke Cloudflare Edge Cache tanpa memblokir proses
				ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
				
				return finalResponse;
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
};