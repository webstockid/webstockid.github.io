// ============================================================
// api.js — Lapisan API, menggunakan Dracin API dengan provider bstation
// Dokumentasi: https://dracinapi.com/providers/bstation/
// ============================================================

const CONFIG = {
	baseUrl: 'https://dracinapi.com',
	provider: 'bstation', // Bstation (Bilibili) memiliki banyak drama China
	timeout: 15000,
};

async function request(path) {
	const url = `${CONFIG.baseUrl}${path}`;
	console.log('[API] Request:', url);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json' },
		});

		console.log('[API] Status:', response.status);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		console.log('[API] Response:', data);
		return data;
	} catch (err) {
		if (err.name === 'AbortError') {
			throw new Error('Request timeout (15s)');
		}
		throw err;
	} finally {
		clearTimeout(timeoutId);
	}
}

// ----- Home / Trending -----
export async function getTrending() {
	// Path yang benar: /bstation/api/v1/home
	const data = await request(`/${CONFIG.provider}/api/v1/home`);
	return normalizeList(data);
}

// ----- Search -----
export async function searchDramas(query) {
	if (!query || query.trim().length < 2) return [];
	// Path yang benar: /bstation/api/v1/search?keyword=...
	const data = await request(
		`/${CONFIG.provider}/api/v1/search?keyword=${encodeURIComponent(query.trim())}`
	);
	return normalizeList(data);
}

// ----- Episodes -----
export async function getEpisodes(id) {
	// Path yang benar: /bstation/api/v1/episodes/{id}
	const data = await request(`/${CONFIG.provider}/api/v1/episodes/${id}`);
	// Struktur respons Dracin: { status: "success", data: [...] }
	if (data.status === 'success' && Array.isArray(data.data)) {
		return data.data;
	}
	return [];
}

// ----- Play URL -----
export async function getPlayUrl(id, episodeIndex = 1) {
	// Path yang benar: /bstation/api/v1/play/{id}/{ep}
	const data = await request(`/${CONFIG.provider}/api/v1/play/${id}/${episodeIndex}`);
	if (data.status === 'success' && data.data) {
		return data.data.url || data.data.play_url || data.data.m3u8 || '';
	}
	return '';
}

// ----- Normalizer -----
function normalizeList(raw) {
	// Dracin mengembalikan: { status: "success", provider: "bstation", data: [...] }
	if (raw.status !== 'success' || !Array.isArray(raw.data)) {
		console.warn('[API] Unexpected response format:', raw);
		return [];
	}

	return raw.data.map((item) => ({
		id: item.id || item.drama_id || '',
		title: item.title || item.name || 'Tanpa Judul',
		poster: item.cover || item.poster || item.thumbnail || '',
		episodes: item.episodes || item.episode_count || 0,
	}));
}

export { CONFIG };