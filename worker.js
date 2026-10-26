// Global In-Memory Cache & Rate Limiting
const memoryCache = new Map();
const rateLimitMap = new Map();
const CACHE_TTL = 3 * 60 * 1000; 		// Cache bertahan 3 Menit
const RATE_LIMIT_WINDOW = 60 * 1000;	// Jendela waktu 1 menit
const MAX_REQUESTS = 30;				// Maksimal 30 request per menit per IP

export default {
	async fetch(request, env, ctx) {
		// 1. Konfigurasi Keamanan Latar Belakang (Proteksi Domain)
		const allowedOrigin = 'https://webstockid.github.io';
		const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
		const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
		
		const corsHeaders = {
			'Access-Control-Allow-Origin': allowedOrigin,
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With, Authorization',
			'Access-Control-Max-Age': '86400',
		};

		// Tangani Preflight Request dari Browser
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		// 2. LAYER KEAMANAN 1: Validasi Domain Strict
		if (origin && !origin.includes('webstockid.github.io')) {
			return new Response(JSON.stringify({ 
				error: 'Akses Ditolak: Invalid Origin.' 
			}), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}

		/* 3. LAYER KEAMANAN 2: Autentikasi Token API (Opsional tapi disarankan)
		Kamu bisa mengirim header "Authorization: Bearer RAHASIA123" dari frontend
		const authHeader = request.headers.get('Authorization');
		const validToken = 'Bearer RAHASIA_STOCKID_123';
		if (authHeader && authHeader !== validToken) {
			return new Response(JSON.stringify({ 
				error: 'Akses Ditolak: Token Keamanan Tidak Valid.' 
			}), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
		}*/

		// 4. LAYER KEAMANAN 3: Rate Limiting (Anti Spam/DDoS)
		const now = Date.now();
		if (rateLimitMap.has(clientIP)) {
			const clientData = rateLimitMap.get(clientIP);
			if (now - clientData.startTime < RATE_LIMIT_WINDOW) {
				if (clientData.count >= MAX_REQUESTS) {
					return new Response(JSON.stringify({ 
						error: 'Terlalu banyak permintaan. Silakan coba lagi sebentar.' 
					}), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
				}
				clientData.count++;
			} else {
				rateLimitMap.set(clientIP, { count: 1, startTime: now });
			}
		} else {
			rateLimitMap.set(clientIP, { count: 1, startTime: now });
		}

		// Bersihkan Rate Limit Map agar memori tidak penuh
		if (rateLimitMap.size > 10000) rateLimitMap.clear();

		const url = new URL(request.url);
		const symbol = url.searchParams.get('symbol') || 'MDIA.JK';

		// 5. LAYER PERFORMA 1: In-Memory Cache
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
				memoryCache.delete(symbol);
			}
		}

		// 6. LAYER PERFORMA 2: Edge Cache & Fetch Data
		const cache = caches.default;
		const cacheKey = new Request(url.toString(), request);
		let response = await cache.match(cacheKey);

		if (response) {
			try {
				const clonedRes = response.clone();
				const data = await clonedRes.json();
				memoryCache.set(symbol, { timestamp: Date.now(), data: data });
			} catch(e) {}
			
			const newHeaders = new Headers(response.headers);
			newHeaders.set("X-Cache-Status", "HIT-EDGE");
			return new Response(response.body, { status: response.status, headers: newHeaders });
		}

		const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=5d`;
		const userAgents = [
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15"
		];
		const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

		try {
			const yahooResponse = await fetch(targetUrl, {
				headers: { "User-Agent": randomUA, "Accept": "application/json" }
			});

			if (yahooResponse.ok) {
				const data = await yahooResponse.json();
				
				memoryCache.set(symbol, { timestamp: Date.now(), data: data });
				
				const finalResponse = new Response(JSON.stringify(data), {
					status: 200,
					headers: { 
						...corsHeaders, 
						"Content-Type": "application/json", 
						"Cache-Control": "public, max-age=180, s-maxage=180",
						"X-Cache-Status": "MISS"
					}
				});
				
				ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
				return finalResponse;
			} else {
				return new Response(JSON.stringify({
					error: `Sumber data mengembalikan status ${yahooResponse.status}`
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