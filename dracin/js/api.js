// ============================================================
// api.js — Hoshiyomi API (dengan CORS Proxy)
// ============================================================

const CONFIG = {
	// URL API asli
	baseUrl: 'https://api.hoshiyomi.my.id/api',
	// ⬇️ PASTE API KEY BARU KAMU DI SINI (jika yang lama expired)
	apiKey: 'HOSHIYOMI-FREE-c8ca87b7',
	platform: 'pinedrama', // Platform gratis
	lang: 'id',
	timeout: 15000,
	// Gunakan proxy CORS publik untuk menghindari blokir browser
	useProxy: true,
	proxyUrl: 'https://corsproxy.io/?',
};

async function request(endpoint, params = {}) {
	const url = new URL(`${CONFIG.baseUrl}/${CONFIG.platform}${endpoint}`);
	url.searchParams.append('lang', CONFIG.lang);
	
	Object.keys(params).forEach((key) => {
		if (params[key] !== undefined && params[key] !== null) {
			url.searchParams.append(key, params[key]);
		}
	});

	// Tentukan URL final (dengan atau tanpa proxy)
	const finalUrl = CONFIG.useProxy 
		? CONFIG.proxyUrl + encodeURIComponent(url.toString())
		: url.toString();

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

	try {
		const response = await fetch(finalUrl, {
			signal: controller.signal,
			headers: {
				'X-API-Key': CONFIG.apiKey,
				'User-Agent': 'Mozilla/5.0',
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		return data;
	} catch (err) {
		if (err.name === 'AbortError') {
			throw new Error('Request timeout (15 detik)');
		}
		throw err;
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function getTrending(page = 1) {
	const data = await request('/trending', { page });
	return normalizeList(data);
}

export async function searchDramas(query, page = 1) {
	if (!query || query.trim().length < 2) return [];
	const data = await request('/search', { q: query.trim(), page });
	return normalizeList(data);
}

export async function getDramaDetail(id) {
	const data = await request('/detail', { id });
	return data?.data || data;
}

export async function getEpisodes(id) {
	const data = await request('/allepisode', { id });
	const items = data?.items || data?.data || data?.episodes || [];

	if (!Array.isArray(items)) return [];

	return items.map((ep, index) => ({
		episode: ep.episode || ep.ep || index + 1,
		title: ep.title || `Episode ${index + 1}`,
		url: ep.url || ep.video_url || ep.play_url || ep.m3u8 || '',
	}));
}

function normalizeList(raw) {
	const items = raw?.items || raw?.data || raw?.results || [];

	if (!Array.isArray(items)) {
		console.warn('[API] Format respons tidak dikenal:', raw);
		return [];
	}

	return items.map((item) => ({
		id: item.id || item.drama_id || item.book_id || '',
		title: item.title || item.name || item.book_name || 'Tanpa Judul',
		poster: item.cover || item.poster || item.thumbnail || item.book_pic || '',
		episodes: item.episodes || item.episode_count || item.total_episode || 0,
	}));
}

export { CONFIG };