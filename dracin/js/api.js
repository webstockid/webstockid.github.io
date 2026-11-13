// ============================================================
// api.js — Satu-satunya tempat yang tahu tentang API eksternal.
// Ganti PROVIDER jika ingin beralih ke sumber lain (mis. Hoshiyomi).
// ============================================================

const CONFIG = {
	// Dracin API: klaim tanpa API key [citation:6]
	baseUrl: 'https://dracinapi.com',
	provider: 'iqiyi', // iQIYI = drama China; bisa ganti 'bilitv', 'starshort', dll.
	timeout: 15000,
};

// ----- Helper request generik -----
async function request(endpoint, params = {}) {
	const url = new URL(`${CONFIG.baseUrl}/${CONFIG.provider}/api/v1${endpoint}`);
	Object.keys(params).forEach((key) => {
		if (params[key] !== undefined && params[key] !== null) {
			url.searchParams.append(key, params[key]);
		}
	});

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

	try {
		const response = await fetch(url.toString(), {
			signal: controller.signal,
			headers: { Accept: 'application/json' },
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		return data;
	} finally {
		clearTimeout(timeoutId);
	}
}

// ----- Endpoint publik -----
export async function getTrending(page = 1) {
	// Dracin API: /home atau /trending (sesuaikan dengan dokumentasi provider)
	const data = await request('/home', { page });
	return normalizeList(data);
}

export async function searchDramas(query, page = 1) {
	if (!query || query.trim().length < 2) return [];
	const data = await request('/search', { keyword: query.trim(), page });
	return normalizeList(data);
}

export async function getDramaDetail(id) {
	const data = await request(`/drama/${id}`);
	return data?.data || data;
}

export async function getEpisodes(id) {
	const data = await request(`/episode/${id}`);
	// Respons bisa berupa array episode langsung
	return Array.isArray(data?.data) ? data.data : data?.data?.episodes || [];
}

// ----- Normalizer: menyeragamkan bentuk respons -----
// Setiap API punya struktur JSON berbeda; normalizer memastikan
// UI selalu menerima { id, title, poster, episodes }.
function normalizeList(raw) {
	// Coba beberapa kemungkinan path umum
	const items =
		raw?.data?.items ||
		raw?.data ||
		raw?.items ||
		raw?.results ||
		raw ||
		[];

	if (!Array.isArray(items)) return [];

	return items.map((item) => ({
		id: item.id || item.drama_id || item.slug || '',
		title: item.title || item.name || item.book_name || 'Tanpa Judul',
		poster:
			item.poster ||
			item.cover ||
			item.thumbnail ||
			item.book_pic ||
			'',
		episodes: item.episodes || item.episode_count || item.total_episode || 0,
	}));
}

export { CONFIG };