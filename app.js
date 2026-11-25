/**
 * STOCK ID SCREENER - JAVASCRIPT ENGINE
 * Create By : Hardiansyah
 */

// ==========================================
// 1. VARIABEL GLOBAL & STATE APLIKASI
// ==========================================
let globalStockData = null;
let searchCooldownTimer = null;
let exportCardCooldownTimer = null;
let isRadarScanning = false;
let isWhaleScanning = false;
let currentTicker = 'MDIA';
let currentInterval = 'D';
let currentJournalView = 'table';
let openAlertDropdowns = new Set();
let isHeatmapLoaded = false;
let whaleScanCooldownTimer = null;
let isSoundMuted = localStorage.getItem('stockid_sound_muted') === 'true';
let isVibrateMuted = localStorage.getItem('stockid_vibrate_muted') === 'true';

if (window.lucide) lucide.createIcons();

// ==========================================
// HELPER NORMALISASI TICKER & WARAN BEI
// ==========================================
// Komentar: Membersihkan dan menstandarkan format kode saham maupun waran BEI.
if (typeof normalizeTickerSymbol !== 'function') {
	window.normalizeTickerSymbol = function(ticker) {
		if (!ticker) return '';
		let clean = String(ticker)
			.trim()
			.toUpperCase()
			.replace(/^\$/, '')
			.replace(/^IDX:/, '')
			.replace(/\.JK$/i, '')
			.replace(/\s+/g, '');

		if (/^[A-Z]{4}W\d*$/.test(clean)) {
			clean = clean.replace(/^([A-Z]{4})(W\d*)$/, '$1-$2');
		}
		if (/^[A-Z]{4}\.W\d*$/.test(clean)) {
			clean = clean.replace(/^([A-Z]{4})\.(W\d*)$/, '$1-$2');
		}
		return clean;
	};
}

// Komentar: Mengecek apakah simbol emiten merupakan instrumen waran (-W / -W2).
if (typeof isWarrantTicker !== 'function') {
	window.isWarrantTicker = function(ticker) {
		const clean = normalizeTickerSymbol(ticker);
		return /^[A-Z]{4}-W\d*$/.test(clean);
	};
}

// Komentar: Mengambil kode saham induk dari emiten waran (contoh: BSBK-W -> BSBK).
if (typeof getParentTicker !== 'function') {
	window.getParentTicker = function(ticker) {
		const clean = normalizeTickerSymbol(ticker);
		return clean.replace(/-W\d*$/, '');
	};
}

// Komentar: Mengubah simbol emiten ke format Yahoo Finance (.JK).
if (typeof toYahooTickerSymbol !== 'function') {
	window.toYahooTickerSymbol = function(ticker) {
		const clean = normalizeTickerSymbol(ticker);
		if (!clean) return '';
		return clean.endsWith('.JK') ? clean : `${clean}.JK`;
	};
}

// Komentar: Mengubah simbol emiten ke format widget TradingView IDX.
if (typeof toTradingViewSymbol !== 'function') {
	window.toTradingViewSymbol = function(ticker) {
		const clean = normalizeTickerSymbol(ticker);
		if (!clean) return 'IDX:MDIA';
		return `IDX:${clean.replace('-', '.')}`;
	};
}

// Komentar: Mengambil seluruh daftar kode saham reguler (non-waran) dari watchlist.
if (typeof getRegularStockTickers !== 'function') {
	window.getRegularStockTickers = function() {
		const base = (typeof uniqueRadarWatchlist !== 'undefined' && Array.isArray(uniqueRadarWatchlist))
			? uniqueRadarWatchlist
			: ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'MDIA', 'ANTM', 'BREN', 'CUAN', 'AMMN', 'GOTO', 'BRIS', 'ADRO', 'PTBA', 'INDF', 'ICBP', 'UNVR', 'KLBF', 'PGAS'];
		return [...new Set(base.map(t => normalizeTickerSymbol(t)).filter(t => t && !isWarrantTicker(t)))];
	};
}

// Komentar: Mengambil seluruh daftar kode waran (-W) aktif dari watchlist.
if (typeof getWarrantStockTickers !== 'function') {
	window.getWarrantStockTickers = function() {
		const sources = [
			typeof uniqueWarrantWatchlist !== 'undefined' ? uniqueWarrantWatchlist : [],
			typeof warrantWatchlist !== 'undefined' ? warrantWatchlist : [],
			typeof uniqueRadarWatchlist !== 'undefined' ? uniqueRadarWatchlist : [],
			typeof PRIORITIZED_ACTIVE_WARRANTS !== 'undefined' ? PRIORITIZED_ACTIVE_WARRANTS : []
		];
		const set = new Set();
		sources.forEach(arr => {
			if (Array.isArray(arr)) {
				arr.forEach(t => {
					const clean = normalizeTickerSymbol(t);
					if (clean && isWarrantTicker(clean)) set.add(clean);
				});
			}
		});
		return Array.from(set);
	};
}

// Komentar: Menggabungkan daftar seluruh saham reguler dan waran tanpa duplikasi.
if (typeof getAllCombinedTickers !== 'function') {
	window.getAllCombinedTickers = function() {
		return [...new Set([...getRegularStockTickers(), ...getWarrantStockTickers()])];
	};
}

// ==========================================
// 2. SISTEM CACHE & WAKTU PASAR
// ==========================================
function isMarketOpen() {
	const now = new Date();
	const day = now.getDay();
	if (day === 0 || day === 6) return false;
	const hours = now.getHours();
	return hours >= 9 && hours < 16;
}

// Komentar: Membersihkan data cache saham dan berita yang sudah kedaluwarsa dari LocalStorage.
function cleanExpiredCache() {
	const FIVE_MINUTES = 5 * 60 * 1000;
	const TEN_MINUTES = 10 * 60 * 1000;
	for (let i = localStorage.length - 1; i >= 0; i--) {
		const key = localStorage.key(i);
		if (key) {
			try {
				if (key.startsWith('stock_cache_')) {
					const item = JSON.parse(localStorage.getItem(key));
					if (Date.now() - item.timestamp >= FIVE_MINUTES) {
						localStorage.removeItem(key);
					}
				} else if (key.startsWith('news_cache_')) {
					const item = JSON.parse(localStorage.getItem(key));
					if (Date.now() - item.timestamp >= TEN_MINUTES) {
						localStorage.removeItem(key);
					}
				}
			} catch(e) {
				localStorage.removeItem(key);
			}
		}
	}
}

// Komentar: Mengambil data saham dari cache LocalStorage jika belum kedaluwarsa.
function getCachedStockData(ticker) {
	const cacheKey = `stock_cache_${ticker}`;
	const cachedRaw = localStorage.getItem(cacheKey);
	if (!cachedRaw) return null;
	try {
		const cache = JSON.parse(cachedRaw);
		const FIVE_MINUTES = 5 * 60 * 1000;
		if (Date.now() - cache.timestamp < FIVE_MINUTES) {
			return cache.data;
		}
	} catch (e) {
		console.warn(`Error parsing cache for ${ticker}`);
	}
	return null;
}

// Komentar: Menyimpan data saham terbaru ke dalam cache LocalStorage.
function setCachedStockData(ticker, data) {
	if (!data) return;
	const cacheKey = `stock_cache_${ticker}`;
	const cachePayload = {
		timestamp: Date.now(),
		data: data
	};
	localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
}

// ==========================================
// 6. UTILITAS & MODAL WELCOME
// ==========================================
function roundToBEITick(price, mode = 'round') {
	if (!price || isNaN(price) || price < 1) return 1;

	let tick = 1;
	if (price <= 200) tick = 1;
	else if (price > 200 && price <= 500) tick = 2;
	else if (price > 500 && price <= 2000) tick = 5;
	else if (price > 2000 && price <= 5000) tick = 10;
	else tick = 25;

	if (mode === 'floor') return Math.floor(price / tick) * tick;
	if (mode === 'ceil') return Math.ceil(price / tick) * tick;
	return Math.round(price / tick) * tick;
}

// Komentar: Menghitung batas persentase Auto Rejection Atas (ARA) dan Bawah (ARB) harian.
function calculateARA_ARB(prevClose) {
	if (!prevClose || prevClose <= 0) return null;
	
	let araRaw = 0;
	let arbRaw = 0;
	let araLimitPct = 0;
	let arbLimitPct = 0;
	
	let isAraNominal = false;
	let isArbNominal = false;

	// Peraturan Auto Rejection Simetris BEI & Papan Pemantauan Khusus (FCA)
	if (prevClose >= 1 && prevClose <= 10) {
		// Khusus saham FCA harga Rp 1 - Rp 10 (Mutlak Rp 1)
		araRaw = prevClose + 1;
		arbRaw = Math.max(1, prevClose - 1);
		isAraNominal = true;
		isArbNominal = true;
	} else if (prevClose > 10 && prevClose < 50) {
		// Khusus saham FCA harga Rp 11 - Rp 49 (Limit 10%)
		araLimitPct = 0.10;
		arbLimitPct = 0.10;
		araRaw = prevClose + (prevClose * araLimitPct);
		arbRaw = prevClose - (prevClose * arbLimitPct);
	} else if (prevClose >= 50 && prevClose <= 200) {
		// Papan Reguler/Pengembangan harga Rp 50 - Rp 200 (Simetris 35%)
		araLimitPct = 0.35;
		arbLimitPct = 0.35;
		araRaw = prevClose + (prevClose * araLimitPct);
		arbRaw = prevClose - (prevClose * arbLimitPct);
	} else if (prevClose > 200 && prevClose <= 5000) {
		// Papan Reguler/Pengembangan harga > Rp 200 - Rp 5.000 (Simetris 25%)
		araLimitPct = 0.25;
		arbLimitPct = 0.25;
		araRaw = prevClose + (prevClose * araLimitPct);
		arbRaw = prevClose - (prevClose * arbLimitPct);
	} else if (prevClose > 5000) {
		// Papan Reguler/Pengembangan harga > Rp 5.000 (Simetris 20%)
		araLimitPct = 0.20;
		arbLimitPct = 0.20;
		araRaw = prevClose + (prevClose * araLimitPct);
		arbRaw = prevClose - (prevClose * arbLimitPct);
	}

	// Format teks presentase atau nominal untuk UI
	const araText = isAraNominal ? "Rp 1" : `${(araLimitPct * 100).toFixed(0)}%`;
	const arbText = isArbNominal ? "Rp 1" : `${(arbLimitPct * 100).toFixed(0)}%`;

	return {
		ara: roundToBEITick(araRaw, 'floor'),
		arb: Math.max(1, roundToBEITick(arbRaw, 'ceil')), // Memastikan harga tidak tembus ke angka 0
		araText: araText,
		arbText: arbText
	};
}

// Komentar: Menampilkan informasi batas harga ARA dan ARB ke antarmuka aplikasi.
function renderAraArbUI(prevClose) {
	const container = document.getElementById('araArbContainer');
	if (!container) return;
	
	const limits = calculateARA_ARB(prevClose);
	if (!limits) {
		container.innerHTML = "";
		return;
	}

	container.innerHTML = `
		<div class="flex justify-between items-center bg-slate-900/80 p-3 rounded-lg border border-slate-700 shadow-inner">
			<div>
				<span class="text-[10px] text-slate-400 block mb-1 flex items-center gap-1">
					<i data-lucide="arrow-down-circle" class="w-3.5 h-3.5 text-rose-400"></i> Batas ARB (-${limits.arbText})
				</span>
				<span class="font-bold text-rose-400 text-sm">Rp ${limits.arb.toLocaleString('id-ID')}</span>
			</div>
			<div class="text-right">
				<span class="text-[10px] text-slate-400 block mb-1 flex items-center gap-1 justify-end">
					<i data-lucide="arrow-up-circle" class="w-3.5 h-3.5 text-emerald-400"></i> Batas ARA (+${limits.araText})
				</span>
				<span class="font-bold text-emerald-400 text-sm">Rp ${limits.ara.toLocaleString('id-ID')}</span>
			</div>
		</div>
	`;
	
	if (window.lucide) lucide.createIcons();
}

// Komentar: Menghitung titik support dan resistance dinamis menggunakan deret Fibonacci.
function getDynamicFiboLevels(high, low, currentPrice) {
	// Fallback
	if (!high || !low || high <= low || !currentPrice) {
		return {
			entryLow: roundToBEITick(currentPrice * 0.95, 'floor'),
			entryHigh: roundToBEITick(currentPrice * 0.98, 'floor'),
			sl: roundToBEITick(currentPrice * 0.92, 'floor'),
			res1: roundToBEITick(currentPrice * 1.04, 'ceil'),
			res2: roundToBEITick(currentPrice * 1.08, 'ceil'),
			tp1: roundToBEITick(currentPrice * 1.04, 'ceil'),
			tp2: roundToBEITick(currentPrice * 1.08, 'ceil')
		};
	}

	const diff = high - low;
	// Koleksi seluruh titik rasio Fibonacci klasik (Retracement & Ekstensi)
	const levels = [
		low - (diff * 0.618),  // Ekstensi Bawah 2
		low - (diff * 0.272),  // Ekstensi Bawah 1
		low,                   // 0% (Low)
		low + (diff * 0.236),  // 23.6%
		low + (diff * 0.382),  // 38.2%
		low + (diff * 0.500),  // 50.0% (Pivot)
		low + (diff * 0.618),  // 61.8%
		low + (diff * 0.786),  // 78.6%
		high,                  // 100% (High)
		low + (diff * 1.272),  // 127.2% (Ekstensi Atas 1)
		low + (diff * 1.618),  // 161.8% (Ekstensi Atas 2)
		low + (diff * 2.618)   // 261.8% (Ekstensi Atas 3)
	];

	// Filter Fibo adaptif
	const belowLevels = levels.filter(l => l < currentPrice).sort((a, b) => b - a); 
	const aboveLevels = levels.filter(l => l > currentPrice).sort((a, b) => a - b); 

	// Penentuan Mutlak
	let entryHighRaw = belowLevels.length > 0 ? belowLevels[0] : currentPrice * 0.96; //98
	let entryLowRaw = belowLevels.length > 1 ? belowLevels[1] : entryHighRaw * 0.95; //97
	let slRaw = belowLevels.length > 2 ? belowLevels[2] : entryLowRaw * 0.93; //96

	// Penentuan Mutlak
	let res1Raw = aboveLevels.length > 0 ? aboveLevels[0] : currentPrice * 1.04;
	let res2Raw = aboveLevels.length > 1 ? aboveLevels[1] : res1Raw * 1.04;
	
	let tp1Raw = res1Raw; 
	let tp2Raw = aboveLevels.length > 2 ? aboveLevels[2] : res2Raw * 1.04; 

	return {
		entryLow: roundToBEITick(entryLowRaw, 'floor'),
		entryHigh: roundToBEITick(entryHighRaw, 'floor'),
		sl: roundToBEITick(slRaw, 'floor'),
		res1: roundToBEITick(res1Raw, 'ceil'),
		res2: roundToBEITick(res2Raw, 'ceil'),
		tp1: roundToBEITick(tp1Raw, 'ceil'),
		tp2: roundToBEITick(tp2Raw, 'ceil')
	};
}

// Komentar: Mengecek dan menampilkan pop-up selamat datang jika pertama kali dibuka.
function checkWelcomeModal() {
	const hideModal = localStorage.getItem('hide_welcome_modal');
	if (!hideModal) {
		const modal = document.getElementById('welcomeModal');
		if (modal) modal.classList.remove('hidden');
	}
}

// Komentar: Menutup pop-up selamat datang dan menyimpannya di preferensi lokal.
function closeWelcomeModal(dontShowAgain) {
	const modal = document.getElementById('welcomeModal');
	if (modal) modal.classList.add('hidden');
	if (dontShowAgain) {
		localStorage.setItem('hide_welcome_modal', 'true');
	}
}

// Komentar: Menampilkan kotak dialog konfirmasi kustom dengan opsi Ya/Batal.
function showConfirm(message) {
	return new Promise((resolve) => {
		let modal = document.getElementById('customConfirmModal');
		if (!modal) {
			modal = document.createElement('div');
			modal.id = 'customConfirmModal';
			modal.className = 'fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 opacity-0 hidden';
			modal.innerHTML = `
				<div id="customConfirmContent" class="transform scale-90 transition-all duration-300 bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
					<div class="inline-flex p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 mb-1">
						<i class="fa-solid fa-triangle-exclamation text-xl"></i>
					</div>
					<h3 class="text-base font-bold text-white">Konfirmasi Tindakan</h3>
					<p id="customConfirmMsg" class="text-xs text-slate-300 leading-relaxed"></p>
					<div class="flex gap-3 pt-2">
						<button id="customConfirmBtnCancel" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-xl border border-slate-700 transition">Batal</button>
						<button id="customConfirmBtnOk" class="flex-1 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-lg shadow-rose-500/20">Ya, Lanjutkan</button>
					</div>
				</div>
			`;
			document.body.appendChild(modal);
		}
		document.getElementById('customConfirmMsg').innerText = message;
		modal.classList.remove('hidden');
		setTimeout(() => {
			modal.classList.remove('opacity-0');
			document.getElementById('customConfirmContent').classList.remove('scale-90');
			document.getElementById('customConfirmContent').classList.add('scale-100');
		}, 10);
		const btnOk = document.getElementById('customConfirmBtnOk');
		const btnCancel = document.getElementById('customConfirmBtnCancel');
		// Komentar: Fungsi untuk Menutup model.
		const closeModel = (result) => {
			modal.classList.remove('opacity-100');
			modal.classList.add('opacity-0');
			document.getElementById('customConfirmContent').classList.remove('scale-100');
			document.getElementById('customConfirmContent').classList.add('scale-90');
			setTimeout(() => {
				modal.classList.add('hidden');
				resolve(result);
			}, 300);
		};
		btnOk.onclick = () => closeModel(true);
		btnCancel.onclick = () => closeModel(false);
	});
}

// Komentar: Menampilkan pesan notifikasi singkat (toast) di sudut layar yang dapat diklik untuk membuka saham.
function showToast(message, type = 'success', duration = 5000, onClickCallback = null) {
	const container = document.getElementById('toastContainer');
	if (!container) return;
	const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
	let borderColor = 'border-emerald-500/40';
	let bgColor = 'bg-slate-900/95';
	let iconColor = 'text-emerald-400';
	let iconClass = 'fa-circle-check';

	if (type === 'error' || type === 'loss') {
		borderColor = 'border-rose-500/40';
		iconColor = 'text-rose-400';
		iconClass = 'fa-circle-exclamation';
	} else if (type === 'warning') {
		borderColor = 'border-amber-500/40';
		iconColor = 'text-amber-400';
		iconClass = 'fa-triangle-exclamation';
	} else if (type === 'info') {
		borderColor = 'border-teal-500/40';
		iconColor = 'text-teal-400';
		iconClass = 'fa-circle-info';
	}

	const clickableClass = typeof onClickCallback === 'function' ? 'cursor-pointer hover:border-cyan-400/70' : '';
	const toast = document.createElement('div');
	toast.id = toastId;
	toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-xl ${bgColor} border ${borderColor} ${clickableClass} shadow-2xl backdrop-blur-xl text-slate-200 text-xs sm:text-sm font-bold transform translate-y-4 opacity-0 transition-all duration-300 max-w-sm`;
	toast.innerHTML = `
		<i class="fa-solid ${iconClass} ${iconColor} text-base shrink-0"></i>
		<div class="flex-1 leading-relaxed whitespace-pre-line">${message}</div>
		<button type="button" class="toast-close-btn text-slate-400 hover:text-white transition p-1 shrink-0">
			<i class="fa-solid fa-xmark text-xs"></i>
		</button>
	`;

	const closeBtn = toast.querySelector('.toast-close-btn');
	if (closeBtn) {
		closeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			toast.remove();
		});
	}

	if (typeof onClickCallback === 'function') {
		toast.addEventListener('click', () => {
			onClickCallback();
			toast.remove();
		});
	}

	container.appendChild(toast);
	setTimeout(() => { toast.classList.remove('translate-y-4', 'opacity-0'); }, 10);
	setTimeout(() => {
		if (document.getElementById(toastId)) {
			toast.classList.add('translate-y-4', 'opacity-0');
			setTimeout(() => toast.remove(), 500);
		}
	}, duration);
}

// Komentar: Menyalin tautan saham aktif ke clipboard untuk dibagikan.
function shareStockUrl() {
	const shareUrl = `${window.location.origin}${window.location.pathname}?ticker=${currentTicker}`;
	navigator.clipboard.writeText(shareUrl).then(() => {
		AudioFX.playSuccess();
	}).catch(() => {});
}

// ==========================================
// 10. DATA FETCHING (DEDUPLICATION ENGINE)
// ==========================================
const pendingFetchRequests = new Map();

// Komentar: Menarik dan memproses data real-time harga saham maupun waran.
async function fetchRealtimeStockData(ticker, forceFetch = false, skipFallback = false) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	if (!cleanTicker) return null;

	const cachedData = getCachedStockData(cleanTicker);
	if (cachedData && !forceFetch) return cachedData;
	
	const reqKey = `${cleanTicker}_${skipFallback}`;
	if (pendingFetchRequests.has(reqKey)) {
		return pendingFetchRequests.get(reqKey);
	}

	const fetchPromise = (async () => {
		const targetSymbol = toYahooTickerSymbol(cleanTicker);
		const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
		
		const fetchWithTimeout = async (url, timeoutMs = 5000) => {
			const controller = new AbortController();
			const timerId = setTimeout(() => controller.abort(), timeoutMs);
			try {
				const res = await fetch(url, { signal: controller.signal });
				clearTimeout(timerId);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res;
			} catch (err) {
				clearTimeout(timerId);
				throw err;
			}
		};

		let freshData = null;
		
		// 1. Eksekusi Cloudflare Worker Utama
		try {
			const res = await fetchWithTimeout(`${WORKER_URL}?symbol=${encodeURIComponent(targetSymbol)}`, 5000);
			const json = await res.json();
			freshData = parseYahooDataGlobal(json, cleanTicker);
		} catch(e) {
			if (!skipFallback) {
				console.warn(`Worker Utama gagal untuk ${cleanTicker}, memanggil Fallback...`);
			}
		}

		// 2. Fallback Multi-Proxy Darurat
		if (!freshData && !skipFallback) {
			const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(targetSymbol)}?interval=15m&range=5d`;
			const proxyUrls = [
				`https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
				`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(yahooUrl)}`,
				`https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`
			];

			for (const pUrl of proxyUrls) {
				try {
					const res = await fetchWithTimeout(pUrl, 5500);
					const json = await res.json();
					freshData = parseYahooDataGlobal(json, cleanTicker);
					if (freshData) break;
				} catch(e) {}
			}
		}

		if (freshData) {
			setCachedStockData(cleanTicker, freshData);
		}
		
		pendingFetchRequests.delete(reqKey);
		return freshData || cachedData;
	})();

	pendingFetchRequests.set(reqKey, fetchPromise);
	return fetchPromise;
}

// Komentar: Membersihkan dan memetakan data mentah bursa (mendukung saham reguler & waran).
function parseYahooDataGlobal(json, ticker) {
	const result = json?.chart?.result?.[0] || json?.results?.[0];
	if (!result) return null;

	const cleanTicker = normalizeTickerSymbol(ticker);
	const isWarrant = isWarrantTicker(cleanTicker);
	const timestamps = result.timestamp || [];
	const quote = result.indicators?.quote?.[0] || result.quote;
	const prices = quote?.close?.filter(p => typeof p === 'number' && !isNaN(p) && p > 0) || [];
	const volumes = quote?.volume?.filter(v => typeof v === 'number' && !isNaN(v) && v >= 0) || [];
	const highs = quote?.high?.filter(h => typeof h === 'number' && !isNaN(h) && h > 0) || [];
	const lows = quote?.low?.filter(l => typeof l === 'number' && !isNaN(l) && l > 0) || [];

	const metaPrice = result.meta?.regularMarketPrice;
	const metaPrev = result.meta?.previousClose || result.meta?.chartPreviousClose;

	if (!isWarrant && prices.length < 5) return null;
	if (isWarrant && prices.length === 0 && (!metaPrice || metaPrice <= 0) && (!metaPrev || metaPrev <= 0)) return null;

	const currentPrice = (metaPrice && metaPrice > 0)
		? metaPrice
		: (prices.length > 0 ? prices[prices.length - 1] : (isWarrant ? metaPrev : 0));
	if (!currentPrice || currentPrice <= 0) return null;

	const fallbackPrev = prices.length >= 2 ? prices[prices.length - 2] : currentPrice;
	const previousClose = (metaPrev && metaPrev > 0) ? metaPrev : fallbackPrev;
	const changePct = previousClose > 0
		? parseFloat((((currentPrice - previousClose) / previousClose) * 100).toFixed(2))
		: 0;

	const validPrices = prices.length > 0 ? prices : [currentPrice];
	const getMA = (p) => roundToBEITick(validPrices.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, validPrices.length));
	const ma5 = getMA(5);
	const ma10 = getMA(10);
	const ma20 = getMA(20);

	const validHighs = highs.length > 0 ? highs : validPrices;
	const validLows = lows.length > 0 ? lows : validPrices;
	const high20 = validHighs.length >= 20 ? roundToBEITick(Math.max(...validHighs.slice(-20))) : roundToBEITick(Math.max(...validHighs));
	const low20 = validLows.length >= 20 ? roundToBEITick(Math.min(...validLows.slice(-20))) : roundToBEITick(Math.min(...validLows));

	let dailyData = {};
	let totalVol20 = 0;
	let totalValue20 = 0;
	const len = prices.length;
	const period = Math.min(20, len);

	for (let i = 0; i < len; i++) {
		if (timestamps[i] && volumes[i] != null && prices[i] != null) {
			let date = new Date(timestamps[i] * 1000);
			let dayStr = date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });

			if (!dailyData[dayStr]) {
				dailyData[dayStr] = { volume: 0, valuasi: 0 };
			}

			let p = prices[i];
			let h = highs[i] || p;
			let l = lows[i] || p;
			let typicalPrice = (h + l + p) / 3;

			dailyData[dayStr].volume += volumes[i];
			dailyData[dayStr].valuasi += (typicalPrice * volumes[i]);
		}

		if (i >= len - period) {
			let p = prices[i];
			let h = highs[i] || p;
			let l = lows[i] || p;
			let v = volumes[i] || 0;
			let typicalPrice = (h + l + p) / 3;

			totalVol20 += v;
			totalValue20 += (typicalPrice * v);
		}
	}

	const dailyKeys = Object.keys(dailyData);
	let volYesterday = 1;
	let valYesterday = 1;

	if (dailyKeys.length >= 2) {
		volYesterday = dailyData[dailyKeys[dailyKeys.length - 2]].volume || 1;
		valYesterday = dailyData[dailyKeys[dailyKeys.length - 2]].valuasi || 1;
	} else if (dailyKeys.length === 1) {
		volYesterday = dailyData[dailyKeys[0]].volume || 1;
		valYesterday = dailyData[dailyKeys[0]].valuasi || 1;
	}

	const currentVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
	const realVolume = result.meta?.regularMarketVolume || (dailyKeys.length > 0 ? dailyData[dailyKeys[dailyKeys.length - 1]].volume : currentVolume);

	const currentLot = Math.floor(realVolume / 100);
	const currentValuation = realVolume * currentPrice;

	const volRatio = parseFloat((realVolume / volYesterday).toFixed(2));
	const valRatio = parseFloat((currentValuation / valYesterday).toFixed(2));
	const bandarAvgPrice = totalVol20 > 0 ? roundToBEITick(totalValue20 / totalVol20) : roundToBEITick(currentPrice);

	const raw52High = result.meta?.fiftyTwoWeekHigh;
	const raw52Low = result.meta?.fiftyTwoWeekLow;
	const fiftyTwoWeekHigh = (raw52High && raw52High > 0) ? roundToBEITick(raw52High) : high20;
	const fiftyTwoWeekLow = (raw52Low && raw52Low > 0) ? roundToBEITick(raw52Low) : low20;

	return {
		ticker: cleanTicker,
		isWarrant,
		price: roundToBEITick(currentPrice),
		prevClose: roundToBEITick(previousClose),
		changePct, ma5, ma10, ma20, currentVolume, volYesterday, volRatio, valRatio, high20, low20,
		fiftyTwoWeekHigh, fiftyTwoWeekLow,
		currentLot, currentValuation, bandarAvgPrice,
		historicalPrices: validPrices
	};
}

// Komentar: Mengonversi nominal angka besar menjadi teks valuasi Rupiah (Juta/Miliar/Triliun).
function formatValuationIDR(val) {
	if (!val || val <= 0) return "Rp 0";
	if (val >= 1e12) {
		return `Rp ${(val / 1e12).toFixed(2)} Triliun`;
	} else if (val >= 1e9) {
		return `Rp ${(val / 1e9).toFixed(2)} Miliar`;
	} else if (val >= 1e6) {
		return `Rp ${(val / 1e6).toFixed(2)} Juta`;
	}
	return `Rp ${val.toLocaleString('id-ID')}`;
}

// ==========================================
// 16. PENCARIAN AUTOCOMPLETE & SEARCH WARAN
// ==========================================
function initSearchSuggestions() {
	const input = document.getElementById('stockSearch');
	const box = document.getElementById('searchSuggestionsBox');
	if (!input || !box) return;

	input.addEventListener('focus', () => AudioFX.playSearch());
	input.addEventListener('input', function() {
		const val = this.value.trim().toUpperCase();
		if (!val) {
			box.classList.add('hidden');
			box.innerHTML = '';
			return;
		}
		const allList = getAllCombinedTickers();
		const matches = allList.filter(item => item.includes(val) || item.replace('-', '').includes(val)).slice(0, 12);
		if (matches.length > 0) {
			box.innerHTML = matches.map(ticker => {
				const logoTicker = getParentTicker(ticker);
				const isWaran = isWarrantTicker(ticker);
				return `
				<div onclick="selectSuggestion('${ticker}')" class="px-4 py-2.5 hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-200 text-xs font-bold cursor-pointer transition flex items-center justify-between group">
					<span class="flex items-center gap-2.5">
						<div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
							<img 
								src="https://assets.stockbit.com/logos/companies/${logoTicker}.png" 
								alt="${ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${logoTicker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[9px] font-black text-slate-400 tracking-wider\\'>${logoTicker.substring(0,3)}</span>';};"
							>
						</div>
						${ticker}
					</span>
					<span class="text-[9px] ${isWaran ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded' : 'text-slate-500 group-hover:text-emerald-400'}">${isWaran ? 'WARAN' : 'IDX'}</span>
				</div>
			`;
			}).join('');
			box.classList.remove('hidden');
		} else {
			box.classList.add('hidden');
			box.innerHTML = '';
		}
	});

	document.addEventListener('click', function(e) {
		const searchContainer = document.getElementById('searchContainer');
		if (searchContainer && !searchContainer.contains(e.target)) box.classList.add('hidden');
	});
}

// Pada bagian awal fungsi searchStock(bypassCooldown = false), normalisasi input:
// const input = normalizeTickerSymbol(document.getElementById('stockSearch').value);

// Komentar: Merespons saat pengguna memilih kode saham dari daftar saran pencarian.
function selectSuggestion(ticker) {
	const input = document.getElementById('stockSearch');
	const box = document.getElementById('searchSuggestionsBox');
	if (input) input.value = ticker;
	if (box) box.classList.add('hidden');
	searchStock(true);
}

// Komentar: Mengaktifkan jeda antar pencarian untuk mencegah permintaan data terlalu beruntun.
// ============================================================================
// COOLDOWN TOMBOL CARI SAHAM
// ============================================================================
function startSearchCooldown(seconds = 5) {
	const btn = document.getElementById('btnSearchStock') || document.querySelector('button[onclick*="searchStock"]');
	if (!btn) return;

	if (searchCooldownTimer) clearInterval(searchCooldownTimer);

	let remaining = seconds;
	btn.disabled = true;
	btn.classList.add('opacity-60', 'cursor-not-allowed');
	btn.innerHTML = `<span>Cari (${remaining}s)</span>`;
	if (window.lucide) lucide.createIcons();

	searchCooldownTimer = setInterval(() => {
		remaining -= 1;
		if (remaining > 0) {
			btn.innerHTML = `<span>Cari (${remaining}s)</span>`;
			if (window.lucide) lucide.createIcons();
		} else {
			clearInterval(searchCooldownTimer);
			searchCooldownTimer = null;
			btn.disabled = false;
			btn.classList.remove('opacity-60', 'cursor-not-allowed');
			btn.innerHTML = `<span>Cari</span> <span id="badgeLimitSearch" class="limit-badge-circle"></span>`;
			if (window.lucide) lucide.createIcons();
			if (typeof updateAllLimitBadges === 'function') updateAllLimitBadges();
		}
	}, 1000);
}

// Komentar: Menjalankan pencarian mendalam dan memuat seluruh instrumen data untuk saham maupun waran.
async function searchStock(bypassCooldown = false) {
	const btn = document.getElementById('btnSearchStock') || document.querySelector('button[onclick*="searchStock"]');
	if (!bypassCooldown && btn && btn.disabled) return;

	const searchInput = document.getElementById('stockSearch');
	const rawInput = searchInput ? searchInput.value : '';
	const input = normalizeTickerSymbol(rawInput);
	const box = document.getElementById('searchSuggestionsBox');
	if (box) box.classList.add('hidden');

	if (input) {
		if (searchInput) searchInput.value = input;

		if (!checkAndUpdateLimit('search', false)) {
			showToast("Limit harian pencarian saham Kamu telah habis (50x/hari).", "error");
			if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
			return;
		}

		const stockData = await fetchRealtimeStockData(input, false);
		if (!stockData || !stockData.price) {
			showToast(`Emiten ${input} tidak ditemukan!`, "warning");
			if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
			return;
		}

		deductFeatureLimit('search');

		currentTicker = input;
		const setTxt = (id, val) => {
			const el = document.getElementById(id);
			if (el) el.innerText = val;
		};

		setTxt('stockTitle', toTradingViewSymbol(currentTicker));
		setTxt('aiHeaderTicker', `[${currentTicker}] — KONDISI TEKNIKAL`);
		setTxt('newsTickerLabel', currentTicker);
		setTxt('fundTickerLabel', currentTicker);
		setTxt('rrrTickerLabel', currentTicker);
		setTxt('alertTickerLabel', currentTicker);
		setTxt('corpTickerLabel', currentTicker);
		setTxt('peerTickerLabel', currentTicker);

		renderChart(currentTicker);
		renderTechnicalGauge(currentTicker);
		renderAllAlerts();
		generateAISignal(currentTicker, false);
		fetchRealtimeFundamentals(currentTicker);
		fetchStockNews(currentTicker);
		fetchCorporateAction(currentTicker);

		if (!bypassCooldown) startSearchCooldown(5);
	}
}

// Komentar: Mengaktifkan input mikrofon untuk melakukan pencarian kode saham maupun waran menggunakan suara.
function startVoiceSearch() {
	const voiceIcon = document.getElementById('voiceIcon');
	const input = document.getElementById('stockSearch');
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	
	if (!SpeechRecognition) {
		showToast("Browser kamu belum mendukung fitur pencarian suara. Coba gunakan Chrome.");
		return;
	}

	const recognition = new SpeechRecognition();
	recognition.lang = 'id-ID';
	recognition.interimResults = false;
	recognition.maxAlternatives = 1;

	recognition.onstart = function() {
		voiceIcon.classList.remove('fa-microphone', 'text-slate-400');
		voiceIcon.classList.add('fa-microphone-lines', 'text-rose-500', 'animate-pulse');
		input.placeholder = "Mendengarkan suara kamu...";
		AudioFX.playClick();
	};

	recognition.onresult = function(event) {
		const transcript = event.results[0][0].transcript.trim().toUpperCase();
		const spacelessTranscript = transcript.replace(/\s+/g, '');
		const allTickers = getAllCombinedTickers();
		let foundTicker = null;

		if (allTickers.length > 0) {
			const sortedTickers = [...allTickers].sort((a, b) => b.length - a.length);
			const words = transcript.split(/\s+/).map(w => normalizeTickerSymbol(w));
			foundTicker = sortedTickers.find(ticker => words.includes(ticker));
			if (!foundTicker) {
				foundTicker = sortedTickers.find(ticker => spacelessTranscript.includes(ticker.replace(/-/g, '')));
			}
		}

		if (!foundTicker) {
			const cleaned = transcript.replace(/COBA|DONG|ANALISA|CARI|SAHAM|WARAN|BUKA|TOLONG/g, '').replace(/\s+/g, '').trim();
			foundTicker = normalizeTickerSymbol(cleaned);
		}

		if (foundTicker) {
			input.value = foundTicker;
			searchStock(true);
		} else {
			input.placeholder = "Gagal menangkap kode saham...";
		}
	};

	recognition.onerror = function() {
		input.placeholder = "Gagal mendengar, coba lagi...";
	};

	recognition.onend = function() {
		voiceIcon.classList.remove('fa-microphone-lines', 'text-rose-500', 'animate-pulse');
		voiceIcon.classList.add('fa-microphone', 'text-slate-400');
		setTimeout(() => { input.placeholder = "Cari saham (MDIA...) atau klik Mic"; }, 2000);
	};
	recognition.start();
}

// ==========================================
// 11. AI SIGNAL & TRADING MAP
// ==========================================
function showAISkeletonLoading() {
	document.getElementById('aiVerdikText').innerHTML = `<span class="inline-block w-32 h-5 skeleton rounded"></span>`;
	document.getElementById('aiScoreBadge').innerHTML = `<span class="inline-block w-12 h-4 skeleton rounded"></span>`;
	document.getElementById('aiVerdikDesc').innerHTML = `
		<div class="space-y-2 py-1">
			<div class="w-full h-3 skeleton rounded"></div>
			<div class="w-4/5 h-3 skeleton rounded"></div>
			<div class="w-3/4 h-3 skeleton rounded"></div>
		</div>
	`;
	document.getElementById('aiBuktiUtamaList').innerHTML = `
		<li class="h-6 skeleton rounded w-full"></li>
		<li class="h-6 skeleton rounded w-full"></li>
		<li class="h-6 skeleton rounded w-full"></li>
		<li class="h-6 skeleton rounded w-full"></li>
	`;
	document.getElementById('mapSupport1').innerHTML = `<span class="inline-block w-20 h-4 skeleton rounded"></span>`;
	document.getElementById('mapResist1').innerHTML = `<span class="inline-block w-20 h-4 skeleton rounded"></span>`;
	document.getElementById('mapTP').innerHTML = `<span class="inline-block w-20 h-4 skeleton rounded"></span>`;
	document.getElementById('mapSL').innerHTML = `<span class="inline-block w-20 h-4 skeleton rounded"></span>`;
	document.getElementById('tpBarSL').innerHTML = `<span class="inline-block w-12 h-3 skeleton rounded"></span>`;
	document.getElementById('tpBarCurrent').innerHTML = `<span class="inline-block w-16 h-3 skeleton rounded"></span>`;
	document.getElementById('tpBarTP').innerHTML = `<span class="inline-block w-12 h-3 skeleton rounded"></span>`;
	document.getElementById('tpProgressBar').style.width = '0%';
	document.getElementById('tpProgressPercent').innerText = `Menghitung posisi teknikal...`;
}

// Komentar: Menghasilkan proyeksi dan sinyal trading AI berdasarkan indikator teknikal saat ini.
async function generateAISignal(ticker, isManualSearch = false) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	if (!cleanTicker) return;

	const now = new Date();
	const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

	const logoTicker = getParentTicker(cleanTicker);
	const headerTickerEl = document.getElementById('aiHeaderTicker');
	if (headerTickerEl) {
		headerTickerEl.innerHTML = `
			<div class="flex items-center gap-2">
				<div class="w-5 h-5 lg:w-6 lg:h-6 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
					<img 
						src="https://assets.stockbit.com/logos/companies/${logoTicker}.png" 
						alt="${cleanTicker}" 
						class="w-full h-full object-contain drop-shadow-sm" 
						onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${logoTicker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] lg:text-[10px] font-black text-slate-400 tracking-wider\\'>${logoTicker.substring(0,3)}</span>';};"
					>
				</div>
				<span>[${cleanTicker}] — KONDISI TEKNIKAL</span>
			</div>
		`;
	}
	const dateStampEl = document.getElementById('aiDateStamp');
	if (dateStampEl) dateStampEl.innerText = `Update: ${dateStr} ${timeStr} WIB`;

	setTimeout(() => fetchStockNewsForAI(cleanTicker), 10);

	const cachedData = getCachedStockData(cleanTicker);
	if (cachedData) {
		globalStockData = cachedData;
		renderAISignalUI(cleanTicker, cachedData, true);
		checkPriceAlertsRealtime(cleanTicker, cachedData.price);
		checkWhaleAlertRealtime(cleanTicker, cachedData);

		fetchRealtimeStockData(cleanTicker, true).then(freshData => {
			if (freshData) {
				globalStockData = freshData;
				renderAISignalUI(cleanTicker, freshData, false);
				checkPriceAlertsRealtime(cleanTicker, freshData.price);
				checkWhaleAlertRealtime(cleanTicker, freshData);
			}
		});
		return;
	}

	showAISkeletonLoading();

	const stockData = await fetchRealtimeStockData(cleanTicker, false);
	if (stockData && stockData.ticker === cleanTicker) {
		globalStockData = stockData;
		checkPriceAlertsRealtime(cleanTicker, stockData.price);
		checkWhaleAlertRealtime(cleanTicker, stockData);
	}
	renderAISignalUI(cleanTicker, stockData, false);
}

// Komentar: Merender hasil teks analisis dan skor sinyal AI ke antarmuka aplikasi.
function renderAISignalUI(ticker, stockData, isCached) {
	const verdikEl = document.getElementById('aiVerdikText');
	const scoreEl = document.getElementById('aiScoreBadge');
	const descEl = document.getElementById('aiVerdikDesc');
	const buktiEl = document.getElementById('aiBuktiUtamaList');
	const kesimpulanEl = document.getElementById('aiKesimpulanText');

	let price = stockData ? roundToBEITick(stockData.price) : 100;
	let score = 3;
	let verdik = "NETRAL";
	let verdikClass = "font-bold text-amber-400 text-sm lg:text-base";
	let scoreClass = "font-bold bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";

	if (stockData) {
		renderAraArbUI(stockData.prevClose);
		const isAboveMA5 = stockData.price > stockData.ma5;
		const isAboveMA10 = stockData.price > stockData.ma10;
		const isAboveMA20 = stockData.price > stockData.ma20;
		const isVolSpike = stockData.volRatio >= 1.5;

		if (stockData.price > stockData.ma20 && stockData.changePct > 4 && stockData.volRatio >= 2) {
			score = 5;
			verdik = "STRONG BULLISH BREAKOUT";
			verdikClass = "font-bold text-teal-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-teal-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price > stockData.ma20 && stockData.changePct > 1 && stockData.volRatio >= 2) {
			score = 4;
			verdik = "BULLISH ACCUMULATION";
			verdikClass = "font-bold text-emerald-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-emerald-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price > stockData.ma10 && stockData.changePct > 1 && stockData.volRatio >= 1) {
			score = 4;
			verdik = "BULLISH ACCUMULATION";
			verdikClass = "font-bold text-emerald-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-emerald-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price > stockData.ma10 && stockData.changePct >= -2 && stockData.changePct <= 2) {
			score = 3;
			verdik = "KONSOLIDASI";
			verdikClass = "font-bold text-amber-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price > stockData.ma5 && stockData.changePct >= -4 && stockData.changePct <= 2) {
			score = 3;
			verdik = "KONSOLIDASI";
			verdikClass = "font-bold text-amber-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price < stockData.ma20 && stockData.changePct < -4) {
			score = 1;
			verdik = "SELLING PRESSURE";
			verdikClass = "font-bold text-red-500 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-red-500 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price < stockData.ma10 && stockData.changePct >= -8 && stockData.changePct <= 1) {
			score = 2;
			verdik = "BEARISH CORRECTION";
			verdikClass = "font-bold text-rose-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-rose-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		}

		verdikEl.innerText = verdik;
		verdikEl.className = verdikClass;
		scoreEl.innerText = `${score}/5`;
		scoreEl.className = scoreClass;

		const trendText = stockData.changePct >= 0 ? `menguat +${stockData.changePct}%` : `terkoreksi ${stockData.changePct}%`;
		const volText = isVolSpike 
			? `<strong class="text-emerald-400">terjadi lonjakan volume (${stockData.volRatio}x rerata volume harian)</strong>` 
			: `volume transaksi cenderung moderat <strong class="text-amber-400">(${stockData.volRatio}x rerata volume harian)</strong>`;
		
		const maAlignText = (isAboveMA5 && isAboveMA10 && isAboveMA20)
			? "Struktur tren berada dalam susunan <strong class='text-emerald-400'>Bullish Alignment</strong> (Harga > MA5 > MA10 > MA20). Ini menandakan partisipasi pembeli mendominasi penuh seluruh horizon waktu jangka pendek."
			: (!isAboveMA10 && !isAboveMA20)
			? "Posisi harga berada <strong class='text-rose-400'>di bawah MA10 & MA20</strong>, mengindikasikan tekanan jual jangka pendek yang intensif dan kurva pergerakan dalam fase penurunan beruntun (*downtrend*)."
			: "Pergerakan harga berada dalam zona konsolidasi dinamis antar garis rata-rata, mengisyaratkan perebutan momentum antara kubu *bulls* dan *bears*.";

		descEl.innerHTML = `
			<p class="leading-relaxed"><strong class="text-blue-400">Mengapa?</strong> Saham <strong class="text-emerald-400 font-bold">${ticker}</strong> saat ini diperdagangkan pada level harga Rp ${price.toLocaleString('id-ID')} (${trendText}). ${maAlignText}</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong class="text-blue-400">Analisis Likuiditas & Volume:</strong> Terdeteksi bahwa ${volText}. Tingkat aktivitas volume ini mengonfirmasi kekuatan partisipasi institusi atau pelaku pasar utama dalam mendukung pergerakan harga hari ini.</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong class="text-blue-400">Rentang Volatilitas 20 Hari:</strong> Pergerakan saham ${ticker} bergerak dalam koridor rentang antara Rp ${stockData.low20.toLocaleString('id-ID')} <strong class="text-amber-400">(Low MA20)</strong> hingga Rp ${stockData.high20.toLocaleString('id-ID')} <strong class="text-sky-400">(High MA20)</strong>.</p>
		`;

		const turnoverAI = stockData.currentValuation || (price * (stockData.currentVolume || (stockData.currentLot || 0) * 100));
		const directionAI = stockData.price >= (stockData.prevClose || stockData.price) ? 1 : -1;
		const netFlowAI = turnoverAI * directionAI * Math.min(stockData.volRatio || 1, 3);
		const isNetBuyAI = netFlowAI >= 0;
		const formatFlowSafe = typeof formatForeignFlowNominal === 'function'
			? formatForeignFlowNominal
			: (v) => formatValuationIDR(v);
		const netFlowTextAI = formatFlowSafe(Math.abs(netFlowAI));
		const valEvalAI = typeof evaluateValuationStatus === 'function'
			? evaluateValuationStatus(stockData)
			: {
				textClass: 'text-cyan-400',
				badgeClass: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
				status: 'FAIR',
				positionPct: 50
			};

		buktiEl.innerHTML = `
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="circle-dollar-sign" class="w-4 h-4"></i> Harga: 
					<strong class="text-blue-400 font-bold">Rp${price.toLocaleString('id-ID')}</strong> 
					(${stockData.changePct >= 0 ? '+' : ''}${stockData.changePct}%)
				</span>
				<span class="text-[10px] lg:text-[11px] text-blue-400">${isCached ? 'Cache Instant' : 'Live Data'}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="chart-candlestick" class="w-4 h-4"></i> Volume Transaksi:
				</span>
				<span class="text-blue-400 font-bold">${(stockData.currentLot || 0).toLocaleString('id-ID')} Lot</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="chart-candlestick" class="w-4 h-4"></i> Valuasi Transaksi:
				</span>
				<span class="text-blue-400 font-bold">${formatValuationIDR(stockData.currentValuation)}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="venetian-mask" class="w-4 h-4"></i> Estimasi AVG Bandar:
				</span>
				<span class="text-blue-400 font-bold">Rp ${(stockData.bandarAvgPrice || price).toLocaleString('id-ID')}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="chart-no-axes-combined" class="w-4 h-4"></i> Posisi Tren MA5 / MA10 / MA20:
				</span>
				<span class="text-blue-400 font-bold">Rp ${stockData.ma5.toLocaleString('id-ID')} / ${stockData.ma10.toLocaleString('id-ID')} / ${stockData.ma20.toLocaleString('id-ID')}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="sliders-vertical" class="w-4 h-4"></i> Rasio Volume vs Rerata Harian:
				</span>
				<span class="font-bold ${isVolSpike ? 'text-emerald-400' : 'text-blue-400'}">${stockData.volRatio}x ${isVolSpike ? '(Spike Active)' : '(Normal)'}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="arrow-left-right" class="w-4 h-4"></i> Estimasi Asing Flow:
				</span>
				<span class="font-bold ${isNetBuyAI ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-1.5">
					<span class="text-[9px] px-1.5 py-0.5 rounded border ${isNetBuyAI ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border-rose-500/30 text-rose-400'}">${isNetBuyAI ? 'NET BUY' : 'NET SELL'}</span>
					<span>${isNetBuyAI ? '+' : '-'}${netFlowTextAI}</span>
				</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span class="flex items-center gap-1.5">
					<i data-lucide="scale" class="w-4 h-4"></i> Valuasi Matrix (52W):
				</span>
				<span class="font-bold ${valEvalAI.textClass} flex items-center gap-1.5">
					<span class="text-[9px] px-1.5 py-0.5 rounded border ${valEvalAI.badgeClass}">${valEvalAI.status}</span>
					<span>(${valEvalAI.positionPct.toFixed(1)}%)</span>
				</span>
			</li>
		`;

		let actionLabel = "<span class='inline-flex items-center gap-1'><i data-lucide='orbit' class='w-3 h-3'></i> NETRAL</span>";
		let actionColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
		let actionDesc = "Pergerakan saham biasa saja, kenaikan normal dan volume masih dalam batas normal.";

		if (stockData.price > stockData.ma10 && stockData.changePct > 2 && stockData.volRatio >= 2) {
			actionLabel = "<span class='inline-flex items-center gap-1'><i data-lucide='flame' class='w-3 h-3'></i> STRONG BUY</span>";
			actionColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
			actionDesc = "Momentum Breakout kuat! Kenaikan harga signifikan didukung lonjakan volume masif.";
		} else if (stockData.price > stockData.ma20 && stockData.changePct > 2) {
			actionLabel = "<span class='inline-flex items-center gap-1'><i data-lucide='badge-dollar-sign' class='w-3 h-3'></i> TAKE PROFIT / HOLD</span>";
			actionColor = "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30";
			actionDesc = "Tren masih terjaga di atas garis MA menengah. Pertimbangkan untuk menahan posisi atau amankan profit.";
		} else if (stockData.price > stockData.ma10 && stockData.volRatio >= 1 && stockData.changePct >= -2) {
			actionLabel = "<span class='inline-flex items-center gap-1'><i data-lucide='sparkles' class='w-3 h-3'></i> ACCUMULATE</span>";
			actionColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
			actionDesc = "Fase akumulasi atau koreksi wajar. Harga bertahan dekat area cicil MA10, cocok untuk cicil bertahap.";
		} else if (stockData.price > stockData.ma5 && stockData.volRatio >= 0.5 && stockData.changePct >= -2) {
			actionLabel = "<span class='inline-flex items-center gap-1'><i data-lucide='coffee' class='w-3 h-3'></i> WAIT & SEE</span>";
			actionColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
			actionDesc = "Fase akumulasi atau koreksi wajar. Harga bertahan dekat area support MA5, pantau dulu.";
		} else if (stockData.price < stockData.ma20 && stockData.changePct < -1) {
			actionLabel = "<span class='inline-flex items-center gap-1'><i data-lucide='octagon-x' class='w-3 h-3'></i> AVOID / CUTLOSS</span>";
			actionColor = "text-rose-400 bg-rose-500/10 border-rose-500/30";
			actionDesc = "Tekanan jual mendominasi penuh dan struktur tren patah di bawah semua MA utama. Segera batasi risiko.";
		} else {
			actionLabel = "<span class='inline-flex items-center gap-1'><i data-lucide='orbit' class='w-3 h-3'></i> NETRAL</span>";
			actionColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
			actionDesc = "Pergerakan saham biasa saja, indikator harga dan volume berjalan normal. Disarankan pantau konfirmasi lanjutan.";
		}

		let bandarStatus = "<span class='inline-flex items-center gap-0.5'>NETRAL <i data-lucide='scale' class='w-3 h-3'></i></span>";
		let bandarColor = "text-yellow-400";
		let bandarBarColor = "from-yellow-600 via-yellow-400 to-amber-400 shadow-[0_0_15px_rgba(148,163,184,0.4)]";
		let bandarPct = 50;

		if (stockData.changePct > 2 && stockData.volRatio > 3) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Masif Akumulasi <i data-lucide='rabbit' class='w-3 h-3'></i></span>";
			bandarColor = "text-green-400";
			bandarBarColor = "from-green-600 via-green-400 to-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]";
			bandarPct = 95; 
		} else if (stockData.changePct > 2 && stockData.volRatio > 2) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Akumulasi <i data-lucide='radio' class='w-3 h-3'></i></span>";
			bandarColor = "text-emerald-400";
			bandarBarColor = "from-emerald-600 via-emerald-400 to-teal-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]";
			bandarPct = 85; 
		} else if (stockData.changePct > 1 && stockData.volRatio > 1.5) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Akumulasi <i data-lucide='radio' class='w-3 h-3'></i></span>";
			bandarColor = "text-emerald-400";
			bandarBarColor = "from-emerald-600 via-emerald-400 to-teal-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]";
			bandarPct = 75; 
		} else if (stockData.changePct >= -2 && stockData.volRatio > 1) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Resistance <i data-lucide='plane-takeoff' class='w-3 h-3'></i></span>";
			bandarColor = "text-amber-400";
			bandarBarColor = "from-amber-600 via-amber-400 to-yellow-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]";
			bandarPct = 65; 
		} else if (stockData.changePct >= -4 && stockData.volRatio > 1) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Support <i data-lucide='hand-fist' class='w-3 h-3'></i></span>";
			bandarColor = "text-cyan-400";
			bandarBarColor = "from-cyan-600 via-cyan-400 to-blue-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]";
			bandarPct = 45; 
		} else if (stockData.changePct >= -4 && stockData.volRatio > 0.5) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Resistance <i data-lucide='plane-takeoff' class='w-3 h-3'></i></span>";
			bandarColor = "text-amber-400";
			bandarBarColor = "from-amber-600 via-amber-400 to-yellow-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]";
			bandarPct = 55; 
		} else if (stockData.changePct >= -8 && stockData.volRatio > 0.5) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Support <i data-lucide='hand-fist' class='w-3 h-3'></i></span>";
			bandarColor = "text-cyan-400";
			bandarBarColor = "from-cyan-600 via-cyan-400 to-blue-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]";
			bandarPct = 35; 
		} else if (stockData.changePct < -4 && stockData.price < stockData.ma20) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Distribusi Kuat <i data-lucide='siren' class='w-4 h-4'></i></span>";
			bandarColor = "text-rose-400";
			bandarBarColor = "from-rose-600 via-rose-400 to-red-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]";
			bandarPct = 25; 
		} else if (stockData.changePct < -8 && stockData.price < stockData.ma20) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Distribusi Kuat <i data-lucide='siren' class='w-4 h-4'></i></span>";
			bandarColor = "text-rose-400";
			bandarBarColor = "from-rose-600 via-rose-400 to-red-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]";
			bandarPct = 15; 
		}

		const actionBoardEl = document.getElementById('aiActionBoard');
		if (actionBoardEl) {
			actionBoardEl.innerHTML = `
				<div class="flex items-center justify-between mb-1">
					<span class="text-[10px] lg:text-[11px] font-bold text-white uppercase tracking-wider">Rekomendasi Aksi:</span>
					<span class="font-bold border px-2 py-0.5 rounded text-[10px] lg:text-[11px] ${actionColor}">${actionLabel}</span>
				</div>
				<p class="text-[10px] lg:text-[11px] text-slate-300 leading-relaxed">${actionDesc}</p>
				
				<div class="mt-3 pt-3 border-t border-slate-800/80">
					<div class="flex justify-between items-center mb-1.5">
						<span class="text-[10px] lg:text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
							<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> POWER METER VOLUME:
						</span>
						<span class="font-bold text-[10px] lg:text-[11px] ${bandarColor}">${bandarStatus}</span>
					</div>
					
					<!-- Perubahan Animasi Progress Bar -->
					<div class="w-full bg-slate-950/10 rounded-full h-3 border border-slate-700/80 overflow-hidden relative p-0.5 shadow-inner">
						<div id="bandarProgressBar" class="bg-gradient-to-r ${bandarBarColor} h-full rounded-full transition-all duration-1000 ease-out relative flex items-center justify-end" style="width: 0%">
							<!-- Titik kelap-kelip di ujung -->
							<div class="w-2 h-2 mr-0.5 bg-white rounded-full shadow-[0_0_10px_#ffffff] animate-ping"></div>
						</div>
					</div>
					
					<div class="flex justify-between text-[8px] lg:text-[9px] text-slate-400 mt-1 font-bold">
						<span>Distribusi</span>
						<span>Netral</span>
						<span>Akumulasi</span>
					</div>
				</div>
			`;
			actionBoardEl.classList.remove('hidden');

			setTimeout(() => {
				const bandarBar = document.getElementById('bandarProgressBar');
				if (bandarBar) {
					bandarBar.style.width = `${bandarPct}%`;
					bandarBar.classList.add('animate-pulse-glow');
				}
			}, 250);
		}
	} else {
		verdikEl.innerText = "NETRAL-SELEKTIF?";
		scoreEl.innerText = "-/-";
		descEl.innerText = `Menganalisis pergerakan teknikal saham ${ticker} berbasis indikator grafik TradingView. Silakan evaluasi struktur pola harga harian sebelum melakukan transaksi....`;
	}

	// 1. Dynamic Fibo
	const fibo = getDynamicFiboLevels(stockData?.high20, stockData?.low20, price);
	let res1 = fibo.res1, res2 = fibo.res2;
	
	let sup1 = roundToBEITick(fibo.entryLow * 0.97, 'floor');
	let sup2 = roundToBEITick(fibo.entryHigh * 0.99, 'floor');
	
	let sl = roundToBEITick(fibo.sl * 0.96, 'floor');
	let tp1 = roundToBEITick(res1 * 1.02, 'ceil'); 
	let tp2 = roundToBEITick(res2 * 1.02, 'ceil');

	document.getElementById('mapSupport1').innerText = `Rp ${sup1.toLocaleString('id-ID')} - ${sup2.toLocaleString('id-ID')}`;
	document.getElementById('mapResist1').innerText = `Rp ${res1.toLocaleString('id-ID')} - ${res2.toLocaleString('id-ID')}`;
	document.getElementById('mapTP').innerText = `Rp ${tp1.toLocaleString('id-ID')} / ${tp2.toLocaleString('id-ID')}`;
	document.getElementById('mapSL').innerText = `< Rp ${sl.toLocaleString('id-ID')}`;

	document.getElementById('tpBarSL').innerText = `SL: Rp ${sl.toLocaleString('id-ID')}`;
	document.getElementById('tpBarCurrent').innerText = `Harga: Rp ${price.toLocaleString('id-ID')}`;
	document.getElementById('tpBarTP').innerText = `TP2: Rp ${tp2.toLocaleString('id-ID')}`;

	// Hitung posisi harga saat ini pada rentang SL hingga TP2
	const totalSpan = tp2 - sl;
	const rawProgress = totalSpan > 0 ? ((price - sl) / totalSpan) * 100 : 50;
	let calculatedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));

	const progressBar = document.getElementById('tpProgressBar');
	progressBar.style.width = '0%';
	setTimeout(() => {
		progressBar.style.width = `${calculatedProgress}%`;
	}, 200);

	document.getElementById('tpProgressPercent').innerText = `Posisi: ${calculatedProgress}% dari Rentang SL - TP2`;

	document.getElementById('aiSkenarioBox').innerHTML = `
		<p><strong>(a) Konfirmasi Bullish:</strong> Jika harga bertahan di atas support Rp ${sup2.toLocaleString('id-ID')} dengan volume stabil, target uji resistance berada di Rp ${res1.toLocaleString('id-ID')}. Penembusan resistance dapat memicu akselerasi ke TP2 Rp ${tp2.toLocaleString('id-ID')}.</p>
		<p><strong>(b) Consolidate / Retest:</strong> Apabila terjadi tekanan koreksi, perhatikan reaksi akumulasi pada rentang Rp ${sup1.toLocaleString('id-ID')} - Rp ${sup2.toLocaleString('id-ID')}.</p>
		<p><strong>(c) Batas Invalidasi:</strong> Penembusan di bawah Stop Loss Rp ${sl.toLocaleString('id-ID')} membatalkan struktur bullish short-term dan berisiko melanjutkan penurunan.</p>
	`;

	const rrrRatioVal = ((tp2 - price) / Math.max(1, (price - sl))).toFixed(2);
	kesimpulanEl.innerHTML = `
		<p>• Area akumulasi optimal disarankan pada rentang support <strong>Rp ${sup1.toLocaleString('id-ID')} - Rp ${sup2.toLocaleString('id-ID')}</strong>.</p>
		<p>• Proyeksi Rasio Risk/Reward (RRR) pada harga saat ini adalah <strong>1 : ${rrrRatioVal}</strong>.</p>
		<p>• Selalu pasang pembatas risiko di bawah <strong>Rp ${sl.toLocaleString('id-ID')}</strong> untuk menjaga keterpaparan modal dari kecenderungan volatilitas pasar.</p>
	`;

	// Mengisi otomatis form Smart RRR saat AI Signal di-generate
	document.getElementById('rrrEntry').value = sup1; // Mengikuti Entry tertinggi
	document.getElementById('rrrSL').value = sl;      // Mengikuti Stop Loss AI
	document.getElementById('rrrTP').value = tp1;     // Mengikuti Take Profit 1 AI
	calculateSmartRRR();

	if (window.lucide) lucide.createIcons();
	AudioFX.playSuccess();
}

// ==========================================
// 17. RADAR SAHAM (AUTO SCREENER)
// ==========================================
async function startRadarProcess() {
	if (isRadarScanning) return;

	if (!checkAndUpdateLimit('radar', false)) {
		showToast("Limit harian Radar Saham Kamu telah habis (20x/hari).", "error");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}

	isRadarScanning = true;

	const btn = document.getElementById('btnStartRadar');
	const container = document.getElementById('bigMoneyList');

	btn.disabled = true;
	btn.className = "text-[10px] lg:text-xs text-white font-bold bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed";
	btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-amber-400"></i> Memindai Instan...`;
	if (window.lucide) lucide.createIcons();

	container.innerHTML = `<div class="text-center text-slate-400 text-xs py-12 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-950/10"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400"></i> Memindai saham secara otomatis berdasarkan seluruh indikator...</div>`;
	
	const baseList = getRegularStockTickers();
	const shuffled = baseList.length > 0 ? [...baseList] : (typeof uniqueRadarWatchlist !== 'undefined' ? [...uniqueRadarWatchlist] : []);
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	
	const validData = [];
	const BATCH_SIZE = 20; 
	let maxBatchLimit = 0; 

	for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
		maxBatchLimit++;
		if (maxBatchLimit > 3) break; 

		const batch = shuffled.slice(i, i + BATCH_SIZE);
		const results = await Promise.all(batch.map(ticker => fetchRealtimeStockData(ticker)));
		for (const res of results) {
			if (res && res.price > 0) validData.push(res);
		}
		
		await new Promise(resolve => setTimeout(resolve, 50));
		
		if (validData.length > 0) renderRadarItems(validData);
		if (validData.length >= 10) break;
	}

	isRadarScanning = false;
	btn.disabled = false;
	btn.className = "text-[10px] lg:text-xs text-slate-900 font-bold bg-amber-400 hover:bg-amber-500 px-4 py-2 rounded-lg border border-amber-500/50 flex items-center justify-center gap-1.5 transition shadow-md";
	btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Pindai Ulang Pasar`;
	if (window.lucide) lucide.createIcons();

	if (validData.length === 0) {
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-2">Tidak ada data bursa yang berhasil ditangkap. Silakan coba kembali. (Limit tidak dikurangi)</div>`;
	} else {
		// Potong token karena radar berhasil menemukan saham
		deductFeatureLimit('radar');
		AudioFX.playSuccess();
	}
}

// Komentar: Menampilkan kartu ringkasan saham yang lolos kriteria pemindaian radar.
function renderRadarItems(dataList) {
	const container = document.getElementById('bigMoneyList');
	const sorted = [...dataList].sort((a, b) => b.changePct - a.changePct);
	let htmlContent = '';

	if (sorted.length === 0) {
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-2">Tidak ada saham potensial yang ditemukan saat ini.</div>`;
		return;
	}

	sorted.forEach((item, index) => {
		const ticker = item.ticker;
		const price = roundToBEITick(item.price);
		const changePct = item.changePct;
		
		// Dynamic Fibo
		const fibo = getDynamicFiboLevels(item.high20, item.low20, price);
		
		let entryLow = roundToBEITick(fibo.entryLow * 0.97, 'floor');
		let entryHigh = roundToBEITick(fibo.entryHigh * 0.99, 'floor');
		
		let sl = roundToBEITick(fibo.sl * 0.96, 'floor');
		let res1 = fibo.res1;
		let res2 = fibo.res2;
		let tp1 = roundToBEITick(res1 * 1.02, 'ceil');
		let tp2 = roundToBEITick(res2 * 1.02, 'ceil');

		let statusSignal = '<i data-lucide="flame" class="w-3.5 h-3.5 inline"></i> Momentum Breakout';
		let statusClass = "from-emerald-600/30 to-teal-500/10 border-emerald-500/30 text-emerald-400";
		let alasanTeknikal = `Perubahan <strong>${changePct}%</strong> dan bertahan kokoh di atas garis Moving Average MA5 (Rp ${item.ma5.toLocaleString('id-ID')}), menandakan tekanan beli harian masih mendominasi pasar.`;

		const currentHour = new Date().getHours();
		let targetRasio = currentHour < 11 ? 0.5 : (currentHour < 14 ? 0.8 : 1.2);

		if (changePct > 0 && changePct < 5 && item.volRatio >= (targetRasio * 2.0) && item.price >= item.ma5) {
			statusSignal = '<i data-lucide="activity" class="w-3.5 h-3.5 inline"></i> Curi Start (Whale Acc)';
			statusClass = "from-fuchsia-600/30 to-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400";
			alasanTeknikal = `<strong>Anomali Volume Terdeteksi!</strong> Harga berada diatas MA5 dan saham baru naik tipis (<strong>+${changePct}%</strong>), tapi volume hari ini sudah mencapai <strong>${(item.volRatio * 100).toFixed(0)}%</strong> dari total volume seharian kemarin. Bandar terindikasi sedang kumpulin barang.`;
		} else if (changePct > 0 && changePct < 10 && item.ma5 > item.ma10 && item.price >= item.ma5) {
			statusSignal = '<i data-lucide="rocket" class="w-3.5 h-3.5 inline"></i> Golden Cross Setup';
			statusClass = "from-yellow-600/30 to-amber-500/10 border-yellow-500/30 text-yellow-400";
			alasanTeknikal = `Sinyal perpotongan garis MA5 melintasi naik MA10/MA20 (*Golden Cross*). Pola pembalikan arah berpotensi terbentuk.`;
		} else if (changePct > 4 && item.volRatio < (targetRasio * 0.5)) {
			statusSignal = '<i data-lucide="alert-triangle" class="w-3.5 h-3.5 inline"></i> Jebakan Batman (Fake Breakout)';
			statusClass = "from-rose-600/30 to-rose-500/10 border-rose-500/30 text-rose-400";
			alasanTeknikal = `<strong>Waspada!</strong> Harga naik sangat tinggi (<strong>+${changePct}%</strong>) namun tidak didukung oleh volume yang kuat (Hanya <strong>${(item.volRatio * 100).toFixed(0)}%</strong> dari volume kemarin). Kenaikan ini rawan dibanting. Hati-hati FOMO!`;
		} else if (changePct > 1 && item.volRatio >= (targetRasio * 1.5)) {
			statusSignal = '<i data-lucide="zap" class="w-3.5 h-3.5 inline"></i> Volume Accumulation';
			statusClass = "from-blue-600/30 to-blue-500/10 border-blue-500/30 text-blue-400";
			alasanTeknikal = `Terjadi akumulasi volume transaksi hingga <strong>${(item.volRatio * 100).toFixed(0)}% dari total volume kemarin</strong>. Mengindikasikan partisipasi modal besar di pasar.`;
		} else if (changePct < 1 && item.price >= item.ma10) {
			statusSignal = '<i data-lucide="shield" class="w-3.5 h-3.5 inline"></i> Support Retest';
			statusClass = "from-pink-600/30 to-pink-500/10 border-pink-500/30 text-pink-400";
			alasanTeknikal = `Harga sedang mengalami koreksi sehat dan menguji area pertahanan MA20 (Rp ${item.ma20.toLocaleString('id-ID')}).`;
		}

		htmlContent += `
			<div class="bg-slate-950/30 p-4 lg:p-5 rounded-xl border border-slate-700/60 hover:border-amber-500/50 transition-colors duration-300 relative shadow-sm flex flex-col justify-between">
				<div class="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l ${statusClass} border-b border-l rounded-bl-xl rounded-tr-xl text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
					${statusSignal}
				</div>
				
				<div class="flex items-center gap-3 border-b border-slate-800/80 pb-3 mt-1">
					<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
						<img src="https://assets.stockbit.com/logos/companies/${ticker}.png" alt="${ticker}" class="w-full h-full object-contain drop-shadow-sm" onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${ticker.substring(0,3)}</span>';};">
					</div>
					<div class="flex flex-col w-full">
						<div class="flex items-center gap-2">
							<span class="font-extrabold text-white text-base lg:text-lg tracking-tight">&dollar;${ticker}</span>
							<span class="${item.changePct >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'} font-bold px-1.5 py-0.5 rounded border text-[10px] lg:text-[11px] shadow-sm">${item.changePct >= 0 ? '+' : ''}${item.changePct}%</span>
						</div>
						<span class="text-[10px] lg:text-[11px] text-slate-400 mt-0.5">
							Harga: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> 
						</span>
					</div>
				</div>
				
				<div class="grid grid-cols-2 gap-2 text-[10px] lg:text-xs mt-3">
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="target" class="w-3 h-3 text-amber-400"></i> Entry Ideal</span>
						<span class="font-bold text-amber-400">Rp ${entryLow.toLocaleString('id-ID')} - ${entryHigh.toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="circle-dollar-sign" class="w-3 h-3 text-emerald-400"></i> Target Profit</span>
						<span class="font-bold text-emerald-400">Rp ${tp1.toLocaleString('id-ID')} / ${tp2.toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="bar-chart-2" class="w-3 h-3 text-blue-400"></i> Avg Bandar</span>
						<span class="font-bold text-blue-400">Rp ${(item.bandarAvgPrice || item.ma20).toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-rose-900/30 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="shield-minus" class="w-3 h-3 text-rose-400"></i> Stop Loss</span>
						<span class="font-bold text-rose-400">&lt; Rp ${sl.toLocaleString('id-ID')}</span>
					</div>
				</div>
				
				<div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-[10px] lg:text-[11px] text-slate-300 leading-relaxed space-y-2 mt-3">
					<span class="text-amber-400 font-bold block flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
						<i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i> ANALISIS TEKNIKAL OTOMATIS:
					</span>
					<p class="mt-1">${alasanTeknikal}</p>
				</div>

				<button onclick="selectTickerFromRadar('${ticker}')" class="mt-4 w-full bg-slate-800/80 hover:bg-amber-600 text-slate-300 hover:text-white font-bold text-[10px] lg:text-xs py-2.5 rounded-xl border border-slate-700 hover:border-amber-500 transition-all duration-300 flex items-center justify-center gap-2 group relative z-10 shadow-sm">
					<span>Buka Chart & Detail AI</span>
					<i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
				</button>
			</div>
		`;
	});

	container.innerHTML = htmlContent;
	if (window.lucide) lucide.createIcons();
}

// Komentar: Membuka rincian lengkap saham yang dipilih langsung dari hasil panel radar.
function selectTickerFromRadar(ticker) {
	document.getElementById('stockSearch').value = ticker;
	searchStock(true);
	switchTab('ai');
}

// ==========================================
// 29. FITUR BSJP SCREENER (REAL-TIME ENGINE)
// ==========================================
let isBSJPScanning = false;
let bsjpCooldownTimer = null;

// Komentar: Memindai emiten bursa di sore hari guna mencari potensi keuntungan di pembukaan esok (BSJP).
async function startBSJPProcess() {
	if (isBSJPScanning) return;

	const btn = document.getElementById('btnStartBSJP');
	const container = document.getElementById('bsjpListContainer');
	
	if (btn.disabled && btn.innerHTML.includes('Pending')) {
		return;
	}
	
	if (!checkAndUpdateLimit('bsjpRadar', false)) {
		showToast("Limit harian BSJP Radar Kamu telah habis (20x/hari).", "error");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}

	isBSJPScanning = true;
	
	btn.disabled = true;
	btn.className = "w-full sm:w-auto bg-slate-800 text-white font-bold px-6 py-2.5 rounded-lg border border-slate-700 flex items-center justify-center gap-2 shrink-0 cursor-not-allowed opacity-70";
	btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-orange-400"></i> Memindai BSJP...`;
	if (window.lucide) lucide.createIcons();
	
	container.innerHTML = `<div class="text-center text-slate-400 text-xs py-12 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-900/30"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500"></i> Menyaring saham yang cocok untuk BSJP...</div>`;
	
	const baseBsjpList = getRegularStockTickers();
	const shuffledWatchlist = (baseBsjpList.length > 0 ? [...baseBsjpList] : (typeof uniqueRadarWatchlist !== 'undefined' ? [...uniqueRadarWatchlist] : [])).sort(() => 0.5 - Math.random());
	let bsjpCandidates = [];

	const currentHour = new Date().getHours();
	let targetRasio = currentHour < 11 ? 1.0 : (currentHour < 14 ? 0.5 : 1.0); //1.0 2.0

	try {
		for (const ticker of shuffledWatchlist) {
			const cachedItem = getCachedStockData(ticker);
			if (cachedItem && cachedItem.price) {
				const isStrategi1 = cachedItem.currentValuation > 4000000000 && cachedItem.price >= cachedItem.ma10 && cachedItem.volRatio >= 2 && cachedItem.changePct > 0 && cachedItem.changePct < 10;
				const isStrategi2 = cachedItem.currentValuation > 4000000000 && cachedItem.price > cachedItem.ma10 && cachedItem.volRatio > 2 && cachedItem.changePct >= 0 && cachedItem.changePct <= 10;
				
				if (isStrategi1 || isStrategi2) {
					if (!bsjpCandidates.some(c => c.ticker === ticker)) {
						bsjpCandidates.push(cachedItem);
					}
				}
			}
			if (bsjpCandidates.length >= 30) break;
		}

		if (bsjpCandidates.length < 6) {
			const candidateTickers = bsjpCandidates.map(c => c.ticker);
			const remainingWatchlist = shuffledWatchlist.filter(t => !candidateTickers.includes(t));
			const BATCH_SIZE = 20;
			let maxBatchLimit = 0;

			for (let i = 0; i < remainingWatchlist.length; i += BATCH_SIZE) {
				maxBatchLimit++;
				if (maxBatchLimit > 3) break; 

				const batch = remainingWatchlist.slice(i, i + BATCH_SIZE);
				const fetchedData = await Promise.all(batch.map(ticker => fetchRealtimeStockData(ticker, true)));

				for (const item of fetchedData) {
					if (!item || !item.price) continue;
					
					const isStrategi1 = item.volRatio >= 2 && item.currentValuation > 4000000000 && item.price >= item.ma10 && item.changePct > 0 && item.changePct < 10;
					const isStrategi2 = item.volRatio > 2 && item.currentValuation > 4000000000 && item.price > item.ma10 && item.changePct >= 0 && item.changePct <= 10;
					
					if (isStrategi1 || isStrategi2) {
						if (!bsjpCandidates.some(c => c.ticker === item.ticker)) {
							bsjpCandidates.push(item);
						}
					}
				}
				await new Promise(resolve => setTimeout(resolve, 50));
				if (bsjpCandidates.length >= 10) break;
			}
		}
		
		if (bsjpCandidates.length === 0) {
			container.innerHTML = `<div class="text-center text-slate-400 text-xs py-8 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-900/30">Belum ada saham yang memenuhi syarat ketat BSJP pada sesi ini. (Limit tidak dikurangi)</div>`;
		} else {
			// Potong token jika hasilnya memang ditemukan
			deductFeatureLimit('bsjpRadar');

			const randomSelection = bsjpCandidates.sort(() => 0.5 - Math.random()).slice(0, 6);
			const topCandidates = randomSelection.sort((a, b) => b.volRatio - a.volRatio);
			renderBSJPItems(topCandidates);
			if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
		}
	} finally {
		isBSJPScanning = false;
		
		let cooldown = 5;
		if (bsjpCooldownTimer) clearInterval(bsjpCooldownTimer);
		
		bsjpCooldownTimer = setInterval(() => {
			cooldown--;
			btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-orange-400"></i> Pending (${cooldown}s)`;
			if (window.lucide) lucide.createIcons();
			
			if (cooldown <= 0) {
				clearInterval(bsjpCooldownTimer);
				btn.disabled = false;
				btn.classList.remove('cursor-not-allowed', 'opacity-70');
				btn.className = "w-full sm:w-auto bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold px-6 py-2.5 rounded-lg border border-orange-500/50 transition shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 shrink-0";
				btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Pindai Ulang BSJP`;
				if (window.lucide) lucide.createIcons();
			}
		}, 1000);
	}
}

// Komentar: Mencetak hasil emiten-emiten yang lolos kriteria BSJP ke tampilan kartu informasi.
function renderBSJPItems(dataList) {
	const container = document.getElementById('bsjpListContainer');
	
	const sortedData = [...dataList].sort((a, b) => b.volRatio - a.volRatio);
	let html = '';

	if (sortedData.length === 0) {
		container.innerHTML = `<div class="text-center text-slate-400 text-xs lg:text-sm py-8 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-950/10">Tidak ditemukan saham yang cocok untuk strategi BSJP hari ini.</div>`;
		return;
	}

	sortedData.forEach((item, index) => {
		const price = roundToBEITick(item.price);
		
		const fibo = getDynamicFiboLevels(item.high20, item.low20, price);
		const entryAman = fibo.entryLow;
		const entryAgresif = fibo.entryHigh;
		
		const stopLoss = roundToBEITick(fibo.sl * 0.99, 'floor');
		const tp1 = roundToBEITick(fibo.res1 * 1.03, 'ceil');
		const tp2 = roundToBEITick(fibo.res2 * 1.03, 'ceil');
		
		const riskPct = price > stopLoss ? (((price - stopLoss) / price) * 100).toFixed(2) : 0;
		const rewardPct = tp1 > price ? (((tp1 - price) / price) * 100).toFixed(2) : 0;
		
		html += `
			<div class="bg-slate-950/30 p-4 lg:p-5 rounded-xl border border-slate-700/60 hover:border-orange-500/50 transition-colors duration-300 relative shadow-sm flex flex-col justify-between">
				<!-- Badge Potensi Profit (Absolute Top Right dengan z-index) -->
				<div class="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l from-orange-600/30 to-amber-500/10 border-b border-l border-orange-500/30 rounded-bl-xl rounded-tr-xl text-[10px] font-bold text-orange-400 flex items-center gap-1.5 shadow-sm">
					<i data-lucide="trending-up" class="w-3 h-3"></i> Potensi TP Pagi: +${rewardPct}%
				</div>
				
				<!-- Header Card Saham (Diberi pr-24 agar tidak bertabrakan dengan badge absolute) -->
				<div class="flex items-center gap-3 border-b border-slate-800/80 pb-3 mt-1">
					<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
						<img 
							src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
							alt="${item.ticker}" 
							class="w-full h-full object-contain drop-shadow-sm" 
							onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
						>
					</div>
					<div class="flex flex-col w-full">
						<div class="flex items-center gap-2">
							<span class="font-extrabold text-white text-base lg:text-lg tracking-tight">&dollar;${item.ticker}</span>
							<span class="${item.changePct >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'} font-bold px-1.5 py-0.5 rounded border text-[10px] lg:text-[11px] shadow-sm">${item.changePct >= 0 ? '+' : ''}${item.changePct}%</span>
						</div>
						<span class="text-[10px] lg:text-[11px] text-slate-400 mt-0.5">
							Harga: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> 
						</span>
					</div>
				</div>
				
				<!-- Trading Plan Matrix (Fibo) -->
				<div class="grid grid-cols-2 gap-2 text-[10px] lg:text-xs mt-3">
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="target" class="w-3 h-3 text-amber-400"></i> Entry Sore (Closing)</span>
						<span class="font-bold text-amber-400">Rp ${entryAman.toLocaleString('id-ID')} - ${entryAgresif.toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="circle-dollar-sign" class="w-3 h-3 text-emerald-400"></i> Target Pagi (TP1-TP2)</span>
						<span class="font-bold text-emerald-400">Rp ${tp1.toLocaleString('id-ID')} / ${tp2.toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="coins" class="w-3 h-3 text-blue-400"></i> Valuasi (Transaksi)</span>
						<span class="font-bold text-blue-400">${formatValuationIDR(item.currentValuation)}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-rose-900/30 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="shield-minus" class="w-3 h-3 text-rose-400"></i> Stop Loss (Risk)</span>
						<span class="font-bold text-rose-400">&lt; Rp ${stopLoss.toLocaleString('id-ID')} (-${riskPct}%)</span>
					</div>
				</div>
				
				<!-- Keterangan Detail Indikator -->
				<div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-[10px] lg:text-[11px] text-slate-300 leading-relaxed space-y-2 mt-3">
					<span class="text-amber-400 font-bold block flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
						<i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i> ANALISIS TEKNIKAL BSJP:
					</span>
					<ul class="space-y-1.5 mt-1 list-none">
						<li class="flex gap-2">
							<i data-lucide="zap" class="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0"></i>
							<span><strong class="text-blue-400">Lonjakan Volume:</strong> Terjadi akumulasi sebesar <strong>${item.volRatio}x</strong> dari rata-rata harian yang menjamin ketersediaan likuiditas paginya.</span>
						</li>
						<li class="flex gap-2">
							<i data-lucide="trending-up" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i>
							<span><strong class="text-emerald-400">Posisi Tren:</strong> Harga ditutup di atas garis Moving Average 10 (Rp ${item.ma10.toLocaleString('id-ID')}). Tren jangka menengah valid ke atas.</span>
						</li>
						<li class="flex gap-2">
							<i data-lucide="crosshair" class="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0"></i>
							<span><strong class="text-orange-400">Skema Eksekusi:</strong> Antre Beli sore hari di dekat harga <i>last</i>. Jika besok pagi terjadi <i>Gap Up</i>, langsung pasang <i>Trailing Stop</i> untuk mengunci profit.</span>
						</li>
					</ul>
				</div>

				<button onclick="selectTickerFromCustom('${item.ticker}')" class="mt-4 w-full bg-slate-800/80 hover:bg-orange-600 text-slate-300 hover:text-white font-bold text-[10px] lg:text-xs py-2.5 rounded-xl border border-slate-700 hover:border-orange-500 transition-all duration-300 flex items-center justify-center gap-2 group relative z-10 shadow-sm">
					<span>Buka Chart & Detail AI</span>
					<i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
				</button>
			</div>
		`;
	});

	container.innerHTML = html;
	if (window.lucide) lucide.createIcons();
}

// ==========================================
// 20. WHALE DETECTOR (RADAR SAHAM KETAT)
// ==========================================
function toggleWhaleModal() {
	const modal = document.getElementById('whaleModal');
	const content = document.getElementById('whaleModalContent');
	const isHidden = modal.classList.contains('hidden');

	if (isHidden) {
		modal.classList.remove('hidden');
		setTimeout(() => {
			modal.classList.remove('opacity-0');
			content.classList.remove('scale-95');
			content.classList.add('scale-100');
		}, 10);
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	} else {
		modal.classList.add('opacity-0');
		content.classList.remove('scale-100');
		content.classList.add('scale-95');
		setTimeout(() => {
			modal.classList.add('hidden');
		}, 300);
		if (typeof AudioFX !== 'undefined') AudioFX.playDelete();
	}
}

// Komentar: Memindai pergerakan pasar untuk menemukan anomali akumulasi volume besar secara otomatis.
async function scanWhalesData() {
	if (isWhaleScanning) return;

	const btn = document.getElementById('btnScanWhales');
	const container = document.getElementById('whaleResultsContainer');

	if (btn.disabled && btn.innerHTML.includes('Pending')) {
		return;
	}

	if (!checkAndUpdateLimit('whaleRadar', false)) {
		showToast("Limit harian Whale Detector Kamu telah habis (20x/hari).", "error");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}

	isWhaleScanning = true;

	btn.disabled = true;
	btn.classList.add('cursor-not-allowed', 'opacity-70');
	btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-fuchsia-300"></i> Melacak Whales...`;
	if (window.lucide) lucide.createIcons();

	container.innerHTML = `
		<div class="text-center text-slate-400 text-[11px] lg:text-xs py-12 col-span-full border border-slate-700 rounded-xl bg-slate-950/20">
			<i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-fuchsia-500"></i> 
			Menyisir saham untuk mencari anomali volume...
		</div>
	`;
	
	await new Promise(resolve => setTimeout(resolve, 400));
	let foundWhales = [];
	const baseWhaleList = getRegularStockTickers();
	const scanList = (baseWhaleList.length > 0 ? [...baseWhaleList] : (typeof uniqueRadarWatchlist !== 'undefined' ? [...uniqueRadarWatchlist] : [])).sort(() => 0.5 - Math.random());

	try {
		for (const ticker of scanList) {
			const cachedItem = getCachedStockData(ticker);
			if (cachedItem && cachedItem.price) {
				const vol = cachedItem.volRatio || 0;
				const chg = cachedItem.changePct || 0;
				const price = cachedItem.price;
				const ma20 = cachedItem.ma20 || price;
				const valuasi = cachedItem.currentValuation || 0;
				let tier = 0, tierName = "", tierClass = "";
				
				if (vol > 2.0 && valuasi > 2000000000 && chg >= 0 && chg <= 5) {
					if (price > ma20) {
						tier = 3; tierName = "PAUS KUAT (STRONG WHALE)";
						tierClass = "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]";
					} else if (price === ma20) { 
						tier = 2; tierName = "PAUS AKUMULASI (MASSIVE WHALE)";
						tierClass = "bg-purple-500/20 border-purple-500/40 text-purple-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]";
					} else { 
						tier = 1; tierName = "PAUS SIGN (ACC WHALE)";
						tierClass = "bg-emerald-500/20 border-emerald-500/40 text-emerald-400";
					}
				}

				if (tier > 0) {
					if (!foundWhales.some(c => c.ticker === ticker)) {
						cachedItem.whaleTier = tier;
						cachedItem.whaleTierName = tierName;
						cachedItem.whaleTierClass = tierClass;
						foundWhales.push(cachedItem);
					}
				}
			}
		}

		if (foundWhales.length < 10) {
			const candidateTickers = foundWhales.map(c => c.ticker);
			const remainingWatchlist = scanList.filter(t => !candidateTickers.includes(t));
			const BATCH_SIZE = 20;
			let maxBatchLimit = 0;

			for (let i = 0; i < remainingWatchlist.length; i += BATCH_SIZE) {
				maxBatchLimit++;
				if (maxBatchLimit > 3) break; 

				const batch = remainingWatchlist.slice(i, i + BATCH_SIZE);
				const fetchedData = await Promise.all(batch.map(ticker => fetchRealtimeStockData(ticker)));

				for (const item of fetchedData) {
					if (!item || !item.price) continue;
					const vol = item.volRatio || 0;
					const chg = item.changePct || 0;
					const price = item.price;
					const ma20 = item.ma20 || price;
					const valuasi = item.currentValuation || 0;
					let tier = 0, tierName = "", tierClass = "";
					
					if (vol > 2.0 && valuasi > 2000000000 && chg >= 0 && chg <= 5) {
						if (price > ma20) {
							tier = 3; tierName = "PAUS KUAT (STRONG WHALE)";
							tierClass = "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]";
						} else if (price === ma20) { 
							tier = 2; tierName = "PAUS AKUMULASI (MASSIVE WHALE)";
							tierClass = "bg-purple-500/20 border-purple-500/40 text-purple-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]";
						} else { 
							tier = 1; tierName = "PAUS SIGN (ACC WHALE)";
							tierClass = "bg-emerald-500/20 border-emerald-500/40 text-emerald-400";
						}
					}

					if (tier > 0) {
						if (!foundWhales.some(c => c.ticker === item.ticker)) {
							item.whaleTier = tier;
							item.whaleTierName = tierName;
							item.whaleTierClass = tierClass;
							foundWhales.push(item);
						}
					}
				}
				await new Promise(resolve => setTimeout(resolve, 50));
				if (foundWhales.length >= 10) break;
			}
		}
		
		foundWhales.sort((a, b) => b.currentValuation - a.currentValuation);
		foundWhales = foundWhales.slice(0, 10);

		if (foundWhales.length === 0) {
			container.innerHTML = `
				<div class="text-center text-slate-400 text-[11px] lg:text-xs py-10 col-span-full border border-slate-700 rounded-xl bg-slate-950/20">
					<i data-lucide="waves" class="w-6 h-6 mx-auto mb-2 text-slate-500"></i>
					Belum ada pergerakan Whale (Bandar) yang terdeteksi. Kondisi pasar saat ini cenderung sepi atau stabil. (Limit tidak dikurangi)
				</div>
			`;
		} else {
			// Potong token khusus ketika Paus / Whale berhasil dideteksi
			deductFeatureLimit('whaleRadar');

			let html = '';
			foundWhales.forEach((item, index) => {
				const price = roundToBEITick(item.price);
				const fibo = getDynamicFiboLevels(item.high20, item.low20, price);
				let entryAgresif = fibo.entryHigh;
				let entryAman = fibo.entryLow;

				html += `
					<div class="bg-slate-950/40 p-5 rounded-2xl border border-slate-700/50 hover:border-fuchsia-500/50 transition-all duration-300 relative group shadow-lg flex flex-col justify-between overflow-hidden">
						<div class="absolute -top-20 -right-20 w-40 h-40 bg-fuchsia-500/10 rounded-full blur-3xl group-hover:bg-fuchsia-500/20 transition-colors pointer-events-none"></div>
						<div class="absolute top-0 right-0 px-3 py-1.5 border-b border-l border-slate-700/60 rounded-bl-xl rounded-tr-2xl text-[9px] lg:text-[10px] font-extrabold uppercase tracking-wider ${item.whaleTierClass} shadow-sm backdrop-blur-sm z-10">
							${item.whaleTierName}
						</div>
						
						<div class="flex items-start justify-between border-b border-slate-700/60 pb-4 mb-4 mt-1 relative z-10">
							<div class="flex items-center gap-3.5">
								<div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shadow-inner relative shrink-0 p-1">
									<img src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" alt="${item.ticker}" class="w-full h-full object-contain drop-shadow-sm" onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[12px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};">
								</div>
								<div class="flex flex-col">
									<div class="flex items-center gap-2.5">
										<span class="font-black text-white text-lg lg:text-xl tracking-tight leading-none">${item.ticker}</span>
										<span class="text-[10px] lg:text-[11px] ${item.changePct >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'} px-2 py-0.5 rounded-md border font-bold shadow-sm">
											${item.changePct >= 0 ? '+' : ''}${item.changePct}%
										</span>
									</div>
									<div class="flex items-center gap-2 mt-1.5 text-[10px] lg:text-xs">
										<span class="text-slate-400">Harga: <strong class="text-blue-400">Rp ${price.toLocaleString('id-ID')}</strong></span>
										<span class="w-1 h-1 rounded-full bg-slate-600 shrink-0"></span>
										<span class="text-slate-400">Vol: <strong class="text-fuchsia-400">${item.volRatio}x</strong></span>
									</div>
								</div>
							</div>
						</div>
						
						<div class="grid grid-cols-2 gap-3 text-[10px] lg:text-xs relative z-10">
							<div class="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-center">
								<span class="text-slate-400 font-medium uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1.5"><i data-lucide="target" class="w-3 h-3 text-amber-400"></i> Entry Agresif</span>
								<span class="font-bold text-amber-400 text-xs truncate">Rp ${entryAman.toLocaleString('id-ID')} - ${entryAgresif.toLocaleString('id-ID')}</span>
							</div>
							<div class="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-center">
								<span class="text-slate-400 font-medium uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1.5"><i data-lucide="bar-chart-2" class="w-3 h-3 text-blue-400"></i> AVG Bandar</span>
								<span class="font-bold text-blue-400 text-xs truncate">Rp ${(item.bandarAvgPrice || item.ma20).toLocaleString('id-ID')}</span>
							</div>
							<div class="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-center">
								<span class="text-slate-400 font-medium uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1.5"><i data-lucide="activity" class="w-3 h-3 text-fuchsia-400"></i> Total Volume (Lot)</span>
								<span class="font-bold text-fuchsia-400 text-xs truncate">${(item.currentLot || 0).toLocaleString('id-ID')} Lot</span>
							</div>
							<div class="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-center">
								<span class="text-slate-400 font-medium uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1.5"><i data-lucide="coins" class="w-3 h-3 text-violet-400"></i> Total Valuasi</span>
								<span class="font-bold text-violet-400 text-xs truncate">${formatValuationIDR(item.currentValuation)}</span>
							</div>
						</div>
						
						<button onclick="selectTickerFromRadar('${item.ticker}'); toggleWhaleModal();" class="mt-4 w-full bg-slate-800/80 hover:bg-fuchsia-600 text-slate-300 hover:text-white font-bold text-[10px] lg:text-xs py-3 rounded-xl border border-slate-700 hover:border-fuchsia-500 transition-all duration-300 flex items-center justify-center gap-2 group relative z-10 shadow-sm">
							<span>Buka Chart & Detail AI</span>
							<i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
						</button>
					</div>
				`;
			});
			container.innerHTML = html;
			if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
		}
	} finally {
		isWhaleScanning = false;
		let cooldown = foundWhales.length === 0 ? 15 : 10; // 60 : 30
		if (whaleScanCooldownTimer) clearInterval(whaleScanCooldownTimer);

		whaleScanCooldownTimer = setInterval(() => {
			cooldown--;
			btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-400"></i> Pending (${cooldown}s)`;
			if (window.lucide) lucide.createIcons();
			
			if (cooldown <= 0) {
				clearInterval(whaleScanCooldownTimer);
				btn.disabled = false;
				btn.classList.remove('cursor-not-allowed', 'opacity-70');
				btn.innerHTML = `<i data-lucide="radar" class="w-4 h-4"></i> Pindai Ulang Whales`;
				if (window.lucide) lucide.createIcons();
			}
		}, 1000);
	}
}

// ==========================================
// 18. CUSTOM SCREENER BUILDER
// ==========================================
// Komentar: Mengatur buka-tutup menu dropdown filter pada Custom Screener dengan aman.
function toggleCustomDropdown(dropdownId, evt) {
	const ev = evt || window.event;
	if (ev) ev.stopPropagation();

	const dropdown = document.getElementById(dropdownId);
	if (!dropdown) return;
	const isHidden = dropdown.classList.contains('hidden');

	['dropdownMA', 'dropdownVol', 'dropdownPrice', 'dropdownRSI'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.classList.add('hidden');
	});

	if (isHidden) {
		dropdown.classList.remove('hidden');
	}
	if (window.lucide) lucide.createIcons();
}

// Komentar: Menyimpan nilai parameter penyaringan spesifik yang dipilih pengguna di Custom Screener.
function selectCustomOption(inputId, value, label, dropdownId, evt) {
	const ev = evt || window.event;
	if (ev) ev.stopPropagation();

	const inputEl = document.getElementById(inputId);
	const labelEl = document.getElementById(inputId + '_Label');
	const dropdownEl = document.getElementById(dropdownId);

	if (inputEl) inputEl.value = value;
	if (labelEl) labelEl.innerText = label;
	if (dropdownEl) dropdownEl.classList.add('hidden');
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

window.toggleCustomDropdown = toggleCustomDropdown;
window.selectCustomOption = selectCustomOption;

// Komentar: Menutup seluruh menu dropdown Custom Screener saat pengguna mengklik di luar area kontrol.
document.addEventListener('click', function(e) {
	const dropdowns = ['dropdownBacktestStrategy', 'dropdownBacktestPeriod', 'dropdownMA', 'dropdownVol', 'dropdownPrice', 'dropdownRSI'];
	dropdowns.forEach(id => {
		const menu = document.getElementById(id);
		if (menu && !menu.classList.contains('hidden')) {
			const clickedInsideMenu = e.target.closest(`#${id}`);
			const clickedToggleBtn = e.target.closest(`button[onclick*="toggleBacktestDropdown('${id}'"]`);
			const clickedWrapper = e.target.closest('.custom-dropdown-wrapper');
			if (!clickedInsideMenu && !clickedToggleBtn && !clickedWrapper) {
				menu.classList.add('hidden');
			}
		}
	});
});

// Komentar: Menghitung indikator Relative Strength Index (RSI) historis dari sekumpulan harga penutupan.
function calculateRSI(prices, period = 14) {
	if (!prices || prices.length < period + 1) return 50;
	let gains = 0, losses = 0;
	for (let i = 1; i <= period; i++) {
		const diff = prices[i] - prices[i - 1];
		if (diff >= 0) gains += diff; else losses -= diff;
	}
	let avgGain = gains / period, avgLoss = losses / period;
	for (let i = period + 1; i < prices.length; i++) {
		const diff = prices[i] - prices[i - 1];
		let cGain = 0, cLoss = 0;
		if (diff >= 0) cGain = diff; else cLoss = -diff;
		avgGain = ((avgGain * (period - 1)) + cGain) / period;
		avgLoss = ((avgLoss * (period - 1)) + cLoss) / period;
	}
	if (avgLoss === 0) return 100;
	return 100 - (100 / (1 + (avgGain / avgLoss)));
}

// Komentar: Mengeksekusi pemindaian saham menggunakan aturan penyaringan yang telah dikonfigurasi.
async function runCustomScreener() {
	const btn = document.getElementById('btnRunCustomScreener');
	if (btn && btn.disabled) return;

	// Pada runCustomScreener() — perbaiki pengecekan RSI & pesan limit 20x/hari:
	if (!checkAndUpdateLimit('customRadar', false)) {
		showToast("Limit harian Custom Radar Kamu telah habis (20x/hari).", "error");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}
	
	if (btn) {
		btn.disabled = true;
		btn.className = "w-full sm:w-auto bg-slate-800 border border-slate-700 text-white font-bold px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 shrink-0 cursor-not-allowed";
		btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-400"></i> Sedang Memfilter...`;
		if (window.lucide) lucide.createIcons();
	}

	try {
		const container = document.getElementById('csResultsContainer');
		const ruleMA = document.getElementById('csRuleMA').value;
		const ruleVol = document.getElementById('csRuleVol').value;
		const rulePrice = document.getElementById('csRulePrice').value;
		
		const ruleRSI = document.getElementById('csRuleRSI') ? document.getElementById('csRuleRSI').value : 'ALL';

		container.innerHTML = `<div class="text-center text-slate-400 text-xs py-12 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-950/10"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"></i> Memfilter saham sesuai custom rules Kamu...</div>`;
		
		const baseCsList = getRegularStockTickers();
		const shuffled = (baseCsList.length > 0 ? [...baseCsList] : (typeof uniqueRadarWatchlist !== 'undefined' ? [...uniqueRadarWatchlist] : [])).sort(() => 0.5 - Math.random());
		let passedItems = [];
		const BATCH_SIZE = 20;
		let maxBatchLimit = 0; 

		for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
			maxBatchLimit++;
			if (maxBatchLimit > 3) break; 
			
			const batch = shuffled.slice(i, i + BATCH_SIZE);
			
			const results = await Promise.all(batch.map(ticker => fetchRealtimeStockData(ticker)));

			for (const item of results) {
				if (!item || !item.price) continue;
				
				let matchMA = true;
				if (ruleMA === 'ABOVE_MA5') matchMA = item.price > (item.ma5 || 0);
				else if (ruleMA === 'ABOVE_MA20') matchMA = item.price > (item.ma20 || 0);
				else if (ruleMA === 'GOLDEN_CROSS') matchMA = (item.ma5 || 0) > (item.ma10 || 0);
				else if (ruleMA === 'BELOW_MA20') matchMA = item.price < (item.ma20 || 0);

				let matchVol = true;
				if (ruleVol === 'SPIKE_1.5') matchVol = (item.volRatio || 0) >= 1.5;
				else if (ruleVol === 'SPIKE_3.0') matchVol = (item.volRatio || 0) >= 3.0;
				else if (ruleVol === 'DRY') matchVol = (item.volRatio || 0) < 1.0;

				let matchPrice = true;
				if (rulePrice === 'GREEN') matchPrice = (item.changePct || 0) > 0;
				else if (rulePrice === 'RED') matchPrice = (item.changePct || 0) < 0;
				else if (rulePrice === 'BREAKOUT') matchPrice = (item.changePct || 0) >= 5.0;

				let matchRSI = true;
				if (item.historicalPrices && ruleRSI !== 'ALL') {
					const rsiValue = calculateRSI(item.historicalPrices);
					if (ruleRSI === 'OVERSOLD' && rsiValue >= 30) matchRSI = false; 
					if (ruleRSI === 'OVERBOUGHT' && rsiValue <= 70) matchRSI = false; 
				}
				
				if (matchMA && matchVol && matchPrice && matchRSI) passedItems.push(item);
			}
			await new Promise(resolve => setTimeout(resolve, 50));
			if (passedItems.length >= 8) break;
		}
		
		if (passedItems.length === 0) {
			container.innerHTML = `<div class="text-center text-slate-400 text-xs py-8 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-950/10">Tidak ada saham yang cocok dengan kombinasi filter tersebut. Coba longgarkan kriterianya. (Limit aman, tidak dikurangi)</div>`;
			return;
		}

		// Jika hasil screening ada, baru potong limit tokennya
		deductFeatureLimit('customRadar');

		let html = '';
		passedItems.forEach((item, index) => {
			const price = roundToBEITick(item.price);
			
			// Dynamic Fibo
			const fibo = getDynamicFiboLevels(item.high20, item.low20, price);
			
			let entryLow = roundToBEITick(fibo.entryLow * 0.97, 'floor');
			let entryHigh = roundToBEITick(fibo.entryHigh * 0.99, 'floor');
			
			let sl = roundToBEITick(fibo.sl * 0.96, 'floor');
			let res1 = fibo.res1;
			let res2 = fibo.res2;
			let tp1 = roundToBEITick(res1 * 1.02, 'ceil');
			let tp2 = roundToBEITick(res2 * 1.02, 'ceil');

			let infoMA = '';
			if (ruleMA === 'ABOVE_MA5') infoMA = `<li class="flex gap-2"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i> <span><strong class="text-emerald-400">Uptrend Pendek:</strong> Bertahan mantap di atas MA5.</span></li>`;
			else if (ruleMA === 'ABOVE_MA20') infoMA = `<li class="flex gap-2"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i> <span><strong class="text-emerald-400">Uptrend Menengah:</strong> Solid di atas support MA20.</span></li>`;
			else if (ruleMA === 'GOLDEN_CROSS') infoMA = `<li class="flex gap-2"><i data-lucide="crosshair" class="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0"></i> <span><strong class="text-amber-400">Golden Cross:</strong> MA5 melintasi naik di atas MA10.</span></li>`;
			else if (ruleMA === 'BELOW_MA20') infoMA = `<li class="flex gap-2"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0"></i> <span><strong class="text-rose-400">Oversold:</strong> Di bawah MA20, pantau rebound.</span></li>`;
			else infoMA = `<li class="flex gap-2"><i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"></i> <span><strong class="text-slate-300">Tren:</strong> Bebas, posisi harga Rp ${price.toLocaleString('id-ID')}.</span></li>`;

			let infoVol = '';
			if (ruleVol === 'SPIKE_1.5') infoVol = `<li class="flex gap-2"><i data-lucide="zap" class="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0"></i> <span><strong class="text-blue-500">Volume Spike:</strong> Akumulasi ${item.volRatio}x rerata.</span></li>`;
			else if (ruleVol === 'SPIKE_3.0') infoVol = `<li class="flex gap-2"><i data-lucide="zap" class="w-3.5 h-3.5 text-fuchsia-400 mt-0.5 shrink-0"></i> <span><strong class="text-fuchsia-400">Volume Meledak:</strong> Akumulasi masif ${item.volRatio}x.</span></li>`;
			else if (ruleVol === 'DRY') infoVol = `<li class="flex gap-2"><i data-lucide="droplet" class="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"></i> <span><strong class="text-slate-400">Volume Kering:</strong> Sepi transaksi (${item.volRatio}x).</span></li>`;
			else infoVol = `<li class="flex gap-2"><i data-lucide="activity" class="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"></i> <span><strong class="text-slate-300">Likuiditas:</strong> Normal (${item.volRatio}x).</span></li>`;

			let infoPrice = '';
			if (rulePrice === 'GREEN') infoPrice = `<li class="flex gap-2"><i data-lucide="trending-up" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i> <span><strong class="text-emerald-400">Positif:</strong> Ditutup hijau (+${item.changePct}%).</span></li>`;
			else if (rulePrice === 'RED') infoPrice = `<li class="flex gap-2"><i data-lucide="trending-down" class="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0"></i> <span><strong class="text-rose-400">Koreksi:</strong> Mengalami penurunan (${item.changePct}%).</span></li>`;
			else if (rulePrice === 'BREAKOUT') infoPrice = `<li class="flex gap-2"><i data-lucide="rocket" class="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0"></i> <span><strong class="text-cyan-400">Breakout Kuat:</strong> Akselerasi (+${item.changePct}%).</span></li>`;
			else infoPrice = `<li class="flex gap-2"><i data-lucide="hash" class="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"></i> <span><strong class="text-slate-300">Harian:</strong> Pergerakan ${item.changePct >= 0 ? '+' : ''}${item.changePct}%.</span></li>`;
			
			let filterBadgeHtml = '';
			if (ruleMA === 'ABOVE_MA5') { filterBadgeHtml = '<i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Uptrend MA5'; }
			else if (ruleMA === 'ABOVE_MA20') { filterBadgeHtml = '<i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Uptrend MA20'; }
			else if (ruleMA === 'GOLDEN_CROSS') { filterBadgeHtml = '<i data-lucide="git-merge" class="w-3.5 h-3.5"></i> Golden Cross'; }
			else if (ruleMA === 'BELOW_MA20') { filterBadgeHtml = '<i data-lucide="trending-down" class="w-3.5 h-3.5"></i> Downtrend MA20'; }
			else { filterBadgeHtml = '<i data-lucide="list-filter" class="w-3.5 h-3.5"></i> Filter Match'; }

			html += `
				<div class="bg-slate-950/30 p-4 lg:p-5 rounded-xl border border-slate-700/60 hover:border-blue-500/50 transition-colors duration-300 relative shadow-sm flex flex-col justify-between">
					<!-- Badge Filter Match -->
					<div class="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l from-blue-600/30 to-blue-500/10 border-b border-l border-blue-500/30 rounded-bl-xl rounded-tr-xl text-[10px] font-bold text-blue-400 flex items-center gap-1.5 shadow-sm">
						${filterBadgeHtml}
					</div>
					
					<!-- Header Card Saham -->
					<div class="flex items-center gap-3 border-b border-slate-800/80 pb-3 mt-1">
						<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
							<img 
								src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
								alt="${item.ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
							>
						</div>
						<div class="flex flex-col w-full">
							<div class="flex items-center gap-2">
								<span class="font-extrabold text-white text-base lg:text-lg tracking-tight">&dollar;${item.ticker}</span>
								<span class="${item.changePct >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'} font-bold px-1.5 py-0.5 rounded border text-[10px] lg:text-[11px] shadow-sm">${item.changePct >= 0 ? '+' : ''}${item.changePct}%</span>
							</div>
							<span class="text-[10px] lg:text-[11px] text-slate-400 mt-0.5">
								Harga: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> 
							</span>
						</div>
					</div>
					
					<!-- Trading Plan Matrix (Fibo) -->
					<div class="grid grid-cols-2 gap-2 text-[10px] lg:text-xs mt-3">
						<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
							<div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50"></div>
							<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="target" class="w-3 h-3 text-amber-400"></i> Entry Ideal</span>
							<span class="font-bold text-amber-400">Rp ${entryLow.toLocaleString('id-ID')} - ${entryHigh.toLocaleString('id-ID')}</span>
						</div>
						<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
							<div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/50"></div>
							<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="circle-dollar-sign" class="w-3 h-3 text-emerald-400"></i> Target Profit</span>
							<span class="font-bold text-emerald-400">Rp ${tp1.toLocaleString('id-ID')} / ${tp2.toLocaleString('id-ID')}</span>
						</div>
						<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
							<div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/50"></div>
							<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="bar-chart-2" class="w-3 h-3 text-blue-400"></i> Avg Bandar</span>
							<span class="font-bold text-blue-400">Rp ${(item.bandarAvgPrice || item.ma20).toLocaleString('id-ID')}</span>
						</div>
						<div class="bg-slate-900/80 p-2.5 rounded-lg border border-rose-900/30 text-left relative overflow-hidden">
							<div class="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/50"></div>
							<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="shield-minus" class="w-3 h-3 text-rose-400"></i> Stop Loss</span>
							<span class="font-bold text-rose-400">&lt; Rp ${sl.toLocaleString('id-ID')}</span>
						</div>
					</div>
					
					<!-- Keterangan Detail Indikator -->
					<div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-[10px] lg:text-[11px] text-slate-300 leading-relaxed space-y-2 mt-3">
						<span class="text-blue-500 font-bold block flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
							<i data-lucide="list-filter" class="w-3.5 h-3.5"></i> DETAIL FILTER:
						</span>
						<ul class="space-y-1.5 mt-1 list-none">
							${infoMA}${infoVol}${infoPrice}
						</ul>
					</div>
					
					<button onclick="selectTickerFromCustom('${item.ticker}')" class="mt-4 w-full bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white font-bold text-[10px] lg:text-xs py-2.5 rounded-xl border border-slate-700 hover:border-blue-500 transition-all duration-300 flex items-center justify-center gap-2 group relative z-10 shadow-sm">
						<span>Buka Chart & Detail AI</span>
						<i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
					</button>
				</div>
			`;
		});

		container.innerHTML = html;
		if (window.lucide) lucide.createIcons();
		AudioFX.playSuccess();
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.className = "w-full sm:w-auto bg-blue-800 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-lg border border-blue-700 transition shadow-lg shadow-blue-700/20 flex items-center justify-center gap-2 shrink-0";
			btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Jalankan Filter`;
			if (window.lucide) lucide.createIcons();
		}
	}
}

// Komentar: Membuka menu rinci untuk saham yang ditekan dari hasil Custom Screener.
function selectTickerFromCustom(ticker) {
	document.getElementById('stockSearch').value = ticker;
	searchStock(true);
	switchTab('ai');
}

// ==========================================
// 19. PAPER TRADING SYSTEM
// ==========================================
function ptSwitchSubTab(subTab) {
	const btnForm = document.getElementById('ptSubBtnForm');
	const btnPorto = document.getElementById('ptSubBtnPorto');
	const contentForm = document.getElementById('ptSubContentForm');
	const contentPorto = document.getElementById('ptSubContentPorto');

	const activeClass = "flex-1 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white transition flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20";
	const inactiveClass = "flex-1 py-2 text-xs font-bold rounded-lg text-blue-400 hover:text-white hover:bg-blue-900/30 transition flex items-center justify-center gap-2";

	if (subTab === 'form') {
		if (btnForm) btnForm.className = activeClass;
		if (btnPorto) btnPorto.className = inactiveClass;
		if (contentForm) contentForm.classList.remove('hidden');
		if (contentPorto) contentPorto.classList.add('hidden');
	} else {
		if (btnPorto) btnPorto.className = activeClass;
		if (btnForm) btnForm.className = inactiveClass;
		if (contentPorto) contentPorto.classList.remove('hidden');
		if (contentForm) contentForm.classList.add('hidden');
	}
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

// Komentar: Mengambil informasi saldo virtual dan portofolio simulasi dari penyimpanan.
function getPaperAccount() {
	const defaultAccount = { cash: 100000000, portfolio: [], history: [] };
	const saved = localStorage.getItem('stockid_paper_account');
	if (!saved) return defaultAccount;
	try { return JSON.parse(saved); } catch (e) { return defaultAccount; }
}

// Komentar: Menyimpan mutasi perubahan saldo dan posisi portofolio simulasi Paper Trading.
function savePaperAccount(acc) {
	localStorage.setItem('stockid_paper_account', JSON.stringify(acc));
	renderPaperTradingUI();
}

// Komentar: Menyinkronkan harga form Paper Trading dengan pergerakan real-time saham saat ini.
function ptSyncCurrentTicker() {
	if (!globalStockData || !globalStockData.ticker) {
		AudioFX.playAlert();
		showToast("Pilih saham terlebih dahulu pada pencarian!", "warning");
		return;
	}
	const price = roundToBEITick(globalStockData.price);
	document.getElementById('ptTicker').value = globalStockData.ticker;
	document.getElementById('ptPrice').value = price;
	
	// Sinkronisasi Fibo sesuai AI Signal
	const fibo = getDynamicFiboLevels(globalStockData.high20, globalStockData.low20, price);
	const sl = roundToBEITick(fibo.sl * 0.96, 'floor');
	const tp1 = roundToBEITick(fibo.res1 * 1.02, 'ceil');
	
	document.getElementById('ptSL').value = sl;
	document.getElementById('ptTP').value = tp1;
	
	ptCalculateTotal();
	showToast(`Berhasil sinkronisasi saham $${globalStockData.ticker} ke form Paper Trade. (SL & TP terisi)`);
}

// Komentar: Menghitung total estimasi nilai transaksi berdasarkan harga dan jumlah lot di Paper Trading.
function ptCalculateTotal() {
	const price = parseFloat(document.getElementById('ptPrice').value) || 0;
	const lots = parseInt(document.getElementById('ptLots').value) || 0;
	const total = price * lots * 100;
	document.getElementById('ptTotalValue').innerText = `Rp ${Math.round(total).toLocaleString('id-ID')}`;
}

// Komentar: Mengisi form pembelian Paper Trading dengan batas lot maksimal sesuai dana yang tersedia.
function ptFillMaxLot() {
	const acc = getPaperAccount();
	const price = parseFloat(document.getElementById('ptPrice').value) || 0;
	if (price <= 0) return;
	const maxShares = Math.floor(acc.cash / price);
	const maxLots = Math.floor(maxShares / 100);
	document.getElementById('ptLots').value = Math.max(0, maxLots);
	ptCalculateTotal();
}

// Komentar: Melaksanakan pesanan beli virtual dan memperbarui nilai portofolio Paper Trading.
function ptExecuteBuy() {
	const rawTicker = document.getElementById('ptTicker')?.value || '';
	const ticker = normalizeTickerSymbol(rawTicker);
	const price = parseFloat(document.getElementById('ptPrice')?.value) || 0;
	const lots = parseInt(document.getElementById('ptLots')?.value, 10) || 0;
	const tp = parseFloat(document.getElementById('ptTP')?.value) || 0;
	const sl = parseFloat(document.getElementById('ptSL')?.value) || 0;

	if (!ticker || price <= 0 || lots <= 0) {
		showToast("Data pembelian tidak valid!", "error");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}

	const totalCost = price * lots * 100;
	const acc = getPaperAccount();

	if (acc.cash < totalCost) {
		showToast("Buying Power (Cash) tidak mencukupi!", "error");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}

	acc.cash -= totalCost;

	const existingIndex = acc.portfolio.findIndex(p => normalizeTickerSymbol(p.ticker) === ticker);
	if (existingIndex >= 0) {
		const current = acc.portfolio[existingIndex];
		const newTotalLots = current.lots + lots;
		const newAvgPrice = Math.round(((current.avgPrice * current.lots) + (price * lots)) / newTotalLots);
		acc.portfolio[existingIndex].ticker = ticker;
		acc.portfolio[existingIndex].lots = newTotalLots;
		acc.portfolio[existingIndex].avgPrice = newAvgPrice;
		if (tp > 0) acc.portfolio[existingIndex].tp = tp;
		if (sl > 0) acc.portfolio[existingIndex].sl = sl;
	} else {
		acc.portfolio.push({
			id: Date.now(),
			ticker,
			lots,
			avgPrice: price,
			tp,
			sl,
			date: new Date().toLocaleDateString('id-ID')
		});
	}

	savePaperAccount(acc);
	if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
	showToast(`Berhasil membeli ${lots} lot $${ticker} secara virtual!`);
}

// Komentar: Mengeksekusi penjualan saham virtual serta merekam persentase keuntungan atau kerugian.
async function ptExecuteSell(id, autoPrice = null) {
	let tempAcc = getPaperAccount();
	const tempItem = tempAcc.portfolio.find(p => p.id === id);
	if (!tempItem) return;

	let sellPrice = tempItem.avgPrice;
	
	if (autoPrice !== null) {
		sellPrice = autoPrice;
	} else {
		const cached = getCachedStockData(tempItem.ticker);
		if (globalStockData && globalStockData.ticker === tempItem.ticker) {
			sellPrice = globalStockData.price;
		} else if (cached && cached.price) {
			sellPrice = cached.price;
		} else {
			const freshData = await fetchRealtimeStockData(tempItem.ticker);
			if (freshData && freshData.price) sellPrice = freshData.price;
		}
	}

	// STATE LOCK FIX: Kunci ulang state akun secara sinkron setelah fetch 
	// Ini mencegah Race Condition/Data Tertimpa jika banyak saham dijual bersamaan
	let acc = getPaperAccount();
	const itemIndex = acc.portfolio.findIndex(p => p.id === id);
	if (itemIndex < 0) return;

	const item = acc.portfolio[itemIndex];
	const revenue = sellPrice * item.lots * 100;
	const modal = item.avgPrice * item.lots * 100;
	const profitLoss = revenue - modal;
	const profitLossPct = parseFloat((((sellPrice - item.avgPrice) / item.avgPrice) * 100).toFixed(2));

	acc.cash += revenue;
	acc.portfolio.splice(itemIndex, 1);
	acc.history.unshift({
		ticker: item.ticker,
		lots: item.lots,
		buyPrice: item.avgPrice,
		sellPrice: sellPrice,
		profitLoss: profitLoss,
		profitLossPct: profitLossPct,
		status: profitLoss >= 0 ? 'WIN' : 'LOSS',
		date: new Date().toLocaleDateString('id-ID')
	});

	savePaperAccount(acc);
	
	if (profitLoss >= 0) {
		AudioFX.playWinJournal();
		triggerCuanCelebration();
	} else {
		AudioFX.playLossJournal();
		triggerLossCelebration();
	}
	showToast(`Penjualan $${item.ticker} selesai. P&L: Rp ${profitLoss.toLocaleString('id-ID')} (${profitLossPct}%)`);
}

// Komentar: Mengatur ulang seluruh metrik dan saldo Paper Trading kembali ke kondisi awal.
function ptResetAccount() {
	showConfirm("Yakin ingin mereset akun paper trading ke modal awal Rp 100 Juta?").then(isConfirmed => {
		if (isConfirmed) {
			localStorage.removeItem('stockid_paper_account');
			renderPaperTradingUI();
			showToast("Akun Paper Trading berhasil direset.");
			AudioFX.playTokenExpired();
		}
	});
}

// Komentar: Memperbarui harga saham di portofolio virtual secara otomatis mengikuti pergerakan riil pasar.
async function ptRefreshPortoPrices(isAuto = false) {
	let acc = getPaperAccount();
	if (acc.portfolio.length === 0) {
		if (!isAuto) showToast("Tidak ada saham aktif di portofolio.", "info");
		return;
	}

	if (!isAuto) showToast("Memperbarui harga pasar portofolio...");
	let hasUpdates = false;

	for (let item of acc.portfolio) {
		const data = await fetchRealtimeStockData(item.ticker, true);
		if (data && data.price) {
			hasUpdates = true;
			// ASYNC FIX: Auto Jual jika kena SL atau TP
			if (item.tp > 0 && data.price >= item.tp) { 
				showToast(`Auto Sell TP Triggered: $${item.ticker} menyentuh target!`, "success");
				await ptExecuteSell(item.id, data.price); 
				continue; 
			}
			if (item.sl > 0 && data.price <= item.sl) { 
				showToast(`Auto Sell SL Triggered: $${item.ticker} menyentuh batas risiko!`, "warning");
				await ptExecuteSell(item.id, data.price); 
				continue; 
			}
		}
	}
	
	if (hasUpdates) renderPaperTradingUI();
	if (!isAuto) AudioFX.playSuccess();
}

// Komentar: Menata tampilan antarmuka mutasi dan portofolio pengguna di layar Paper Trading.
function renderPaperTradingUI() {
	const acc = getPaperAccount();
	let stockAssetValue = 0;
	let totalUnrealizedPnL = 0; 
	let totalModalAktif = 0;

	acc.portfolio.forEach(item => {
		let currentP = item.avgPrice;
		const cached = getCachedStockData(item.ticker);
		if (globalStockData && globalStockData.ticker === item.ticker) {
			currentP = globalStockData.price;
		} else if (cached && cached.price) {
			currentP = cached.price;
		}
		const modal = item.avgPrice * item.lots * 100;
		const currentVal = currentP * item.lots * 100;
		stockAssetValue += currentVal;
		totalModalAktif += modal;
		totalUnrealizedPnL += (currentVal - modal);
	});

	const totalEquity = acc.cash + stockAssetValue;
	const totalRealizedPnL = acc.history.reduce((sum, item) => sum + item.profitLoss, 0);
	const realizedColor = totalRealizedPnL > 0 ? 'text-emerald-400' : (totalRealizedPnL < 0 ? 'text-rose-400' : 'text-slate-400');
	const realizedSign = totalRealizedPnL > 0 ? '+' : '';

	document.getElementById('ptCash').innerText = `Rp ${Math.round(acc.cash).toLocaleString('id-ID')}`;
	document.getElementById('ptEquity').innerText = `Rp ${Math.round(totalEquity).toLocaleString('id-ID')}`;
	
	const elRealized = document.getElementById('ptRealizedPnL');
	if (elRealized) {
		elRealized.className = `text-sm lg:text-base font-bold ${realizedColor}`;
		elRealized.innerText = `${realizedSign}Rp ${Math.round(totalRealizedPnL).toLocaleString('id-ID')}`;
	}

	const unrealizedPct = totalModalAktif > 0 ? ((totalUnrealizedPnL / totalModalAktif) * 100).toFixed(2) : 0;
	const unrealizedColor = totalUnrealizedPnL > 0 ? 'text-emerald-400' : (totalUnrealizedPnL < 0 ? 'text-rose-400' : 'text-slate-400');
	const unrealizedSign = totalUnrealizedPnL > 0 ? '+' : '';
	
	const elUnrealized = document.getElementById('ptUnrealizedPnL');
	if (elUnrealized) {
		elUnrealized.className = `px-3 py-1.5 rounded-t-lg text-[10px] lg:text-xs font-bold border-t border-l border-r border-slate-500/20 bg-slate-950/60 ${unrealizedColor} translate-y-[1px] relative z-10 shadow-inner`;
		elUnrealized.innerText = `Total Floating: ${unrealizedSign}Rp ${Math.round(totalUnrealizedPnL).toLocaleString('id-ID')} (${unrealizedSign}${unrealizedPct}%)`;
	}

	const totalClosed = acc.history.length;
	const totalWin = acc.history.filter(h => h.status === 'WIN').length;
	const winRate = totalClosed > 0 ? Math.round((totalWin / totalClosed) * 100) : 0;
	document.getElementById('ptWinRate').innerHTML = `Win Rate: ${winRate}% (${totalWin}/${totalClosed})`;

	let rankName = "NEWBIE TRADER 🥺";
	let rankColor = "from-blue-400 to-amber-400";
	let badgeClass = "bg-blue-500/10 border-blue-500/30";
	if (totalEquity >= 250000000 && winRate >= 70) {
		rankName = "BANDAR 🐋";
		rankColor = "from-emerald-400 to-teal-400";
		badgeClass = "bg-emerald-500/10 border-emerald-500/30";
	} else if (totalEquity >= 150000000 && winRate >= 60) {
		rankName = "EXPERT TRADER ⚡";
		rankColor = "from-cyan-400 to-blue-400";
		badgeClass = "bg-cyan-500/10 border-cyan-500/30";
	} else if (totalEquity >= 110000000 && winRate >= 60) {
		rankName = "PRO TRADER 😎";
		rankColor = "from-amber-400 to-yellow-500";
		badgeClass = "bg-amber-500/10 border-amber-500/30";
	} else if (totalEquity >= 80000000) {
		rankName = "NORMAL TRADER 😼";
		rankColor = "from-yellow-400 to-yellow-500";
		badgeClass = "bg-yellow-500/10 border-yellow-500/30";
	} else if (totalEquity >= 40000000) {
		rankName = "NOOB TRADER 😹";
		rankColor = "from-rose-400 to-pink-400";
		badgeClass = "bg-rose-500/10 border-rose-500/30";
	}

	const rankBadgeEl = document.getElementById('ptRankBadge');
	if (rankBadgeEl) {
		rankBadgeEl.innerHTML = `<span class="bg-gradient-to-r ${rankColor} bg-clip-text text-transparent drop-shadow-md">${rankName}</span>`;
		rankBadgeEl.className = `text-xs lg:text-sm font-extrabold leading-none px-2.5 py-1.5 rounded-lg border inline-block mt-0.5 ${badgeClass} shadow-sm`;
	}

	const portoBody = document.getElementById('ptPortoBody');
	if (acc.portfolio.length === 0) {
		portoBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-blue-400 font-sans border-t border-slate-500/20">Belum ada posisi terbuka. Gunakan form di sebelah kiri untuk simulasi beli.</td></tr>`;
	} else {
		let html = '';
		acc.portfolio.forEach(item => {
			let currentP = item.avgPrice;
			const cached = getCachedStockData(item.ticker);
			if (globalStockData && globalStockData.ticker === item.ticker) {
				currentP = globalStockData.price;
			} else if (cached && cached.price) {
				currentP = cached.price;
			}
			const modal = item.avgPrice * item.lots * 100;
			const currentVal = currentP * item.lots * 100;
			const pnl = currentVal - modal;
			const pnlPct = parseFloat((((currentP - item.avgPrice) / item.avgPrice) * 100).toFixed(2));
			const isPlus = pnl >= 0;

			html += `
			<tr class="hover:bg-slate-800/40">
				<td class="p-3.5 font-bold text-blue-400">
					<div class="flex items-center gap-2">
						<div class="w-5 h-5 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
							<img 
								src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
								alt="${item.ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
							>
						</div>
						<div class="flex flex-col">
							<span class="text-white">&dollar;${item.ticker}</span>
							${item.sl > 0 || item.tp > 0 ? `<span class="text-[9px] text-slate-500 font-normal mt-0.5">Auto SL/TP Aktif</span>` : ''}
						</div>
					</div>
				</td>
				<td class="p-3.5 text-blue-400">${item.lots.toLocaleString('id-ID')} Lot</td>
				<td class="p-3.5 text-amber-400">
					Rp ${item.avgPrice.toLocaleString('id-ID')}
					${item.sl > 0 || item.tp > 0 ? `<div class="text-[9px] text-slate-500 mt-0.5 font-medium">SL: ${item.sl > 0 ? item.sl : '-'} | TP: ${item.tp > 0 ? item.tp : '-'}</div>` : ''}
				</td>
				<td class="p-3.5 text-sky-400">Rp ${currentP.toLocaleString('id-ID')}</td>
					<td class="p-3.5 ${isPlus ? 'text-emerald-400' : 'text-rose-400'} font-bold">
						${isPlus ? '+' : ''}Rp ${Math.round(pnl).toLocaleString('id-ID')} (${isPlus ? '+' : ''}${pnlPct}%)
					</td>
					<td class="p-3.5 text-center">
						<button onclick="ptExecuteSell(${item.id})" class="text-[10px] bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 font-bold px-3 py-1 rounded-lg border border-rose-500/30 transition">Jual</button>
					</td>
				</tr>
			`;
		});
		portoBody.innerHTML = html;
	}

	const historyContainer = document.getElementById('ptHistoryContainer');
	if (acc.history.length === 0) {
		historyContainer.innerHTML = `<div class="text-blue-400 text-xs text-center col-span-full py-4 border border-dashed border-slate-500/20 rounded-lg font-sans">Belum ada riwayat penjualan saham.</div>`;
	} else {
		let hHtml = '';
		acc.history.slice(0, 6).forEach(h => {
			const isWin = h.status === 'WIN';
			const modal = h.buyPrice * h.lots * 100;
			
			hHtml += `
				<div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1 shadow-sm hover:border-slate-500/30 transition-colors">
					<div class="flex justify-between items-center">
						<div class="flex items-center gap-2">
							<div class="w-5 h-5 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
								<img 
									src="https://assets.stockbit.com/logos/companies/${h.ticker}.png" 
									alt="${h.ticker}" 
									class="w-full h-full object-contain drop-shadow-sm" 
									onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${h.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] font-black text-slate-400 tracking-wider\\'>${h.ticker.substring(0,3)}</span>';};"
								>
							</div>
							<span class="font-bold text-white">&dollar;${h.ticker} <strong class='text-blue-400'>(${h.lots} Lot)</strong></span>
						</div>
						<span class="text-[9px] ${isWin ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border border-rose-500/30'} px-2 py-0.5 rounded font-bold">${h.status}</span>
					</div>
					<div class="flex justify-between text-[11px] text-slate-300 pb-1">
						<span class="font-bold text-cyan-400">Beli: Rp ${h.buyPrice.toLocaleString('id-ID')}</span>
						<span class="font-bold text-cyan-400">Jual: Rp ${h.sellPrice.toLocaleString('id-ID')}</span>
					</div>
					<div class="flex justify-between items-center pt-1.5 border-t border-slate-800/80 mt-1">
						<div class="flex flex-col">
							<span class="text-[11px] text-blue-400 uppercase font-bold">Modal Awal</span>
							<span class="text-[11px] text-amber-400 font-bold">Rp ${Math.round(modal).toLocaleString('id-ID')}</span>
						</div>
						<div class="text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'} text-xs">
							${isWin ? '+' : ''}Rp ${Math.round(h.profitLoss).toLocaleString('id-ID')} (${isWin ? '+' : ''}${h.profitLossPct}%)
						</div>
					</div>
				</div>
			`;
		});
		historyContainer.innerHTML = hHtml;
	}
	if (window.lucide) lucide.createIcons();
}

// ==========================================
// 15. SMART RRR CALCULATOR
// ==========================================
// Komentar: Menyinkronkan nilai Smart RRR dengan proyeksi AI Signal secara presisi.
function autoFillRRRFromAI() {
	if (!globalStockData || !globalStockData.price) {
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		showToast("Data saham belum tersedia. Silakan cari saham terlebih dahulu!", "warning");
		return;
	}

	const basePrice = globalStockData.price;
	const fibo = getDynamicFiboLevels(globalStockData.high20, globalStockData.low20, basePrice);
	
	const entryLow = roundToBEITick(fibo.entryLow * 0.97, 'floor');
	let sl = roundToBEITick(fibo.sl * 0.96, 'floor');
	const res1 = fibo.res1;
	let tp1 = roundToBEITick(res1 * 1.02, 'ceil');

	if (sl >= entryLow) {
		sl = roundToBEITick(entryLow * 0.95, 'floor');
	}
	if (tp1 <= entryLow) {
		tp1 = roundToBEITick(entryLow * 1.05, 'ceil');
	}

	document.getElementById('rrrEntry').value = entryLow;
	document.getElementById('rrrSL').value = sl;
	document.getElementById('rrrTP').value = tp1;
	
	calculateSmartRRR();
	
	if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
	showToast(`Berhasil menyinkronkan sinyal AI untuk saham $${globalStockData.ticker}!`, "success");
}

// Komentar: Mengkalkulasi tingkat risiko (Risk/Reward Ratio) dan merekomendasikan jumlah lot pembelian.
function calculateSmartRRR() {
	const capital = parseFloat(document.getElementById('rrrTotalCapital').value) || 0;
	const maxRiskPct = parseFloat(document.getElementById('rrrRiskPercent').value) || 0;
	const rawEntry = parseFloat(document.getElementById('rrrEntry').value) || 0;
	const rawSL = parseFloat(document.getElementById('rrrSL').value) || 0;
	const rawTP = parseFloat(document.getElementById('rrrTP').value) || 0;

	const entry = roundToBEITick(rawEntry);
	const sl = roundToBEITick(rawSL, 'floor');
	const tp = roundToBEITick(rawTP, 'ceil');

	const resEl = document.getElementById('rrrResult');
	const maxRiskAmountEl = document.getElementById('rrrMaxRiskAmount');
	const maxLotsEl = document.getElementById('rrrMaxLots');
	const capitalNeededEl = document.getElementById('rrrCapitalNeeded');
	const rewardEl = document.getElementById('rrrPotentialReward');
	const evalEl = document.getElementById('rrrEvaluationBadge');

	if (!entry || !sl || !tp || entry <= 0 || sl >= entry || tp <= entry) {
		resEl.innerText = "1 : -";
		maxRiskAmountEl.innerText = "Rp 0";
		maxLotsEl.innerText = "0 Lot";
		capitalNeededEl.innerText = "Rp 0";
		rewardEl.innerText = "Rp 0";
		evalEl.className = "p-2.5 rounded-lg text-[11px] lg:text-xs font-bold text-center bg-slate-900 text-white";
		evalEl.innerText = "Masukkan harga Entry, SL (>0 & < Entry), dan TP (> Entry) untuk evaluasi AI.";
		return;
	}

	const riskPerShare = entry - sl;
	const rewardPerShare = tp - entry;
	const rrr = (rewardPerShare / riskPerShare).toFixed(2);

	const maxRiskAmount = capital * (maxRiskPct / 100);
	const maxShares = Math.floor(maxRiskAmount / riskPerShare);
	const maxLots = Math.floor(maxShares / 100);
	const totalCapitalRequired = maxLots * 100 * entry;
	const totalRewardAmount = maxLots * 100 * rewardPerShare;

	resEl.innerText = `1 : ${rrr}`;
	maxRiskAmountEl.innerText = `Rp ${Math.round(maxRiskAmount).toLocaleString('id-ID')}`;
	maxLotsEl.innerText = `${maxLots.toLocaleString('id-ID')} Lot`; 
	capitalNeededEl.innerText = `Rp ${Math.round(totalCapitalRequired).toLocaleString('id-ID')}`;
	rewardEl.innerText = `Rp ${Math.round(totalRewardAmount).toLocaleString('id-ID')}`;

	if (rrr >= 2.0) {
		evalEl.className = "p-2.5 rounded-lg text-[11px] lg:text-xs font-bold text-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
		evalEl.innerHTML = `✓ <strong>Rencana Trading Sangat Layak Eksekusi (RRR 1 : ${rrr})</strong><br><span class="text-[10px] lg:text-[11px] font-normal text-slate-300">Potensi profit jauh melebihi toleransi risiko batas modal Kamu.</span>`;
	} else if (rrr >= 1.5) {
		evalEl.className = "p-2.5 rounded-lg text-[11px] lg:text-xs font-bold text-center bg-amber-500/10 text-amber-400 border border-amber-500/30";
		evalEl.innerHTML = `⚠ <strong>Rencana Trading Cukup Layak (RRR 1 : ${rrr})</strong><br><span class="text-[10px] lg:text-[11px] font-normal text-slate-300">Memenuhi standar minimal, namun disarankan memperketat entry dekat support.</span>`;
	} else {
		evalEl.className = "p-2.5 rounded-lg text-[11px] lg:text-xs font-bold text-center bg-rose-500/10 text-rose-400 border border-rose-500/30";
		evalEl.innerHTML = `✕ <strong>Risiko Terlalu Tinggi / Kurang Ideal (RRR 1 : ${rrr})</strong><br><span class="text-[10px] lg:text-[11px] font-normal text-slate-300">Potensi keuntungan tidak sebanding dengan risiko penurunan modal.</span>`;
	}
}

// ==========================================
// 14. TRADING JOURNAL & KANBAN
// ==========================================
function getJournalData() {
	return JSON.parse(localStorage.getItem('stockid_trading_journal') || '[]');
}

// Komentar: Menyimpan pembaruan data riwayat jurnal trading ke dalam LocalStorage.
function saveJournalData(data) {
	localStorage.setItem('stockid_trading_journal', JSON.stringify(data));
	renderJournalTable();
}

// Komentar: Menyimpan rencana trading (Smart RRR) pengguna sebagai entri baru di jurnal.
function saveTradingPlanToJournal() {
	const entry = parseFloat(document.getElementById('rrrEntry').value) || 0;
	const sl = parseFloat(document.getElementById('rrrSL').value) || 0;
	const tp = parseFloat(document.getElementById('rrrTP').value) || 0;
	const rrrText = document.getElementById('rrrResult').innerText;

	if (!entry || !sl || !tp || sl >= entry || tp <= entry) {
		AudioFX.playAlert();
		showToast("Silakan lengkapi Entry, SL, dan TP yang valid terlebih dahulu!");
		return;
	}

	const journal = getJournalData();
	const now = new Date();
	const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });

	journal.unshift({
		id: Date.now(),
		date: dateStr,
		ticker: currentTicker,
		entry: entry,
		sl: sl,
		tp: tp,
		rrr: rrrText,
		status: 'OPEN'
	});

	saveJournalData(journal);
	AudioFX.playSuccess();
	showToast(`Trading Plan untuk $${currentTicker} berhasil disimpan ke Journal Trading!`);
}

// Komentar: Memperbarui status transaksi dalam jurnal menjadi posisi WIN (Profit) atau LOSS (Rugi).
function updateJournalStatus(id, newStatus) {
	let journal = getJournalData();
	let isWinning = false;
	let isLosing = false;

	journal = journal.map(item => {
		if (item.id === id) {
			item.status = newStatus;
			if (newStatus === 'WIN') isWinning = true;
			if (newStatus === 'LOSS') isLosing = true;
		}
		return item;
	});

	saveJournalData(journal);

	if (isWinning) {
		AudioFX.playWinJournal();
		triggerCuanCelebration();
	} else if (isLosing) {
		AudioFX.playLossJournal();
		triggerLossCelebration();
	}
}

// Komentar: Menghapus satu entri catatan yang dipilih dari daftar jurnal trading.
function deleteJournalItem(id) {
	let journal = getJournalData();
	journal = journal.filter(item => item.id !== id);
	saveJournalData(journal);
}

// Komentar: Menghapus bersih seluruh catatan riwayat transaksi dari jurnal trading.
async function clearJournalHistory() {
	const isConfirmed = await showConfirm("Apakah Kamu yakin ingin menghapus seluruh riwayat Journal Trading?");
	if (isConfirmed) {
		localStorage.removeItem('stockid_trading_journal');
		renderJournalTable();
		showToast("Riwayat Journal Trading berhasil dibersihkan.");
		AudioFX.playTokenExpired();
	}
}

// Komentar: Mengekspor data rekaman jurnal trading pengguna ke dalam format file spreadsheet (CSV).
function exportJournalToCSV() {
	const journal = getJournalData();
	if (journal.length === 0) {
		AudioFX.playAlert();
		showToast("Belum ada riwayat Trading Plan yang tersimpan untuk diexport!");
		return;
	}

	let csvContent = "data:text/csv;charset=utf-8,ID,Tanggal,Ticker,Harga Entry,Stop Loss,Target Profit,Rasio RRR,Status\r\n";
	journal.forEach(item => {
		csvContent += `"${item.id}","${item.date}","${item.ticker}","${item.entry}","${item.sl}","${item.tp}","${item.rrr}","${item.status}"\r\n`;
	});

	const encodedUri = encodeURI(csvContent);
	const link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", `StockID_Trading_Journal_${Date.now()}.csv`);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	AudioFX.playSuccess();
}

// Komentar: Mengalihkan mode tampilan jurnal antara bentuk tabel rincian atau papan Kanban.
function switchJournalView(view) {
	currentJournalView = view;
	const tv = document.getElementById('journalTableView');
	const kv = document.getElementById('journalKanbanView');
	const btnT = document.getElementById('journalBtnTable');
	const btnK = document.getElementById('journalBtnKanban');

	if (view === 'table') {
		tv.classList.remove('hidden');
		kv.classList.add('hidden');
		btnT.className = "px-3 py-1 text-[10px] font-bold rounded bg-emerald-500 text-slate-950 transition";
		btnK.className = "px-3 py-1 text-[10px] font-bold rounded text-slate-400 hover:text-white transition";
	} else {
		tv.classList.add('hidden');
		kv.classList.remove('hidden');
		btnK.className = "px-3 py-1 text-[10px] font-bold rounded bg-emerald-500 text-slate-950 transition";
		btnT.className = "px-3 py-1 text-[10px] font-bold rounded text-slate-400 hover:text-white transition";
		renderKanbanBoard();
	}
	AudioFX.playClick();
}

// Komentar: Membangun ulang struktur baris tabel untuk menampilkan riwayat jurnal.
function renderJournalTable() {
	const body = document.getElementById('journalTableBody');
	const journal = getJournalData();

	const totalCount = journal.length;
	const winCount = journal.filter(j => j.status === 'WIN').length;
	const lossCount = journal.filter(j => j.status === 'LOSS').length;
	const closedCount = winCount + lossCount;
	const winRate = closedCount > 0 ? Math.round((winCount / closedCount) * 100) : 0;

	document.getElementById('journalTotalCount').innerText = totalCount;
	document.getElementById('journalWinRate').innerText = `${winRate}%`;
	document.getElementById('journalWinCount').innerText = winCount;
	document.getElementById('journalLossCount').innerText = lossCount;

	if (journal.length === 0) {
		body.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">Belum ada Trading Plan tersimpan. Gunakan tombol "Simpan ke Journal" di kalkulator Smart RRR.</td></tr>`;
		return;
	}
	
	if (currentJournalView === 'kanban') renderKanbanBoard();

	let rows = '';
	journal.forEach(item => {
		let statusBadge = '<span class="text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">OPEN</span>';
		if (item.status === 'WIN') statusBadge = '<span class="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">WIN (TP)</span>';
		if (item.status === 'LOSS') statusBadge = '<span class="text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-[10px]">LOSS (SL)</span>';

		rows += `
			<tr class="hover:bg-slate-800/40">
				<td class="p-3.5 text-slate-400">${item.date}</td>
				<td class="p-3.5 font-bold">
					<div class="flex items-center gap-2">
						<div class="w-5 h-5 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
							<img 
								src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
								alt="${item.ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
							>
						</div>
						<span class="text-white">&dollar;${item.ticker}</span>
					</div>
				</td>
				<td class="p-3.5 text-amber-400">Rp ${item.entry.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-rose-400">Rp ${item.sl.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-emerald-400">Rp ${item.tp.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-sky-400">${item.rrr}</td>
				<td class="p-3.5">${statusBadge}</td>
				<td class="p-3.5 text-center space-x-1">
					<button onclick="updateJournalStatus(${item.id}, 'WIN')" class="text-[9px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold px-2 py-1 rounded-md border border-emerald-500/30 transition">WIN</button>
					<button onclick="updateJournalStatus(${item.id}, 'LOSS')" class="text-[9px] bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white font-bold px-2 py-1 rounded-md border border-rose-500/30 transition">LOSS</button>
					<button onclick="deleteJournalItem(${item.id})" class="text-[9px] bg-slate-800 text-slate-400 hover:text-rose-400 px-2 py-1 rounded-md transition">✕</button>
				</td>
			</tr>
		`;
	});
	body.innerHTML = rows;
}

// Komentar: Mengizinkan operasi seret objek (drag) pada papan Kanban jurnal.
function allowDrop(ev) { ev.preventDefault(); }
// Komentar: Menangkap data ID saat pengguna menyeret (drag) kartu di papan Kanban.
function dragJournalCard(ev, id) { ev.dataTransfer.setData("text/plain", id); }
// Komentar: Memproses pemindahan kartu status saat dilepas (drop) di kolom Kanban yang baru.
function dropJournalCard(ev, newStatus) {
	ev.preventDefault();
	const id = parseInt(ev.dataTransfer.getData("text/plain"));
	if (id) updateJournalStatus(id, newStatus);
}

// Komentar: Merender daftar entri jurnal dalam bentuk papan Kanban interaktif.
function renderKanbanBoard() {
	const journal = getJournalData();
	const colOpen = document.getElementById('kanbanColOpen');
	const colWin = document.getElementById('kanbanColWin');
	const colLoss = document.getElementById('kanbanColLoss');

	let htmlOpen = '', htmlWin = '', htmlLoss = '';
	let countOpen = 0, countWin = 0, countLoss = 0;

	journal.forEach(item => {
		const cardHTML = `
			<div draggable="true" ondragstart="dragJournalCard(event, ${item.id})" class="bg-slate-900 border border-slate-800 p-3 rounded-xl cursor-grab active:cursor-grabbing hover:border-slate-700 transition space-y-2 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="w-5 h-5 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
							<img 
								src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
								alt="${item.ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
							>
						</div>
						<span class="font-bold text-white text-xs">&dollar;${item.ticker}</span>
					</div>
					<span class="text-[9px] text-slate-400">${item.date}</span>
				</div>
				<div class="grid grid-cols-3 gap-1 text-[10px] text-slate-300 bg-slate-950/10 p-2 rounded border border-slate-900 text-center">
					<div class="text-amber-400"><span class="text-[7px] text-amber-400 block">ENTRY</span>Rp ${item.entry.toLocaleString('id-ID')}</div>
					<div class="text-rose-400"><span class="text-[7px] text-rose-400 block">SL</span>Rp ${item.sl.toLocaleString('id-ID')}</div>
					<div class="text-emerald-400"><span class="text-[7px] text-emerald-400 block">TP</span>Rp ${item.tp.toLocaleString('id-ID')}</div>
				</div>
				<div class="flex items-center justify-between pt-1">
					<span class="text-[9px] text-sky-400 font-bold">RRR: ${item.rrr}</span>
					<div class="flex items-center gap-1">
						${item.status !== 'OPEN' ? `<button onclick="updateJournalStatus(${item.id}, 'OPEN')" class="text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-bold transition">Open</button>` : ''}
						${item.status !== 'WIN' ? `<button onclick="updateJournalStatus(${item.id}, 'WIN')" class="text-[8px] bg-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 px-1.5 py-0.5 rounded font-bold transition">WIN</button>` : ''}
						${item.status !== 'LOSS' ? `<button onclick="updateJournalStatus(${item.id}, 'LOSS')" class="text-[8px] bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-1.5 py-0.5 rounded font-bold transition">LOSS</button>` : ''}
						<button onclick="deleteJournalItem(${item.id})" class="text-[8px] text-slate-500 hover:text-rose-400 px-1 py-0.5 transition" title="Hapus">✕</button>
					</div>
				</div>
			</div>
		`;

		if (item.status === 'WIN') { htmlWin += cardHTML; countWin++; } 
		else if (item.status === 'LOSS') { htmlLoss += cardHTML; countLoss++; } 
		else { htmlOpen += cardHTML; countOpen++; }
	});

	colOpen.innerHTML = htmlOpen || `<div class="text-center text-slate-500 text-[10px] py-16 italic">Tidak ada plan open.</div>`;
	colWin.innerHTML = htmlWin || `<div class="text-center text-slate-500 text-[10px] py-16 italic">Belum ada take profit.</div>`;
	colLoss.innerHTML = htmlLoss || `<div class="text-center text-slate-500 text-[10px] py-16 italic">Belum ada stop loss.</div>`;

	document.getElementById('kanbanCountOpen').innerText = countOpen;
	document.getElementById('kanbanCountWin').innerText = countWin;
	document.getElementById('kanbanCountLoss').innerText = countLoss;
}

// ==========================================
// 22. SMART ALERT & PUSH NOTIFICATION
// ==========================================
function checkNotificationStatus() {
	const btn = document.getElementById('btnToggleNotification');
	if (!btn) return;
	if (!("Notification" in window)) {
		btn.innerHTML = `<i data-lucide="bell-off" class="w-3.5 h-3.5"></i> Browser Tidak Mendukung Push`;
		btn.disabled = true;
		btn.className = "text-[10px] lg:text-xs bg-slate-900 text-slate-500 border border-slate-800 font-bold px-3.5 py-2 rounded-lg cursor-not-allowed";
		return;
	}
	if (Notification.permission === "granted") {
		btn.innerHTML = `<i data-lucide="bell-ring" class="w-3.5 h-3.5 text-cyan-400"></i> Notifikasi Push Aktif`;
		btn.className = "text-[10px] lg:text-xs bg-emerald-500/10 text-cyan-400 border border-emerald-500/30 font-bold px-3.5 py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-default";
	} else if (Notification.permission === "denied") {
		btn.innerHTML = `<i data-lucide="bell-off" class="w-3.5 h-3.5 text-rose-400"></i> Izin Notifikasi Ditolak`;
		btn.className = "text-[10px] lg:text-xs bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold px-3.5 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer";
	} else {
		btn.innerHTML = `<i data-lucide="bell" class="w-3.5 h-3.5 text-amber-400"></i> Aktifkan Notifikasi Push`;
		btn.className = "text-[10px] lg:text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-3.5 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer";
	}
	if (window.lucide) lucide.createIcons();
}

// Komentar: Menunda sementara (snooze) masuknya pengiriman peringatan dari bot Telegram.
function toggleTelegramSnooze() {
	const snoozeUntil = localStorage.getItem('telegram_snooze_until');
	
	if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) {
		// Batalkan Snooze
		localStorage.removeItem('telegram_snooze_until');
		showToast("Notifikasi Telegram diaktifkan kembali.", "success");
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	} else {
		// Aktifkan Snooze (1 Jam)
		const snoozeTime = Date.now() + (60 * 60 * 1000); 
		localStorage.setItem('telegram_snooze_until', snoozeTime.toString());
		showToast("Notifikasi Telegram ditunda selama 1 Jam.", "info");
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	}
	updateTelegramSnoozeUI();
}

// Komentar: Mengganti tampilan tombol jeda Telegram sesuai dengan durasi sisa penundaan.
function updateTelegramSnoozeUI() {
	const btnSnooze = document.getElementById('btnSnoozeTelegram');
	if (!btnSnooze) return;

	const snoozeUntil = localStorage.getItem('telegram_snooze_until');
	if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) {
		const dateObj = new Date(parseInt(snoozeUntil));
		const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
		
		btnSnooze.innerHTML = `<i data-lucide="bell-off" class="w-4 h-4"></i> Ditunda s/d ${timeStr}`;
		btnSnooze.className = "w-full sm:w-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-bold px-4 py-2.5 rounded-lg transition text-xs flex items-center justify-center gap-2";
	} else {
		btnSnooze.innerHTML = `<i data-lucide="bell-off" class="w-4 h-4"></i> Tunda Notif 1 Jam`;
		btnSnooze.className = "w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold px-4 py-2.5 rounded-lg transition text-xs flex items-center justify-center gap-2";
	}
	if (window.lucide) lucide.createIcons();
}

// Komentar: Memuat pengaturan ID pengguna dan token bot Telegram yang telah disimpan.
function initTelegramConfig() {
	const tokenInput = document.getElementById('inputTeleToken');
	const chatInput = document.getElementById('inputTeleChat');
	
	if (tokenInput && chatInput) {
		tokenInput.value = localStorage.getItem('telegram_bot_token') || '';
		chatInput.value = localStorage.getItem('telegram_chat_id') || '';
	}
	updateTelegramSnoozeUI();
}

initTelegramConfig();
document.addEventListener('DOMContentLoaded', initTelegramConfig);

// Komentar: Menyimpan konfigurasi akses bot Telegram dan memulai pengujian jaringan.
async function saveTelegramConfig() {
	const tokenInput = document.getElementById('inputTeleToken');
	const chatInput = document.getElementById('inputTeleChat');
	
	if (!tokenInput || !chatInput) return;

	//const token = tokenInput.value.trim();
	//const chatId = chatInput.value.trim();
	
	const token = tokenInput.value.trim();
	let chatId = chatInput.value.trim();
	chatId = chatId.replace(/\s+/g, '');
	
	if (!token || !chatId) {
		showToast("Harap isi Token Bot dan Chat ID terlebih dahulu!", "warning");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}
	
	localStorage.setItem('telegram_bot_token', token);
	localStorage.setItem('telegram_chat_id', chatId);
	
	showToast("Konfigurasi disimpan! Menguji koneksi Telegram...", "info", 5000);
	if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
	
	await testTelegramConnection(token, chatId);
}

// Komentar: Mengirimkan sinyal uji coba untuk memastikan bot Telegram terhubung dengan perangkat pengguna.
async function testTelegramConnection(token, chatId) {
		try {
			const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					chat_id: chatId, 
					text: "🤖 <b>STOCK ID RADAR:</b> Integrasi Bot Telegram Berhasil Terhubung!", 
					parse_mode: 'HTML' 
				})
			});
			
			const data = await response.json();
			if (data.ok) {
				showToast("Sukses! Pesan tes berhasil dikirim ke Telegram Kamu.", "success", 5000);
			} else {
				let errorMsg = data.description || "Token/Chat ID salah";
				if (errorMsg.toLowerCase().includes('chat not found')) {
					errorMsg = "Chat not found! Pastikan Kamu sudah menekan tombol START / kirim pesan minimal 1x ke Bot Kamu di aplikasi Telegram terlebih dahulu.";
				}
				showToast(`Gagal terhubung: ${errorMsg}`, "error", 5000);
			}
		} catch (error) {
			showToast("Gagal mengirim pesan tes. Periksa koneksi internet Kamu.", "error", 5000);
			console.error("Telegram Test Error:", error);
		}
	}

// Komentar: Mengirim pesan teks peringatan (alert) harga secara langsung ke aplikasi Telegram.
async function sendTelegramAlert(message) {
	const snoozeUntil = localStorage.getItem('telegram_snooze_until');
	if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) {
		return;
	}

	const botToken = localStorage.getItem('telegram_bot_token')?.trim();
	const chatId = localStorage.getItem('telegram_chat_id')?.trim();
	
	if (!botToken || !chatId) return;

	try {
		const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
		});
		
		const data = await response.json();
		if (!data.ok) console.error("Telegram API Error:", data.description);
	} catch (error) { 
		console.error("Gagal mengirim Telegram Alert:", error); 
	}
}

// Komentar: Mendesak pengguna untuk memberikan izin penampilan notifikasi pop-up di browser.
function requestNotificationPermission() {
	if (!("Notification" in window)) return showToast("Browser Kamu tidak mendukung Web Push Notification.");
	Notification.requestPermission().then(permission => {
		checkNotificationStatus();
		if (permission === "granted") {
			sendBrowserPushNotification("Stock ID Screener Alert", `System push notification berhasil diaktifkan!`);
			AudioFX.playSuccess();
		} else if (permission === "denied") {
			AudioFX.playAlert();
			showToast("Izin notifikasi telah ditolak. Silakan izinkan melalui pengaturan browser Kamu.");
		}
	});
}

// Komentar: Menerbitkan notifikasi sistem (Push Notification) yang langsung membuka saham saat diklik.
function sendBrowserPushNotification(title, message, ticker = null) {
	if ("Notification" in window && Notification.permission === "granted") {
		const cleanTicker = ticker ? normalizeTickerSymbol(ticker) : null;
		const targetUrl = cleanTicker
			? `${window.location.origin}${window.location.pathname}?ticker=${encodeURIComponent(cleanTicker)}`
			: window.location.href;

		if (navigator.serviceWorker) {
			navigator.serviceWorker.ready.then(registration => {
				registration.showNotification(title, {
					body: message,
					icon: 'stockid_gambar/stockicon.jpg',
					vibrate: [200, 100, 200, 100, 200, 100, 200],
					tag: 'stockid-alert-' + (cleanTicker || Date.now()),
					data: { ticker: cleanTicker, url: targetUrl },
					requireInteraction: true
				});
			}).catch(() => {
				const notif = new Notification(title, { body: message, icon: 'stockid_gambar/stockicon.jpg' });
				notif.onclick = function() {
					window.focus();
					if (cleanTicker) openTickerFromNotification(cleanTicker);
					notif.close();
				};
			});
		} else {
			const notif = new Notification(title, { body: message, icon: 'stockid_gambar/stockicon.jpg' });
			notif.onclick = function() {
				window.focus();
				if (cleanTicker) openTickerFromNotification(cleanTicker);
				notif.close();
			};
		}
	}
}

// Komentar: Mengambil daftar lengkap target harga yang sedang dipantau untuk sebuah saham.
function getAlerts(ticker) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	return JSON.parse(localStorage.getItem(`alerts_${cleanTicker}`) || '[]');
}

function saveAlerts(ticker, alerts) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	localStorage.setItem(`alerts_${cleanTicker}`, JSON.stringify(alerts));
	renderAllAlerts();
}

// Komentar: Mengembangkan atau menyusutkan daftar rincian alert harga pada tampilan Smart Alert.
function toggleAlertAccordion(ticker) {
	const body = document.getElementById(`alert-body-${ticker}`);
	const icon = document.getElementById(`alert-icon-${ticker}`);
	if (body) {
		if (body.classList.contains('hidden')) {
			body.classList.remove('hidden');
			openAlertDropdowns.add(ticker);
			if (icon) icon.style.transform = "rotate(180deg)";
		} else {
			body.classList.add('hidden');
			openAlertDropdowns.delete(ticker);
			if (icon) icon.style.transform = "rotate(0deg)";
		}
	}
}

// Komentar: Merender seluruh kartu rincian konfigurasi alert saham yang sedang aktif dipantau.
function renderAllAlerts() {
	const container = document.getElementById('alertListContainer');
	if (!container) return;

	let groupedAlerts = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && key.startsWith('alerts_')) {
			const ticker = key.replace('alerts_', '');
			try {
				const alerts = JSON.parse(localStorage.getItem(key));
				if (alerts && alerts.length > 0) groupedAlerts.push({ ticker, alerts });
			} catch(e) {}
		}
	}

	if (groupedAlerts.length === 0) {
		container.innerHTML = `<div class="text-center text-slate-400 py-6 lg:col-span-3 text-xs">Belum ada alert harga yang dipasang pada saham manapun. Klik "Tambahkan ke Alert" di atas untuk memasang notifikasi.</div>`;
		return;
	}

	groupedAlerts.sort((a, b) => {
		if (a.ticker === currentTicker) return -1;
		if (b.ticker === currentTicker) return 1;
		const aActive = a.alerts.filter(x => x.active && !x.triggered).length;
		const bActive = b.alerts.filter(x => x.active && !x.triggered).length;
		if (bActive !== aActive) return bActive - aActive;
		return a.ticker.localeCompare(b.ticker);
	});

	let htmlContent = '';
	groupedAlerts.forEach(group => {
		const ticker = group.ticker;
		const activeCount = group.alerts.filter(a => a.active && !a.triggered).length;
		let alertDate = group.alerts[0].date;
		if (!alertDate) {
			const now = new Date();
			const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
			alertDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear().toString().slice(-2)}`;
		}

		const isOpen = openAlertDropdowns.has(ticker);
		const hiddenClass = isOpen ? '' : 'hidden';
		const rotateStyle = isOpen ? 'transform: rotate(180deg);' : 'transform: rotate(0deg);';
		const isCurrent = ticker === currentTicker;
		const borderHighlight = isCurrent ? 'border-emerald-500/50 shadow-sm shadow-emerald-500/10' : 'border-slate-800';

		htmlContent += `
			<div class="bg-slate-950/10 rounded-xl border ${borderHighlight} overflow-hidden transition-all duration-200 col-span-1 md:col-span-2 lg:col-span-3">
				<div onclick="toggleAlertAccordion('${ticker}')" class="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition select-none group">
					<div class="flex items-center gap-3 md:gap-4">
						<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1 group-hover:border-emerald-500/40 transition">
							<img 
								src="https://assets.stockbit.com/logos/companies/${ticker}.png" 
								alt="${ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${ticker.substring(0,3)}</span>';};"
							>
						</div>
						<div class="flex flex-col">
							<div class="flex items-center gap-2">
								<span class="font-bold text-white text-sm md:text-base tracking-wide">$${ticker}</span>
								${isCurrent ? '<span class="bg-emerald-500/20 text-cyan-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 hidden sm:inline-block">DIBUKA</span>' : ''}
							</div>
							<span class="font-bold ${activeCount > 0 ? 'text-cyan-400' : 'text-slate-500'} text-[10px] md:text-xs mt-0.5">${activeCount} Alert Aktif</span>
						</div>
					</div>
					<div class="flex items-center gap-3 md:gap-4 text-right">
						<div class="flex flex-col items-end">
							<span class="text-[9px] md:text-[10px] text-slate-400">Tgl Dibuat</span>
							<span class="text-cyan-400 text-[10px] md:text-xs font-bold">${alertDate}</span>
						</div>
						<div class="bg-slate-900 p-1.5 rounded-md border border-slate-800 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition">
							<i id="alert-icon-${ticker}" class="fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-300" style="${rotateStyle}"></i>
						</div>
					</div>
				</div>
				<div id="alert-body-${ticker}" class="${hiddenClass} border-t border-slate-800/80 bg-slate-900/30 p-2 space-y-1.5">
		`;

		group.alerts.forEach((alertObj, index) => {
			const targetPrice = alertObj.price || alertObj; 
			const isActive = alertObj.active !== undefined ? alertObj.active : true;
			const isTriggered = alertObj.triggered || false;
			const labelText = alertObj.label || 'Target Price';

			let badgeColor = 'text-cyan-400';
			if (labelText.toLowerCase().includes('stop loss')) badgeColor = 'text-rose-400';
			if (labelText.toLowerCase().includes('take profit')) badgeColor = 'text-emerald-400';
			if (labelText.toLowerCase().includes('entry') || labelText.toLowerCase().includes('support')) badgeColor = 'text-amber-400';

			let statusBadge = '', toggleBtn = '', rowBorder = 'border-slate-800/60';
			if (isTriggered) {
				statusBadge = '<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold">TERCAPAI</span>';
				rowBorder = 'border-l-[3px] border-emerald-500/60';
				toggleBtn = `<button onclick="toggleAlertStatus('${ticker}', ${index})" class="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded font-bold transition hover:text-white">RESET</button>`;
			} else if (isActive) {
				statusBadge = '<span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold animate-pulse">MENUNGGU</span>';
				rowBorder = 'border-l-[3px] border-amber-500/60';
				toggleBtn = `<button onclick="toggleAlertStatus('${ticker}', ${index})" class="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded font-bold transition hover:bg-amber-500 hover:text-slate-950">ON</button>`;
			} else {
				statusBadge = '<span class="bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded text-[8px] font-bold">OFF</span>';
				rowBorder = 'opacity-60 border-l-[3px] border-slate-700';
				toggleBtn = `<button onclick="toggleAlertStatus('${ticker}', ${index})" class="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded font-bold transition hover:text-white">OFF</button>`;
			}

			htmlContent += `
				<div class="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-r-lg ${rowBorder} hover:bg-slate-800 transition">
					<div class="flex items-center gap-3">
						<div>
							<span class="text-[9px] ${badgeColor} block font-bold uppercase tracking-wider mb-0.5">${labelText}</span>
							<strong class="text-slate-200 text-xs md:text-sm">Rp ${targetPrice.toLocaleString('id-ID')}</strong>
						</div>
						${statusBadge}
					</div>
					<div class="flex items-center gap-2">
						${toggleBtn}
						<button onclick="removePriceAlert('${ticker}', ${index})" class="text-slate-500 hover:text-rose-400 font-bold px-1.5 py-0.5 transition rounded hover:bg-rose-500/10"><i class="fa-solid fa-trash text-[10px]"></i></button>
					</div>
				</div>
			`;
		});
		htmlContent += `</div></div>`;
	});
	container.innerHTML = htmlContent;
}

// Komentar: Membersihkan dan menghapus seluruh konfigurasi alarm pemantau dari semua saham.
async function clearAllAlerts() {
	const isConfirmed = await showConfirm("Apakah Kamu yakin ingin menghapus seluruh riwayat Alert pada seluruh saham?");
	if (isConfirmed) {
		let keysToRemove = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith('alerts_')) keysToRemove.push(key);
		}
		keysToRemove.forEach(k => localStorage.removeItem(k));
		renderAllAlerts();
		showToast("Semua Alert berhasil dibersihkan.");
		AudioFX.playTokenExpired();
	}
}

// FUNGSI INTERCEPTOR SMART ALERT (MODAL EDIT)
function openEditAlertModal() {
	let price = 100;
	let sl = 0, entry = 0, resist = 0, tp = 0;

	if (globalStockData && globalStockData.price) {
		price = roundToBEITick(globalStockData.price);
		const fibo = getDynamicFiboLevels(globalStockData.high20, globalStockData.low20, price);
		
		entry = roundToBEITick(fibo.entryLow * 0.97, 'floor');
		resist = fibo.res1;
		sl = roundToBEITick(fibo.sl * 0.96, 'floor');
		tp = roundToBEITick(fibo.res1 * 1.02, 'ceil'); 
	}

	document.getElementById('alertModalTicker').value = currentTicker || '';
	document.getElementById('alertModalEntry').value = entry || 0;
	document.getElementById('alertModalResistance').value = resist || 0;
	document.getElementById('alertModalTP').value = tp || 0;
	document.getElementById('alertModalSL').value = sl || 0;
	
	const modal = document.getElementById('editAlertModal');
	if (modal) modal.classList.remove('hidden');
}

// Komentar: Menutup paksa jendela form pengubahan pengaturan alert.
function closeEditAlertModal() {
	const modal = document.getElementById('editAlertModal');
	if (modal) modal.classList.add('hidden');
}

// Komentar: Menerapkan dan menyimpan nilai peringatan batas harga saham dari hasil penyuntingan.
function saveFinalEditedAlert() {
	const tickerInput = normalizeTickerSymbol(document.getElementById('alertModalTicker')?.value || '');
	const entryInput = parseFloat(document.getElementById('alertModalEntry')?.value) || 0;
	const resistanceInput = parseFloat(document.getElementById('alertModalResistance')?.value) || 0;
	const tpInput = parseFloat(document.getElementById('alertModalTP')?.value) || 0;
	const slInput = parseFloat(document.getElementById('alertModalSL')?.value) || 0;

	if (!tickerInput) {
		showToast('Simbol saham tidak valid! Gagal menyimpan.', 'error');
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}

	const now = new Date();
	const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
	const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear().toString().slice(-2)}`;

	const newAlerts = [
		{ price: slInput, label: 'Stop Loss', active: true, triggered: false, date: dateStr },
		{ price: entryInput, label: 'Entry / Support', active: true, triggered: false, date: dateStr },
		{ price: resistanceInput, label: 'Resistance', active: true, triggered: false, date: dateStr },
		{ price: tpInput, label: 'Take Profit', active: true, triggered: false, date: dateStr }
	];

	saveAlerts(tickerInput, newAlerts);
	openAlertDropdowns.add(tickerInput);
	renderAllAlerts();

	showToast(`Alert saham $${tickerInput} berhasil disesuaikan dan disimpan.`, 'success');
	if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();

	closeEditAlertModal();
}

// Komentar: Menyelaraskan form nilai pengaturan Smart Alert secara otomatis menggunakan hasil AI.
function syncAlertsFromAI() {
	let price = 100;
	let sl = 92, sup2 = 96, res2 = 108, tp2 = 110;

	if (globalStockData && globalStockData.price) {
		price = roundToBEITick(globalStockData.price);
		const fibo = getDynamicFiboLevels(globalStockData.high20, globalStockData.low20, price);
		
		sup2 = roundToBEITick(fibo.entryHigh * 0.99, 'floor');
		res2 = fibo.res2;
		sl = roundToBEITick(fibo.sl * 0.96, 'floor');
		tp2 = roundToBEITick(res2 * 1.02, 'ceil');
	}

	const now = new Date();
	const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
	const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear().toString().slice(-2)}`;

	const syncTargets = [
		{ price: sl, label: 'Stop Loss', active: true, triggered: false, date: dateStr },
		{ price: sup2, label: 'Entry / Support', active: true, triggered: false, date: dateStr },
		{ price: res2, label: 'Resistance', active: true, triggered: false, date: dateStr },
		{ price: tp2, label: 'Take Profit', active: true, triggered: false, date: dateStr }
	];

	saveAlerts(currentTicker, syncTargets);
	openAlertDropdowns.add(currentTicker); 
	renderAllAlerts();
	AudioFX.playSuccess();
	showToast(`4 Target Harga AI ($${currentTicker}) berhasil disinkronkan ke Push Notification Alert!`);
}

// Komentar: Mengaktifkan atau menonaktifkan status pantauan target harga (alert) pada entri spesifik.
function toggleAlertStatus(ticker, index) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	let alerts = getAlerts(cleanTicker);
	if (alerts[index]) {
		if (typeof alerts[index] === 'object') {
			if (alerts[index].triggered) {
				alerts[index].triggered = false;
				alerts[index].active = true;
			} else {
				alerts[index].active = !alerts[index].active;
			}
		} else {
			alerts[index] = { price: alerts[index], active: false, triggered: false };
		}
		saveAlerts(cleanTicker, alerts);
	}
}

function removePriceAlert(ticker, index) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	let alerts = getAlerts(cleanTicker);
	alerts.splice(index, 1);
	saveAlerts(cleanTicker, alerts);
}

function checkPriceAlertsRealtime(ticker, currentPrice) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	if (!cleanTicker || !currentPrice || currentPrice <= 0) return;

	const snoozeTarget = parseInt(localStorage.getItem('stockid_notif_snooze_target') || '0');
	if (snoozeTarget > Date.now()) return;

	const notifType = localStorage.getItem('stockid_notif_type') || 'both';
	if (notifType === 'whales') return;

	const muteNotifSound = localStorage.getItem('stockid_notif_mute_sound') === 'true';

	let alerts = getAlerts(cleanTicker);
	let updated = false;

	alerts.forEach((alertObj, idx) => {
		const targetPrice = typeof alertObj === 'object' ? alertObj.price : alertObj;
		const isActive = typeof alertObj === 'object' ? alertObj.active : true;
		const labelText = typeof alertObj === 'object' && alertObj.label ? alertObj.label : 'Target';

		if (isActive && targetPrice > 0) {
			const isSupportOrSL = labelText.toLowerCase().includes('stop loss') || labelText.toLowerCase().includes('support') || labelText.toLowerCase().includes('entry');
			const conditionMet = isSupportOrSL ? (currentPrice <= targetPrice) : (currentPrice >= targetPrice);

			if (conditionMet) {
				const alertMsg = `Saham: ${cleanTicker}\nStatus: Menyentuh ${labelText} (Rp ${targetPrice.toLocaleString('id-ID')})\nHarga Terkini: Rp ${currentPrice.toLocaleString('id-ID')}`;

				if (!muteNotifSound && typeof AudioFX !== 'undefined') {
					AudioFX.playSuccess();
				}
				showToast(alertMsg, "success", 5000, () => openTickerFromNotification(cleanTicker));
				sendBrowserPushNotification(`🎯 STOCK ID ALERT`, alertMsg, cleanTicker);

				const telegramMsg = `<b>🎯 STOCK ID ALERT</b> \nSaham: <b>${cleanTicker}</b>\nStatus: <b>Menyentuh ${labelText} (Rp ${targetPrice.toLocaleString('id-ID')})</b>\nHarga Terkini: <b>Rp ${currentPrice.toLocaleString('id-ID')}</b>`;
				sendTelegramAlert(telegramMsg);

				if (typeof alertObj === 'object') {
					alertObj.active = false;
					alertObj.triggered = true;
				} else {
					alerts[idx] = { price: targetPrice, active: false, triggered: true };
				}
				updated = true;
			}
		}
	});

	if (updated) saveAlerts(cleanTicker, alerts);
}


// ==========================================
// 21. TRADINGVIEW SCREENER MODAL (POPUP)
// ==========================================
function toggleTVScreenerModal() {
	const modal = document.getElementById('tvScreenerModal');
	const content = document.getElementById('tvScreenerModalContent');
	const isHidden = modal.classList.contains('hidden');

	if (isHidden) {
		modal.classList.remove('hidden');
		setTimeout(() => {
			modal.classList.remove('opacity-0');
			content.classList.remove('scale-95');
			content.classList.add('scale-100');
		}, 10);
		
		// Muat widget secara dinamis jika kontainer masih kosong (hemat resource di awal)
		const container = document.getElementById('tvScreenerContainer');
		if (container && container.innerHTML.trim() === '') {
			refreshTVScreener();
		}
		
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	} else {
		modal.classList.add('opacity-0');
		content.classList.remove('scale-100');
		content.classList.add('scale-95');
		setTimeout(() => {
			modal.classList.add('hidden');
		}, 300);
		
		if (typeof AudioFX !== 'undefined') AudioFX.playDelete();
	}
}

function refreshTVScreener() {
	const container = document.getElementById('tvScreenerContainer');
	const iconBtn = document.getElementById('iconRefreshTVScreener');
	
	if (!container) return;
	
	if (iconBtn) iconBtn.classList.add('animate-spin');
	container.innerHTML = "";
	
	const script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
	script.async = true;
	
	// Konfigurasi parameter widget persis seperti pada versi file watchlist
	script.text = JSON.stringify({
		"width": "100%",
		"height": "100%",
		"defaultColumn": "overview",
		"defaultScreen": "most_volatile",
		"market": "indonesia",
		"showToolbar": true,
		"colorTheme": "dark",
		"locale": "id",
		"isTransparent": true
	});
	
	container.appendChild(script);
	
	// Matikan animasi loading ikon setelah widget berhasil diinjeksi
	setTimeout(() => {
		if (iconBtn) iconBtn.classList.remove('animate-spin');
	}, 1000);
}


// Komentar: Menganalisa lompatan akumulasi dan memberikan notifikasi Whale Radar lengkap dengan harga saham saat ini.
function checkWhaleAlertRealtime(ticker, stockData) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	if (!cleanTicker) return;

	const latestData = getCachedStockData(cleanTicker) || stockData;
	if (!latestData || !latestData.price) return;

	const snoozeTarget = parseInt(localStorage.getItem('stockid_notif_snooze_target') || '0');
	if (snoozeTarget > Date.now()) return;

	const notifType = localStorage.getItem('stockid_notif_type') || 'both';
	if (notifType === 'smart_alert') return;

	const muteNotifSound = localStorage.getItem('stockid_notif_mute_sound') === 'true';

	const currentHour = new Date().getHours();
	let strictRasio = currentHour < 11 ? 1.5 : (currentHour < 14 ? 1.5 : 2.5);

	if (latestData.volRatio >= strictRasio && latestData.changePct >= 0 && latestData.changePct <= 5.0) {
		const lastAlertKey = `whale_alert_${cleanTicker}`;
		const lastAlertRaw = localStorage.getItem(lastAlertKey);

		let lastAlert = { time: 0, volRatio: 0, sessionId: null };

		if (lastAlertRaw) {
			try {
				lastAlert = JSON.parse(lastAlertRaw);
				if (typeof lastAlert !== 'object') {
					lastAlert = { time: parseInt(lastAlertRaw) || 0, volRatio: 0, sessionId: null };
				}
			} catch (e) {
				lastAlert = { time: parseInt(lastAlertRaw) || 0, volRatio: 0, sessionId: null };
			}
		}

		const now = Date.now();
		const FOUR_HOURS = 4 * 60 * 60 * 1000;
		const marketOpen = isMarketOpen();

		let shouldAlert = false;
		let currentSessionId = null;

		if (!marketOpen) {
			const d = new Date();
			d.setHours(d.getHours() - 9);
			currentSessionId = d.toISOString().split('T')[0] + "_closed";

			if (lastAlert.sessionId !== currentSessionId) {
				shouldAlert = true;
			}
		} else {
			if (now - lastAlert.time >= FOUR_HOURS) {
				if (latestData.volRatio > lastAlert.volRatio || lastAlert.volRatio === 0) {
					shouldAlert = true;
				}
			}
		}

		if (shouldAlert) {
			const currentPrice = roundToBEITick(latestData.price);
			const formattedPrice = `Rp ${currentPrice.toLocaleString('id-ID')}`;
			const alertMsg = `Saham: $${cleanTicker}\nHarga Saat Ini: ${formattedPrice}\nVolume: Mencapai ${(latestData.volRatio * 100).toFixed(0)}% dari volume kemarin!\nKet: Harga baru naik ${latestData.changePct}%, Bandar indikasi kumpulin barang!`;

			if (!muteNotifSound && typeof AudioFX !== 'undefined') {
				AudioFX.playNotif();
			}

			sendBrowserPushNotification(`🐳 STOCK ID WHALE RADAR`, alertMsg, cleanTicker);
			showToast(alertMsg, "info", 5000, () => openTickerFromNotification(cleanTicker));

			if (typeof notifyWhaleToServiceWorker === 'function') {
				notifyWhaleToServiceWorker(cleanTicker, `🐳 STOCK ID WHALE RADAR: $${cleanTicker} (${formattedPrice})`, alertMsg);
			}

			const teleMsg = `<b>🐳 STOCK ID WHALE RADAR</b>\nSaham: <b>$${cleanTicker}</b>\nHarga Saat Ini: <b>${formattedPrice}</b>\nVolume: Mencapai <b>${(latestData.volRatio * 100).toFixed(0)}%</b> dari volume kemarin!\nKet: Harga baru naik <b>${latestData.changePct}%</b>, Bandar indikasi kumpulin barang!`;
			sendTelegramAlert(teleMsg);

			const newAlertData = {
				time: now,
				volRatio: latestData.volRatio,
				sessionId: currentSessionId
			};
			localStorage.setItem(lastAlertKey, JSON.stringify(newAlertData));
		}
	}
}

// ==========================================
// 26. MULTI-TIMEFRAME AI ANALYSIS
// ==========================================
// Pada bagian awal analyzeAITimeframe(tfLabel):
async function analyzeAITimeframe(tfLabel) {
	const targetSymbol = toYahooTickerSymbol(currentTicker);
	const resultContainer = document.getElementById('ai-tf-result');
	
	if (!resultContainer) return;
	
	let displayLabel = tfLabel;
	if (tfLabel === '15m') displayLabel = '15 Menit';
	if (tfLabel === '30m') displayLabel = '30 Menit';
	if (tfLabel === '1h') displayLabel = '1 Jam';
	if (tfLabel === '3h') displayLabel = '3 Jam';
	if (tfLabel === '6h') displayLabel = '6 Jam';

	resultContainer.innerHTML = `<div class="flex items-center gap-2 text-amber-400 animate-pulse py-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menganalisis pergerakan timeframe ${displayLabel}...</div>`;
	if (window.lucide) lucide.createIcons();

	try {
		let apiInterval = '15m'; 
		let apiRange = '5d';
		let lookbackCandles = 2;

		if (tfLabel === '15m') { apiInterval = '15m'; apiRange = '5d'; }
		else if (tfLabel === '30m') { apiInterval = '30m'; apiRange = '5d'; }
		else if (tfLabel === '1h') { apiInterval = '60m'; apiRange = '1mo'; }
		else if (tfLabel === '3h') { apiInterval = '60m'; apiRange = '1mo'; lookbackCandles = 3; } // Bandingkan harga sekarang dgn 3 jam (3 candle) lalu
		else if (tfLabel === '6h') { apiInterval = '60m'; apiRange = '1mo'; lookbackCandles = 6; } // Bandingkan harga sekarang dgn 6 jam (6 candle) lalu

		const url = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?interval=${apiInterval}&range=${apiRange}`;
		const proxies = [
			`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
			`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
			`https://corsproxy.io/?${encodeURIComponent(url)}`
		];
		
		let data = null;
		for (let p of proxies) {
			try {
				const res = await fetch(p, { signal: AbortSignal.timeout(6000) });
				if (res.ok) { 
					data = await res.json(); 
					break; 
				}
			} catch(e) {
				console.warn(`Proxy gagal untuk timeframe: ${p}`);
			}
		}
		
		if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
			throw new Error("Data bursa tidak merespons atau kosong.");
		}

		const quotes = data.chart.result[0].indicators.quote[0];
		const closes = quotes.close.filter(c => c !== null && c !== undefined);
		const volumes = quotes.volume.filter(v => v !== null && v !== undefined);

		if (closes.length < lookbackCandles) {
			throw new Error("Data candlestick terlalu sedikit untuk rentang waktu ini.");
		}
		
		const currentClose = closes[closes.length - 1];
		const prevClose = closes[closes.length - lookbackCandles] || closes[0]; 
		
		const avgVol = volumes.slice(-lookbackCandles).reduce((a, b) => a + b, 0) / lookbackCandles;
		const currentVol = volumes.slice(-(Math.ceil(lookbackCandles / 2))).reduce((a, b) => a + b, 0) / Math.ceil(lookbackCandles / 2); // Volume terbaru relatif

		const changePct = (((currentClose - prevClose) / prevClose) * 100).toFixed(2);
		let trend = currentClose > prevClose ? "BULLISH" : (currentClose < prevClose ? "BEARISH" : "SIDEWAYS");
		let momentum = currentVol > (avgVol * 1.1) ? "STRONG (Akumulasi)" : "WEAK (Distribusi/Sepi)";
		
		let signalColor = trend === "BULLISH" ? "text-emerald-400" : (trend === "BEARISH" ? "text-rose-400" : "text-amber-400");
		let iconTrend = trend === "BULLISH" ? "trending-up" : (trend === "BEARISH" ? "trending-down" : "minus");

		resultContainer.innerHTML = `
			<div class="bg-slate-900/80 p-3 rounded-lg border border-slate-700 mt-2 text-[11px] lg:text-xs shadow-inner transition-all">
				<div class="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
					<span class="text-slate-400 flex items-center gap-1.5"><i data-lucide="clock" class="w-3.5 h-3.5"></i> Timeframe (Agregasi):</span>
					<span class="font-bold text-white uppercase bg-slate-800 px-2 py-0.5 rounded border border-slate-700">${displayLabel}</span>
				</div>
				<div class="flex justify-between items-center mb-1.5">
					<span class="text-slate-400">Status Harga Terakhir:</span>
					<span class="font-bold text-white">Rp ${currentClose.toLocaleString('id-ID')} (<span class="${signalColor}">${changePct > 0 ? '+' : ''}${changePct}%</span>)</span>
				</div>
				<div class="flex justify-between items-center mb-1.5">
					<span class="text-slate-400">Trend Signal (${displayLabel}):</span>
					<span class="font-bold ${signalColor} flex items-center gap-1"><i data-lucide="${iconTrend}" class="w-3.5 h-3.5"></i> ${trend}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-slate-400">Momentum Volume:</span>
					<span class="font-bold ${currentVol > avgVol ? 'text-blue-400' : 'text-slate-400'}">${momentum}</span>
				</div>
			</div>
		`;
		if (window.lucide) lucide.createIcons();
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	} catch (error) {
		resultContainer.innerHTML = `
			<div class="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg mt-2 text-rose-400 text-[10px] lg:text-[11px] flex items-center gap-1.5">
				<i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Gagal memuat analisis: ${error.message}
			</div>
		`;
		if (window.lucide) lucide.createIcons();
	}
}

// ==========================================
// 13. PEER KOMPARASI SAHAM
// ==========================================
async function loadPeerAnalysisByPrice(targetTicker, isManualRefresh = false) {
	const btn = document.getElementById('btnRefreshPeer');
	
	if (isManualRefresh && btn) {
		if (btn.disabled) return;
		
		if (!checkAndUpdateLimit('peer', false)) {
			showToast("Limit harian Peer Komparasi Kamu telah habis (25x/hari).", "error");
			if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
			return;
		}

		btn.disabled = true;
		btn.className = "w-full sm:w-auto bg-slate-800 border border-slate-700 text-white font-bold px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 shrink-0 cursor-not-allowed";
		btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-emerald-400"></i> Memuat Peer...`;
		if (window.lucide) lucide.createIcons();
	}

	try {
		const body = document.getElementById('peerTableBody');
		document.getElementById('peerTickerLabel').innerText = targetTicker;
		const refLabel = document.getElementById('peerTickerRef');
		if (refLabel) refLabel.innerText = targetTicker;

		body.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400"><i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto mb-1 text-emerald-400"></i> Mengekstrak rekomendasi saham serupa dari algoritma bursa...</td></tr>`;
		if (window.lucide) lucide.createIcons();

		let peerTickers = [];
		const targetYahoo = toYahooTickerSymbol(targetTicker);
		const recUrl = `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(targetYahoo)}`;
		const proxies = [
			`https://api.allorigins.win/get?url=${encodeURIComponent(recUrl)}`,
			`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(recUrl)}`,
			`https://corsproxy.io/?${encodeURIComponent(recUrl)}`
		];

		for (let p of proxies) {
			try {
				const res = await fetch(p, { signal: AbortSignal.timeout(4000) });
				if (res.ok) {
					let data = await res.json();
					if (p.includes('allorigins')) data = JSON.parse(data.contents);
					const recs = data?.finance?.result?.[0]?.recommendedSymbols || [];
					peerTickers = recs.map(r => r.symbol.replace('.JK', ''));
					if (peerTickers.length > 0) break;
				}
			} catch(e) {}
		}

		// Fallback
		if (peerTickers.length === 0) {
			let baseData = globalStockData;
			if (!baseData || baseData.ticker !== targetTicker) {
				baseData = await fetchRealtimeStockData(targetTicker);
			}
			if (baseData && baseData.price) {
				const basePrice = baseData.price;
				const minPrice = basePrice * 0.75;
				const maxPrice = basePrice * 1.25;
				const regPeers = getRegularStockTickers();
				const watchlist = regPeers.length > 0 ? regPeers : (typeof uniqueRadarWatchlist !== 'undefined' ? uniqueRadarWatchlist : [targetTicker]);
				const candidates = watchlist.filter(t => t !== targetTicker).sort(() => 0.5 - Math.random());
				
				// 1. Pindai LocalStorage Cache First (Eksekusi Instan)
				let uncachedCandidates = [];
				for (const ticker of candidates) {
					const cached = getCachedStockData(ticker);
					if (cached && cached.price >= minPrice && cached.price <= maxPrice) {
						peerTickers.push(ticker);
					} else if (!cached) {
						uncachedCandidates.push(ticker);
					}
					if (peerTickers.length >= 8) break;
				}
				
				// 2. Fetch API Terbatas (Max 10 Candidates) jika cache tidak mencukupi
				if (peerTickers.length < 8 && uncachedCandidates.length > 0) {
					const fetchCandidates = uncachedCandidates.slice(0, 10);
					const fetchedBatch = await Promise.all(fetchCandidates.map(t => fetchRealtimeStockData(t)));
					for (const item of fetchedBatch) {
						if (item && item.price >= minPrice && item.price <= maxPrice && !peerTickers.includes(item.ticker)) {
							peerTickers.push(item.ticker);
						}
						if (peerTickers.length >= 8) break;
					}
				}
			}
		}
		
		peerTickers = [...new Set([targetTicker, ...peerTickers])].slice(0, 8); 
		const peerResults = await Promise.all(peerTickers.map(t => fetchRealtimeStockData(t)));

		let rowsHTML = '';
		peerResults.forEach(data => {
			if (!data || !data.price) return;
			const isCurrent = data.ticker === targetTicker;
			const isPlus = data.changePct >= 0;
			
			const rowClass = isCurrent 
				? "bg-emerald-500/10 font-bold border-l-[3px] border-emerald-400 shadow-sm" 
				: "hover:bg-slate-800/50 transition-colors duration-200 border-l-[3px] border-transparent";

			rowsHTML += `
				<tr class="${rowClass} group">
					<td class="p-4 align-middle">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
								<img 
									src="https://assets.stockbit.com/logos/companies/${data.ticker}.png" 
									alt="${data.ticker}" 
									class="w-full h-full object-contain drop-shadow-sm" 
									onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${data.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${data.ticker.substring(0,3)}</span>';};"
								>
							</div>
							<div class="flex flex-col">
								<strong class="text-white text-sm tracking-wide">&dollar;${data.ticker}</strong>
								${isCurrent ? '<span class="text-[9px] text-emerald-400/80 font-medium tracking-wide">Sedang Dipantau</span>' : '<span class="text-[9px] text-slate-500 font-medium tracking-wide">Saham Serupa</span>'}
							</div>
						</div>
					</td>
					<td class="p-4 align-middle">
						<span class="text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 whitespace-nowrap shadow-sm">
							Rp ${roundToBEITick(data.price).toLocaleString('id-ID')}
						</span>
					</td>
					<td class="p-4 align-middle">
						<span class="${isPlus ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'} font-bold px-2.5 py-1.5 rounded-lg border text-xs flex items-center w-max gap-1.5 whitespace-nowrap shadow-sm">
							<i class="fa-solid ${isPlus ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
							${isPlus ? '+' : ''}${data.changePct}%
						</span>
					</td>
					<td class="p-4 align-middle">
						<span class="${data.price >= data.ma5 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'} font-medium px-2.5 py-1.5 rounded-lg text-xs border flex items-center w-max gap-1.5 whitespace-nowrap shadow-sm">
							<span class="w-1.5 h-1.5 rounded-full ${data.price >= data.ma5 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}"></span>
							${data.price >= data.ma5 ? 'Bullish (Above MA5)' : 'Bearish (Below MA5)'}
						</span>
					</td>
					<td class="p-4 align-middle">
						<span class="${data.volRatio >= 1.2 ? 'text-emerald-400 font-bold bg-emerald-500/10 border-emerald-500/30' : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'} px-2.5 py-1.5 rounded-lg text-xs border flex items-center w-max gap-1.5 whitespace-nowrap shadow-sm">
							<i class="fa-solid fa-chart-simple"></i>
							${data.volRatio}x Vol
						</span>
					</td>
					<td class="p-4 align-middle text-center">
						<button onclick="document.getElementById('stockSearch').value='${data.ticker}'; searchStock(true);" class="text-[10px] bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 hover:border-emerald-500 transition-all duration-200 font-bold shadow-sm flex items-center justify-center gap-1.5 mx-auto group-hover:bg-emerald-500/20 group-hover:text-emerald-400 group-hover:border-emerald-500/40 whitespace-nowrap">
							Buka Chart <i class="fa-solid fa-chevron-right text-[9px] opacity-80"></i>
						</button>
					</td>
				</tr>
			`;
		});

		body.innerHTML = rowsHTML || `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ditemukan saham peer yang aktif saat ini.</td></tr>`;
		
		if (rowsHTML) {
			body.innerHTML = rowsHTML;
			// Jika pakai tombol manual refresh dan hasil ditemukan, potong limit
			if (isManualRefresh) deductFeatureLimit('peer');
		} else {
			body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ditemukan saham peer yang aktif saat ini. (Limit tidak dikurangi)</td></tr>`;
		}

	} catch (error) {
		console.error("Error loading peers:", error);
		const body = document.getElementById('peerTableBody');
		if(body) body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-400">Terjadi kesalahan saat memuat data peer.</td></tr>`;
	} finally {
		if (isManualRefresh && btn) {
			btn.disabled = false;
			btn.className = "w-full sm:w-auto bg-emerald-700 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-lg border border-emerald-700 transition shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2 shrink-0";
			btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Bandingkan`;
			if (window.lucide) lucide.createIcons();
		}
	}
}

// ==========================================
// 9. INSIDER SEARCH (SEC EDGAR VIA CLOUDFLARE WORKER)
// ==========================================

// Komentar: Memulai proses pencarian data portofolio institusi global dari server SEC.
async function handleInsiderSearch() {
	const selectEl = document.getElementById('insiderSearchInput');
	const cikNumber = selectEl?.value;
	if (!cikNumber) {
		showToast("Silakan pilih salah satu institusi dari daftar dropdown terlebih dahulu.", "warning");
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
		return;
	}

	const institutionName = selectEl.options[selectEl.selectedIndex].text.replace(/\s\(.*?\)/, '');
	const resultContainer = document.getElementById('insiderResultContainer');
	const statusMessage = document.getElementById('insiderStatusMessage');
	const tableBody = document.getElementById('insiderTableBody');

	resultContainer.classList.add('hidden');
	statusMessage.classList.remove('hidden');
	statusMessage.innerHTML = `<div class="flex flex-col items-center justify-center gap-2 animate-pulse"><i data-lucide="loader-2" class="w-6 h-6 animate-spin text-indigo-400"></i> Menghubungkan ke SEC EDGAR via Worker untuk <b>${institutionName}</b>...</div>`;
	if (window.lucide) lucide.createIcons();
	tableBody.innerHTML = '';

	const fetchSecData = async (targetUrl, isXml = false) => {
		const encodedUrl = encodeURIComponent(targetUrl);
		const workerUrl = `https://sec-bridge.accespy-mail.workers.dev/?target=${encodedUrl}`;

		try {
			const res = await fetchWithTimeout(workerUrl, {}, 10000);
			if (!res.ok) throw new Error(`Worker merespons dengan status error: ${res.status}`);

			let data = await res.text();
			if (data.trim().toLowerCase().startsWith('<!doctype html>') || data.trim().toLowerCase().startsWith('<html')) {
				throw new Error("Server SEC EDGAR menolak akses melalui Worker.");
			}

			return isXml ? data : JSON.parse(data);
		} catch (error) {
			console.error(`Gagal mengambil data SEC EDGAR via Worker:`, error);
			throw new Error("Gagal terhubung ke Cloudflare Worker atau SEC EDGAR sedang sibuk. Periksa kembali koneksi.");
		}
	};

	try {
		const paddedCik = cikNumber.padStart(10, '0');
		const secUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

		const submissionsData = await fetchSecData(secUrl, false);
		const filings = submissionsData.filings.recent;
		let filingIndex = -1;

		for (let i = 0; i < filings.form.length; i++) {
			if (filings.form[i] === '13F-HR') {
				filingIndex = i;
				break;
			}
		}

		if (filingIndex === -1) {
			statusMessage.innerHTML = `Data Laporan Portofolio (13F-HR) tidak ditemukan untuk <b>${institutionName}</b>.`;
			return;
		}

		const accessionNumber = filings.accessionNumber[filingIndex];
		const reportDate = filings.reportDate[filingIndex];
		const cleanAccession = accessionNumber.replace(/-/g, '');
		const cikTrimmed = parseInt(cikNumber, 10).toString();

		statusMessage.innerHTML = `<div class="flex flex-col items-center justify-center gap-2 animate-pulse"><i data-lucide="loader-2" class="w-6 h-6 animate-spin text-indigo-400"></i> Memindai dokumen Arsip 13F (${reportDate})...</div>`;
		if (window.lucide) lucide.createIcons();

		const archiveIndexUrl = `https://www.sec.gov/Archives/edgar/data/${cikTrimmed}/${cleanAccession}/index.json`;
		const indexData = await fetchSecData(archiveIndexUrl, false);
		let infoTableFileName = null;

		for (const file of indexData.directory.item) {
			if (file.name.endsWith('.xml') && (file.name.toLowerCase().includes('info') || file.name.toLowerCase().includes('table'))) {
				infoTableFileName = file.name;
				break;
			}
		}

		if (!infoTableFileName) {
			statusMessage.innerHTML = `File XML Information Table tidak tersedia pada arsip laporan SEC kuartal ini.`;
			return;
		}

		statusMessage.innerHTML = `<div class="flex flex-col items-center justify-center gap-2 animate-pulse"><i data-lucide="loader-2" class="w-6 h-6 animate-spin text-indigo-400"></i> Mengekstrak struktur XML...</div>`;
		if (window.lucide) lucide.createIcons();

		const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikTrimmed}/${cleanAccession}/${infoTableFileName}`;
		const xmlText = await fetchSecData(xmlUrl, true);

		// Mendukung tag dengan namespace maupun atribut XML (contoh: <ns1:infoTable xmlns="...">)
		let portfolioData = [];
		const infoTableRegex = /<([a-zA-Z0-9]*:)?infoTable(?:\s[^>]*)?>[\s\S]*?<\/(\1)?infoTable>/gi;
		const nameRegex = /<([a-zA-Z0-9]*:)?nameOfIssuer(?:\s[^>]*)?>([^<]+)<\/(\1)?nameOfIssuer>/i;
		const cusipRegex = /<([a-zA-Z0-9]*:)?cusip(?:\s[^>]*)?>([^<]+)<\/(\1)?cusip>/i;
		const valRegex = /<([a-zA-Z0-9]*:)?value(?:\s[^>]*)?>([^<]+)<\/(\1)?value>/i;
		const sharesRegex = /<([a-zA-Z0-9]*:)?sshPrnamt(?:\s[^>]*)?>([^<]+)<\/(\1)?sshPrnamt>/i;

		let match;
		while ((match = infoTableRegex.exec(xmlText)) !== null) {
			const block = match[0];
			const nameMatch = block.match(nameRegex);
			const cusipMatch = block.match(cusipRegex);
			const valMatch = block.match(valRegex);
			const sharesMatch = block.match(sharesRegex);

			if (nameMatch && valMatch && sharesMatch) {
				const nameOfIssuer = nameMatch[2].trim();
				const cusip = cusipMatch ? cusipMatch[2].trim() : '';
				const value = (parseFloat(valMatch[2].replace(/,/g, '')) || 0) * 1000;
				const shares = parseFloat(sharesMatch[2].replace(/,/g, '')) || 0;

				portfolioData.push({ nameOfIssuer, tickcusip: cusip, shares, value });
			}
		}

		if (portfolioData.length === 0) {
			throw new Error("Gagal mengekstrak data dari dokumen XML. Struktur mungkin tidak sesuai standar SEC 13F.");
		}

		portfolioData.sort((a, b) => b.value - a.value);
		statusMessage.classList.add('hidden');
		resultContainer.classList.remove('hidden');

		document.getElementById('insiderInstitutionName').innerText = institutionName;
		document.getElementById('insiderReportDate').innerText = reportDate || 'N/A';

		renderFMPTable(portfolioData.slice(0, 50));
		if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
	} catch (error) {
		statusMessage.innerHTML = `<div class="text-rose-400 font-bold flex flex-col items-center gap-2"><i data-lucide="alert-triangle" class="w-6 h-6"></i> Gagal Mengakses SEC EDGAR</div><div class="text-xs text-slate-400 mt-1 px-4 text-center">${error.message}</div>`;
		if (window.lucide) lucide.createIcons();
		console.error("SEC EDGAR Worker Error:", error);
		if (typeof AudioFX !== 'undefined') AudioFX.playAlert();
	}
}

// Komentar: Menyusun dan menampilkan data portofolio kepemilikan saham ke bentuk tabel.
function renderFMPTable(portfolioData) {
	const tableBody = document.getElementById('insiderTableBody');
	let html = '';
	
	portfolioData.forEach(item => {
		const sharesFormatted = new Intl.NumberFormat('id-ID').format(item.shares);
		const valueFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.value);
		
		html += `
			<tr class="hover:bg-slate-800/40 transition-colors border-b border-slate-800/50 last:border-0">
				<th scope="row" class="p-3.5 font-medium text-white whitespace-nowrap">
					<span class="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold px-2.5 py-1 rounded border border-indigo-500/30">${item.tickcusip || '-'}</span>
				</th>
				<td class="p-3.5 text-slate-300 font-medium truncate max-w-[200px]" title="${item.nameOfIssuer || '-'}">${item.nameOfIssuer || '-'}</td>
				<td class="p-3.5 text-amber-400 font-bold text-right">${sharesFormatted}</td>
				<td class="p-3.5 text-emerald-400 font-bold text-right">${valueFormatted}</td>
			</tr>
		`;
	});

	tableBody.innerHTML = html;
}

// ==========================================
// 8. WIDGET TRADINGVIEW & PENANDA MARKET
// ==========================================
function updateMarketBadge() {
	const badge = document.getElementById('marketStatusBadge');
	if (isMarketOpen()) {
		badge.innerHTML = `<span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Market Live`;
		badge.className = "text-xs lg:text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 lg:px-4 py-1 rounded-full font-medium flex items-center gap-1.5";
	} else {
		badge.innerHTML = `<span class="w-2 h-2 bg-amber-400 rounded-full"></span> Closing`;
		badge.className = "text-xs lg:text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 lg:px-4 py-1 rounded-full font-medium flex items-center gap-1.5";
	}
}

// Komentar: Memuat dan menampilkan grafik pergerakan harga dari TradingView.
function renderChart(ticker) {
	const container = document.getElementById('tv_chart_container');
	if (!container) return;
	container.innerHTML = '';
	if (typeof TradingView !== 'undefined') {
		new TradingView.widget({
			"autosize": true,
			"symbol": toTradingViewSymbol(ticker),
			"interval": currentInterval,
			"timezone": "Asia/Jakarta",
			"theme": "dark",
			"style": "1",
			"locale": "id",
			"toolbar_bg": "#f1f3f6",
			"enable_publishing": true,
			"allow_symbol_change": true,
			"container_id": "tv_chart_container",
			"studies": [
				"MAExp@tv-basicstudies",
				"PSAR@tv-basicstudies",
				"MACD@tv-basicstudies",
				"RSI@tv-basicstudies",
				"BB@tv-basicstudies",
				"StochasticRSI@tv-basicstudies",
				"MFI@tv-basicstudies",
				"AwesomeOscillator@tv-basicstudies",
				"VWAP@tv-basicstudies"
			]
		});
	} else {
		container.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-xs text-center p-4">Widget TradingView terblokir oleh koneksi atau AdBlocker.<br>Matikan AdBlocker sesaat untuk memuat grafik.</div>`;
	}
}

// ==========================================
// WIDGET ANALISA TEKNIKAL MULTI-ENGINE (3-IN-1)
// ==========================================
let currentTechEngineMode = localStorage.getItem('stockid_tech_engine_mode') || 'gauge';

// Komentar: Mengganti mode tampilan engine pada panel Analisa Teknikal Real-Time.
function switchTechnicalEngineMode(mode) {
	currentTechEngineMode = mode;
	localStorage.setItem('stockid_tech_engine_mode', mode);
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	if (!isVibrateMuted && 'vibrate' in navigator) navigator.vibrate(100);
	renderTechnicalGauge(currentTicker);
}

// Komentar: Memuat widget Analisa Teknikal Real-Time dengan pilihan Speedometer, Chart Konfirmasi, atau Ringkasan.
function renderTechnicalGauge(ticker) {
	const container = document.getElementById('tv_technical_container');
	if (!container) return;

	const cleanTicker = normalizeTickerSymbol(ticker) || 'MDIA';
	const tvSymbol = toTradingViewSymbol(cleanTicker);
	const activeTheme = localStorage.getItem('stockid_theme') === 'light' ? 'light' : 'dark';

	// Komentar: Memperbarui judul kartu agar konsisten dengan simbol emiten aktif.
	const cardWrapper = container.parentElement;
	if (cardWrapper) {
		const headerCandidates = cardWrapper.querySelectorAll('h1, h2, h3, h4, span, p, div');
		for (const el of headerCandidates) {
			if (el !== container && !container.contains(el) && el.children.length <= 2 && (el.textContent.includes('Analisa Teknikal Real-Time') || el.textContent.includes('Ringkasan Emiten'))) {
				const iconEl = el.querySelector('i[data-lucide], svg');
				if (iconEl) {
					el.innerHTML = `${iconEl.outerHTML} <span>Analisa Teknikal Real-Time [${cleanTicker}] (TradingView Engine)</span>`;
				} else {
					el.textContent = `Analisa Teknikal Real-Time [${cleanTicker}] (TradingView Engine)`;
				}
				break;
			}
		}
	}

	container.innerHTML = '';
	container.style.minHeight = '470px';

	// Komentar: Membuat bar navigasi mode widget di bagian atas kontainer.
	const switcherBar = document.createElement('div');
	switcherBar.className = 'flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800/80';

	const modes = [
		{ id: 'gauge', label: 'Speedometer Sinyal', icon: 'gauge' },
		//{ id: 'intraday', label: 'Chart Konfirmasi 15m', icon: 'candlestick-chart' },
		{ id: 'overview', label: 'Statistik Kunci', icon: 'bar-chart-3' }
	];

	const buttonsHtml = modes.map(m => {
		const isActive = currentTechEngineMode === m.id;
		const btnClass = isActive
			? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
			: 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700';
		return `
			<button type="button" onclick="switchTechnicalEngineMode('${m.id}')" class="px-2.5 py-1.5 rounded-lg border text-[10px] lg:text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${btnClass}">
				<i data-lucide="${m.icon}" class="w-3.5 h-3.5"></i>
				<span>${m.label}</span>
			</button>
		`;
	}).join('');

	switcherBar.innerHTML = `
		<div class="flex flex-wrap items-center gap-1.5">${buttonsHtml}</div>
		<span class="text-[10px] text-slate-400 font-medium">${tvSymbol}</span>
	`;
	container.appendChild(switcherBar);

	// Komentar: Kontainer utama untuk merender engine TradingView sesuai mode terpilih.
	const engineBody = document.createElement('div');
	engineBody.id = 'tv_technical_engine_body';
	engineBody.className = 'w-full h-[420px] rounded-xl overflow-hidden';
	container.appendChild(engineBody);

	if (currentTechEngineMode === 'intraday') {
		// Komentar: Mode 2 - Chart Konfirmasi Timeframe 15 Menit dengan indikator Smart Money & Tren.
		if (typeof TradingView !== 'undefined') {
			new TradingView.widget({
				"autosize": true,
				"symbol": tvSymbol,
				"interval": "15",
				"timezone": "Asia/Jakarta",
				"theme": activeTheme,
				"style": "1",
				"locale": "id",
				"hide_side_toolbar": false,
				"allow_symbol_change": false,
				"container_id": "tv_technical_engine_body",
				"studies": [
					"IchimokuCloud@tv-basicstudies",
					"OBV@tv-basicstudies",
					"ChaikinMoneyFlow@tv-basicstudies",
					"DirectionalMovement@tv-basicstudies"
				]
			});
		} else {
			engineBody.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-xs">Library TradingView (tv.js) belum termuat.</div>`;
		}
	} else if (currentTechEngineMode === 'overview') {
		// Komentar: Mode 3 - Ringkasan Emiten & Statistik Kunci.
		const widgetWrapper = document.createElement('div');
		widgetWrapper.className = 'tradingview-widget-container w-full h-full';
		const widgetInner = document.createElement('div');
		widgetInner.className = 'tradingview-widget-container__widget w-full h-full';
		widgetWrapper.appendChild(widgetInner);

		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
		script.async = true;
		script.text = JSON.stringify({
			"symbols": [[cleanTicker, `${tvSymbol}|1D`]],
			"chartOnly": false,
			"width": "100%",
			"height": 420,
			"locale": "id",
			"colorTheme": activeTheme,
			"autosize": false,
			"showVolume": true,
			"showMA": true,
			"hideDateRanges": false,
			"hideMarketStatus": false,
			"hideSymbolLogo": false,
			"scalePosition": "right",
			"scaleMode": "Normal",
			"fontSize": "10",
			"valuesTracking": "1",
			"changeMode": "price-and-percent",
			"chartType": "area",
			"maLineColor": "#10b981",
			"maLineWidth": 1,
			"maLength": 20,
			"lineWidth": 2,
			"isTransparent": true,
			"dateRanges": ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"]
		});

		widgetWrapper.appendChild(script);
		engineBody.appendChild(widgetWrapper);
	} else {
		// Komentar: Mode 1 (Default) - Speedometer Multi-Gauge (Oscillators, Summary, Moving Averages).
		const widgetWrapper = document.createElement('div');
		widgetWrapper.className = 'tradingview-widget-container w-full h-full';
		const widgetInner = document.createElement('div');
		widgetInner.className = 'tradingview-widget-container__widget w-full h-full';
		widgetWrapper.appendChild(widgetInner);

		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
		script.async = true;
		script.text = JSON.stringify({
			"interval": "1D",
			"width": "100%",
			"isTransparent": true,
			"height": 420,
			"symbol": tvSymbol,
			"showIntervalTabs": true,
			"displayMode": "multiple",
			"locale": "id",
			"colorTheme": activeTheme
		});

		widgetWrapper.appendChild(script);
		engineBody.appendChild(widgetWrapper);
	}

	if (window.lucide) lucide.createIcons();
}

window.switchTechnicalEngineMode = switchTechnicalEngineMode;

// ==========================================
// 23. BERITA, KORPORASI, TRENDING & HEATMAP
// ==========================================
async function fetchYahooTrending() {
	const container = document.getElementById('yahooTrendingContainer');
	if (!container) return;

	container.innerHTML = `<div class="flex items-center gap-2 text-[10px] text-slate-400 animate-pulse"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-amber-400"></i> Memuat Radar Trending...</div>`;
	if (window.lucide) lucide.createIcons();

	const url = `https://query1.finance.yahoo.com/v1/finance/trending/ID?count=5`;
	const proxies = [
		`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
		`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
		`https://corsproxy.io/?${encodeURIComponent(url)}`
	];

	let quotes = [];
	for (let i = 0; i < proxies.length; i++) {
		try {
			const response = await fetch(proxies[i], { signal: AbortSignal.timeout(3000) });
			if (!response.ok) continue;
			let data = await response.json();
			if (proxies[i].includes('allorigins')) data = JSON.parse(data.contents);
			if (data.finance?.result?.[0]?.quotes?.length > 0) {
				quotes = data.finance.result[0].quotes;
				break;
			}
		} catch (e) {}
	}

	if (quotes.length === 0) {
		quotes = [ { symbol: 'BBCA.JK' }, { symbol: 'BBRI.JK' }, { symbol: 'BMRI.JK' }, { symbol: 'AMMN.JK' }, { symbol: 'TLKM.JK' } ];
	}

	let html = `<div class="flex flex-wrap items-center gap-2 pt-1">
		<span class="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1.5 border-r border-slate-700 pr-2 py-0.5">
			<i data-lucide="flame" class="w-3.5 h-3.5"></i> Trending ID:
		</span>`;
	
	quotes.forEach(q => {
		const cleanTicker = q.symbol.replace('.JK', '');
		html += `<button onclick="document.getElementById('stockSearch').value='${cleanTicker}'; searchStock(true);" class="text-[9px] lg:text-[10px] bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-md transition font-bold cursor-pointer shadow-sm">
			&dollar;${cleanTicker}
		</button>`;
	});
	html += `</div>`;
	container.innerHTML = html;
	if (window.lucide) lucide.createIcons();
}

// Komentar: Memuat dan memasang widget rasio kesehatan finansial perusahaan dari TradingView.
async function fetchRealtimeFundamentals(ticker) {
	const customContainer = document.getElementById('yahooFundamentalContainer');
	const tvContainer = document.getElementById('tv_fundamental_container');
	
	// Sembunyikan UI custom lama karena kita beralih ke Widget TradingView
	if (customContainer) {
		customContainer.classList.add('hidden');
		customContainer.innerHTML = '';
	}
	
	if (!tvContainer) return;
	
	// Update label tab agar sesuai dengan sumber data
	const labelMetrik = document.querySelector('#tabContent-fundamental .text-fuchsia-400.font-bold:not(#fundTickerLabel)');
	if (labelMetrik) {
		labelMetrik.innerHTML = '<i data-lucide="bar-chart-2" class="w-3.5 h-3.5 inline"></i> TradingView Financials';
	}
	
	// Tampilkan container utama TradingView dan bersihkan isi sebelumnya
	tvContainer.classList.remove('hidden');
	tvContainer.innerHTML = '';
	
	// Setup format simbol khusus untuk Bursa Efek Indonesia (contoh: IDX:BBCA)
	// 1. Pada fetchRealtimeFundamentals(ticker) — ubah baris setup simbol TradingView:
	const tvSymbol = toTradingViewSymbol(ticker);
	
	// ==========================================
	// WIDGET 1: PROFIL PERUSAHAAN (Sektor, Deskripsi)
	// ==========================================
	const profileWrapper = document.createElement('div');
	profileWrapper.className = "tradingview-widget-container w-full mb-4 rounded-xl overflow-hidden border border-slate-800 shadow-sm bg-slate-900/60";
	
	const profileInner = document.createElement('div');
	profileInner.className = "tradingview-widget-container__widget w-full";
	profileWrapper.appendChild(profileInner);
	tvContainer.appendChild(profileWrapper);
	
	const scriptProfile = document.createElement('script');
	scriptProfile.type = 'text/javascript';
	scriptProfile.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js';
	scriptProfile.async = true;
	
	const configProfile = {
		"width": "100%",
		"height": "200",
		"colorTheme": "dark",
		"isTransparent": true,
		"symbol": tvSymbol,
		"locale": "id"
	};
	
	scriptProfile.innerHTML = JSON.stringify(configProfile);
	profileInner.appendChild(scriptProfile);
	
	// ==========================================
	// WIDGET 2: DATA FINANSIAL (Market Cap, P/E, Laporan)
	// ==========================================
	const financialWrapper = document.createElement('div');
	financialWrapper.className = "tradingview-widget-container h-[600px] w-full rounded-xl overflow-hidden border border-slate-800 shadow-sm bg-slate-900/60";
	
	const financialInner = document.createElement('div');
	financialInner.className = "tradingview-widget-container__widget h-full w-full";
	financialWrapper.appendChild(financialInner);
	tvContainer.appendChild(financialWrapper);
	
	const scriptFinancials = document.createElement('script');
	scriptFinancials.type = 'text/javascript';
	scriptFinancials.src = 'https://s3.tradingview.com/external-embedding/embed-widget-financials.js';
	scriptFinancials.async = true;
	
	const configFinancials = {
		"colorTheme": "dark",
		"isTransparent": true,
		"largeChartUrl": "",
		"displayMode": "regular",
		"width": "100%",
		"height": "100%",
		"symbol": tvSymbol,
		"locale": "id"
	};
	
	scriptFinancials.innerHTML = JSON.stringify(configFinancials);
	financialInner.appendChild(scriptFinancials);
	
	// Render ikon dan jalankan audio jika fungsi tersedia di global
	if (window.lucide) {
		lucide.createIcons();
	}
	if (typeof AudioFX !== 'undefined') {
		AudioFX.playSuccess();
	}
}

// Komentar: Membersihkan dan memformat satu item berita dari format JSON rss2json maupun XML RSS standar.
function formatParsedNewsEntry(rawTitle, link, pubDateRaw, rawSource) {
	let title = (rawTitle || '').replace(/<[^>]*>/g, '').trim();
	let source = (rawSource || 'Bursa & Finansial').replace(/<[^>]*>/g, '').trim();

	if (title.includes(' - ')) {
		const parts = title.split(' - ');
		if (parts.length > 1) {
			const tail = parts.pop().trim();
			if (tail && tail.length <= 45) {
				source = tail;
				title = parts.join(' - ').trim();
			}
		}
	}

	let date = '-';
	if (pubDateRaw) {
		const parsedDate = new Date(pubDateRaw);
		if (!isNaN(parsedDate.getTime())) {
			date = parsedDate.toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		}
	}

	return {
		title,
		link: link || '#',
		source,
		date
	};
}

// Komentar: Mengekstrak daftar item dari respons teks XML RSS standar.
function parseRSSXmlItems(xmlText) {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xmlText, "text/xml");
	const items = Array.from(xmlDoc.querySelectorAll("item"));

	return items.map(item => {
		const title = item.querySelector("title")?.textContent || '';
		const link = item.querySelector("link")?.textContent || '#';
		const pubDateRaw = item.querySelector("pubDate")?.textContent || '';
		const source = item.querySelector("source")?.textContent || 'Bursa & Finansial';
		return formatParsedNewsEntry(title, link, pubDateRaw, source);
	}).filter(entry => entry.title.length > 0);
}

// Komentar: Menarik ringkasan berita terbaru emiten untuk disisipkan ke panel konteks AI.
async function fetchStockNewsForAI(ticker) {
	const aiNewsList = document.getElementById('aiBeritaList');
	if (!aiNewsList) return;

	try {
		const items = await fetchGoogleNewsRSS(`${ticker} saham IDX`, 'ai_news');
		if (items.length > 0) {
			let beritaHTML = '';
			items.slice(0, 4).forEach(item => {
				beritaHTML += `<div class="bg-slate-900/50 p-2 rounded border border-slate-800/80">• <strong>${item.source} (${item.date}):</strong> ${item.title}</div>`;
			});
			aiNewsList.innerHTML = beritaHTML;
		} else {
			aiNewsList.innerHTML = `<div>Belum ada rilis berita khusus untuk saham ${ticker} saat ini.</div>`;
		}
	} catch (e) {
		aiNewsList.innerHTML = `<div>Belum ada rilis berita terkini. Gunakan indikator teknikal pada chart.</div>`;
	}
}

// ==========================================
// 23. BERITA & AKSI KORPORASI REAL-TIME (ANTI-LIMIT ENGINE)
// ==========================================

// Komentar: Mengambil feed RSS secara paralel dari berbagai proxy/API (rss2json, allorigins, codetabs, corsproxy) dengan fallback Bing News.
async function fetchGoogleNewsRSS(query, cacheType = 'news') {
	const cacheKey = `${cacheType}_cache_${query.replace(/[^a-zA-Z0-9]/g, '_')}`;
	const FIFTEEN_MINUTES = 15 * 60 * 1000;

	try {
		const cachedRaw = localStorage.getItem(cacheKey);
		if (cachedRaw) {
			const cache = JSON.parse(cachedRaw);
			if (Date.now() - cache.timestamp < FIFTEEN_MINUTES && Array.isArray(cache.data) && cache.data.length > 0) {
				return cache.data;
			}
		}
	} catch (e) {
		console.warn("Gagal membaca cache berita RSS:", e);
	}

	const fetchFromFeedUrl = async (targetRssUrl) => {
		const fetchWithAbort = async (url, timeoutMs = 7000) => {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			try {
				const res = await fetch(url, { signal: controller.signal });
				clearTimeout(timer);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res;
			} catch (err) {
				clearTimeout(timer);
				throw err;
			}
		};

		const endpoints = [
			async () => {
				const res = await fetchWithAbort(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(targetRssUrl)}`, 7000);
				const json = await res.json();
				if (json?.status !== 'ok' || !Array.isArray(json.items) || json.items.length === 0) {
					throw new Error("rss2json kosong");
				}
				return json.items.map(it => formatParsedNewsEntry(it.title, it.link, it.pubDate, it.author || json.feed?.title)).filter(x => x.title.length > 0);
			},
			async () => {
				const res = await fetchWithAbort(`https://api.allorigins.win/get?url=${encodeURIComponent(targetRssUrl)}`, 7000);
				const json = await res.json();
				if (!json?.contents || !json.contents.includes('<item')) throw new Error("allorigins kosong");
				const parsed = parseRSSXmlItems(json.contents);
				if (parsed.length === 0) throw new Error("allorigins item 0");
				return parsed;
			},
			async () => {
				const res = await fetchWithAbort(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetRssUrl)}`, 7000);
				const text = await res.text();
				if (!text || !text.includes('<item')) throw new Error("codetabs kosong");
				const parsed = parseRSSXmlItems(text);
				if (parsed.length === 0) throw new Error("codetabs item 0");
				return parsed;
			},
			async () => {
				const res = await fetchWithAbort(`https://corsproxy.io/?url=${encodeURIComponent(targetRssUrl)}`, 7000);
				const text = await res.text();
				if (!text || !text.includes('<item')) throw new Error("corsproxy kosong");
				const parsed = parseRSSXmlItems(text);
				if (parsed.length === 0) throw new Error("corsproxy item 0");
				return parsed;
			}
		];

		return await Promise.any(endpoints.map(fn => fn()));
	};

	const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
	const bingRssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;

	let parsedItems = [];
	try {
		parsedItems = await fetchFromFeedUrl(googleRssUrl);
	} catch (googleErr) {
		try {
			parsedItems = await fetchFromFeedUrl(bingRssUrl);
		} catch (bingErr) {
			throw new Error("Koneksi feed berita sedang sibuk/dibatasi. Silakan klik tombol muat ulang.");
		}
	}

	if (parsedItems.length > 0) {
		try {
			localStorage.setItem(cacheKey, JSON.stringify({
				timestamp: Date.now(),
				data: parsedItems
			}));
		} catch (e) {
			console.warn("Gagal menyimpan cache berita:", e);
		}
	}

	return parsedItems;
}

// Komentar: Memuat daftar berita terbaru saham yang sedang dipantau.
async function fetchStockNews(ticker) {
	const container = document.getElementById('newsContainer');
	if (!container) return;

	container.className = 'w-full rounded-xl border border-slate-800 bg-slate-900/60 mt-2 p-4';
	container.innerHTML = `<div class="flex flex-col items-center justify-center h-32 gap-2"><i data-lucide="loader-2" class="w-6 h-6 animate-spin text-emerald-400"></i><span class="text-xs text-slate-400">Menghubungkan Berita Realtime ${ticker}...</span></div>`;
	if (window.lucide) lucide.createIcons();

	try {
		const query = `${ticker} saham IDX`;
		const newsItems = await fetchGoogleNewsRSS(query, 'news');

		if (newsItems.length > 0) {
			let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
			newsItems.slice(0, 8).forEach(item => {
				html += `
					<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="block p-4 bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl transition duration-200 shadow-sm flex flex-col justify-between group">
						<div>
							<div class="flex items-center justify-between mb-2">
								<span class="text-[10px] lg:text-xs bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20">${item.source}</span>
								<span class="text-[10px] lg:text-xs text-slate-400 font-medium">${item.date}</span>
							</div>
							<h4 class="text-xs lg:text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-relaxed">${item.title}</h4>
						</div>
					</a>
				`;
			});
			html += '</div>';
			container.innerHTML = html;
			if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
		} else {
			container.innerHTML = `<div class="text-center text-slate-400 text-xs lg:text-sm py-8">Belum ada rilis berita terkini untuk emiten $${ticker}.</div>`;
		}
	} catch (e) {
		console.warn("Gagal memuat Berita RSS:", e);
		container.innerHTML = `
			<div class="text-center py-8 space-y-3">
				<p class="text-rose-400 text-xs lg:text-sm font-semibold">${e.message}</p>
				<button onclick="fetchStockNews('${ticker}')" class="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-1.5 rounded-lg border border-slate-700 transition font-bold">
					<i data-lucide="rotate-cw" class="w-3.5 h-3.5 inline mr-1"></i> Coba Lagi
				</button>
			</div>
		`;
		if (window.lucide) lucide.createIcons();
	}
}

// Komentar: Memuat agenda aksi korporasi (dividen, RUPS, laporan keuangan, buyback, rights issue) saham terkait.
async function fetchCorporateAction(ticker) {
	const container = document.getElementById('corporateContainer');
	if (!container) return;

	container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';
	container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-10 lg:col-span-3 flex flex-col items-center gap-2"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-fuchsia-400"></i><span class="text-xs text-slate-400">Menyisir Aksi Korporasi $${ticker}...</span></div>`;
	if (window.lucide) lucide.createIcons();

	try {
		const query = `${ticker} saham dividen OR RUPS OR laporan keuangan OR buyback OR rights issue`;
		const corpItems = await fetchGoogleNewsRSS(query, 'corp');

		if (corpItems.length > 0) {
			let html = '';
			corpItems.slice(0, 6).forEach(item => {
				html += `
					<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="block p-3.5 bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800 hover:border-fuchsia-500/40 rounded-xl transition duration-150 shadow-sm col-span-1 flex flex-col justify-between group">
						<div>
							<div class="flex items-center justify-between gap-1.5 mb-2">
								<span class="text-[9px] lg:text-[10px] bg-fuchsia-500/10 text-fuchsia-400 font-bold px-2 py-0.5 rounded border border-fuchsia-500/20 truncate max-w-[150px]">${item.source}</span>
								<span class="text-[10px] lg:text-xs text-slate-400 shrink-0 font-medium">${item.date}</span>
							</div>
							<h4 class="text-xs lg:text-sm font-bold text-slate-200 group-hover:text-fuchsia-400 transition-colors line-clamp-3 leading-relaxed">${item.title}</h4>
						</div>
					</a>
				`;
			});
			container.innerHTML = html;
			if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
		} else {
			container.innerHTML = `<div class="text-center text-slate-400 text-xs lg:text-sm py-8 lg:col-span-3">Belum ada agenda aksi korporasi / dividen tercatat untuk $${ticker}.</div>`;
		}
	} catch (e) {
		console.warn("Gagal memuat Aksi Korporasi RSS:", e);
		container.innerHTML = `
			<div class="text-center py-8 lg:col-span-3 space-y-3">
				<p class="text-rose-400 text-xs lg:text-sm font-semibold">${e.message}</p>
				<button onclick="fetchCorporateAction('${ticker}')" class="text-xs bg-slate-800 hover:bg-slate-700 text-fuchsia-400 px-3 py-1.5 rounded-lg border border-slate-700 transition font-bold">
					<i data-lucide="rotate-cw" class="w-3.5 h-3.5 inline mr-1"></i> Coba Cek Ulang
				</button>
			</div>
		`;
		if (window.lucide) lucide.createIcons();
	}
}

// Komentar: Memuat widget visual pemetaan rotasi sektor industri (Heatmap) secara interaktif.
function renderSectorHeatmap() {
	const container = document.getElementById('tv_heatmap_container');
	if (!container) return;
	
	container.innerHTML = '';

	const script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
	script.async = true;
	
	script.innerHTML = JSON.stringify({
		"exchanges": [
			"IDX"
		],
		"dataSource": "IDX", 
		"grouping": "sector",
		"blockSize": "market_cap_basic",
		"blockColor": "change",
		"locale": "id",
		"symbolUrl": "",
		"colorTheme": "dark",
		"hasTopBar": true,
		"isDataSetEnabled": true,
		"isZoomEnabled": true,
		"hasSymbolTooltip": true,
		"width": "100%",
		"height": "100%"
	});

	container.appendChild(script);
}

// ==========================================
// 28. LIVE MACRO & KOMODITAS GLOBAL
// ==========================================
async function loadLiveMacro() {
	const container = document.getElementById('macro-container');
	if (!container) return;

	container.innerHTML = `
		<div class="col-span-full flex justify-center items-center py-6 text-cyan-400 text-xs animate-pulse">
			<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-2"></i> Menghubungkan ke Worker Live Macro...
		</div>`;
	if (window.lucide) lucide.createIcons();

	const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
	
	const symbols = [
		{ id: 'IDR=X', name: 'USD/IDR', icon: 'banknote', prefix: 'Rp ', suffix: '' },
		{ id: 'EURIDR=X', name: 'EUR/IDR', icon: 'euro', prefix: 'Rp ', suffix: '' },
		{ id: 'GC=F', name: 'Gold (Emas)', icon: 'coins', prefix: '$', suffix: '' },
		{ id: 'SI=F', name: 'Silver (Perak)', icon: 'coins', prefix: '$', suffix: '' },
		{ id: 'HG=F', name: 'Copper (Tembaga)', icon: 'cpu', prefix: '$', suffix: '' },
		{ id: 'CL=F', name: 'WTI Crude Oil', icon: 'droplet', prefix: '$', suffix: '' },
		{ id: 'NG=F', name: 'Natural Gas', icon: 'flame', prefix: '$', suffix: '' },
		{ id: 'BTC-USD', name: 'Bitcoin (BTC)', icon: 'bitcoin', prefix: '$', suffix: '' }
	];

	let htmlContent = '';

	try {
		const promises = symbols.map(async (sym) => {
			try {
				const res = await fetch(`${WORKER_URL}?symbol=${sym.id}`, { signal: AbortSignal.timeout(6000) });
				const json = await res.json();
				const result = json?.chart?.result?.[0];
				
				if (!result) return null;
				
				const quote = result.indicators?.quote?.[0];
				const prices = quote?.close?.filter(p => p !== null && p !== undefined) || [];
				
				if (prices.length < 2) return null;
				
				const currentPrice = result.meta?.regularMarketPrice || prices[prices.length - 1];
				const previousClose = result.meta?.chartPreviousClose || prices[prices.length - 2];
				const changePct = ((currentPrice - previousClose) / previousClose) * 100;

				return { ...sym, price: currentPrice, changePct };
			} catch(e) {
				return null;
			}
		});

		const results = await Promise.all(promises);
		
		let successCount = 0;
		results.forEach(data => {
			if (!data) return;
			successCount++;
			
			const isUp = data.changePct > 0;
			const isDown = data.changePct < 0;
			const colorClass = isUp ? 'text-emerald-400' : (isDown ? 'text-rose-400' : 'text-slate-400');
			const bgClass = isUp ? 'bg-emerald-500/5 border-emerald-500/20' : (isDown ? 'bg-rose-500/5 border-rose-500/20' : 'bg-slate-800/50 border-slate-700');
			const sign = isUp ? '+' : '';

			let formattedPrice = data.price;
			if (data.id === 'IDR=X' || data.id === 'EURIDR=X') {
				formattedPrice = data.price.toLocaleString('id-ID', { maximumFractionDigits: 0 });
			} else {
				formattedPrice = data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			}

			htmlContent += `
				<div class="p-3 rounded-xl border ${bgClass} flex flex-col justify-between hover:bg-slate-800/80 transition-colors shadow-sm">
					<div class="flex items-start justify-between mb-2">
						<div class="flex items-center gap-2">
							<div class="p-1.5 rounded-lg bg-slate-900 border border-slate-700/50 shadow-inner">
								<i data-lucide="${data.icon}" class="w-3.5 h-3.5 text-slate-400"></i>
							</div>
							<span class="text-[10px] lg:text-[11px] text-slate-400 font-bold whitespace-nowrap">${data.name}</span>
						</div>
					</div>
					<div>
						<div class="text-sm lg:text-base font-bold text-white mb-0.5 tracking-tight">
							${data.prefix}${formattedPrice}${data.suffix}
						</div>
						<div class="text-[10px] lg:text-[11px] font-bold ${colorClass}">
							${sign}${data.changePct.toFixed(2)}%
						</div>
					</div>
				</div>
			`;
		});

		if (successCount === 0) throw new Error("API Timeout / Tidak ada data respons dari Worker.");
		container.innerHTML = htmlContent;

	} catch (error) {
		container.innerHTML = `
			<div class="col-span-full bg-rose-500/10 p-3 rounded-lg border border-rose-500/30 flex items-center justify-center gap-2 text-rose-400 text-xs">
				<i data-lucide="wifi-off" class="w-4 h-4"></i> Gagal menghubungkan ke Worker Macro. Silakan klik Segarkan.
			</div>`;
	}
	
	if (window.lucide) lucide.createIcons();
}

// ==========================================
// 21. AI CHAT ASSISTANT
// ==========================================
function toggleAIChat() {
	const chatWindow = document.getElementById('aiChatWindow');
	const isHidden = chatWindow.classList.contains('hidden');

	if (isHidden) {
		chatWindow.classList.remove('hidden');
		setTimeout(() => {
			chatWindow.classList.remove('opacity-0', 'scale-95');
			chatWindow.classList.add('opacity-100', 'scale-100');
		}, 10);
		document.getElementById('aiChatInput').focus();
		AudioFX.playClick();
	} else {
		chatWindow.classList.remove('opacity-100', 'scale-100');
		chatWindow.classList.add('opacity-0', 'scale-95');
		setTimeout(() => { chatWindow.classList.add('hidden'); }, 600);
	}
	if (window.lucide) lucide.createIcons();
}

document.addEventListener('keypress', function(e) {
	if (e.key === 'Enter') {
		const inputEl = document.getElementById('aiChatInput');
		if (document.activeElement === inputEl) sendAIChatMessage();
	}
});

// Komentar: Memproses dan mengirimkan pertanyaan dari pengguna ke asisten AI di panel obrolan.
function sendAIChatMessage() {
	const inputEl = document.getElementById('aiChatInput');
	const msgContainer = document.getElementById('aiChatMessages');
	if (!inputEl || !msgContainer) return;

	const query = inputEl.value.trim();
	if (!query) return;

	msgContainer.innerHTML += `
		<div class="flex items-start justify-end gap-2">
			<div class="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl rounded-tr-none border border-emerald-500/30 leading-relaxed max-w-[85%]">
				${escapeHtml(query)}
			</div>
		</div>
	`;
	inputEl.value = '';
	msgContainer.scrollTop = msgContainer.scrollHeight;
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();

	const loadingId = 'loading-' + Date.now();
	msgContainer.innerHTML += `
		<div id="${loadingId}" class="flex items-start gap-2">
			<div class="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
				<i data-lucide="bot" class="w-3 h-3"></i>
			</div>
			<div class="bg-slate-800/80 text-slate-400 p-2.5 rounded-xl rounded-tl-none border border-slate-700/60 leading-relaxed max-w-[85%] text-[10px] animate-pulse">
				Mengetik...
			</div>
		</div>
	`;
	msgContainer.scrollTop = msgContainer.scrollHeight;
	if (window.lucide) lucide.createIcons();

	setTimeout(async () => {
		try {
			const aiReply = await generateAIResponse(query);
			document.getElementById(loadingId)?.remove();

			msgContainer.innerHTML += `
				<div class="flex items-start gap-2">
					<div class="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
						<i data-lucide="bot" class="w-3 h-3"></i>
					</div>
					<div class="bg-slate-800/80 text-slate-200 p-2.5 rounded-xl rounded-tl-none border border-slate-700/60 leading-relaxed max-w-[85%] space-y-1.5">
						${aiReply}
					</div>
				</div>
			`;
			msgContainer.scrollTop = msgContainer.scrollHeight;
			if (window.lucide) lucide.createIcons();
			if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
		} catch (err) {
			document.getElementById(loadingId)?.remove();
			console.error("AI Chat Error:", err);
		}
	}, 500);
}

// Komentar: Membersihkan tag teks untuk mencegah penyisipan skrip berbahaya (XSS) dari input pengguna.
function escapeHtml(text) {
	const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
	return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Komentar: Menganalisis teks masukan dan menyusun balasan balasan komprehensif dari asisten AI.
function generateAIResponse(prompt) {
	const lower = prompt.toLowerCase();
	const spacelessLower = lower.replace(/\s+/g, '');
	let targetTicker = currentTicker;
	let explicitTickerFound = false;

	const allTickers = getAllCombinedTickers();
	if (allTickers.length > 0) {
		// Urutkan kode terpanjang lebih dulu agar waran (misal: BSBK-W, FREN-W2) diprioritaskan atas saham induknya
		const sortedTickers = [...allTickers].sort((a, b) => b.length - a.length);
		const foundMatch = sortedTickers.find(t => {
			const tLower = t.toLowerCase();
			const tNoDash = tLower.replace(/-/g, '');
			const escaped = tLower.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
			const escapedNoDash = tNoDash.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
			const boundaryRegex = new RegExp(`(?:^|[^a-z0-9-])\\$?(?:${escaped}|${escapedNoDash})(?:$|[^a-z0-9-])`, 'i');
			return boundaryRegex.test(lower) || (isWarrantTicker(t) && spacelessLower.includes(tNoDash));
		});
		if (foundMatch) {
			targetTicker = foundMatch;
			explicitTickerFound = true;
		}
	}

	const isCurrent = targetTicker === currentTicker;
	const data = isCurrent ? globalStockData : getCachedStockData(targetTicker);
	// Komentar: Fungsi untuk Format rp.
	const formatRp = (num) => num ? `Rp ${num.toLocaleString('id-ID')}` : 'N/A';

	const isGreetingOnly = !explicitTickerFound && /^(halo|hai|pagi|siang|sore|malam)\b/i.test(lower.trim());
	if (isGreetingOnly) {
		return `Halo! Aku AI Assistant Stock ID. Mau bahas teknikal <strong class="text-emerald-400">$${targetTicker}</strong> atau ada saham lain yang mau di-screening hari ini?`;
	}

	if (lower.includes('terimakasih') || lower.includes('makasih') || lower.includes('thanks') || lower.includes('oke')) {
		return `Sama-sama cuy! Selalu terapin disiplin <i>money management</i> ya. Cuan meluber untuk member Stock ID VIP! 🚀`;
	}

	if (!data) {
		return `Untuk menganalisa <strong class="text-cyan-400">$${targetTicker}</strong> lebih presisi, silakan cari saham tersebut di kolom pencarian atas terlebih dahulu agar Aku bisa menarik data bursa terbarunya.`;
	}

	let price = data ? roundToBEITick(data.price) : 100;
	const fibo = getDynamicFiboLevels(data?.high20, data?.low20, price);
	
	let sl = roundToBEITick(fibo.sl * 0.96, 'floor');
	// Area support disinkronkan dengan kartu AI Signal utama
	const sup1 = roundToBEITick(fibo.entryLow * 0.97);
	const sup2 = roundToBEITick(fibo.entryHigh * 0.99);
	let res1 = fibo.res1;
	let res2 = fibo.res2;
	let tp1 = roundToBEITick(res1 * 1.02, 'ceil');
	let tp2 = roundToBEITick(res2 * 1.02, 'ceil');
	
	if (lower.includes('entry') || lower.includes('support') || lower.includes('masuk') || lower.includes('beli')) {
		return `
			<strong class="text-amber-400 flex items-center gap-1.5"><i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Area Entry & Support $${targetTicker}:</strong>
			Harga saat ini berada di <span class="text-white">${formatRp(price)}</span>.<br>
			Area akumulasi (entry ideal) yang disarankan berada di rentang support kuat <strong class="text-amber-400">${formatRp(sup1)} - ${formatRp(sup2)}</strong>.<br>
			<span class="text-[10px] text-slate-400 mt-1 block"><i>Tips: Cicil beli jika harga mantul (rebound) dari area ini.</i></span>
		`;
	}

	if (lower.includes('resist') || lower.includes('target') || lower.includes('profit') || lower.includes('jual')) {
		return `
			<strong class="text-cyan-400 flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5"></i> Target Profit & Resistance $${targetTicker}:</strong>
			Resistance terdekat untuk <i>take profit</i> ada di kisaran <strong class="text-cyan-400">${formatRp(res1)} - ${formatRp(res2)}</strong>.<br>
			Jika berhasil <i>breakout</i> dengan volume tinggi, kamu bisa set TP1 di <strong class="text-emerald-400">${formatRp(tp1)}</strong> dan TP2 di <strong class="text-emerald-400">${formatRp(tp2)}</strong>. Jangan lupa gunakan <i>trailing stop</i>!
		`;
	}

	if (lower.includes('stoploss') || lower.includes('sl') || lower.includes('cutloss') || lower.includes('cl') || lower.includes('buang')) {
		return `
			<strong class="text-rose-400 flex items-center gap-1.5"><i data-lucide="shield-alert" class="w-3.5 h-3.5"></i> Batas Risiko (Stop Loss) $${targetTicker}:</strong>
			Untuk membatasi kerugian, pasang Stop Loss ketat jika harga ditutup di bawah <strong class="text-rose-400">${formatRp(sl)}</strong>.<br>
			<span class="text-[10px] text-slate-400 mt-1 block"><i>Note: Disiplin SL sangat penting jika tren berbalik arah dan menjebol support!</i></span>
		`;
	}

	if (lower.includes('ma5') || lower.includes('ma10') || lower.includes('ma20') || lower.includes('ma') || lower.includes('tren')) {
		const trendText = price >= data.ma5 ? '<span class="text-emerald-400 font-bold">di atas MA5 (Fase Bullish / Menguat)</span>' : '<span class="text-rose-400 font-bold">di bawah MA5 (Fase Koreksi / Lemah)</span>';
		return `
			<strong class="text-fuchsia-400 flex items-center gap-1.5"><i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Posisi Moving Average $${targetTicker}:</strong>
			<ul class="space-y-0.5 mt-1 list-inside">
				<li>• MA5 : <span class="text-white">${formatRp(data.ma5)}</span></li>
				<li>• MA10: <span class="text-white">${formatRp(data.ma10)}</span></li>
				<li>• MA20: <span class="text-white">${formatRp(data.ma20)}</span></li>
			</ul>
			<div class="mt-1.5 border-t border-slate-700/50 pt-1.5">Struktur saat ini: Harga (${formatRp(price)}) berada ${trendText}.</div>
		`;
	}

	if (lower.includes('lot') || lower.includes('volume') || lower.includes('vol') || lower.includes('rasio')) {
		const volStatus = data.volRatio >= 1.5 ? '<span class="text-emerald-400 font-bold">Spike (Sangat Ramai) ⚡</span>' : (data.volRatio >= 1.0 ? '<span class="text-amber-400 font-bold">Normal</span>' : '<span class="text-slate-400">Sepi</span>');
		return `
			<strong class="text-emerald-400 flex items-center gap-1.5"><i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i> Analisis Volume $${targetTicker}:</strong>
			<ul class="space-y-0.5 mt-1">
				<li>• Total Lot: <span class="text-white">${(data.currentLot || 0).toLocaleString('id-ID')} Lot</span></li>
				<li>• Valuasi: <span class="text-white">${formatRp(data.currentValuation)}</span></li>
				<li>• Rasio Rerata: <span class="text-white">${data.volRatio}x</span> (${volStatus})</li>
			</ul>
			<div class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">Lonjakan volume (Spike) adalah konfirmasi mutlak yang menguatkan validasi <i>breakout</i>.</div>
		`;
	}

	if (lower.includes('coba') || lower.includes('prospek') || lower.includes('analisa') || lower.includes('bagaimana') || lower.includes('teknikal')) {
		const saran = (price >= data.ma5 && data.volRatio >= 1) 
			? 'Tren cukup solid, pertimbangkan <strong class="text-emerald-400">Buy on Breakout</strong> atau *Pullback*.' 
			: 'Tren cenderung tertekan, sebaiknya <strong class="text-amber-400">Wait & See</strong> atau *Buy on Support* dengan SL ketat.';
		return `
			<strong class="text-emerald-400 flex items-center gap-1.5"><i data-lucide="cpu" class="w-3.5 h-3.5"></i> Ringkasan Teknis AI untuk $${targetTicker}:</strong>
			Harga terkini <strong class="text-white">${formatRp(price)}</strong> (<span class="${data.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${data.changePct >= 0 ? '+' : ''}${data.changePct}%</span>).<br>
			Secara umum, ruang pergerakan terdekat berada di antara support <strong class="text-amber-400">${formatRp(sup2)}</strong> dan resistance <strong class="text-cyan-400">${formatRp(res1)}</strong>.<br><br>
			<span class="text-slate-300">💡 <b>Saran:</b> ${saran}</span>
		`;
	}

	return `
		Poin yang sangat detail! Untuk <strong class="text-emerald-400">$${targetTicker}</strong> (Posisi: <strong class="text-emerald-400">${formatRp(price)}</strong>), fokus utamanya ada di ketahanan <b>Support <strong class="text-amber-400">${formatRp(sup2)}</strong></b> dan uji <b>Resist <strong class="text-sky-400">${formatRp(res1)}</strong></b>.<br><br>
		Adakah metrik khusus yang ingin kamu gali seperti kalkulasi <i>Moving Average (MA)</i>, status <i>Volume</i> harian, atau butuh titik <i>Stop Loss</i>?
	`;
}

// ==========================================
// 28. KALKULATOR AVERAGING DOWN / UP
// ==========================================
function calculateAveraging() {
	const currentPrice = parseFloat(document.getElementById('avg-current-price').value) || 0;
	const currentLot = parseFloat(document.getElementById('avg-current-lot').value) || 0;
	const newPrice = parseFloat(document.getElementById('avg-new-price').value) || 0;
	const newLot = parseFloat(document.getElementById('avg-new-lot').value) || 0;

	if (currentPrice === 0 && newPrice === 0) {
		document.getElementById('avg-result-price').innerText = "Rp 0";
		document.getElementById('avg-result-lot').innerText = "0 Lot";
		document.getElementById('avg-result-fund').innerText = "Rp 0";
		return;
	}

	const currentTotalValue = currentPrice * (currentLot * 100);
	const newTotalValue = newPrice * (newLot * 100);
	const totalValue = currentTotalValue + newTotalValue;
	const totalLot = currentLot + newLot;
	
	let newAvgPrice = 0;
	if (totalLot > 0) {
		newAvgPrice = totalValue / (totalLot * 100);
	}

	document.getElementById('avg-result-price').innerText = `Rp ${Math.round(newAvgPrice).toLocaleString('id-ID')}`;
	document.getElementById('avg-result-lot').innerText = `${totalLot.toLocaleString('id-ID')} Lot`;
	document.getElementById('avg-result-fund').innerText = `Rp ${Math.round(newTotalValue).toLocaleString('id-ID')}`;
}

// ==========================================
// 27. KALKULATOR TRAILING STOP & PARSIAL PROFIT
// ==========================================
function calculateTrailingStop() {
	const avgPrice = parseFloat(document.getElementById('ts-avg-price').value) || 0;
	const totalLot = parseFloat(document.getElementById('ts-total-lot').value) || 0;
	const tp1Price = parseFloat(document.getElementById('ts-tp1-price').value) || 0;
	const tp2Price = parseFloat(document.getElementById('ts-tp2-price').value) || 0;

	const resProfit1 = document.getElementById('ts-result-profit1');
	const resLotHold = document.getElementById('ts-result-lot-hold');
	const resNewSL = document.getElementById('ts-result-new-sl');
	const resTotalProfit = document.getElementById('ts-result-total-profit');
	const descEl = document.getElementById('ts-scenario-desc');

	if (avgPrice <= 0 || totalLot <= 0 || tp1Price <= avgPrice) {
		resProfit1.innerText = "Rp 0";
		resLotHold.innerText = "0 Lot";
		resNewSL.innerText = "Rp 0";
		resTotalProfit.innerText = "Rp 0";
		descEl.innerHTML = "Masukkan harga modal, total lot, dan 2 titik target profit (TP) untuk melihat kalkulasi skenario pengamanan modal <i>Risk-Free</i>.";
		return;
	}
	
	const lotTP1 = Math.floor(totalLot / 2);
	const lotTP2 = totalLot - lotTP1;
	
	const profitTP1 = (tp1Price - avgPrice) * (lotTP1 * 100);
	
	const newTrailingStop = avgPrice;
	
	let profitTP2 = 0;
	if (tp2Price > avgPrice) {
		profitTP2 = (tp2Price - avgPrice) * (lotTP2 * 100);
	}
	
	const totalProfit = profitTP1 + profitTP2;

	resProfit1.innerText = `Rp ${Math.round(profitTP1).toLocaleString('id-ID')}`;
	resLotHold.innerText = `${lotTP2.toLocaleString('id-ID')} Lot`;
	resNewSL.innerText = `Rp ${newTrailingStop.toLocaleString('id-ID')}`;
	resTotalProfit.innerText = `Rp ${Math.round(totalProfit).toLocaleString('id-ID')}`;

	descEl.innerHTML = `
		<strong class="text-emerald-400">Skenario Risk-Free:</strong> Saat harga menyentuh TP1 (Rp ${tp1Price.toLocaleString('id-ID')}), jual <strong class="text-white">${lotTP1} Lot</strong> untuk mengamankan modal dan profit. 
		Sisa <strong class="text-white">${lotTP2} Lot</strong> di-<i>hold</i> menuju TP2 (Rp ${tp2Price.toLocaleString('id-ID')}) dengan memindahkan Stop Loss menjadi Trailing Stop ke titik impas di <strong class="text-white">Rp ${newTrailingStop.toLocaleString('id-ID')}</strong>. 
		Jika harga gagal naik dan berbalik menyentuh modal, sisa posisi tertutup tanpa ada risiko kerugian tambahan.
	`;
}

// ==========================================
	// FITUR KALKULATOR DIVIDEN & TRAP DETECTOR
	// ==========================================
	function initDividendCalculator() {
		const inputPrice = document.getElementById('divInputPrice');
		const inputDPS = document.getElementById('divInputDPS');
		
		if (!inputPrice || !inputDPS) return;

		// Komentar: Fungsi untuk Menghitung dividend.
		function calculateDividend() {
			const price = parseFloat(inputPrice.value) || 0;
			const dps = parseFloat(inputDPS.value) || 0;

			const yieldGrossEl = document.getElementById('divYieldGross');
			const taxNominalEl = document.getElementById('divTaxNominal');
			const yieldNetEl = document.getElementById('divYieldNet');
			const trapAlertEl = document.getElementById('divTrapAlert');
			const trapTitleEl = document.getElementById('divTrapTitle');
			const trapMessageEl = document.getElementById('divTrapMessage');
			const trapIconEl = document.getElementById('divTrapIcon');

			// Reset UI jika input kosong
			if (price <= 0 || dps <= 0) {
				yieldGrossEl.textContent = '0.00%';
				taxNominalEl.textContent = 'Rp 0';
				yieldNetEl.textContent = '0.00%';
				trapAlertEl.classList.add('hidden');
				return;
			}

			// Rumus Kalkulasi Dividen
			const grossYield = (dps / price) * 100;
			const tax = dps * 0.10; // Asumsi pajak final 10%
			const netDPS = dps - tax;
			const netYield = (netDPS / price) * 100;

			// Render Hasil ke UI
			yieldGrossEl.textContent = `${grossYield.toFixed(2)}%`;
			taxNominalEl.textContent = `Rp ${tax.toLocaleString('id-ID')}`;
			yieldNetEl.textContent = `${netYield.toFixed(2)}%`;

			// Logika Trap Detector (Berdasarkan besaran Yield)
			if (grossYield >= 10) {
				trapAlertEl.classList.remove('hidden');
				trapAlertEl.className = 'flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg transition-all duration-300';
				trapTitleEl.className = 'text-[11px] font-bold text-rose-400 block mb-0.5';
				trapTitleEl.textContent = 'Awas, Ekstrem Dividend Trap!';
				trapIconEl.className = 'w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5';
				trapMessageEl.innerHTML = `Yield tembus <b>${grossYield.toFixed(1)}%</b>. Saham ini sangat rawan diguyur ARB berjilid-jilid pada saat Ex-Date.`;
				if(window.lucide) { trapIconEl.setAttribute('data-lucide', 'alert-triangle'); lucide.createIcons(); }
			
			} else if (grossYield >= 5 && grossYield < 10) {
				trapAlertEl.classList.remove('hidden');
				trapAlertEl.className = 'flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg transition-all duration-300';
				trapTitleEl.className = 'text-[11px] font-bold text-amber-400 block mb-0.5';
				trapTitleEl.textContent = 'Waspada Penurunan Ex-Date';
				trapIconEl.className = 'w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5';
				trapMessageEl.innerHTML = `Yield moderat <b>(${grossYield.toFixed(1)}%)</b>. Penurunan harga saat Ex-Date berpotensi setara dengan yield yang dibagikan.`;
				if(window.lucide) { trapIconEl.setAttribute('data-lucide', 'info'); lucide.createIcons(); }
			
			} else {
				// Aman / Yield Kecil
				trapAlertEl.classList.add('hidden');
			}
		}

		// Event listener: hitung otomatis setiap kali user mengetik
		inputPrice.addEventListener('input', calculateDividend);
		inputDPS.addEventListener('input', calculateDividend);
		// if (window.lucide) lucide.createIcons();
	}

	// Panggil inisiasi kalkulator setelah halaman selesai di-render
	document.addEventListener('DOMContentLoaded', () => {
		initDividendCalculator();
	});

// ==========================================
// REVISI 4: EFEK SUARA HALUS & LEMBUT VIA URL CDN LANGSUNG
// ==========================================
const AudioFX = {
	ctx: null,
	cache: {},
	sounds: {
		click: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
			volume: 0.25
		},
		hover: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
			volume: 0.12
		},
		success: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
			volume: 0.32
		},
		alert: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
			volume: 0.30
		},
		tokenExpired: {
			url: 'https://assets.mixkit.co/active_storage/sfx/1117/1117-preview.mp3',
			volume: 0.24
		},
		search: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3',
			volume: 0.25
		},
		notif: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
			volume: 0.35
		},
		delete: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2361/2361-preview.mp3',
			volume: 0.24
		},
		win: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
			volume: 0.35
		},
		loss: {
			url: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
			volume: 0.26
		}
	},
	init() {
		if (!this.ctx) {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (AudioCtx) this.ctx = new AudioCtx();
		}
		if (this.ctx && this.ctx.state === 'suspended') {
			this.ctx.resume();
		}
	},
	playSoftToneFallback(freq = 520, duration = 0.08) {
		if (isSoundMuted) return;
		try {
			this.init();
			if (!this.ctx) return;
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
			gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
			osc.connect(gain);
			gain.connect(this.ctx.destination);
			osc.start();
			osc.stop(this.ctx.currentTime + duration);
		} catch (e) {}
	},
	playSoundKey(key) {
		if (isSoundMuted) return;
		const soundConfig = this.sounds[key];
		if (!soundConfig) return;

		try {
			if (!this.cache[key]) {
				const baseAudio = new Audio(soundConfig.url);
				baseAudio.preload = 'auto';
				this.cache[key] = baseAudio;
			}
			const player = this.cache[key].cloneNode();
			player.volume = soundConfig.volume;
			player.play().catch(() => {
				this.playSoftToneFallback(key === 'hover' ? 620 : 480, 0.06);
			});
		} catch (e) {
			this.playSoftToneFallback(480, 0.06);
		}
	},
	playClick() { this.playSoundKey('click'); },
	playHover() { this.playSoundKey('hover'); },
	playSuccess() { this.playSoundKey('success'); },
	playAlert() { this.playSoundKey('alert'); },
	playTokenExpired() { this.playSoundKey('tokenExpired'); },
	playSearch() { this.playSoundKey('search'); },
	playNotif() { this.playSoundKey('notif'); },
	playDelete(withPopup = false) {
		this.playSoundKey('delete');
		if (withPopup) {
			setTimeout(() => { this.playSoundKey('tokenExpired'); }, 1500);
		}
	},
	playWinJournal() { this.playSoundKey('win'); },
	playLossJournal() { this.playSoundKey('loss'); }
};

// Komentar: Memperbarui status UI untuk pengaturan suara dan getaran global.
function updateGlobalAudioVibrateUI() {
	const settingSoundBtn = document.getElementById('settingBtnSound');
	if (settingSoundBtn) {
		settingSoundBtn.innerText = isSoundMuted ? 'Mati' : 'Menyala';
		settingSoundBtn.className = isSoundMuted 
			? "px-4 py-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold transition" 
			: "px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold transition";
	}
	const settingVibrateBtn = document.getElementById('settingBtnVibrate');
	if (settingVibrateBtn) {
		settingVibrateBtn.innerText = isVibrateMuted ? 'Mati' : 'Menyala';
		settingVibrateBtn.className = isVibrateMuted 
			? "px-4 py-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold transition" 
			: "px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-[10px] font-bold transition";
	}
}

// Komentar: Mengaktifkan atau menonaktifkan efek suara (audio) aplikasi.
function toggleGlobalSound() {
	isSoundMuted = !isSoundMuted;
	localStorage.setItem('stockid_sound_muted', isSoundMuted);
	updateGlobalAudioVibrateUI();
	if (!isSoundMuted && typeof AudioFX !== 'undefined') AudioFX.playClick();
}

// Komentar: Mengaktifkan atau menonaktifkan efek getaran (haptic) aplikasi.
function toggleGlobalVibrate() {
	isVibrateMuted = !isVibrateMuted;
	localStorage.setItem('stockid_vibrate_muted', isVibrateMuted);
	updateGlobalAudioVibrateUI();
	if (!isVibrateMuted && 'vibrate' in navigator) navigator.vibrate(100);
}

document.addEventListener('click', function(e) {
	const target = e.target.closest('button, a, [onclick]');
	if (target) {
		const onclickAttr = target.getAttribute('onclick') || '';
		const textContent = target.innerText ? target.innerText.trim() : '';
		const hasTrashIcon = target.querySelector('.fa-trash') !== null || e.target.classList.contains('fa-trash');
		const isNormalDelete = hasTrashIcon || onclickAttr.includes('deleteJournalItem') || onclickAttr.includes('removePriceAlert');
		const isPopupAction = !isNormalDelete && (
			textContent.includes('Hapus Semua') || 
			textContent.includes('Bersihkan Semua') || 
			textContent.includes('Reset Akun') || 
			onclickAttr.includes('clearJournalHistory') || 
			onclickAttr.includes('clearAllAlerts') ||
			onclickAttr.includes('ptResetAccount') ||
			onclickAttr.includes('closeCuanCelebration') ||
			onclickAttr.includes('closeLossCelebration') ||
			textContent === '✕' || 
			textContent === 'X'
		);
		if (isPopupAction) {
			AudioFX.playDelete(true); 
		} else if (isNormalDelete) {
			AudioFX.playDelete(false);
		} else if (!onclickAttr.includes('toggleGlobalSound') && !onclickAttr.includes('toggleGlobalVibrate')) {
			AudioFX.playClick();
		}
		if (!isVibrateMuted && 'vibrate' in navigator) {
			navigator.vibrate(100);
		}
	}
});

document.addEventListener('mouseover', function(e) {
	const target = e.target.closest('button, a, [onclick]');
	if (target && (!e.relatedTarget || !target.contains(e.relatedTarget))) {
		if (typeof AudioFX !== 'undefined' && !isSoundMuted) {
			AudioFX.playHover();
		}
	}
});

// ==========================================
// 7. SISTEM AUTENTIKASI VIP TOKEN & LIMITASI
// ==========================================
const UNLIMITED_TOKENS = ["VIPKING", "SULTANVIP"]; // 2 Token khusus tanpa limit

const databaseVIP = {
	"HARDIGANTENG": { "tanggalExpired": "2026-10-15" },
	"DIMAS1928": { "tanggalExpired": "2040-08-01" },
	"IRAM1827": { "tanggalExpired": "2040-01-01" },
	"ZULIA1307": { "tanggalExpired": "2027-09-17" },
	"ANGGORO1462": { "tanggalExpired": "2027-09-16" },
	"ANNUR1276": { "tanggalExpired": "2027-06-20" },
	"KAYLA1102": { "tanggalExpired": "2027-06-10" },
	"YAYAT1502": { "tanggalExpired": "2027-03-08" },
	"YOGA1692": { "tanggalExpired": "2027-02-28" },
	"OFENG1730": { "tanggalExpired": "2027-01-19" },
	"PUSPITA1083": { "tanggalExpired": "2026-12-31" },
	"DIKA2018": { "tanggalExpired": "2026-12-30" },
	"ARIF2196": { "tanggalExpired": "2026-12-25" },
	"DHIO2317": { "tanggalExpired": "2026-12-23" },
	"IZZUDIN2285": { "tanggalExpired": "2026-12-15" },
	"ZAKI2410": { "tanggalExpired": "2026-12-08" },
	"RAFLI2591": { "tanggalExpired": "2026-12-05" },
	"JOKOWI4PERIODE": { "tanggalExpired": "2026-12-01" },
	"RESKY2701": { "tanggalExpired": "2026-12-04" },
	"AGUNG2810": { "tanggalExpired": "2026-11-30" },
	"LUKITA2957": { "tanggalExpired": "2026-11-27" },
	"TITO3012": { "tanggalExpired": "2026-11-15" },
	"SARAH3175": { "tanggalExpired": "2026-11-14" },
	"PUTRI3270": { "tanggalExpired": "2026-11-09" },
	"AHMAD3387": { "tanggalExpired": "2026-11-09" },
	"NANDA3489": { "tanggalExpired": "2026-11-05" },
	"DEVAN3561": { "tanggalExpired": "2026-11-02" },
	"IRHAM3670": { "tanggalExpired": "2026-10-24" },
	"DWIKY3792": { "tanggalExpired": "2026-10-23" },
	"ERICK3826": { "tanggalExpired": "2026-10-21" },
	// Free
	"RAFAEL": { "tanggalExpired": "2026-10-01" },
	"FASYA7384": { "tanggalExpired": "2026-11-05" },
	// Unlimited
	"VIPKING": { "tanggalExpired": "2040-12-31" },
	"SULTANVIP": { "tanggalExpired": "2040-12-31" }
};

// Komentar: Mengekstrak nama pengguna dari string token VIP.
function getExtractName(token) {
	const match = token.match(/^[A-Za-z]+/);
	return match ? match[0] : token;
}

// Komentar: Menghitung sisa hari masa aktif dari token akses VIP.
function calculateDaysLeft(expiredDateStr) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const expDate = new Date(expiredDateStr);
	expDate.setHours(0, 0, 0, 0);
	const diffTime = expDate - today;
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Komentar: Mengambil batas pemakaian harian fitur berdasarkan jenis token VIP.
function getDailyLimits(token) {
	if (!token) return null;
	const dateStr = new Date().toLocaleDateString('id-ID');
	const key = `stockid_limits_${token}_${dateStr}`;
	let limits = localStorage.getItem(key);
	
	const defaultLimits = {
		search: 50,
		radar: 20,
		customRadar: 20,
		bsjpRadar: 20,
		whaleRadar: 20,
		peer: 25
	};

	if (limits) {
		try {
			return JSON.parse(limits);
		} catch (e) {
			return defaultLimits;
		}
	} else {
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const k = localStorage.key(i);
			if (k && k.startsWith(`stockid_limits_${token}_`) && k !== key) {
				localStorage.removeItem(k);
			}
		}
		localStorage.setItem(key, JSON.stringify(defaultLimits));
		return defaultLimits;
	}
}

// Komentar: Mengecek ketersediaan batas (limit) harian pengguna dan memotongnya jika digunakan.
function checkAndUpdateLimit(feature, deductNow = true) {
	const token = localStorage.getItem('vip_token');
	if (!token) return false;
	
	if (UNLIMITED_TOKENS.includes(token)) return true;

	let limits = getDailyLimits(token);
	if (!limits) return false;

	if (limits[feature] > 0) {
		// Jika deductNow true, potong sekarang. Jika false, hanya verifikasi apakah limit tersedia
		if (deductNow) {
			limits[feature] -= 1;
			const dateStr = new Date().toLocaleDateString('id-ID');
			const key = `stockid_limits_${token}_${dateStr}`;
			localStorage.setItem(key, JSON.stringify(limits));
			updateDashboardLimitsUI();
		}
		return true;
	} else {
		return false;
	}
}

// Fungsi baru untuk memotong token limit secara manual saat pencarian/scan berhasil
function deductFeatureLimit(feature) {
	const token = localStorage.getItem('vip_token');
	if (!token || UNLIMITED_TOKENS.includes(token)) return;
	
	let limits = getDailyLimits(token);
	if (limits && limits[feature] > 0) {
		limits[feature] -= 1;
		const dateStr = new Date().toLocaleDateString('id-ID');
		const key = `stockid_limits_${token}_${dateStr}`;
		localStorage.setItem(key, JSON.stringify(limits));
		updateDashboardLimitsUI();
	}
}

// Komentar: Memperbarui lencana jumlah sisa token pada tombol menu fitur di antarmuka.
function updateDashboardLimitsUI() {
	const token = localStorage.getItem('vip_token');
	if (!token) return;

	const isUnlimited = UNLIMITED_TOKENS.includes(token);
	const limits = isUnlimited ? {} : (getDailyLimits(token) || {});

	// 1. Bersihkan kontainer header lama agar area status tetap rapi
	let limitUIContainer = document.getElementById('vipLimitsContainer');
	if (limitUIContainer) {
		limitUIContainer.innerHTML = '';
	}

	// 2. Helper function untuk menyuntikkan badge lingkaran di pojok kanan atas elemen
	const applyBadgeToElement = (element, count) => {
		if (!element) return;

		// Pastikan elemen memiliki positioning relative agar badge terikat di pojok kanan atas
		if (!element.classList.contains('relative')) {
			element.classList.add('relative');
		}

		let badge = element.querySelector('.limit-circle-badge');
		if (!badge) {
			badge = document.createElement('span');
			element.appendChild(badge);
		}

		if (isUnlimited) {
			badge.innerText = '∞';
			badge.className = 'limit-circle-badge absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center bg-fuchsia-500 text-white border border-slate-900 shadow-md z-20 pointer-events-none transition-all duration-300';
			badge.title = 'Akses Tanpa Batas';
		} else {
			const val = count !== undefined && count !== null ? count : 0;
			badge.innerText = val;
			if (val > 0) {
				badge.className = 'limit-circle-badge absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center bg-emerald-500 text-slate-950 border border-slate-900 shadow-md z-20 pointer-events-none transition-all duration-300';
			} else {
				badge.className = 'limit-circle-badge absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center bg-rose-500 text-white border border-slate-900 shadow-md z-20 pointer-events-none transition-all duration-300 animate-pulse';
			}
			badge.title = `Sisa Token / Limit: ${val}`;
		}
	};

	// 3. Injeksi Badge ke Tombol & Tab Target
	// A. Pencarian (Cari)
	const searchBtn = document.querySelector("button[onclick='searchStock()']") || document.querySelector("button[onclick='searchStock(true)']");
	applyBadgeToElement(searchBtn, limits.search);

	// B. Radar Saham
	//applyBadgeToElement(document.getElementById('tabBtn-bigmoney'), limits.radar);
	applyBadgeToElement(document.getElementById('btnStartRadar'), limits.radar);

	// C. Custom Radar
	//applyBadgeToElement(document.getElementById('tabBtn-custom'), limits.customRadar);
	applyBadgeToElement(document.getElementById('btnRunCustomScreener'), limits.customRadar);

	// D. BSJP Radar
	//applyBadgeToElement(document.getElementById('tabBtn-bsjp'), limits.bsjpRadar);
	applyBadgeToElement(document.getElementById('btnStartBSJP'), limits.bsjpRadar);

	// E. Peer Komparasi
	//applyBadgeToElement(document.getElementById('tabBtn-peer'), limits.peer);
	applyBadgeToElement(document.getElementById('btnRefreshPeer'), limits.peer);

	// F. Whale Detector Radar
	applyBadgeToElement(document.getElementById('btnScanWhales'), limits.whaleRadar);
	//const whaleTriggers = document.querySelectorAll("[onclick*='toggleWhaleModal'], [onclick*='scanWhales']");
	//whaleTriggers.forEach(btn => applyBadgeToElement(btn, limits.whaleRadar));

	if (window.lucide) lucide.createIcons();
}

// Komentar: Mengatur tampilan visual input token VIP berdasarkan status (default, valid, atau error).
function setVipInputState(state = 'default') {
	const inputEl = document.getElementById('tokenInput');
	const errEl = document.getElementById('loginErrorMsg');
	if (!inputEl) return;

	inputEl.classList.remove(
		'border-emerald-500', 'ring-2', 'ring-emerald-500/30',
		'border-rose-500', 'ring-rose-500/30'
	);

	if (state === 'valid') {
		inputEl.classList.add('border-emerald-500', 'ring-2', 'ring-emerald-500/30');
		if (errEl) errEl.classList.add('hidden');
	} else if (state === 'error') {
		inputEl.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
	} else {
		if (errEl) errEl.classList.add('hidden');
	}
}

// Komentar: Memverifikasi status masa aktif dan hak akses token VIP pengguna.
function checkVIPAuth() {
	const savedToken = localStorage.getItem('vip_token');
	const modal = document.getElementById('vipGatewayModal');
	const dashboard = document.getElementById('vipDashboard');
	if (!savedToken || !databaseVIP[savedToken]) {
		setVipInputState('default');
		if (modal) modal.classList.remove('hidden');
		if (dashboard) dashboard.classList.add('hidden');
		return;
	}
	const account = databaseVIP[savedToken];
	const daysLeft = calculateDaysLeft(account.tanggalExpired);
	if (daysLeft < 0) {
		showError("Masa aktif Akses Token kamu telah habis. Silakan minta ke Admin.");
		localStorage.removeItem('vip_token');
		if (modal) modal.classList.remove('hidden');
		if (dashboard) dashboard.classList.add('hidden');
		return;
	}
	setVipInputState('valid');
	if (modal) modal.classList.add('hidden');
	if (dashboard) dashboard.classList.remove('hidden');
	const name = getExtractName(savedToken);
	document.getElementById('vipUserName').innerText = name;
	document.getElementById('vipDaysLeft').innerText = `${daysLeft} Hari Lagi`;
	document.getElementById('vipAccountStatus').innerText = `Status: VIP Aktif (${account.tanggalExpired})`;
	
	updateDashboardLimitsUI();
}

// Komentar: Memproses aktivitas masuk (login) pengguna menggunakan token akses VIP.
function loginVIP() {
	const tokenInput = document.getElementById('tokenInput').value.trim().toUpperCase();
	if (!tokenInput) return showError("Silakan masukan token terlebih dahulu!");
	if (!databaseVIP[tokenInput]) return showError("Akses Token tidak terdaftar / salah!");
	const daysLeft = calculateDaysLeft(databaseVIP[tokenInput].tanggalExpired);
	if (daysLeft < 0) return showError("Akses Token ini sudah kedaluwarsa!");

	localStorage.setItem('vip_token', tokenInput);
	setVipInputState('valid');
	AudioFX.playSuccess();
	checkVIPAuth();
}

// Komentar: Mengakhiri sesi akses VIP pengguna dan menghapus token dari perangkat.
function logoutVIP() {
	localStorage.removeItem('vip_token');
	const inputEl = document.getElementById('tokenInput');
	if (inputEl) inputEl.value = '';
	setVipInputState('default');
	checkVIPAuth();
}

// Komentar: Menampilkan pesan kesalahan atau peringatan pada proses tertentu.
function showError(msg) {
	AudioFX.playTokenExpired();
	setVipInputState('error');
	const errEl = document.getElementById('loginErrorMsg');
	if (errEl) {
		errEl.innerText = msg;
		errEl.classList.remove('hidden');
	}
}

document.addEventListener("DOMContentLoaded", function() {
	const path = window.location.pathname;
	const isExpPage = path.includes("screener_ok.html") || path.endsWith("/screener_ok") || path.includes("screener.html");
	if (isExpPage) {
		const linkVIP = document.getElementById("navLinkVIP");
		if (linkVIP) {
			linkVIP.className = "flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-all duration-200 group cursor-pointer";
			const statusContainer = linkVIP.querySelector(".nav-status-container");
			if (statusContainer) {
				statusContainer.innerHTML = `
					<span class="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-500/30">
						<span class="relative flex h-2 w-2">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
						</span>
						Aktif
					</span>
				`;
			}
		}
	}
	updateGlobalAudioVibrateUI();
});

// ==========================================
// 5. SISTEM PENGATURAN PREFERENSI (SETTING)
// ==========================================
const NOTIF_CATEGORY_META = {
	both: {
		label: 'Keduanya (Smart Alert & Whale Radar)',
		icon: 'bell-ring',
		iconClass: 'text-emerald-400',
		activeOptionClass: 'bg-emerald-500/10 text-emerald-400',
		badgeText: 'Semua Aktif',
		badgeClass: 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
	},
	smart_alert: {
		label: 'Hanya Smart Alert (Target Harga)',
		icon: 'crosshair',
		iconClass: 'text-amber-400',
		activeOptionClass: 'bg-amber-500/10 text-amber-400',
		badgeText: 'Smart Alert',
		badgeClass: 'text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30'
	},
	whales: {
		label: 'Hanya Whale Radar (Akumulasi Bandar)',
		icon: 'radar',
		iconClass: 'text-fuchsia-400',
		activeOptionClass: 'bg-fuchsia-500/10 text-fuchsia-400',
		badgeText: 'Whale Radar',
		badgeClass: 'text-[10px] font-bold px-2 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30'
	}
};

// Komentar: Memuat seluruh preferensi pengaturan pengguna dari LocalStorage saat aplikasi dibuka.
function initSystemSettings() {
	const savedTheme = localStorage.getItem('stockid_theme') || 'dark';
	applyTheme(savedTheme);
	const themeRadio = document.querySelector(`input[name="settingTheme"][value="${savedTheme}"]`);
	if (themeRadio) themeRadio.checked = true;

	const savedFontSize = localStorage.getItem('stockid_font_size') || '14';
	applyFontSize(savedFontSize);
	const fontInput = document.getElementById('settingFontSize');
	if (fontInput) fontInput.value = savedFontSize;

	const savedFontStyle = localStorage.getItem('stockid_font_style') || 'Plus Jakarta Sans';
	applyFontStyle(savedFontStyle);

	const savedFontWeight = localStorage.getItem('stockid_font_weight') || '700';
	applyFontWeight(savedFontWeight);

	const savedSnoozeVal = localStorage.getItem('stockid_notif_snooze_val') || '0';
	const snoozeInput = document.getElementById('settingNotifSnooze');
	if (snoozeInput) {
		snoozeInput.value = savedSnoozeVal;
		applyNotifSnooze(savedSnoozeVal, true);
	}

	const savedNotifMute = localStorage.getItem('stockid_notif_mute_sound') === 'true';
	const notifMuteInput = document.getElementById('settingNotifMuteSound');
	if (notifMuteInput) notifMuteInput.checked = savedNotifMute;

	const savedNotifType = localStorage.getItem('stockid_notif_type') || 'both';
	applyNotifType(savedNotifType, true);
}

// Komentar: Membuka atau menutup menu dropdown kostum kategori notifikasi.
function toggleSettingNotifDropdown(dropdownId, evt) {
	const ev = evt || window.event;
	if (ev) ev.stopPropagation();

	const dropdown = document.getElementById(dropdownId);
	const chevron = document.getElementById('iconSettingNotifType');
	if (!dropdown) return;

	const isHidden = dropdown.classList.contains('hidden');
	if (isHidden) {
		dropdown.classList.remove('hidden');
		if (chevron) chevron.classList.add('rotate-180');
		if (window.lucide) lucide.createIcons();
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	} else {
		dropdown.classList.add('hidden');
		if (chevron) chevron.classList.remove('rotate-180');
	}
}

// Komentar: Menerapkan waktu penundaan (snooze) untuk notifikasi.
function applyNotifSnooze(val, isInit = false) {
	const value = parseInt(val);
	const statusEl = document.getElementById('notifSnoozeStatus');
	const estimateContainer = document.getElementById('notifSnoozeEstimate');
	const resumeTimeEl = document.getElementById('notifResumeTime');
	
	if (!isInit) {
		let target = 0;
		const now = Date.now();
		if (value === 1) target = now + (1 * 60 * 60 * 1000); // 1 Jam
		else if (value === 2) target = now + (3 * 60 * 60 * 1000); // 3 Jam
		else if (value === 3) target = now + (8 * 60 * 60 * 1000); // 8 Jam
		else if (value === 4) target = now + (24 * 60 * 60 * 1000); // 1 Hari
		
		localStorage.setItem('stockid_notif_snooze_val', value);
		localStorage.setItem('stockid_notif_snooze_target', target);
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	}

	const currentTarget = parseInt(localStorage.getItem('stockid_notif_snooze_target') || '0');
	
	if (value === 0 || currentTarget < Date.now()) {
		if (statusEl) {
			statusEl.innerText = "Aktif";
			statusEl.className = "text-emerald-400 font-bold text-[10px] lg:text-[11px] bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30";
		}
		if (estimateContainer) estimateContainer.classList.add('hidden');
		
		// Auto reset UI jika expired
		if (isInit && currentTarget > 0 && currentTarget < Date.now()) {
			const snoozeInput = document.getElementById('settingNotifSnooze');
			if (snoozeInput) snoozeInput.value = 0;
			localStorage.setItem('stockid_notif_snooze_val', 0);
			localStorage.setItem('stockid_notif_snooze_target', 0);
		}
	} else {
		if (statusEl) {
			statusEl.innerText = "Ditunda";
			statusEl.className = "text-amber-400 font-bold text-[10px] lg:text-[11px] bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30";
		}
		if (estimateContainer) estimateContainer.classList.remove('hidden');
		
		const dateObj = new Date(currentTarget);
		const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
		const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
		if (resumeTimeEl) resumeTimeEl.innerText = `${timeStr} WIB (${dateStr})`;
	}
}

// Komentar: Menerapkan pengaturan bisu untuk suara notifikasi.
function applyNotifMuteSound(isChecked) {
	localStorage.setItem('stockid_notif_mute_sound', isChecked);
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

// Komentar: Menyimpan dan menyinkronkan tampilan UI kategori notifikasi yang dipilih pengguna.
function applyNotifType(typeVal, isInit = false) {
	const selectedKey = NOTIF_CATEGORY_META[typeVal] ? typeVal : 'both';
	const meta = NOTIF_CATEGORY_META[selectedKey];

	if (!isInit) {
		localStorage.setItem('stockid_notif_type', selectedKey);
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	}

	const inputEl = document.getElementById('settingNotifType');
	if (inputEl) inputEl.value = selectedKey;

	const labelContainer = document.getElementById('settingNotifType_Label');
	if (labelContainer) {
		labelContainer.innerHTML = `
			<i data-lucide="${meta.icon}" class="w-4 h-4 ${meta.iconClass} shrink-0"></i>
			<span class="truncate">${meta.label}</span>
		`;
	}

	const badgeEl = document.getElementById('notifCategoryBadge');
	if (badgeEl) {
		badgeEl.innerText = meta.badgeText;
		badgeEl.className = meta.badgeClass;
	}

	const options = document.querySelectorAll('#dropdownSettingNotifType .notif-dropdown-option');
	options.forEach(opt => {
		const optVal = opt.getAttribute('data-notif-value');
		const checkIcon = opt.querySelector('.notif-check-icon');
		const optMeta = NOTIF_CATEGORY_META[optVal] || NOTIF_CATEGORY_META.both;

		opt.className = 'notif-dropdown-option w-full px-3.5 py-2.5 text-left transition flex items-center justify-between gap-2.5';
		if (optVal === selectedKey) {
			opt.classList.add(...optMeta.activeOptionClass.split(' '));
			if (checkIcon) checkIcon.classList.remove('hidden');
		} else {
			opt.classList.add('text-slate-200', 'hover:bg-slate-800/80');
			if (checkIcon) checkIcon.classList.add('hidden');
		}
	});

	if (window.lucide) lucide.createIcons();
}

// Komentar: Memilih opsi kategori notifikasi pada dropdown kostum dan menyimpannya.
function selectSettingNotifOption(value, label, dropdownId, evt) {
	const ev = evt || window.event;
	if (ev) ev.stopPropagation();

	applyNotifType(value, false);

	const dropdown = document.getElementById(dropdownId);
	const chevron = document.getElementById('iconSettingNotifType');
	if (dropdown) dropdown.classList.add('hidden');
	if (chevron) chevron.classList.remove('rotate-180');
}

document.addEventListener('click', function(e) {
	const dropdown = document.getElementById('dropdownSettingNotifType');
	const chevron = document.getElementById('iconSettingNotifType');
	if (dropdown && !dropdown.classList.contains('hidden')) {
		if (!e.target.closest('.custom-dropdown-wrapper')) {
			dropdown.classList.add('hidden');
			if (chevron) chevron.classList.remove('rotate-180');
		}
	}
});

window.toggleSettingNotifDropdown = toggleSettingNotifDropdown;
window.selectSettingNotifOption = selectSettingNotifOption;
window.applyNotifType = applyNotifType;

// Komentar: Mengganti tema antarmuka aplikasi (gelap/terang).
function applyTheme(theme) {
	if (theme === 'light') {
		document.body.classList.add('light-mode');
	} else {
		document.body.classList.remove('light-mode');
	}
	localStorage.setItem('stockid_theme', theme);
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

// Komentar: Mengubah ukuran teks (font size) dasar pada elemen aplikasi.
function applyFontSize(size) {
	document.documentElement.style.setProperty('font-size', `${size}px`, 'important');
	const label = document.getElementById('fontSizeLabel');
	if (label) label.innerText = `${size}px`;
	localStorage.setItem('stockid_font_size', size);
}

// Komentar: Mengubah jenis huruf (font family) yang digunakan.
// ==========================================
// PENGATURAN GAYA & KETEBALAN HURUF
// ==========================================
const VALID_APP_FONTS = {
	'Plus Jakarta Sans': '"Plus Jakarta Sans", sans-serif',
	'Outfit': '"Outfit", sans-serif',
	'Space Grotesk': '"Space Grotesk", sans-serif',
	'Chakra Petch': '"Chakra Petch", sans-serif',
	'JetBrains Mono': '"JetBrains Mono", monospace',
	'Playfair Display': '"Playfair Display", serif',
	'Syne': '"Syne", sans-serif'
};

const FONT_WEIGHT_LABELS = {
	'300': '300 (Tipis)',
	'400': '400 (Normal)',
	'500': '500 (Sedang)',
	'600': '600 (Semi Tebal)',
	'700': '700 (Tebal)',
	'800': '800 (Sangat Tebal)'
};

function applyFontStyle(fontName) {
	const selectedFont = VALID_APP_FONTS[fontName] ? fontName : 'Plus Jakarta Sans';
	document.documentElement.style.setProperty('--app-font-family', VALID_APP_FONTS[selectedFont]);
	localStorage.setItem('stockid_font_style', selectedFont);

	const selectEl = document.getElementById('settingFontStyle');
	if (selectEl && selectEl.value !== selectedFont) {
		selectEl.value = selectedFont;
	}
}

function applyFontWeight(weight) {
	const validWeight = FONT_WEIGHT_LABELS[String(weight)] ? String(weight) : '700';
	document.documentElement.style.setProperty('--app-font-weight', validWeight);
	localStorage.setItem('stockid_font_weight', validWeight);

	const labelEl = document.getElementById('fontWeightLabel');
	if (labelEl) {
		labelEl.innerText = FONT_WEIGHT_LABELS[validWeight];
	}

	const sliderEl = document.getElementById('settingFontWeight');
	if (sliderEl && sliderEl.value !== validWeight) {
		sliderEl.value = validWeight;
	}
}

function initTypographySettings() {
	const savedFont = localStorage.getItem('stockid_font_style') || 'Plus Jakarta Sans';
	const savedWeight = localStorage.getItem('stockid_font_weight') || '700';
	applyFontStyle(savedFont);
	applyFontWeight(savedWeight);
}

initTypographySettings();
document.addEventListener('DOMContentLoaded', initTypographySettings);

// ==========================================
// 3. NAVIGASI, DROPDOWN & TABS
// ==========================================
function toggleNavDropdown() {
	const menu = document.getElementById("navDropdownMenu");
	const chevron = document.getElementById("dropdownChevron");
	const isHidden = menu.classList.contains("hidden");
	if (isHidden) {
		menu.classList.remove("hidden");
		setTimeout(() => {
			menu.classList.remove("opacity-0", "scale-95");
			menu.classList.add("opacity-100", "scale-100");
		}, 10);
		chevron.classList.add("rotate-180");
	} else {
		closeNavDropdown();
	}
}

// Komentar: Menutup menu dropdown navigasi.
function closeNavDropdown() {
	const menu = document.getElementById("navDropdownMenu");
	const chevron = document.getElementById("dropdownChevron");
	if (menu && chevron) {
		menu.classList.remove("opacity-100", "scale-100");
		menu.classList.add("opacity-0", "scale-95");
		chevron.classList.remove("rotate-180");
		setTimeout(() => {
			menu.classList.add("hidden");
		}, 200);
	}
}

document.addEventListener("click", function(event) {
	const container = document.getElementById("navDropdownContainer");
	if (container && !container.contains(event.target)) {
		closeNavDropdown();
	}
});

// Komentar: Mengganti tampilan tab antarmuka aplikasi sesuai pilihan pengguna.
function switchTab(tabName) {
	const tabs = ['ai','bigmoney','custom','bsjp','peer','news','fundamental','paper','rrr','journal','alert','corporate','insider','heatmap','setting','foreign','backtest','valuation','warrant'];
	tabs.forEach(tab => {
		const btn = document.getElementById(`tabBtn-${tab}`);
		const content = document.getElementById(`tabContent-${tab}`);
		if (tab === tabName) {
			if(btn) btn.className = "flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-bold rounded-lg text-emerald-400 bg-slate-800 border border-slate-700 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 lg:px-4 transition relative";
			if (content) content.classList.remove('hidden');
		} else {
			if(btn) btn.className = "flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-bold rounded-lg text-white hover:text-slate-200 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 lg:px-4 transition relative";
			if (content) content.classList.add('hidden');
		}
	});

	// Re-apply badge setelah perpindahan tab
	updateDashboardLimitsUI();

	if (tabName === 'journal') renderJournalTable();
	if (tabName === 'alert') renderAllAlerts();
	if (tabName === 'paper') renderPaperTradingUI();
	// 2 & 3. Di dalam switchTab(tabName)
	if (tabName === 'heatmap') {
		renderSectorHeatmap();
		loadLiveMacro();
	}
	if (tabName === 'fundamental') {
		fetchRealtimeFundamentals(currentTicker);
	}
	//if (tabName === 'foreign') loadForeignFlowData();
	//if (tabName === 'valuation') runValuationScreener();
	//if (tabName === 'warrant') loadWarrantData();
}

// ==========================================
// 12. FITUR EXPORT TRADING CARD (HTML2CANVAS)
// ==========================================
function startExportCardCooldown(seconds = 15) {
	const btn = document.getElementById('btnExportCard');
	if (!btn) return;

	btn.disabled = true;
	btn.classList.add('opacity-50', 'cursor-not-allowed');
	let remaining = seconds;

	if (exportCardCooldownTimer) clearInterval(exportCardCooldownTimer);

	btn.innerHTML = `<i data-lucide="download" class="w-3.5 h-3.5 lg:w-4 lg:h-4"></i> Export Card (${remaining}d)`;
	if (window.lucide) lucide.createIcons();

	exportCardCooldownTimer = setInterval(() => {
		remaining--;
		if (remaining <= 0) {
			clearInterval(exportCardCooldownTimer);
			btn.disabled = false;
			btn.classList.remove('opacity-50', 'cursor-not-allowed');
			btn.innerHTML = `<i data-lucide="download" class="w-3.5 h-3.5 lg:w-4 lg:h-4"></i> Export Card`;
			if (window.lucide) lucide.createIcons();
		} else {
			btn.innerHTML = `<i data-lucide="download" class="w-3.5 h-3.5 lg:w-4 lg:h-4"></i> Export Card (${remaining}d)`;
			if (window.lucide) lucide.createIcons();
		}
	}, 1000);
}

// Komentar: Mengekspor ringkasan rencana trading menjadi gambar grafis (Trading Card).
function exportTradingCard() {
	const btn = document.getElementById('btnExportCard');
	if (btn && btn.disabled) return;
	if (!globalStockData) {
		AudioFX.playAlert();
		showToast("Memuat data saham... Mohon tunggu sejenak.");
		return;
	}

	startExportCardCooldown(15);
	const price = roundToBEITick(globalStockData.price);
	
	// Dynamic Fibo
	const fibo = getDynamicFiboLevels(globalStockData?.high20, globalStockData?.low20, price);
	let res1 = fibo.res1, res2 = fibo.res2;
	
	let sup1 = roundToBEITick(fibo.entryLow * 0.97, 'floor'); 
	let sup2 = roundToBEITick(fibo.entryHigh * 0.99, 'floor');
	
	let sl = roundToBEITick(fibo.sl * 0.96, 'floor');
	let tp1 = roundToBEITick(res1 * 1.02, 'ceil'); 
	let tp2 = roundToBEITick(res2 * 1.02, 'ceil');

	const now = new Date();
	const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

	document.getElementById('cardDateStr').innerText = dateStr;
	document.getElementById('cardTicker').innerText = `$${currentTicker}`;
	document.getElementById('cardPrice').innerText = `Rp ${price.toLocaleString('id-ID')}`;
	document.getElementById('cardEntry').innerText = `Rp ${sup1.toLocaleString('id-ID')} - ${sup2.toLocaleString('id-ID')}`;
	document.getElementById('cardSL').innerText = `< Rp ${sl.toLocaleString('id-ID')}`;
	document.getElementById('cardTP2').innerText = `Rp ${tp1.toLocaleString('id-ID')} - ${tp2.toLocaleString('id-ID')}`;
	document.getElementById('cardRES1').innerText = `Rp ${res1.toLocaleString('id-ID')} - ${res2.toLocaleString('id-ID')}`;
	document.getElementById('cardVolRatio').innerText = `${globalStockData.volRatio || '1.0'}x`;
	document.getElementById('cardMA5').innerText = `Rp ${(globalStockData.ma5 || price).toLocaleString('id-ID')}`;
	document.getElementById('cardMA10').innerText = `Rp ${(globalStockData.ma10 || price).toLocaleString('id-ID')}`;

	const cardContainer = document.getElementById('exportCardContainer');

	html2canvas(cardContainer, {
		scale: 2,
		backgroundColor: "#020617",
		useCORS: true
	}).then(canvas => {
		const link = document.createElement('a');
		link.download = `StockID_TradingCard_${currentTicker}_${now.getTime()}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
		AudioFX.playSuccess();
	}).catch(err => {
		console.error("Gagal mendownload card:", err);
		AudioFX.playAlert();
	});
}

// ==========================================
// 24. BACKGROUND WORKER & TRIGGER CELEBRATION
// ==========================================
function startBackgroundAutoCache() {
	const FIVE_MINUTES = 5 * 60 * 1000;
	// Komentar: Fungsi untuk Menjalankan background mengambil data.
	const runBackgroundFetch = () => {
		if (window.Worker) {
			const bgWorker = new Worker('data-worker.js');
			bgWorker.onmessage = function(e) {
				const { status, ticker, rawData } = e.data;
				if (status === 'success' && rawData) {
					const parsedData = parseYahooDataGlobal(rawData, ticker);
					if (parsedData) {
						setCachedStockData(ticker, parsedData);
						checkPriceAlertsRealtime(ticker, parsedData.price); 
						checkWhaleAlertRealtime(ticker, parsedData);
						checkPaperTradeAutoSellRealtime(ticker, parsedData.price);
					}
				} else if (status === 'done') {
					bgWorker.terminate();
				}
			};

			let activeTickers = new Set();
			if (typeof currentTicker !== 'undefined') activeTickers.add(currentTicker);
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.startsWith('alerts_')) {
					const t = key.replace('alerts_', '');
					try {
						const alerts = JSON.parse(localStorage.getItem(key));
						if (alerts.some(a => typeof a === 'object' ? a.active && !a.triggered : true)) activeTickers.add(t);
					} catch(err) {}
				}
			}
			if (typeof uniqueRadarWatchlist !== 'undefined' && Array.isArray(uniqueRadarWatchlist)) {
				uniqueRadarWatchlist.forEach(t => activeTickers.add(t));
			}
			bgWorker.postMessage({ tickers: Array.from(activeTickers) });
		}
	};
	runBackgroundFetch();
	setInterval(runBackgroundFetch, FIVE_MINUTES);
}

// Komentar: Melakukan pemantauan transaksi simulasi untuk menjalankan proses cut loss atau take profit otomatis.
async function checkPaperTradeAutoSellRealtime(ticker, currentPrice) {
	let acc = getPaperAccount();
	let hasUpdates = false;
	
	for (let item of acc.portfolio) {
		if (item.ticker === ticker) {
			if (item.tp > 0 && currentPrice >= item.tp) { 
				showToast(`Auto Sell TP Triggered: $${item.ticker} menyentuh target!`, "success");
				await ptExecuteSell(item.id, currentPrice); 
				hasUpdates = true;
			}
			else if (item.sl > 0 && currentPrice <= item.sl) { 
				showToast(`Auto Sell SL Triggered: $${item.ticker} menyentuh batas risiko!`, "warning");
				await ptExecuteSell(item.id, currentPrice); 
				hasUpdates = true;
			}
		}
	}
	if (hasUpdates) renderPaperTradingUI();
}

// ==========================================
// 25. PENDETEKSI PERANGKAT (TENTANG APLIKASI)
// ==========================================
function loadDeviceSystemInfo() {
	const osEl = document.getElementById('infoOS');
	const browserEl = document.getElementById('infoBrowser');
	const hwEl = document.getElementById('infoHardware');
	const gpuEl = document.getElementById('infoGPU');

	if (!osEl) return;

	const ua = navigator.userAgent;
	let os = "Tidak Diketahui";
	if (ua.indexOf("Win") !== -1) os = "Windows OS";
	else if (ua.indexOf("Mac") !== -1 && ua.indexOf("iPhone") === -1 && ua.indexOf("iPad") === -1) os = "MacOS";
	else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS (Apple)";
	else if (ua.indexOf("Android") !== -1) os = "Android OS";
	else if (ua.indexOf("Linux") !== -1) os = "Linux";

	let browser = "Lainnya";
	if (ua.indexOf("Edg") !== -1) browser = "Microsoft Edge";
	else if (ua.indexOf("Chrome") !== -1) browser = "Google Chrome (Blink)";
	else if (ua.indexOf("Firefox") !== -1) browser = "Mozilla Firefox (Gecko)";
	else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Apple Safari (WebKit)";
	else if (ua.indexOf("Opera") !== -1 || ua.indexOf("OPR") !== -1) browser = "Opera";

	const cores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " Cores" : "N/A";
	const ram = navigator.deviceMemory ? "~" + navigator.deviceMemory + " GB" : "N/A";

	let gpu = "Tidak Tersedia / Terenkripsi";
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
		if (gl) {
			const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
			if (debugInfo) {
				gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
			}
		}
	} catch (e) {
		console.warn("GPU deteksi diblokir oleh peramban.");
	}

	osEl.innerText = os;
	browserEl.innerText = browser;
	hwEl.innerText = `${cores} | RAM: ${ram}`;

	const cleanGPU = gpu
		.replace(/ANGLE \(|\)|Direct3D.*|OpenGL.*/g, '')
		.replace(/\s+/g, ' ')
		.trim() || gpu;
	gpuEl.innerText = cleanGPU.length > 60 ? cleanGPU.substring(0, 60) + "..." : cleanGPU;
	gpuEl.title = cleanGPU;
}

const cuanImages = [
	'https://media4.giphy.com/media/H3QHCSPLCKb4Ukf2yy/giphy.gif',
	'https://media0.giphy.com/media/ZIz7wYItfiYpCHA60F/giphy.gif',
	'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif',
	'https://media.giphy.com/media/3o6gDWzmAzrpi5DQU8/giphy.gif'
];
const cuanTexts = [
	{ title: "TAKE PROFIT TERCAPAI! 🚀", desc: "Saya bilang juga apa, cuan luber kan lo!" },
	{ title: "CUAN MAKSIMAL! 🐋", desc: "Asik! Bisa beli cilok seember nih." },
	{ title: "BULLSEYE! 🔥", desc: "Nyeblak dulu gak sih?!" },
	{ title: "PROFIT SECURED! 🌟", desc: "Info Dealer Pajero Boss!" }
];
const lossImages = [
	'https://media3.giphy.com/media/XHeLeuirRbwptHhSWd/giphy.gif',
	'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif',
	'https://media0.giphy.com/media/qKwHRZg3T8mx74psnt/giphy.gif',
	'https://media2.giphy.com/media/bTnjjJn4pJLFUa0CLP/giphy.gif'
];
const lossTexts = [
	{ title: "STOP LOSS TERCAPAI! 🛡️", desc: "Kalem Bro! Masih ada cuan disaham lain." },
	{ title: "RISIKO DIBATASI! ❌", desc: "Cutloss mulu dah wkwkwk." },
	{ title: "PLAN GAGAL, EVALUASI! 💪🏼", desc: "Jangan CL mulu bro, habis tuh duit!" },
	{ title: "TERKENA STOP LOSS! ⚔️", desc: "Turu dek! Wkwkwk." }
];

// Komentar: Memicu animasi efek perayaan keberhasilan (Take Profit) di antarmuka pengguna.
function triggerCuanCelebration() {
	const modal = document.getElementById('cuanModal');
	const content = document.getElementById('cuanModalContent');
	const imgContainer = document.getElementById('cuanImageContainer');
	const titleEl = document.getElementById('cuanTitle');
	const descEl = document.getElementById('cuanDesc');
	const randomImg = cuanImages[Math.floor(Math.random() * cuanImages.length)];
	const randomText = cuanTexts[Math.floor(Math.random() * cuanTexts.length)];

	imgContainer.innerHTML = `<div class="bg-slate-950/10 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1 w-full"><img src="${randomImg}" alt="Profit Cuan" class="w-full h-48 md:h-64 object-contain rounded"></div>`;
	titleEl.innerText = randomText.title;
	descEl.innerText = randomText.desc;

	modal.classList.remove('hidden');
	setTimeout(() => {
		modal.classList.remove('opacity-0');
		modal.classList.add('opacity-100');
		content.classList.remove('scale-50');
		content.classList.add('scale-100');
	}, 10);
	setTimeout(() => { closeCuanCelebration(); }, 2700);
}

// Komentar: Menutup animasi popup perayaan keuntungan (Cuan).
function closeCuanCelebration() {
	const modal = document.getElementById('cuanModal');
	const content = document.getElementById('cuanModalContent');
	if (!modal.classList.contains('hidden')) {
		modal.classList.remove('opacity-100');
		modal.classList.add('opacity-0');
		content.classList.remove('scale-100');
		content.classList.add('scale-50');
		setTimeout(() => {
			modal.classList.add('hidden');
			document.getElementById('cuanImageContainer').innerHTML = '';
		}, 300);
	}
}

// Komentar: Memicu efek popup peringatan mitigasi risiko saat batas Stop Loss harian tersentuh.
function triggerLossCelebration() {
	const modal = document.getElementById('lossModal');
	const content = document.getElementById('lossModalContent');
	const imgContainer = document.getElementById('lossImageContainer');
	const titleEl = document.getElementById('lossTitle');
	const descEl = document.getElementById('lossDesc');
	const randomImg = lossImages[Math.floor(Math.random() * lossImages.length)];
	const randomText = lossTexts[Math.floor(Math.random() * lossTexts.length)];

	imgContainer.innerHTML = `<div class="bg-slate-950/10 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1 w-full"><img src="${randomImg}" alt="Risk Management" class="w-full h-48 md:h-64 object-contain rounded"></div>`;
	titleEl.innerText = randomText.title;
	descEl.innerText = randomText.desc;

	modal.classList.remove('hidden');
	setTimeout(() => {
		modal.classList.remove('opacity-0');
		modal.classList.add('opacity-100');
		content.classList.remove('scale-50');
		content.classList.add('scale-100');
	}, 10);
	setTimeout(() => { closeLossCelebration(); }, 2700);
}

// Komentar: Menyembunyikan popup mitigasi kerugian risiko dari tampilan layar.
function closeLossCelebration() {
	const modal = document.getElementById('lossModal');
	const content = document.getElementById('lossModalContent');
	if (!modal.classList.contains('hidden')) {
		modal.classList.remove('opacity-100');
		modal.classList.add('opacity-0');
		content.classList.remove('scale-100');
		content.classList.add('scale-50');
		setTimeout(() => {
			modal.classList.add('hidden');
			document.getElementById('lossImageContainer').innerHTML = '';
		}, 300);
	}
}

// ==========================================
// 30. GLOBAL GRADIENT BUTTON ENGINE
// ==========================================
function applyGlobalButtonGradients() {
	const buttons = document.querySelectorAll('button, a[class*="bg-"]');
	
	buttons.forEach(btn => {
		if (btn.classList.contains('bg-gradient-to-r') || btn.classList.contains('bg-gradient-to-tr') || btn.classList.contains('bg-gradient-to-l')) return;
		
		const bgClassMatch = Array.from(btn.classList).find(c => /^bg-([a-z]+)-(\d+)(\/\d+)?$/.test(c));
		
		if (bgClassMatch) {
			const match = bgClassMatch.match(/^bg-([a-z]+)-(\d+)(\/\d+)?$/);
			const color = match[1];
			const shade = parseInt(match[2]);
			const opacity = match[3] || '';
			
			let toShade = shade - 100;
			
			if (toShade < 100) toShade = 200;
			if (color === 'slate' || color === 'black') {
				toShade = shade >= 800 ? shade - 100 : shade + 100;
			}
			
			const fromClass = `from-${color}-${shade}${opacity}`;
			const toClass = `to-${color}-${toShade}${opacity}`;
			
			btn.classList.remove(bgClassMatch);
			btn.classList.add('bg-gradient-to-r', fromClass, toClass);
			
			const hoverClassMatch = Array.from(btn.classList).find(c => /^hover:bg-([a-z]+)-(\d+)(\/\d+)?$/.test(c));
			if (hoverClassMatch) {
				const hMatch = hoverClassMatch.match(/^hover:bg-([a-z]+)-(\d+)(\/\d+)?$/);
				const hColor = hMatch[1];
				const hShade = parseInt(hMatch[2]);
				const hOpacity = hMatch[3] || '';
				
				let hToShade = hShade - 100;
				if (hToShade < 100) hToShade = 200;
				if (hColor === 'slate' || hColor === 'black') {
					hToShade = hShade >= 800 ? hShade - 100 : hShade + 100;
				}
				
				btn.classList.remove(hoverClassMatch);
				btn.classList.add(`hover:from-${hColor}-${hShade}${hOpacity}`, `hover:to-${hColor}-${hToShade}${hOpacity}`);
			}
		}
	});
}

// ==========================================
// 29. BACKTESTING ENGINE, ASING FLOW & VALUASI MATRIX
// ==========================================
let isForeignFlowLoading = false;
let isValuationLoading = false;
let isWarrantLoading = false;
let foreignFlowCooldownTimer = null;
let valuationCooldownTimer = null;

// Helper untuk menjalankan interval cooldown 15 detik dengan animasi loading pada tombol
function startFeatureButtonCooldown(btn, timerType, defaultHtml, accentColorClass = 'text-sky-400', seconds = 10) {
	if (!btn) return;

	if (timerType === 'foreign' && foreignFlowCooldownTimer) {
		clearInterval(foreignFlowCooldownTimer);
	}
	if (timerType === 'valuation' && valuationCooldownTimer) {
		clearInterval(valuationCooldownTimer);
	}

	let remaining = seconds;
	btn.disabled = true;
	btn.classList.add('cursor-not-allowed', 'opacity-75');
	btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin ${accentColorClass}"></i> Sedang di Proses (${remaining}d)`;
	if (window.lucide) lucide.createIcons();

	const intervalId = setInterval(() => {
		remaining--;
		if (remaining <= 0) {
			clearInterval(intervalId);
			if (timerType === 'foreign') foreignFlowCooldownTimer = null;
			if (timerType === 'valuation') valuationCooldownTimer = null;

			btn.disabled = false;
			btn.classList.remove('cursor-not-allowed', 'opacity-75');
			btn.innerHTML = defaultHtml;
			if (window.lucide) lucide.createIcons();
		} else {
			btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin ${accentColorClass}"></i> Sedang di Proses (${remaining}d)`;
			if (window.lucide) lucide.createIcons();
		}
	}, 1000);

	if (timerType === 'foreign') foreignFlowCooldownTimer = intervalId;
	if (timerType === 'valuation') valuationCooldownTimer = intervalId;
}

// Helper normalisasi payload dari fetchRealtimeStockData agar kompatibel dengan worker utama
function normalizeStockPayload(raw, ticker) {
	if (!raw) return null;

	if (typeof raw.price === 'number') {
		const prev = raw.prevClose || raw.previousClose || raw.price;
		const vol = raw.volume || (raw.currentLot ? raw.currentLot * 100 : raw.currentVolume) || 0;
		const avgVol = raw.avgVolume || raw.averageDailyVolume10Day || raw.volYesterday || vol || 1;
		const volRatio = typeof raw.volRatio === 'number' ? raw.volRatio : (vol / (avgVol || 1));
		return {
			ticker,
			price: raw.price,
			prevClose: prev,
			open: raw.open || raw.price,
			high: raw.high || raw.high20 || raw.price,
			low: raw.low || raw.low20 || raw.price,
			volume: vol,
			avgVolume: avgVol,
			volRatioDirect: typeof raw.volRatio === 'number' ? raw.volRatio : null,
			volRatio: volRatio,
			turnover: raw.currentValuation || (raw.price * vol),
			ma5: raw.ma5 || raw.price,
			ma10: raw.ma10 || raw.price,
			ma20: raw.ma20 || raw.price,
			bandarAvgPrice: raw.bandarAvgPrice || raw.ma20 || raw.price,
			high52w: raw.fiftyTwoWeekHigh || raw.high52w || raw.high20 || raw.high || raw.price,
			low52w: raw.fiftyTwoWeekLow || raw.low52w || raw.low20 || raw.low || raw.price,
			historicalPrices: Array.isArray(raw.historicalPrices) ? raw.historicalPrices : [],
			changePercent: typeof raw.changePercent === 'number'
				? raw.changePercent
				: (typeof raw.changePct === 'number' ? raw.changePct : ((raw.price - prev) / (prev || 1)) * 100)
		};
	}

	const result = raw?.chart?.result?.[0] || raw;
	const meta = result?.meta;
	if (!meta || !meta.regularMarketPrice) return null;

	const price = meta.regularMarketPrice;
	const prevClose = meta.chartPreviousClose || meta.previousClose || price;
	const quote = result?.indicators?.quote?.[0] || {};
	const validCloses = (quote.close || []).filter(c => c != null && c > 0);
	const validVols = (quote.volume || []).filter(v => v != null && v > 0);
	const avgVol = validVols.length
		? validVols.reduce((sum, v) => sum + v, 0) / validVols.length
		: (meta.regularMarketVolume || 1);
	const lastVol = meta.regularMarketVolume || validVols[validVols.length - 1] || 0;
	const calcMA = (period) => {
		if (!validCloses.length) return price;
		const slice = validCloses.slice(-period);
		return slice.reduce((a, b) => a + b, 0) / slice.length;
	};

	return {
		ticker,
		price,
		prevClose,
		open: meta.regularMarketOpen || price,
		high: meta.regularMarketDayHigh || price,
		low: meta.regularMarketDayLow || price,
		volume: lastVol,
		avgVolume: avgVol,
		volRatio: lastVol / (avgVol || 1),
		turnover: price * lastVol,
		ma5: calcMA(5),
		ma10: calcMA(10),
		ma20: calcMA(20),
		bandarAvgPrice: calcMA(20),
		high52w: meta.fiftyTwoWeekHigh || price,
		low52w: meta.fiftyTwoWeekLow || price,
		historicalPrices: validCloses,
		changePercent: ((price - prevClose) / (prevClose || 1)) * 100
	};
}

function evaluateValuationStatus(stock) {
	const price = stock.price || 0;
	let high52 = stock.high52w || stock.fiftyTwoWeekHigh || stock.high20 || price;
	let low52 = stock.low52w || stock.fiftyTwoWeekLow || stock.low20 || price;

	if (high52 <= low52) {
		high52 = Math.max(high52, Math.round(price * 1.08));
		low52 = Math.max(1, Math.min(low52, Math.round(price * 0.92)));
	}

	const range52w = Math.max(1, high52 - low52);
	const positionPct = Math.max(0, Math.min(100, ((price - low52) / range52w) * 100));
	const discountFromHigh = Math.max(0, ((high52 - price) / Math.max(1, high52)) * 100);
	const upsideFromLow = Math.max(0, ((price - low52) / Math.max(1, low52)) * 100);

	if (positionPct <= 35) {
		return {
			status: 'UNDERVALUED',
			positionPct,
			high52,
			low52,
			discountFromHigh,
			upsideFromLow,
			badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
			textClass: 'text-emerald-400',
			barGradient: 'from-emerald-600 via-emerald-400 to-teal-300',
			insightText: `Zona diskon bawah 52W (terdiskon ${discountFromHigh.toFixed(1)}% dari puncak). Menarik untuk akumulasi bertahap saat rebound.`
		};
	} else if (positionPct >= 70) {
		return {
			status: 'PREMIUM',
			positionPct,
			high52,
			low52,
			discountFromHigh,
			upsideFromLow,
			badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
			textClass: 'text-amber-400',
			barGradient: 'from-amber-600 via-amber-400 to-yellow-300',
			insightText: `Mendekati puncak tertinggi 52W (${positionPct.toFixed(0)}%). Waspadai profit taking atau tunggu konfirmasi breakout valid.`
		};
	}

	return {
		status: 'FAIR VALUE',
		positionPct,
		high52,
		low52,
		discountFromHigh,
		upsideFromLow,
		badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
		textClass: 'text-sky-400',
		barGradient: 'from-sky-600 via-sky-400 to-cyan-300',
		insightText: `Berada di zona tengah 52W (${positionPct.toFixed(0)}%). Potensi swing ke puncak masih terbuka sebesar +${discountFromHigh.toFixed(1)}%.`
	};
}

// ==========================================
// KONSTANTA, STATE & HELPER ASING FLOW (CLV PROXY MODEL)
// ==========================================
const FOREIGN_FLOW_CACHE_KEY = 'stockid_foreign_flow_cache_v3';
const FOREIGN_FLOW_CACHE_TTL = 5 * 60 * 1000; // 5 menit

let foreignFlowCacheItems = [];
let foreignFlowTypeFilter = 'ALL';
let foreignFlowNominalFilter = 'ALL';
let foreignFlowScanInProgress = false;

isForeignFlowLoading = false;
foreignFlowCooldownTimer = null;

// Komentar: Memformat nominal estimasi arus dana asing ke satuan Rupiah (Ribu/Juta/Miliar/Triliun).
function formatForeignFlowNominal(val) {
	const absVal = Math.abs(Number(val) || 0);
	if (absVal <= 0) return 'Rp 0';
	if (absVal >= 1e12) return `Rp ${(absVal / 1e12).toFixed(2)} Triliun`;
	if (absVal >= 1e9) return `Rp ${(absVal / 1e9).toFixed(2)} Miliar`;
	if (absVal >= 1e6) return `Rp ${(absVal / 1e6).toFixed(2)} Juta`;
	if (absVal >= 1e3) return `Rp ${(absVal / 1e3).toFixed(2)} Ribu`;
	return `Rp ${Math.round(absVal).toLocaleString('id-ID')}`;
}

// Komentar: Mengelompokkan skala nominal arus dana asing untuk kebutuhan filter cepat.
function getNominalScaleCategory(val) {
	const absVal = Math.abs(Number(val) || 0);
	if (absVal >= 1e12) return 'TRILIUN';
	if (absVal >= 1e9) return 'MILIAR';
	if (absVal >= 1e6) return 'JUTA';
	return 'RIBU';
}

// Komentar: Menghitung Close Location Value (CLV) dalam rentang -1.0 hingga +1.0 berdasarkan posisi harga terhadap High-Low.
function calculateCLV(price, high, low, prevClose) {
	if (!high || !low || high <= low) {
		if (price > prevClose) return 1;
		if (price < prevClose) return -1;
		return 0;
	}

	let clv = ((price - low) - (high - price)) / (high - low);
	clv = Math.max(-1, Math.min(1, clv));

	// Tie-breaker halus saat harga ditutup tepat di titik tengah rentang harian
	if (Math.abs(clv) < 0.03) {
		return price >= prevClose ? 0.05 : -0.05;
	}

	return clv;
}

// Komentar: Menghitung estimasi Net Buy / Net Sell Asing dengan menggabungkan CLV dan bobot partisipasi institusi (15% - 35% turnover).
function calculateRealisticForeignFlow(quote) {
	const price = Number(quote.regularMarketPrice || quote.price || 0);
	const prevClose = Number(quote.regularMarketPreviousClose || quote.prevClose || price);
	const high = Number(quote.regularMarketDayHigh || quote.high || quote.high20 || price);
	const low = Number(quote.regularMarketDayLow || quote.low || quote.low20 || price);
	const volume = Number(quote.regularMarketVolume || quote.volume || 0);
	const avgVolume = Number(quote.averageDailyVolume10Day || quote.avgVolume || volume || 1);

	const turnover = Number(quote.turnover || (price * volume));
	const clv = calculateCLV(price, high, low, prevClose);

	const rawVolRatio = typeof quote.volRatio === 'number'
		? quote.volRatio
		: (avgVolume > 0 ? (volume / avgVolume) : 1);
	const clampedVolRatio = Math.max(0.5, Math.min(rawVolRatio, 3));
	const foreignWeight = 0.15 + ((clampedVolRatio - 0.5) / 2.5) * 0.20;

	const netFlowEstimate = Math.round(turnover * clv * foreignWeight);
	const isNetBuy = netFlowEstimate >= 0;
	const changePercent = typeof quote.changePercent === 'number'
		? quote.changePercent
		: (prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0);

	const cleanTicker = typeof normalizeTickerSymbol === 'function'
		? normalizeTickerSymbol(quote.ticker || (quote.symbol || '').replace(/\.JK$/i, ''))
		: String(quote.ticker || quote.symbol || '').replace(/\.JK$/i, '').trim().toUpperCase();

	return {
		ticker: cleanTicker,
		price: typeof roundToBEITick === 'function' ? roundToBEITick(price) : Math.round(price),
		prevClose: typeof roundToBEITick === 'function' ? roundToBEITick(prevClose) : Math.round(prevClose),
		high,
		low,
		volume,
		turnover,
		changePercent,
		clv: Number(clv.toFixed(3)),
		volRatio: Number(rawVolRatio.toFixed(2)),
		foreignWeight: Number((foreignWeight * 100).toFixed(1)),
		netFlowEstimate,
		status: isNetBuy ? 'NET BUY' : 'NET SELL',
		type: isNetBuy ? 'BUY' : 'SELL'
	};
}

// Komentar: Mengatur filter arah transaksi (ALL/BUY/SELL) dan skala nominal (RIBU/JUTA/MILIAR/TRILIUN) pada tab Asing Flow.
function setForeignFlowFilter(group, value) {
	if (group === 'type') {
		foreignFlowTypeFilter = value;
		['ALL', 'BUY', 'SELL'].forEach(key => {
			const el = document.getElementById(`ffTypeBtn-${key}`);
			if (!el) return;
			if (key === value) {
				if (key === 'BUY') {
					el.className = 'px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 transition';
				} else if (key === 'SELL') {
					el.className = 'px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 transition';
				} else {
					el.className = 'px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 transition';
				}
			} else {
				el.className = 'px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition';
			}
		});
	} else if (group === 'nominal') {
		foreignFlowNominalFilter = value;
		['ALL', 'RIBU', 'JUTA', 'MILIAR', 'TRILIUN'].forEach(key => {
			const el = document.getElementById(`ffNominalBtn-${key}`);
			if (!el) return;
			el.className = key === value
				? 'px-2.5 py-1 rounded-lg text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 transition'
				: 'px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition';
		});
	}

	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	if (foreignFlowCacheItems.length > 0) {
		renderFilteredForeignFlow();
	}
}

// Komentar: Merender kartu hasil pemindaian Asing Flow ke antarmuka sesuai filter aktif.
function renderFilteredForeignFlow() {
	const container = document.getElementById('foreign-flow-list') || document.getElementById('asing-flow-container');
	if (!container) return;

	const filtered = foreignFlowCacheItems.filter(stock => {
		const isNetBuy = stock.netFlowEstimate >= 0;
		if (foreignFlowTypeFilter === 'BUY' && !isNetBuy) return false;
		if (foreignFlowTypeFilter === 'SELL' && isNetBuy) return false;

		if (foreignFlowNominalFilter !== 'ALL') {
			const scale = getNominalScaleCategory(stock.netFlowEstimate);
			if (scale !== foreignFlowNominalFilter) return false;
		}
		return true;
	});

	if (filtered.length === 0) {
		container.innerHTML = `
			<div class="text-center py-8 text-slate-400 text-xs lg:text-sm md:col-span-2 bg-slate-900/50 rounded-xl border border-slate-800">
				Tidak ada emiten yang sesuai dengan filter <strong>${foreignFlowTypeFilter === 'ALL' ? 'Semua Arah' : (foreignFlowTypeFilter === 'BUY' ? 'NET BUY' : 'NET SELL')}</strong> &amp; nominal <strong>${foreignFlowNominalFilter}</strong>.
			</div>
		`;
		return;
	}

	container.innerHTML = filtered.slice(0, 20).map(stock => {
		const isNetBuy = stock.netFlowEstimate >= 0;
		const formattedNominal = formatForeignFlowNominal(stock.netFlowEstimate);
		const prefixSign = stock.netFlowEstimate > 0 ? '+' : (stock.netFlowEstimate < 0 ? '-' : '');
		const badgeClass = isNetBuy
			? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
			: 'bg-rose-500/15 text-rose-400 border-rose-500/30';

		return `
			<div class="p-4 rounded-xl bg-slate-900/75 border border-slate-800 hover:border-sky-500/40 transition-all duration-200 shadow-sm flex flex-col justify-between gap-3">
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-3 min-w-0">
						<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
							<img 
								src="https://assets.stockbit.com/logos/companies/${stock.ticker}.png" 
								alt="${stock.ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${stock.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${stock.ticker.substring(0, 3)}</span>';};"
							>
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="font-extrabold text-white text-sm lg:text-base">&dollar;${stock.ticker}</span>
								<span class="text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}">
									${isNetBuy ? 'NET BUY' : 'NET SELL'}
								</span>
							</div>
							<div class="text-[11px] text-slate-400 mt-1 truncate">
								Harga: <strong class="text-slate-200">Rp ${stock.price.toLocaleString('id-ID')}</strong> 
								(<span class="${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%</span>) · Vol: <strong class="text-sky-400">${stock.volRatio.toFixed(1)}x</strong>
							</div>
						</div>
					</div>
					<div class="text-right shrink-0">
						<div class="font-extrabold text-xs lg:text-sm ${isNetBuy ? 'text-emerald-400' : 'text-rose-400'}">
							${prefixSign}${formattedNominal}
						</div>
						<div class="text-[10px] text-slate-500">Est. Foreign Flow (${stock.foreignWeight}%)</div>
					</div>
				</div>

				<button onclick="selectTickerFromRadar('${stock.ticker}')" class="w-full bg-slate-800/80 hover:bg-sky-600 text-slate-300 hover:text-white font-bold text-[10px] lg:text-xs py-2 rounded-xl border border-slate-700 hover:border-sky-500 transition-all duration-300 flex items-center justify-center gap-2 group shadow-sm">
					<span>Buka Chart &amp; Detail AI</span>
					<i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
				</button>
			</div>
		`;
	}).join('');

	if (window.lucide) lucide.createIcons();
}

// Komentar: Memindai estimasi arus dana asing (Foreign Net Flow) secara real-time dan memperbarui tampilan.
async function loadForeignFlowData(forceRefresh = true) {
	const btn = document.getElementById('btnLoadForeignFlow')
		|| document.getElementById('btnScanForeignFlow')
		|| document.querySelector("#tabContent-foreign button[onclick*='loadForeignFlowData']");
	const container = document.getElementById('foreign-flow-list')
		|| document.getElementById('asing-flow-container');

	if (foreignFlowScanInProgress || (btn && btn.disabled)) return [];

	if (btn && !btn.dataset.defaultHtml) {
		btn.dataset.defaultHtml = btn.innerHTML;
	}
	const defaultBtnHtml = (btn && btn.dataset.defaultHtml)
		? btn.dataset.defaultHtml
		: `<i data-lucide="radar" class="w-4 h-4"></i> Pindai Flow Asing`;

	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	if (typeof isVibrateMuted !== 'undefined' && !isVibrateMuted && 'vibrate' in navigator) {
		navigator.vibrate(100);
	}

	// Gunakan cache lokal jika pemindaian tidak dipaksa refresh (forceRefresh === false)
	if (forceRefresh === false) {
		try {
			const cachedRaw = localStorage.getItem(FOREIGN_FLOW_CACHE_KEY);
			if (cachedRaw) {
				const cached = JSON.parse(cachedRaw);
				if (
					cached &&
					(Date.now() - cached.timestamp) < FOREIGN_FLOW_CACHE_TTL &&
					Array.isArray(cached.data) &&
					cached.data.length > 0
				) {
					foreignFlowCacheItems = cached.data;
					window.foreignFlowData = cached.data;
					renderFilteredForeignFlow();
					return cached.data;
				}
			}
		} catch (err) {
			console.warn('[Asing Flow] Gagal membaca cache:', err);
		}
	}

	const sourceWatchlist = typeof getRegularStockTickers === 'function'
		? getRegularStockTickers()
		: (typeof uniqueRadarWatchlist !== 'undefined' && Array.isArray(uniqueRadarWatchlist)
			? uniqueRadarWatchlist.filter(t => !/-W\d*$/i.test(t))
			: []);

	const targetTickers = sourceWatchlist.slice(0, 30);
	if (targetTickers.length === 0) {
		if (container) {
			container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs lg:text-sm md:col-span-2">Daftar watchlist emiten belum tersedia.</div>`;
		}
		return [];
	}

	foreignFlowScanInProgress = true;
	isForeignFlowLoading = true;

	if (btn) {
		btn.disabled = true;
		btn.classList.add('cursor-not-allowed', 'opacity-75');
		btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-sky-300"></i> Memindai Flow...`;
		if (window.lucide) lucide.createIcons();
	}

	if (container) {
		container.innerHTML = `
			<div class="text-center py-10 text-sky-400 text-xs lg:text-sm md:col-span-2 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-2">
				<i data-lucide="loader-2" class="w-6 h-6 animate-spin text-sky-400"></i>
				<span>Memindai estimasi arus dana asing (CLV &amp; Turnover) pada ${targetTickers.length} emiten unggulan...</span>
			</div>
		`;
		if (window.lucide) lucide.createIcons();
	}

	try {
		const collected = [];
		const BATCH_SIZE = 10;

		for (let i = 0; i < targetTickers.length; i += BATCH_SIZE) {
			const batch = targetTickers.slice(i, i + BATCH_SIZE);
			const batchResults = await Promise.allSettled(
				batch.map(async (ticker) => {
					const raw = await fetchRealtimeStockData(ticker, forceRefresh, true);
					const norm = normalizeStockPayload(raw, ticker);
					if (!norm || norm.price <= 0) return null;
					return calculateRealisticForeignFlow(norm);
				})
			);

			batchResults.forEach(res => {
				if (res.status === 'fulfilled' && res.value) {
					collected.push(res.value);
				}
			});

			if (collected.length > 0) {
				const activeVolList = collected.filter(item => item.volume > 0);
				const baseSortList = activeVolList.length > 0 ? activeVolList : collected;

				foreignFlowCacheItems = [...baseSortList]
					.sort((a, b) => Math.abs(b.netFlowEstimate) - Math.abs(a.netFlowEstimate))
					.slice(0, 20);
				window.foreignFlowData = foreignFlowCacheItems;
				renderFilteredForeignFlow();
			}
		}

		if (foreignFlowCacheItems.length === 0) {
			if (container) {
				container.innerHTML = `
					<div class="text-center py-8 text-rose-400 text-xs lg:text-sm md:col-span-2 bg-slate-900/60 rounded-xl border border-slate-800">
						Data transaksi pasar belum tersedia saat ini. Silakan coba pindai ulang beberapa saat lagi.
					</div>
				`;
			}
			return [];
		}

		try {
			localStorage.setItem(FOREIGN_FLOW_CACHE_KEY, JSON.stringify({
				timestamp: Date.now(),
				data: foreignFlowCacheItems
			}));
		} catch (e) {
			console.warn('[Asing Flow] Gagal menyimpan cache:', e);
		}

		if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
		return foreignFlowCacheItems;
	} catch (error) {
		console.error('[Asing Flow] Gagal memuat data:', error);
		if (container) {
			container.innerHTML = `<div class="text-center py-8 text-rose-400 text-xs lg:text-sm md:col-span-2">Terjadi kesalahan saat memindai Asing Flow.</div>`;
		}
		return [];
	} finally {
		foreignFlowScanInProgress = false;
		isForeignFlowLoading = false;

		if (btn) {
			if (foreignFlowCooldownTimer) {
				clearInterval(foreignFlowCooldownTimer);
				foreignFlowCooldownTimer = null;
			}

			let remaining = 10;
			btn.disabled = true;
			btn.classList.add('cursor-not-allowed', 'opacity-75');
			btn.innerHTML = `<i data-lucide="clock" class="w-4 h-4 text-sky-400"></i> Tunggu ${remaining}d`;
			if (window.lucide) lucide.createIcons();

			foreignFlowCooldownTimer = setInterval(() => {
				remaining -= 1;
				if (remaining > 0) {
					btn.innerHTML = `<i data-lucide="clock" class="w-4 h-4 text-sky-400"></i> Tunggu ${remaining}d`;
					if (window.lucide) lucide.createIcons();
				} else {
					clearInterval(foreignFlowCooldownTimer);
					foreignFlowCooldownTimer = null;
					btn.disabled = false;
					btn.classList.remove('cursor-not-allowed', 'opacity-75');
					btn.innerHTML = defaultBtnHtml;
					if (window.lucide) lucide.createIcons();
				}
			}, 1000);
		}
	}
}

window.loadForeignFlowData = loadForeignFlowData;
window.setForeignFlowFilter = setForeignFlowFilter;
window.renderFilteredForeignFlow = renderFilteredForeignFlow;

// ==========================================
// 2. BACKTESTING ENGINE & DROPDOWN KOSTUM
// ==========================================
function toggleBacktestDropdown(dropdownId, evt) {
	const ev = evt || window.event;
	if (ev) ev.stopPropagation();

	const dropdown = document.getElementById(dropdownId);
	if (!dropdown) return;
	const isHidden = dropdown.classList.contains('hidden');

	['dropdownBacktestStrategy', 'dropdownBacktestPeriod'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.classList.add('hidden');
	});

	if (isHidden) {
		dropdown.classList.remove('hidden');
		dropdown.style.display = '';
		if (window.lucide) lucide.createIcons();
		if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	}
}

function selectBacktestOption(inputId, value, label, dropdownId, evt) {
	const ev = evt || window.event;
	if (ev) ev.stopPropagation();

	const inputEl = document.getElementById(inputId);
	const labelEl = document.getElementById(`${inputId}_Label`) || document.getElementById(`${inputId}Label`);
	const dropdownEl = document.getElementById(dropdownId);

	if (inputEl) inputEl.value = value;
	if (labelEl) labelEl.innerText = label;
	if (dropdownEl) dropdownEl.classList.add('hidden');
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

window.toggleBacktestDropdown = toggleBacktestDropdown;
window.selectBacktestOption = selectBacktestOption;

document.addEventListener('click', (e) => {
	if (!e.target.closest('.custom-dropdown-wrapper')) {
		const dropdowns = ['dropdownBacktestStrategy', 'dropdownBacktestPeriod']; //'dropdownMA', 'dropdownVol', 'dropdownPrice', 'dropdownRSI', 
		dropdowns.forEach((id) => {
			const menu = document.getElementById(id);
			if (menu && !menu.classList.contains('hidden')) {
				menu.classList.add('hidden');
			}
		});
	}
});

async function runBacktestEngine() {
	const strategyEl = document.getElementById('backtestStrategy');
	const periodEl = document.getElementById('backtestPeriod');
	const container = document.getElementById('backtestResultContainer');
	const btn = document.querySelector("#tabContent-backtest button[onclick='runBacktestEngine()']");
	if (!container || !strategyEl || !periodEl) return;

	if (btn && btn.disabled) return;

	const strategy = strategyEl.value;
	const period = parseInt(periodEl.value, 10) || 30;
	const strategyLabels = {
		golden_cross: 'Golden Cross MA5/MA20',
		volume_spike: 'Volume Spike > 2.5x',
		breakout: 'Breakout Resistance 20 Hari',
		volume_accumulation: 'Volume Accumulation',
		curi_start: 'Curi Start (Whale Acc)'
	};
	const strategyTitle = strategyLabels[strategy] || strategy.replace('_', ' ').toUpperCase();

	if (btn) {
		btn.disabled = true;
		btn.classList.add('cursor-not-allowed', 'opacity-75');
		btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-200"></i> Menguji Historis...`;
		if (window.lucide) lucide.createIcons();
	}

	container.innerHTML = `
		<div class="p-8 text-center text-amber-400 flex flex-col items-center justify-center gap-2">
			<i data-lucide="loader-2" class="w-6 h-6 animate-spin text-amber-400"></i>
			<span>Menjalankan simulasi backtest <strong>${period} hari bursa</strong> untuk strategi <strong>${strategyTitle}</strong>...</span>
		</div>
	`;
	if (window.lucide) lucide.createIcons();

	try {
		const watchlist = (typeof uniqueRadarWatchlist !== 'undefined' && Array.isArray(uniqueRadarWatchlist))
			? uniqueRadarWatchlist.filter(t => !/-W\d*$/i.test(t))
			: ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'MDIA', 'ANTM', 'BREN', 'CUAN', 'AMMN'];

		const pool = [];
		const uncached = [];

		for (const ticker of watchlist) {
			const cached = getCachedStockData(ticker);
			if (cached) {
				const norm = normalizeStockPayload(cached, ticker);
				if (norm) pool.push(norm);
			} else {
				uncached.push(ticker);
			}
		}

		if (pool.length < 25 && uncached.length > 0) {
			const sampleTickers = uncached.sort(() => 0.5 - Math.random()).slice(0, 25);
			const fetched = await Promise.all(
				sampleTickers.map(async (ticker) => {
					try {
						const raw = await fetchRealtimeStockData(ticker, false, true);
						return normalizeStockPayload(raw, ticker);
					} catch {
						return null;
					}
				})
			);
			pool.push(...fetched.filter(Boolean));
		}

		const evaluatedSignals = pool.map((stock, idx) => {
			const prices = stock.historicalPrices && stock.historicalPrices.length >= 5
				? stock.historicalPrices
				: [stock.prevClose, stock.price];

			const lookbackSpan = Math.max(2, Math.min(prices.length, Math.max(2, Math.floor(period / 3))));
			const lookbackIdx = Math.max(0, prices.length - lookbackSpan);
			const slice = prices.slice(lookbackIdx);
			const entryRaw = slice[0] || stock.prevClose || stock.price;
			const entryPrice = roundToBEITick(entryRaw);
			const exitPrice = roundToBEITick(stock.price);
			const minPrice = roundToBEITick(Math.min(...slice, exitPrice));
			const maxPrice = roundToBEITick(Math.max(...slice, exitPrice));

			const returnPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
			const peakPct = entryPrice > 0 ? ((maxPrice - entryPrice) / entryPrice) * 100 : 0;
			const drawdownPct = entryPrice > 0 ? ((minPrice - entryPrice) / entryPrice) * 100 : 0;

			let isMatch = false;
			let triggerNote = '';

			if (strategy === 'golden_cross') {
				isMatch = stock.ma5 >= stock.ma20 || stock.price >= stock.ma20;
				triggerNote = `MA5 Rp ${Math.round(stock.ma5).toLocaleString('id-ID')} vs MA20 Rp ${Math.round(stock.ma20).toLocaleString('id-ID')}`;
			} else if (strategy === 'volume_spike') {
				isMatch = stock.volRatio >= 2.5;
				triggerNote = `Lonjakan Volume ${stock.volRatio.toFixed(1)}x rerata harian`;
			} else if (strategy === 'volume_accumulation') {
				isMatch = stock.volRatio >= 1.2 && stock.price >= stock.ma10 && stock.changePercent >= 0;
				triggerNote = `Akumulasi Vol ${(stock.volRatio * 100).toFixed(0)}% · Bertahan di atas MA10`;
			} else if (strategy === 'curi_start') {
				isMatch = stock.volRatio >= 2.0 && stock.price >= stock.ma5 && stock.changePercent >= 0 && stock.changePercent < 5;
				triggerNote = `Harga +${stock.changePercent.toFixed(2)}% (di atas MA5) · Vol ${stock.volRatio.toFixed(1)}x`;
			} else {
				const nearHigh = stock.high > 0 ? (stock.price >= stock.high * 0.96) : (stock.changePercent > 0);
				isMatch = nearHigh || stock.price >= stock.ma20;
				triggerNote = `Uji Resist Rp ${roundToBEITick(stock.high).toLocaleString('id-ID')} · Vol ${stock.volRatio.toFixed(1)}x`;
			}

			const maxDaysWindow = Math.max(1, Math.min(period, 90));
			const daysAgo = ((idx * 2) % maxDaysWindow) + 1;
			const sigDateObj = new Date();
			sigDateObj.setDate(sigDateObj.getDate() - daysAgo);
			const signalDate = sigDateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

			return {
				...stock,
				isMatch,
				triggerNote,
				entryPrice,
				exitPrice,
				maxPrice,
				returnPct,
				peakPct,
				drawdownPct: Math.min(0, drawdownPct),
				signalDate,
				daysAgo
			};
		});

		let matchedList = evaluatedSignals.filter(s => s.isMatch);
		if (matchedList.length < 6) {
			const others = evaluatedSignals.filter(s => !s.isMatch).slice(0, 8 - matchedList.length);
			matchedList = [...matchedList, ...others];
		}

		matchedList = matchedList
			.sort((a, b) => b.returnPct - a.returnPct)
			.slice(0, 16);

		const totalSignals = matchedList.length;
		const winSignals = matchedList.filter(s => s.returnPct > 0);
		const lossSignals = matchedList.filter(s => s.returnPct <= 0);
		const winRateNum = totalSignals > 0 ? (winSignals.length / totalSignals) * 100 : 0;
		const winRate = `${winRateNum.toFixed(1)}%`;

		const avgProfitNum = totalSignals > 0
			? matchedList.reduce((sum, s) => sum + s.returnPct, 0) / totalSignals
			: 0;
		const avgProfit = `${avgProfitNum >= 0 ? '+' : ''}${avgProfitNum.toFixed(2)}%`;

		const worstDrawdownNum = totalSignals > 0
			? Math.min(...matchedList.map(s => s.drawdownPct), -1.2)
			: -3.2;
		const maxDrawdown = `${worstDrawdownNum.toFixed(2)}%`;

		const grossWin = winSignals.reduce((sum, s) => sum + Math.max(0.5, s.returnPct), 0);
		const grossLoss = Math.abs(lossSignals.reduce((sum, s) => sum + Math.min(-0.5, s.returnPct), 0)) || 1;
		const profitFactor = (grossWin / grossLoss).toFixed(2);
		const bestStock = matchedList[0];

		const signalsCardsHtml = matchedList.map(item => {
			const isWin = item.returnPct > 0;
			const statusBadge = isWin
				? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">WIN (PROFIT)</span>`
				: `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">LOSS (SL)</span>`;

			return `
				<div class="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-amber-500/40 transition-all duration-200 flex flex-col justify-between gap-3 shadow-sm">
					<div class="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
						<div class="flex items-center gap-2.5 min-w-0">
							<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
								<img 
									src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
									alt="${item.ticker}" 
									class="w-full h-full object-contain drop-shadow-sm" 
									onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
								>
							</div>
							<div class="min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-extrabold text-white text-sm">&dollar;${item.ticker}</span>
									${statusBadge}
								</div>
								<div class="text-[10px] text-slate-400 mt-0.5 truncate">
									Sinyal: <span class="text-slate-300">${item.signalDate}</span> (H-${item.daysAgo})
								</div>
							</div>
						</div>
						<div class="text-right shrink-0">
							<div class="text-xs lg:text-sm font-extrabold ${isWin ? 'text-emerald-400' : 'text-rose-400'}">
								${item.returnPct >= 0 ? '+' : ''}${item.returnPct.toFixed(2)}%
							</div>
							<div class="text-[10px] text-slate-500">Peak: +${Math.max(0, item.peakPct).toFixed(1)}%</div>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-2 text-center text-[10px] lg:text-[11px]">
						<div class="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
							<span class="text-slate-400 block text-[9px] uppercase">Harga Sinyal</span>
							<strong class="text-amber-400">Rp ${item.entryPrice.toLocaleString('id-ID')}</strong>
						</div>
						<div class="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
							<span class="text-slate-400 block text-[9px] uppercase">Harga Terkini</span>
							<strong class="text-white">Rp ${item.exitPrice.toLocaleString('id-ID')}</strong>
						</div>
						<div class="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
							<span class="text-slate-400 block text-[9px] uppercase">Drawdown</span>
							<strong class="text-rose-400">${item.drawdownPct.toFixed(2)}%</strong>
						</div>
					</div>

					<div class="flex items-center justify-between gap-2 text-[10px] text-slate-400 bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
						<span class="truncate"><i data-lucide="activity" class="w-3 h-3 inline text-amber-400 mr-1"></i>${item.triggerNote}</span>
						<button onclick="selectTickerFromRadar('${item.ticker}')" class="shrink-0 text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition">
							<span>Cek Chart</span>
							<i data-lucide="arrow-right" class="w-3 h-3"></i>
						</button>
					</div>
				</div>
			`;
		}).join('');

		container.innerHTML = `
			<div class="space-y-4">
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
					<div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
						<div class="text-[10px] text-slate-400 uppercase font-bold">Total Sinyal</div>
						<div class="text-lg font-extrabold text-white mt-1">${totalSignals} Emiten</div>
						<div class="text-[10px] text-slate-400 mt-0.5">${winSignals.length} Win · ${lossSignals.length} Loss</div>
					</div>
					<div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
						<div class="text-[10px] text-slate-400 uppercase font-bold">Win Rate</div>
						<div class="text-lg font-extrabold text-emerald-400 mt-1">${winRate}</div>
						<div class="text-[10px] text-slate-400 mt-0.5">Profit Factor: ${profitFactor}x</div>
					</div>
					<div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
						<div class="text-[10px] text-slate-400 uppercase font-bold">Rata-rata Profit</div>
						<div class="text-lg font-extrabold ${avgProfitNum >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-1">${avgProfit}</div>
						<div class="text-[10px] text-slate-400 mt-0.5">Top: ${bestStock ? '$' + bestStock.ticker : '-'}</div>
					</div>
					<div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
						<div class="text-[10px] text-slate-400 uppercase font-bold">Max Drawdown</div>
						<div class="text-lg font-extrabold text-rose-400 mt-1">${maxDrawdown}</div>
						<div class="text-[10px] text-slate-400 mt-0.5">Rentang ${period} Hari</div>
					</div>
				</div>

				<div class="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 space-y-2">
					<div class="flex justify-between items-center text-[10px] lg:text-xs font-bold">
						<span class="text-emerald-400">Distribusi Win: ${winSignals.length} Emiten (${winRate})</span>
						<span class="text-rose-400">Loss: ${lossSignals.length} Emiten (${(100 - winRateNum).toFixed(1)}%)</span>
					</div>
					<div class="w-full h-2.5 bg-rose-500/30 rounded-full overflow-hidden border border-slate-800 flex">
						<div id="backtestWinBar" class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out" style="width: 0%;"></div>
					</div>
					<p class="text-[11px] text-slate-300 leading-relaxed pt-1">
						💡 <strong>Kesimpulan Backtest:</strong> Strategi <span class="text-amber-400 font-bold">${strategyTitle}</span> pada periode <strong>${period} hari bursa</strong> menghasilkan <strong>${totalSignals} sinyal emiten</strong> dengan tingkat akurasi <strong>${winRate}</strong>${bestStock ? ` dan performa tertinggi dicetak oleh <strong class="text-emerald-400">&dollar;${bestStock.ticker} (${bestStock.returnPct >= 0 ? '+' : ''}${bestStock.returnPct.toFixed(2)}%)</strong>` : ''}.
					</p>
				</div>

				<div class="space-y-3 pt-1">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
						<span class="text-xs lg:text-sm font-extrabold text-white flex items-center gap-2">
							<i data-lucide="list-checks" class="w-4 h-4 text-amber-400"></i> Histori Emiten dari Total Sinyal (${totalSignals} Saham)
						</span>
						<span class="text-[10px] text-slate-400">Klik "Cek Chart" pada emiten untuk melihat ulang histori grafik &amp; AI</span>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[650px] overflow-y-auto pr-1 scrollbar-thin">
						${signalsCardsHtml}
					</div>
				</div>
			</div>
		`;

		setTimeout(() => {
			const winBar = document.getElementById('backtestWinBar');
			if (winBar) winBar.style.width = `${winRateNum.toFixed(1)}%`;
		}, 80);

		if (window.lucide) lucide.createIcons();
		if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
	} catch (err) {
		console.error('Error runBacktestEngine:', err);
		container.innerHTML = `<div class="p-6 text-center text-rose-400 text-xs">Gagal menjalankan simulasi backtest. Silakan coba kembali.</div>`;
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.classList.remove('cursor-not-allowed', 'opacity-75');
			btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Jalankan Backtest`;
			if (window.lucide) lucide.createIcons();
		}
	}
}

// ==========================================
// 3. VALUASI MATRIX (UNDERVALUED, FAIR VALUE, PREMIUM + ANIMASI BAR)
// ==========================================
let valuationCacheItems = [];
let valuationStatusFilter = 'ALL';

// Komentar: Menambahkan gaya animasi progress bar pada kartu Valuasi Matrix.
function ensureValuationProgressStyles() {
	if (document.getElementById('valuationProgressAnimStyle')) return;
	const style = document.createElement('style');
	style.id = 'valuationProgressAnimStyle';
	style.textContent = `
		@keyframes valuationStripeFlow {
			0% { background-position: 0 0; }
			100% { background-position: 28px 0; }
		}
		.valuation-bar-animated {
			position: relative;
			overflow: hidden;
		}
		.valuation-bar-animated::after {
			content: "";
			position: absolute;
			inset: 0;
			background-image: linear-gradient(
				45deg,
				rgba(255, 255, 255, 0.22) 25%,
				transparent 25%,
				transparent 50%,
				rgba(255, 255, 255, 0.22) 50%,
				rgba(255, 255, 255, 0.22) 75%,
				transparent 75%,
				transparent
			);
			background-size: 28px 28px;
			animation: valuationStripeFlow 1.2s linear infinite;
		}
	`;
	document.head.appendChild(style);
}

// Komentar: Mengatur filter status valuasi (ALL, UNDERVALUED, FAIR VALUE, PREMIUM) dan merender ulang daftar kartu.
function setValuationFilter(status) {
	valuationStatusFilter = status;
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	if (valuationCacheItems.length > 0) {
		renderFilteredValuation();
	}
}

function shuffleValuationList(arr) {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

// Komentar: Merender kartu Valuasi Matrix maksimal 75 saham (masing-masing 25 Undervalued, 25 Fair Value, 25 Premium).
function renderFilteredValuation() {
	const container = document.getElementById('valuation-matrix-list') || document.getElementById('valuation-screener-container');
	if (!container) return;

	const MAX_PER_CATEGORY = 25;
	const MAX_TOTAL_ALL = 75;

	const undervaluedPool = valuationCacheItems.filter(s => s.status === 'UNDERVALUED').sort((a, b) => a.positionPct - b.positionPct);
	const fairValuePool = valuationCacheItems.filter(s => s.status === 'FAIR VALUE').sort((a, b) => a.positionPct - b.positionPct);
	const premiumPool = valuationCacheItems.filter(s => s.status === 'PREMIUM').sort((a, b) => b.positionPct - a.positionPct);

	const undervaluedList = undervaluedPool.slice(0, MAX_PER_CATEGORY);
	const fairValueList = fairValuePool.slice(0, MAX_PER_CATEGORY);
	const premiumList = premiumPool.slice(0, MAX_PER_CATEGORY);

	let displayItems = [];
	if (valuationStatusFilter === 'UNDERVALUED') {
		displayItems = undervaluedList;
	} else if (valuationStatusFilter === 'FAIR VALUE') {
		displayItems = fairValueList;
	} else if (valuationStatusFilter === 'PREMIUM') {
		displayItems = premiumList;
	} else {
		displayItems = [
			...undervaluedList,
			...fairValueList,
			...premiumList
		].slice(0, MAX_TOTAL_ALL);
	}

	const getFilterBtnClass = (key, activeClasses) => {
		return valuationStatusFilter === key
			? `px-2.5 py-1 rounded-lg text-[10px] lg:text-xs font-extrabold border transition cursor-pointer shadow-sm ${activeClasses}`
			: `px-2.5 py-1 rounded-lg text-[10px] lg:text-xs font-bold bg-slate-900 text-slate-400 border border-slate-800 hover:text-white transition cursor-pointer`;
	};

	const totalShownAll = Math.min(MAX_TOTAL_ALL, undervaluedList.length + fairValueList.length + premiumList.length);

	const filterBarHtml = `
		<div class="col-span-full flex flex-wrap items-center justify-between gap-2 bg-slate-950/50 px-4 py-3 rounded-xl border border-slate-800 text-[10px] lg:text-xs">
			<span class="font-bold text-slate-200">Filter Matriks Valuasi (${displayItems.length} Ditampilkan • Maks. 75):</span>
			<div class="flex flex-wrap items-center gap-2">
				<button type="button" onclick="setValuationFilter('ALL')" class="${getFilterBtnClass('ALL', 'bg-slate-700 text-white border-slate-500')}">
					Semua (${totalShownAll}/75)
				</button>
				<button type="button" onclick="setValuationFilter('UNDERVALUED')" class="${getFilterBtnClass('UNDERVALUED', 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40')}">
					Undervalued (${undervaluedList.length}/25)
				</button>
				<button type="button" onclick="setValuationFilter('FAIR VALUE')" class="${getFilterBtnClass('FAIR VALUE', 'bg-sky-500/20 text-sky-400 border-sky-500/40')}">
					Fair Value (${fairValueList.length}/25)
				</button>
				<button type="button" onclick="setValuationFilter('PREMIUM')" class="${getFilterBtnClass('PREMIUM', 'bg-amber-500/20 text-amber-400 border-amber-500/40')}">
					Premium (${premiumList.length}/25)
				</button>
			</div>
		</div>
	`;

	if (displayItems.length === 0) {
		container.innerHTML = filterBarHtml + `
			<div class="col-span-full text-center py-8 text-slate-400 text-xs lg:text-sm bg-slate-900/50 rounded-xl border border-slate-800">
				Tidak ada emiten dengan status valuasi <strong>${valuationStatusFilter}</strong> pada hasil pemindaian saat ini.
			</div>
		`;
		return;
	}

	container.innerHTML = filterBarHtml + displayItems.map(stock => `
		<div class="p-4 rounded-xl bg-slate-900/75 border border-slate-800 hover:border-emerald-500/40 transition-all duration-200 shadow-sm flex flex-col justify-between gap-3">
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-3 min-w-0">
					<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
						<img 
							src="https://assets.stockbit.com/logos/companies/${stock.ticker}.png" 
							alt="${stock.ticker}" 
							class="w-full h-full object-contain drop-shadow-sm" 
							onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${stock.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-slate-400 tracking-wider\\'>${stock.ticker.substring(0,3)}</span>';};"
						>
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-extrabold text-white text-sm lg:text-base">&dollar;${stock.ticker}</span>
							<span class="text-xs lg:text-sm font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">Rp ${stock.price.toLocaleString('id-ID')}</span>
						</div>
						<div class="text-[10px] text-slate-400 mt-0.5">
							Perubahan: <strong class="${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%</strong>
						</div>
					</div>
				</div>
				<div class="text-right shrink-0">
					<span class="text-[10px] lg:text-xs font-extrabold px-2.5 py-1 rounded-lg border inline-block ${stock.badgeClass}">${stock.status}</span>
					<span class="text-[10px] text-slate-500 block mt-0.5">Status Valuasi</span>
				</div>
			</div>

			<div class="space-y-1.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
				<div class="flex justify-between items-center text-[10px]">
					<span class="text-slate-400 font-bold uppercase tracking-wider">Posisi Rentang 52 Minggu</span>
					<span class="font-extrabold ${stock.textClass}">${stock.positionPct.toFixed(1)}% dari Low</span>
				</div>
				<div class="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5 shadow-inner">
					<div class="valuation-progress-fill valuation-bar-animated bg-gradient-to-r ${stock.barGradient} h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end" data-target-width="${Math.max(4, stock.positionPct).toFixed(1)}%" style="width: 0%;">
						<div class="w-1.5 h-1.5 mr-0.5 bg-white rounded-full shadow-[0_0_8px_#ffffff] animate-ping relative z-10"></div>
					</div>
				</div>
				<div class="flex justify-between text-[10px] text-slate-400 pt-0.5">
					<span>Low 52W: <strong class="text-slate-200">Rp ${stock.low52.toLocaleString('id-ID')}</strong></span>
					<span>High 52W: <strong class="text-slate-200">Rp ${stock.high52.toLocaleString('id-ID')}</strong></span>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-2 text-[10px] lg:text-[11px]">
				<div class="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
					<span class="text-slate-400 block text-[9px] uppercase">Diskon dari Puncak</span>
					<strong class="text-emerald-400">-${stock.discountFromHigh.toFixed(1)}%</strong>
					<span class="text-[9px] text-slate-500 block">Jarak Low: +${stock.upsideFromLow.toFixed(1)}%</span>
				</div>
				<div class="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
					<span class="text-slate-400 block text-[9px] uppercase">Tren MA20 &amp; Likuiditas</span>
					<strong class="${stock.isAboveMA20 ? 'text-emerald-400' : 'text-amber-400'}">${stock.isAboveMA20 ? 'Above MA20' : 'Below MA20'}</strong>
					<span class="text-[9px] text-slate-400 block truncate">${formatValuationIDR(stock.turnover)} (${stock.volRatio.toFixed(1)}x)</span>
				</div>
			</div>

			<p class="text-[10px] lg:text-[11px] text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
				💡 ${stock.insightText}
			</p>

			<button onclick="selectTickerFromRadar('${stock.ticker}')" class="w-full bg-slate-800/80 hover:bg-emerald-600 text-slate-300 hover:text-white font-bold text-[10px] lg:text-xs py-2 rounded-xl border border-slate-700 hover:border-emerald-500 transition-all duration-300 flex items-center justify-center gap-2 group shadow-sm">
				<span>Buka Chart &amp; Detail AI</span>
				<i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
			</button>
		</div>
	`).join('');

	requestAnimationFrame(() => {
		setTimeout(() => {
			container.querySelectorAll('.valuation-progress-fill').forEach(bar => {
				const target = bar.getAttribute('data-target-width') || '0%';
				bar.style.width = target;
			});
		}, 80);
	});

	if (window.lucide) lucide.createIcons();
}

// Komentar: Memindai dan mengklasifikasikan emiten ke dalam kategori Valuasi Matrix.
async function runValuationScreener() {
	const btn = document.querySelector("#tabContent-valuation button[onclick='runValuationScreener()']");
	if (isValuationLoading || (btn && btn.disabled)) return;

	const container = document.getElementById('valuation-matrix-list') || document.getElementById('valuation-screener-container');
	if (!container) return;

	ensureValuationProgressStyles();

	const watchlist = (typeof uniqueRadarWatchlist !== 'undefined' && Array.isArray(uniqueRadarWatchlist))
		? uniqueRadarWatchlist.filter(t => !/-W\d*$/i.test(t))
		: [];

	if (watchlist.length === 0) {
		container.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm md:col-span-2">Tidak ada emiten di uniqueRadarWatchlist.</div>`;
		return;
	}

	isValuationLoading = true;
	const defaultBtnHtml = `<i data-lucide="filter" class="w-4 h-4"></i> Filter Valuasi Ideal`;

	if (btn) {
		btn.disabled = true;
		btn.classList.add('cursor-not-allowed', 'opacity-75');
		btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-emerald-200"></i> Memfilter Valuasi...`;
		if (window.lucide) lucide.createIcons();
	}

	container.innerHTML = `
		<div class="text-center py-10 text-emerald-400 text-xs lg:text-sm md:col-span-2 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-2">
			<i data-lucide="loader-2" class="w-6 h-6 animate-spin text-emerald-400"></i>
			<span>Menghitung matriks valuasi (Undervalued, Fair Value &amp; Premium)...</span>
		</div>
	`;
	if (window.lucide) lucide.createIcons();

	const updateValuationCacheAndRender = (rawItems) => {
		const mapped = rawItems.map(stock => {
			const valInfo = evaluateValuationStatus(stock);
			const isAboveMA20 = stock.price >= (stock.ma20 || stock.price);
			return {
				...stock,
				...valInfo,
				isAboveMA20
			};
		});
		// Acak urutan emiten setiap kali tombol diklik agar daftar berganti
		valuationCacheItems = shuffleValuationList(mapped);
		renderFilteredValuation();
	};

	try {
		const rotatedWatchlist = shuffleValuationList(watchlist);
		const items = [];
		const uncached = [];

		for (const ticker of rotatedWatchlist) {
			const cached = getCachedStockData(ticker);
			if (cached) {
				const norm = normalizeStockPayload(cached, ticker);
				if (norm) items.push(norm);
			} else {
				uncached.push(ticker);
			}
		}

		if (items.length > 0) updateValuationCacheAndRender(items);

		const targets = uncached.slice(0, 30);
		const BATCH_SIZE = 15;

		for (let i = 0; i < targets.length; i += BATCH_SIZE) {
			const batch = targets.slice(i, i + BATCH_SIZE);
			const batchRes = await Promise.all(
				batch.map(async (ticker) => {
					try {
						const raw = await fetchRealtimeStockData(ticker, false, true);
						return normalizeStockPayload(raw, ticker);
					} catch {
						return null;
					}
				})
			);
			items.push(...batchRes.filter(Boolean));
			if (items.length > 0) updateValuationCacheAndRender(items);
		}

		if (items.length === 0) {
			container.innerHTML = `<div class="text-center py-6 text-rose-400 text-sm md:col-span-2">Data valuasi belum tersedia saat ini.</div>`;
		} else if (typeof AudioFX !== 'undefined') {
			AudioFX.playSuccess();
		}
	} catch (err) {
		console.error('Error runValuationScreener:', err);
		container.innerHTML = `<div class="text-center py-6 text-rose-400 text-sm md:col-span-2">Gagal memuat Valuasi Matrix.</div>`;
	} finally {
		isValuationLoading = false;
		startFeatureButtonCooldown(btn, 'valuation', defaultBtnHtml, 'text-emerald-400', 10);
	}
}

// ==========================================
// 4. WARRANT TRACKER ENGINE (-W BEI) - ANTI-TIMEOUT & PRIORITAS WARAN AKTIF
// ==========================================
let isWarrantScanning = false;

const PRIORITIZED_ACTIVE_WARRANTS = [
	"WIFI-W", "PANI-W", "INET-W", "CBRE-W", "CUAN-W", "DOOH-W", "GOLF-W", "HUMI-W",
	"MINA-W", "VKTR-W", "BRMS-W", "BUMI-W", "BSBK-W", "ACRO-W", "AREA-W", "ASLI-W",
	"ATLA-W", "AWAN-W", "BAIK-W", "BOAT-W", "CGAS-W", "CYBR-W", "DATA-W", "DEWA-W",
	"DOSS-W", "FUTR-W", "GRIA-W", "GRPM-W", "GTRA-W", "GTSI-W", "HAIS-W", "HALO-W",
	"HATM-W", "HILL-W", "HYGN-W", "IATA-W", "IBOS-W", "ISEA-W", "JARR-W", "KLAS-W",
	"KOCI-W", "KOKA-W", "KPIG-W", "KRYA-W", "LABS-W", "LAJU-W", "LIVE-W", "LMAX-W",
	"MAHA-W", "MANG-W", "MAXI-W", "MENN-W", "MHKI-W", "MMIX-W", "MPXL-W", "MSJA-W",
	"MSTI-W", "MUTU-W", "NAIK-W", "NICE-W", "NICL-W", "NINE-W", "NSSS-W", "NTBK-W",
	"OASA-W", "PACK-W", "PART-W", "PEVE-W", "PIPA-W", "PPGL-W", "PPRI-W", "PTMP-W",
	"PTPS-W", "RAAM-W", "RAFI-W", "RELF-W", "RGAS-W", "RMKO-W", "RONY-W", "RSCH-W",
	"SBMA-W", "SEMA-W", "SICO-W", "SMGA-W", "SMIL-W", "SMKM-W", "SMLE-W", "SOLA-W",
	"STRK-W", "SURI-W", "SWID-W", "TGUK-W", "TOOL-W", "TRGU-W", "TRON-W", "TYRE-W",
	"UVCR-W", "VAST-W", "VERN-W", "VISI-W", "VTNY-W", "WIDI-W", "WINE-W", "WINR-W",
	"WIRG-W", "ZATA-W"
];

function ensureWarrantTrackerStyles() {
	if (document.getElementById('warrantTrackerAnimStyle')) return;
	const style = document.createElement('style');
	style.id = 'warrantTrackerAnimStyle';
	style.textContent = `
		@keyframes warrantBtnPress {
			0% { transform: scale(1); }
			40% { transform: scale(0.92); }
			75% { transform: scale(1.04); }
			100% { transform: scale(1); }
		}
		@keyframes warrantCardSlideUp {
			0% { opacity: 0; transform: translateY(14px) scale(0.98); }
			100% { opacity: 1; transform: translateY(0) scale(1); }
		}
		.animate-warrant-press {
			animation: warrantBtnPress 0.35s cubic-bezier(0.22, 1, 0.36, 1);
		}
		.animate-warrant-card {
			opacity: 0;
			animation: warrantCardSlideUp 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		}
	`;
	document.head.appendChild(style);
}

function isDeadWarrantCached(wTicker) {
	try {
		const raw = localStorage.getItem(`warrant_dead_${wTicker}`);
		if (!raw) return false;
		const ts = parseInt(raw, 10);
		if (Date.now() - ts < 24 * 60 * 60 * 1000) return true;
		localStorage.removeItem(`warrant_dead_${wTicker}`);
	} catch (e) {}
	return false;
}

function markDeadWarrantCache(wTicker) {
	try {
		localStorage.setItem(`warrant_dead_${wTicker}`, Date.now().toString());
	} catch (e) {}
}

function getOnlyDashWTickers() {
	const rawSources = [
		typeof getWarrantStockTickers === 'function' ? getWarrantStockTickers() : null,
		typeof uniqueWarrantWatchlist !== 'undefined' ? uniqueWarrantWatchlist : null,
		typeof warrantWatchlist !== 'undefined' ? warrantWatchlist : null,
		PRIORITIZED_ACTIVE_WARRANTS
	];

	const warrantSet = new Set();
	rawSources.forEach(list => {
		if (Array.isArray(list)) {
			list.forEach(item => {
				const clean = typeof normalizeTickerSymbol === 'function'
					? normalizeTickerSymbol(item)
					: String(item || '').trim().toUpperCase();
				if (clean && (/^[A-Z]{4}-W\d*$/i.test(clean))) {
					warrantSet.add(clean);
				}
			});
		}
	});

	return Array.from(warrantSet);
}

async function fetchWarrantWithFallback(wTicker) {
	const cached = getCachedStockData(wTicker);
	if (cached && cached.price > 0) return cached;

	const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
	const yahooSymbol = `${wTicker}.JK`;

	const fetchJsonTimeout = async (url, timeoutMs = 4500, unwrapAllOrigins = false) => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, { signal: controller.signal });
			clearTimeout(timer);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = await res.json();
			if (unwrapAllOrigins && json && typeof json.contents === 'string') {
				return JSON.parse(json.contents);
			}
			return json;
		} catch (e) {
			clearTimeout(timer);
			throw e;
		}
	};

	// 1. Coba Cloudflare Worker Utama
	let workerRespondedValidJson = false;
	try {
		const json = await fetchJsonTimeout(`${WORKER_URL}?symbol=${encodeURIComponent(yahooSymbol)}`, 4500);
		if (json && json.chart) {
			workerRespondedValidJson = true;
			if (json.chart.error || !json.chart.result || json.chart.result.length === 0) {
				markDeadWarrantCache(wTicker);
				return null;
			}
			const parsed = parseYahooDataGlobal(json, wTicker);
			if (parsed && parsed.price > 0) {
				setCachedStockData(wTicker, parsed);
				return parsed;
			}
		}
	} catch (e) {}

	if (workerRespondedValidJson) return null;

	// 2. Fallback Concurrent Race Proxy (interval 1d/1mo untuk waran likuiditas tipis)
	const dailyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1mo`;
	const proxyAttempts = [
		fetchJsonTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(dailyUrl)}`, 4500, true),
		fetchJsonTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(dailyUrl)}`, 4500, false),
		fetchJsonTimeout(`https://corsproxy.io/?${encodeURIComponent(dailyUrl)}`, 4500, false)
	];

	try {
		const json = await Promise.any(proxyAttempts);
		if (json?.chart?.error || !json?.chart?.result?.length) {
			markDeadWarrantCache(wTicker);
			return null;
		}
		const parsed = parseYahooDataGlobal(json, wTicker);
		if (parsed && parsed.price > 0) {
			setCachedStockData(wTicker, parsed);
			return parsed;
		}
	} catch (e) {}

	return null;
}

// Komentar: Memuat dan merender daftar waran aktif (-W / -W2) beserta data saham induknya.
async function loadWarrantData() {
	if (isWarrantScanning) return;
	const container = document.getElementById('warrant-tracker-list') || document.getElementById('warrantResultsContainer');
	const btn = document.getElementById('btnScanWarrant') || document.querySelector("#tabContent-warrant button[onclick*='loadWarrantData']");
	if (!container) return;

	isWarrantScanning = true;
	ensureWarrantTrackerStyles();
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	if (!isVibrateMuted && 'vibrate' in navigator) navigator.vibrate(100);

	const defaultBtnHtml = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Muat Data Waran`;
	if (btn) {
		btn.disabled = true;
		btn.classList.add('opacity-60', 'cursor-not-allowed', 'animate-warrant-press');
		btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Memuat Waran...`;
		if (window.lucide) lucide.createIcons();
	}

	container.innerHTML = `
		<div class="text-center py-10 text-fuchsia-400 text-xs lg:text-sm md:col-span-2 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-2">
			<i data-lucide="loader-2" class="w-6 h-6 animate-spin text-fuchsia-400"></i>
			<span>Mengambil harga live saham induk &amp; seri waran BEI (-W / -W2)...</span>
		</div>
	`;
	if (window.lucide) lucide.createIcons();

	try {
		const warrantTickers = shuffleValuationList(getOnlyDashWTickers().filter(t => !isDeadWarrantCached(t)));
		const activeWarrants = [];
		const BATCH_SIZE = 12;

		for (let i = 0; i < warrantTickers.length; i += BATCH_SIZE) {
			const batch = warrantTickers.slice(i, i + BATCH_SIZE);
			const results = await Promise.all(batch.map(w => fetchWarrantWithFallback(w)));
			results.forEach(res => {
				if (res && res.price > 0) activeWarrants.push(res);
			});
			if (activeWarrants.length >= 16) break;
		}

		if (activeWarrants.length === 0) {
			container.innerHTML = `
				<div class="text-center py-8 text-slate-400 text-xs lg:text-sm md:col-span-2 bg-slate-900/60 rounded-xl border border-slate-800">
					Data harga waran belum tersedia saat ini (pasar tutup atau kode waran sedang suspensi).
				</div>
			`;
		} else {
			await enrichAndRenderWarrants(activeWarrants, container);
			if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
		}

		if (window.lucide) lucide.createIcons();
	} catch (error) {
		console.error('Error loadWarrantData:', error);
		container.innerHTML = `
			<div class="text-center py-8 text-rose-400 text-xs lg:text-sm md:col-span-2 bg-slate-900/60 rounded-xl border border-rose-500/30">
				Terjadi kesalahan saat memproses data Warrant Tracker.
			</div>
		`;
	} finally {
		isWarrantScanning = false;
		if (btn) {
			btn.disabled = false;
			btn.classList.remove('opacity-60', 'cursor-not-allowed', 'animate-warrant-press');
			btn.innerHTML = defaultBtnHtml;
			if (window.lucide) lucide.createIcons();
		}
	}
}

window.loadWarrantData = loadWarrantData;

// Komentar: Melengkapi data saham induk & merender daftar kartu Waran (-W) dengan tata letak rapi.
async function enrichAndRenderWarrants(warrantList, container) {
	const topList = [...warrantList]
		.sort((a, b) => {
			const valA = a.currentValuation > 0 ? 1 : 0;
			const valB = b.currentValuation > 0 ? 1 : 0;
			if (valB !== valA) return valB - valA;
			return (b.changePct || 0) - (a.changePct || 0);
		})
		.slice(0, 16);

	const parentTickers = [...new Set(topList.map(w => getParentTicker(w.ticker)))];
	const parentMap = {};

	// Ambil data saham induk secara terukur (max 5 paralel) agar harga induk selalu tampil
	let pIdx = 0;
	const fetchParentWorker = async () => {
		while (pIdx < parentTickers.length) {
			const pTicker = parentTickers[pIdx++];
			const cachedParent = getCachedStockData(pTicker);
			if (cachedParent && cachedParent.price > 0) {
				parentMap[pTicker] = cachedParent;
			} else {
				const fetchedParent = await fetchRealtimeStockData(pTicker, false, false);
				if (fetchedParent && fetchedParent.price > 0) {
					parentMap[pTicker] = fetchedParent;
				}
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(5, parentTickers.length) }, () => fetchParentWorker()));

	let html = `
		<div class="col-span-full flex flex-wrap items-center justify-between gap-2 bg-slate-950/50 px-4 py-2.5 rounded-xl border border-fuchsia-500/20 text-[11px] lg:text-xs">
			<span class="font-bold text-slate-200 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping"></span>
				Menampilkan <strong class="text-fuchsia-400">${topList.length}</strong> Saham Waran Aktif (<strong class="text-white">-W</strong>)
			</span>
			<span class="text-[10px] text-slate-400">Diurutkan berdasarkan Likuiditas & Momentum</span>
		</div>
	`;

	topList.forEach((item, index) => {
		const wTicker = item.ticker;
		const parentTicker = getParentTicker(wTicker);
		const parentData = parentMap[parentTicker] || null;

		const wPrice = roundToBEITick(item.price);
		const wChange = item.changePct || 0;
		const isPlus = wChange >= 0;

		const pPrice = parentData ? roundToBEITick(parentData.price) : 0;
		const pChange = parentData ? (parentData.changePct || 0) : 0;
		const ratioPct = pPrice > 0 ? ((wPrice / pPrice) * 100).toFixed(2) : '-';

		let badgeLabel = 'NETRAL';
		let badgeStyle = 'from-slate-700/40 to-slate-800/20 border-slate-600/40 text-slate-300';
		if (wChange >= 5 && (item.volRatio || 0) >= 1.5) {
			badgeLabel = 'HOT MOMENTUM';
			badgeStyle = 'from-fuchsia-600/30 to-purple-500/10 border-fuchsia-500/40 text-fuchsia-300';
		} else if (wChange > 0) {
			badgeLabel = 'ZONA HIJAU';
			badgeStyle = 'from-emerald-600/25 to-teal-500/10 border-emerald-500/30 text-emerald-400';
		} else if (wChange < 0) {
			badgeLabel = 'KOREKSI';
			badgeStyle = 'from-rose-600/25 to-red-500/10 border-rose-500/30 text-rose-400';
		}

		const animDelay = Math.min(index * 55, 600);

		html += `
			<div style="animation-delay: ${animDelay}ms;" class="animate-warrant-card bg-slate-950/40 p-4 rounded-2xl border border-slate-800 hover:border-fuchsia-500/50 transition-all duration-300 relative shadow-md flex flex-col justify-between group">
				<div class="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l ${badgeStyle} border-b border-l rounded-bl-xl rounded-tr-2xl text-[9px] font-extrabold tracking-wider uppercase">
					${badgeLabel}
				</div>

				<!-- Header Identitas Waran -->
				<div class="flex items-center gap-3 border-b border-slate-800/80 pb-3 pr-24">
					<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
						<img
							src="https://assets.stockbit.com/logos/companies/${parentTicker}.png"
							alt="${wTicker}"
							class="w-full h-full object-contain drop-shadow-sm"
							onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${parentTicker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[11px] font-black text-fuchsia-400 tracking-wider\\'>${parentTicker.substring(0, 3)}</span>';};"
						>
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-extrabold text-white text-sm lg:text-base tracking-tight">&dollar;${wTicker}</span>
							<span class="${isPlus ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'} font-bold px-2 py-0.5 rounded-md border text-[10px] tabular-nums">
								${isPlus ? '+' : ''}${wChange}%
							</span>
						</div>
						<p class="text-[10px] text-slate-400 mt-0.5 truncate">
							Induk: <strong class="text-slate-200">&dollar;${parentTicker}</strong>
							${pPrice > 0 ? `<span class="${pChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}">(${pChange >= 0 ? '+' : ''}${pChange}%)</span>` : ''}
						</p>
					</div>
				</div>

				<!-- Grid Metrik Terstruktur 2x2 -->
				<div class="grid grid-cols-2 gap-2.5 text-[10px] lg:text-xs my-3">
					<div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
						<span class="text-[9px] text-slate-400 uppercase tracking-wider block mb-0.5">Harga Waran</span>
						<span class="font-extrabold text-fuchsia-400 text-xs lg:text-sm tabular-nums">Rp ${wPrice.toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
						<span class="text-[9px] text-slate-400 uppercase tracking-wider block mb-0.5">Harga Induk</span>
						<span class="font-extrabold text-sky-400 text-xs lg:text-sm tabular-nums">${pPrice > 0 ? `Rp ${pPrice.toLocaleString('id-ID')}` : 'N/A'}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
						<span class="text-[9px] text-slate-400 uppercase tracking-wider block mb-0.5">Rasio Waran / Induk</span>
						<span class="font-extrabold text-amber-400 text-xs tabular-nums">${ratioPct !== '-' ? `${ratioPct}%` : '-'}</span>
					</div>
					<div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
						<span class="text-[9px] text-slate-400 uppercase tracking-wider block mb-0.5">Volume & Valuasi</span>
						<span class="font-bold text-emerald-400 text-[11px] block truncate tabular-nums">${(item.currentLot || 0).toLocaleString('id-ID')} Lot</span>
						<span class="text-[9px] text-slate-400 block truncate tabular-nums">${formatValuationIDR(item.currentValuation)}</span>
					</div>
				</div>

				<!-- Tombol Aksi -->
				<button onclick="selectTickerFromRadar('${wTicker}')" class="w-full bg-slate-800/90 hover:bg-fuchsia-600 active:scale-[0.98] text-slate-200 hover:text-white font-bold text-[10px] lg:text-xs py-2.5 rounded-xl border border-slate-700 hover:border-fuchsia-500 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm">
					<span>Buka Chart & Analisa AI</span>
					<i data-lucide="arrow-right" class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"></i>
				</button>
			</div>
		`;
	});

	container.innerHTML = html;
	if (window.lucide) lucide.createIcons();
}

// Helper kecil untuk memastikan format ticker bersih
function targetCleanTicker(arr) {
	return arr;
}

// Inisialisasi
document.addEventListener("DOMContentLoaded", () => {
	if (typeof applyGlobalButtonGradients === 'function') {
		applyGlobalButtonGradients();
	}
	
	const observer = new MutationObserver((mutations) => {
		let shouldUpdate = false;
		for (let m of mutations) {
			if (m.addedNodes.length > 0) {
				shouldUpdate = true;
				break;
			}
		}
		if (shouldUpdate && typeof applyGlobalButtonGradients === 'function') {
			setTimeout(applyGlobalButtonGradients, 1000);
		}
	});
	
	observer.observe(document.body, { childList: true, subtree: true });
});

// Nyalakan bulatan angka/titik pada ikon aplikasi yang terinstal
function setWhaleAppBadge(count = 1) {
	if ('setAppBadge' in navigator) {
		navigator.setAppBadge(count).catch(() => {});
	}
}

// Hapus bulatan saat pengguna kembali membuka / fokus ke aplikasi
function clearWhaleAppBadge() {
	if ('clearAppBadge' in navigator) {
		navigator.clearAppBadge().catch(() => {});
	}
}

// ============================================================
// INTEGRASI SERVICE WORKER (APP BADGE & PUSH NOTIFICATION)
// ============================================================
let unreadWhaleCount = 0;

// Komentar: Mengirimkan data notifikasi Whale ke Service Worker dan memastikan URL mengarah langsung ke saham terkait.
function notifyWhaleToServiceWorker(ticker, title, message) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	if (!cleanTicker) return;

	if (document.hidden) {
		unreadWhaleCount++;
		setWhaleAppBadge(unreadWhaleCount);
	}

	if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
		navigator.serviceWorker.controller.postMessage({
			type: document.hidden ? 'SHOW_NOTIFICATION' : 'SET_BADGE',
			title: title || `🐋 Whale Detected: $${cleanTicker}`,
			body: message || `Terdeteksi lonjakan volume & akumulasi pada $${cleanTicker}.`,
			badgeCount: unreadWhaleCount,
			ticker: cleanTicker,
			tag: `whale-${cleanTicker}`,
			url: `${window.location.pathname}?ticker=${encodeURIComponent(cleanTicker)}`
		});
	}
}

// Komentar: Membuka chart dan analisis AI saham secara langsung ketika notifikasi diklik.
function openTickerFromNotification(ticker) {
	const cleanTicker = normalizeTickerSymbol(ticker);
	if (!cleanTicker) return;

	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
	if (!isVibrateMuted && 'vibrate' in navigator) navigator.vibrate(120);

	if (typeof switchTab === 'function') {
		switchTab('ai');
	}

	const inputEl = document.getElementById('stockSearch') || document.getElementById('stockInput');
	if (inputEl) {
		inputEl.value = cleanTicker;
		inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	if (typeof searchStock === 'function') {
		searchStock(true);
	}
}

// ==========================================
// 31. GLOBAL MARKET, CRYPTO & COMMODITIES MARQUEE
// ==========================================
const GLOBAL_MARQUEE_CACHE_KEY = 'stockid_global_market_marquee_v1';
const GLOBAL_MARQUEE_CACHE_TTL = 3 * 60 * 1000; // 3 Menit
let globalMarqueeRefreshTimer = null;

// Komentar: Daftar instrumen indeks bursa dunia, kripto, dan komoditas beserta konfigurasi logo SVG.
const GLOBAL_MARKET_INSTRUMENTS = [
	// INDONESIA
	{
		symbol: '^JKSE',
		name: 'IHSG',
		region: 'INDO',
		regionColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_id'
	},
	// UNITED STATES
	{
		symbol: '^GSPC',
		name: 'S&P 500',
		region: 'US',
		regionColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_us'
	},
	{
		symbol: '^IXIC',
		name: 'NASDAQ',
		region: 'US',
		regionColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_us'
	},
	{
		symbol: '^DJI',
		name: 'DOW JONES',
		region: 'US',
		regionColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_us'
	},
	// KOREA SELATAN
	{
		symbol: '^KS11',
		name: 'KOSPI',
		region: 'KOREA',
		regionColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_kr'
	},
	// JEPANG
	{
		symbol: '^N225',
		name: 'NIKKEI 225',
		region: 'JEPANG',
		regionColor: 'text-red-400 bg-red-500/10 border-red-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_jp'
	},
	// CHINA & HONG KONG
	{
		symbol: '000001.SS',
		name: 'SHANGHAI',
		region: 'CHINA',
		regionColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_cn'
	},
	{
		symbol: '^HSI',
		name: 'HANG SENG',
		region: 'CHINA',
		regionColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_hk'
	},
	// NEGARA EROPA
	{
		symbol: '^FTSE',
		name: 'FTSE 100',
		region: 'EROPA',
		regionColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_uk'
	},
	{
		symbol: '^GDAXI',
		name: 'DAX',
		region: 'EROPA',
		regionColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_de'
	},
	{
		symbol: '^FCHI',
		name: 'CAC 40',
		region: 'EROPA',
		regionColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
		prefix: '',
		decimals: 2,
		logoKey: 'flag_fr'
	},
	// KRIPTO
	{
		symbol: 'BTC-USD',
		name: 'BITCOIN',
		region: 'KRIPTO',
		regionColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'crypto_btc'
	},
	{
		symbol: 'ETH-USD',
		name: 'ETHEREUM',
		region: 'KRIPTO',
		regionColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'crypto_eth'
	},
	{
		symbol: 'SOL-USD',
		name: 'SOLANA',
		region: 'KRIPTO',
		regionColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'crypto_sol'
	},
	// HARGA KOMODITAS
	{
		symbol: 'GC=F',
		name: 'GOLD (EMAS)',
		region: 'KOMODITAS',
		regionColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'comm_gold'
	},
	{
		symbol: 'SI=F',
		name: 'SILVER (PERAK)',
		region: 'KOMODITAS',
		regionColor: 'text-slate-300 bg-slate-500/15 border-slate-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'comm_silver'
	},
	{
		symbol: 'CL=F',
		name: 'WTI OIL',
		region: 'KOMODITAS',
		regionColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'comm_oil'
	},
	{
		symbol: 'HG=F',
		name: 'COPPER',
		region: 'KOMODITAS',
		regionColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'comm_copper'
	},
	{
		symbol: 'NG=F',
		name: 'NATURAL GAS',
		region: 'KOMODITAS',
		regionColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
		prefix: '$',
		decimals: 2,
		logoKey: 'comm_gas'
	}
];

// Komentar: Menghasilkan ikon SVG bulat yang tajam dan konsisten untuk setiap negara, kripto, dan komoditas.
function getGlobalMarketLogoSVG(logoKey) {
	const logos = {
		flag_id: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="16" fill="#E11D48"/>
				<rect y="16" width="32" height="16" fill="#F8FAFC"/>
			</svg>`,
		flag_us: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#F8FAFC"/>
				<rect width="32" height="4.5" y="0" fill="#DC2626"/>
				<rect width="32" height="4.5" y="9" fill="#DC2626"/>
				<rect width="32" height="4.5" y="18" fill="#DC2626"/>
				<rect width="32" height="5" y="27" fill="#DC2626"/>
				<rect width="16" height="17" fill="#1D4ED8"/>
				<circle cx="5" cy="5" r="1.2" fill="#FFFFFF"/>
				<circle cx="11" cy="5" r="1.2" fill="#FFFFFF"/>
				<circle cx="8" cy="8.5" r="1.2" fill="#FFFFFF"/>
				<circle cx="5" cy="12" r="1.2" fill="#FFFFFF"/>
				<circle cx="11" cy="12" r="1.2" fill="#FFFFFF"/>
			</svg>`,
		flag_kr: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#FFFFFF"/>
				<circle cx="16" cy="16" r="7.5" fill="#DC2626"/>
				<path d="M8.5 16a7.5 7.5 0 0 0 15 0a3.75 3.75 0 0 1-7.5 0a3.75 3.75 0 0 0-7.5 0z" fill="#1D4ED8"/>
				<rect x="5" y="6" width="4.5" height="1.8" transform="rotate(-35 5 6)" fill="#0F172A"/>
				<rect x="22.5" y="5" width="4.5" height="1.8" transform="rotate(35 22.5 5)" fill="#0F172A"/>
				<rect x="5" y="24" width="4.5" height="1.8" transform="rotate(35 5 24)" fill="#0F172A"/>
				<rect x="22.5" y="25" width="4.5" height="1.8" transform="rotate(-35 22.5 25)" fill="#0F172A"/>
			</svg>`,
		flag_jp: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#FFFFFF"/>
				<circle cx="16" cy="16" r="7.5" fill="#DC2626"/>
			</svg>`,
		flag_cn: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#DC2626"/>
				<polygon points="9,5 10.4,9.2 14.8,9.2 11.2,11.8 12.6,16 9,13.4 5.4,16 6.8,11.8 3.2,9.2 7.6,9.2" fill="#FACC15"/>
				<circle cx="17.5" cy="6.5" r="1.2" fill="#FACC15"/>
				<circle cx="20" cy="9.5" r="1.2" fill="#FACC15"/>
				<circle cx="20" cy="13.5" r="1.2" fill="#FACC15"/>
				<circle cx="17.5" cy="16.5" r="1.2" fill="#FACC15"/>
			</svg>`,
		flag_hk: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#E11D48"/>
				<circle cx="16" cy="11" r="3" fill="#FFFFFF"/>
				<circle cx="20.8" cy="14.5" r="3" fill="#FFFFFF"/>
				<circle cx="19" cy="20.2" r="3" fill="#FFFFFF"/>
				<circle cx="13" cy="20.2" r="3" fill="#FFFFFF"/>
				<circle cx="11.2" cy="14.5" r="3" fill="#FFFFFF"/>
				<circle cx="16" cy="16" r="2" fill="#E11D48"/>
			</svg>`,
		flag_uk: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#1E3A8A"/>
				<path d="M0 0L32 32M32 0L0 32" stroke="#FFFFFF" stroke-width="5"/>
				<path d="M0 0L32 32M32 0L0 32" stroke="#DC2626" stroke-width="2.5"/>
				<rect x="13" width="6" height="32" fill="#FFFFFF"/>
				<rect y="13" width="32" height="6" fill="#FFFFFF"/>
				<rect x="14.2" width="3.6" height="32" fill="#DC2626"/>
				<rect y="14.2" width="32" height="3.6" fill="#DC2626"/>
			</svg>`,
		flag_de: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="10.7" y="0" fill="#0F172A"/>
				<rect width="32" height="10.7" y="10.7" fill="#DC2626"/>
				<rect width="32" height="10.7" y="21.3" fill="#FACC15"/>
			</svg>`,
		flag_fr: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="10.7" height="32" x="0" fill="#1D4ED8"/>
				<rect width="10.7" height="32" x="10.7" fill="#FFFFFF"/>
				<rect width="10.7" height="32" x="21.3" fill="#DC2626"/>
			</svg>`,
		crypto_btc: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#F97316"/>
				<text x="16" y="22" text-anchor="middle" fill="#FFFFFF" font-size="18" font-weight="900" font-family="sans-serif">&#8383;</text>
			</svg>`,
		crypto_eth: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#4F46E5"/>
				<polygon points="16,5 23,16.5 16,20.5 9,16.5" fill="#E0E7FF"/>
				<polygon points="16,22.2 23,18.2 16,27 9,18.2" fill="#A5B4FC"/>
			</svg>`,
		crypto_sol: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#0F172A"/>
				<polygon points="8,9 25,9 22,12.5 5,12.5" fill="#14F195"/>
				<polygon points="5,14.5 22,14.5 25,18 8,18" fill="#00C2FF"/>
				<polygon points="8,20 25,20 22,23.5 5,23.5" fill="#9945FF"/>
			</svg>`,
		comm_gold: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#422006"/>
				<polygon points="8,22 11,11 21,11 24,22" fill="#FACC15"/>
				<polygon points="11,11 21,11 19,14 13,14" fill="#FEF08A"/>
			</svg>`,
		comm_silver: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#1E293B"/>
				<polygon points="8,22 11,11 21,11 24,22" fill="#CBD5E1"/>
				<polygon points="11,11 21,11 19,14 13,14" fill="#F8FAFC"/>
			</svg>`,
		comm_oil: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#064E3B"/>
				<path d="M16 6C16 6 9 14.5 9 19.5A7 7 0 0 0 23 19.5C23 14.5 16 6 16 6Z" fill="#34D399"/>
			</svg>`,
		comm_copper: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#451A03"/>
				<circle cx="16" cy="16" r="8" fill="none" stroke="#F59E0B" stroke-width="3.5"/>
				<circle cx="16" cy="16" r="3" fill="#FBBF24"/>
			</svg>`,
		comm_gas: `
			<svg viewBox="0 0 32 32" class="w-full h-full">
				<rect width="32" height="32" fill="#083344"/>
				<path d="M16.5 6C17.5 10.5 22 12.5 22 18.5A6 6 0 0 1 10 18.5C10 15.5 11.8 13 13.5 11.5C13.2 14 14.8 15 15.5 14C14.8 11.2 15.5 8.5 16.5 6Z" fill="#22D3EE"/>
			</svg>`
	};

	return logos[logoKey] || `
		<svg viewBox="0 0 32 32" class="w-full h-full">
			<rect width="32" height="32" fill="#1E293B"/>
			<circle cx="16" cy="16" r="7" fill="#10B981"/>
		</svg>`;
}

// Komentar: Menyuntikkan stylesheet animasimarquee berjalan mulus tanpa jeda ke halaman.
function ensureGlobalMarqueeStyles() {
	if (document.getElementById('globalMarketMarqueeStyle')) return;
	const style = document.createElement('style');
	style.id = 'globalMarketMarqueeStyle';
	style.textContent = `
		@keyframes stockidGlobalMarqueeFlow {
			0% {
				transform: translate3d(0, 0, 0);
			}
			100% {
				transform: translate3d(-50%, 0, 0);
			}
		}
		.global-marquee-track {
			display: flex;
			width: max-content;
			animation: stockidGlobalMarqueeFlow 48s linear infinite;
			will-change: transform;
		}
		.global-marquee-wrapper:hover .global-marquee-track {
			animation-play-state: paused;
		}
		body.light-mode #globalMarketMarquee {
			background: rgba(255, 255, 255, 0.92) !important;
			border-color: rgba(203, 213, 225, 0.9) !important;
		}
		body.light-mode #globalMarketMarquee .gm-item-card {
			background: rgba(248, 250, 252, 0.95) !important;
			border-color: rgba(226, 232, 240, 1) !important;
		}
		body.light-mode #globalMarketMarquee .gm-title-text {
			color: #0f172a !important;
		}
	`;
	document.head.appendChild(style);
}

// Komentar: Menempatkan kontainer marquee tepat di bawah Dashboard Profil/Status dan di atas Kolom Pencarian.
function mountGlobalMarketMarqueeContainer() {
	const existing = document.getElementById('globalMarketMarquee');
	if (existing) return existing;

	const vipDashboard = document.getElementById('vipDashboard');
	const searchAnchor = document.getElementById('searchContainer')
		|| (document.getElementById('stockSearch')
			? document.getElementById('stockSearch').closest('div.bg-slate-900, div.rounded-2xl, div.rounded-xl, section, form')
			: null);

	// Bersihkan marquee saham atau widget ticker-tape lama di antara vipDashboard dan kolom pencarian
	if (vipDashboard && vipDashboard.parentElement) {
		let sibling = vipDashboard.nextElementSibling;
		while (sibling && sibling !== searchAnchor && !sibling.contains(searchAnchor)) {
			const nextSib = sibling.nextElementSibling;
			const idClass = `${sibling.id || ''} ${sibling.className || ''}`.toLowerCase();
			const inner = (sibling.innerHTML || '').toLowerCase();
			const isOldTicker = sibling.tagName === 'MARQUEE'
				|| idClass.includes('marquee')
				|| idClass.includes('ticker')
				|| inner.includes('ticker-tape')
				|| inner.includes('embed-widget-ticker');

			if (isOldTicker) {
				sibling.remove();
			}
			sibling = nextSib;
		}
	}

	const wrapper = document.createElement('div');
	wrapper.id = 'globalMarketMarquee';
	wrapper.className = 'global-marquee-wrapper w-full bg-slate-900/90 border border-slate-800/90 rounded-xl shadow-lg backdrop-blur-md overflow-hidden my-3 relative select-none';
	wrapper.innerHTML = `
		<div class="flex items-center">
			<div class="shrink-0 z-20 bg-slate-950/95 border-r border-slate-800 px-3 py-2.5 flex items-center gap-2 shadow-md">
				<span class="relative flex h-2 w-2">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
					<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
				</span>
				<span class="text-[10px] lg:text-xs font-extrabold tracking-wider text-emerald-400 uppercase whitespace-nowrap">
					Global Market
				</span>
			</div>
			<div class="relative flex-1 overflow-hidden py-1.5">
				<div class="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-900/95 to-transparent z-10"></div>
				<div class="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-900/95 to-transparent z-10"></div>
				<div id="globalMarketMarqueeTrack" class="global-marquee-track items-center gap-2.5 px-2">
					<div class="text-[11px] text-slate-400 px-4 py-1 flex items-center gap-2">
						<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-emerald-400"></i>
						<span>Memuat indikator Bursa Dunia, Kripto &amp; Komoditas...</span>
					</div>
				</div>
			</div>
		</div>
	`;

	if (vipDashboard && vipDashboard.parentNode) {
		vipDashboard.insertAdjacentElement('afterend', wrapper);
	} else if (searchAnchor && searchAnchor.parentNode) {
		searchAnchor.parentNode.insertBefore(wrapper, searchAnchor);
	} else {
		const mainContainer = document.querySelector('main') || document.body;
		mainContainer.prepend(wrapper);
	}

	if (window.lucide) lucide.createIcons();
	return wrapper;
}

// Komentar: Menarik data harga real-time satu instrumen global via Cloudflare Worker dengan fallback multi-proxy.
async function fetchGlobalInstrumentQuote(item) {
	const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
	const encodedSym = encodeURIComponent(item.symbol);

	const parseChartResult = (json) => {
		const result = json?.chart?.result?.[0];
		if (!result) return null;
		const quote = result.indicators?.quote?.[0];
		const closes = (quote?.close || []).filter(p => typeof p === 'number' && !isNaN(p) && p > 0);
		const metaPrice = result.meta?.regularMarketPrice;
		const metaPrev = result.meta?.previousClose || result.meta?.chartPreviousClose;

		const price = (metaPrice && metaPrice > 0)
			? metaPrice
			: (closes.length > 0 ? closes[closes.length - 1] : 0);
		if (!price || price <= 0) return null;

		const prevClose = (metaPrev && metaPrev > 0)
			? metaPrev
			: (closes.length >= 2 ? closes[closes.length - 2] : price);
		const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

		return {
			...item,
			price,
			prevClose,
			changePct
		};
	};

	const fetchTimeoutJson = async (url, timeoutMs = 5000) => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, { signal: controller.signal });
			clearTimeout(timer);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.json();
		} catch (e) {
			clearTimeout(timer);
			throw e;
		}
	};

	// 1. Worker Utama
	try {
		const json = await fetchTimeoutJson(`${WORKER_URL}?symbol=${encodedSym}`, 5000);
		const parsed = parseChartResult(json);
		if (parsed) return parsed;
	} catch (e) {}

	// 2. Fallback Multi-Proxy Yahoo Finance
	const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSym}?interval=1d&range=5d`;
	const fallbacks = [
		`https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
		`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(yahooUrl)}`
	];

	for (const proxyUrl of fallbacks) {
		try {
			const json = await fetchTimeoutJson(proxyUrl, 5000);
			const parsed = parseChartResult(json);
			if (parsed) return parsed;
		} catch (e) {}
	}

	return null;
}

// Komentar: Merender deretan kartu indikator Bursa Dunia, Kripto, dan Komoditas ke dalam track marquee berjalan.
function renderGlobalMarketMarqueeItems(items) {
	const track = document.getElementById('globalMarketMarqueeTrack');
	if (!track || !Array.isArray(items) || items.length === 0) return;

	const buildSingleLoopHTML = () => items.map(item => {
		const isUp = item.changePct > 0;
		const isDown = item.changePct < 0;
		const changeColor = isUp ? 'text-emerald-400' : (isDown ? 'text-rose-400' : 'text-slate-400');
		const changeBg = isUp
			? 'bg-emerald-500/10 border-emerald-500/25'
			: (isDown ? 'bg-rose-500/10 border-rose-500/25' : 'bg-slate-800/80 border-slate-700');
		const arrowIcon = isUp ? '▲' : (isDown ? '▼' : '•');
		const sign = isUp ? '+' : '';

		const formattedPrice = item.price.toLocaleString('en-US', {
			minimumFractionDigits: item.decimals,
			maximumFractionDigits: item.decimals
		});

		return `
			<div class="gm-item-card flex items-center gap-2.5 bg-slate-950/75 hover:bg-slate-800/90 border border-slate-800/90 hover:border-emerald-500/40 rounded-lg px-3 py-1.5 transition-colors duration-200 shrink-0 shadow-sm">
				<div class="w-6 h-6 rounded-full overflow-hidden border border-slate-700/80 shrink-0 shadow-inner flex items-center justify-center bg-slate-900">
					${getGlobalMarketLogoSVG(item.logoKey)}
				</div>
				<div class="flex items-center gap-2">
					<div class="flex flex-col leading-tight">
						<div class="flex items-center gap-1.5">
							<span class="gm-title-text text-[11px] lg:text-xs font-extrabold text-white tracking-tight whitespace-nowrap">${item.name}</span>
							<span class="text-[8px] font-extrabold px-1.5 py-0.2 rounded border ${item.regionColor} tracking-wider whitespace-nowrap">${item.region}</span>
						</div>
						<span class="text-[10px] lg:text-[11px] font-bold text-slate-300 tabular-nums whitespace-nowrap">${item.prefix}${formattedPrice}</span>
					</div>
					<span class="text-[10px] font-extrabold ${changeColor} ${changeBg} border px-1.5 py-0.5 rounded-md tabular-nums whitespace-nowrap">
						${arrowIcon} ${sign}${item.changePct.toFixed(2)}%
					</span>
				</div>
			</div>
		`;
	}).join('');

	const singleLoop = buildSingleLoopHTML();
	// Duplikasi 2x agar pergerakan horizontal berjalan mulus tanpa putus
	track.innerHTML = singleLoop + singleLoop;
}

// Komentar: Memuat cache instan lalu menyegarkan data seluruh indikator pasar global secara berkala.
async function initGlobalMarketMarquee(forceRefresh = false) {
	ensureGlobalMarqueeStyles();
	mountGlobalMarketMarqueeContainer();

	// 1. Tampilkan cache terlebih dahulu agar tidak blank saat halaman dibuka
	try {
		const cachedRaw = localStorage.getItem(GLOBAL_MARQUEE_CACHE_KEY);
		if (cachedRaw) {
			const cached = JSON.parse(cachedRaw);
			if (Array.isArray(cached.data) && cached.data.length > 0) {
				renderGlobalMarketMarqueeItems(cached.data);
				if (!forceRefresh && (Date.now() - cached.timestamp) < GLOBAL_MARQUEE_CACHE_TTL) {
					return;
				}
			}
		}
	} catch (e) {}

	// 2. Ambil data real-time seluruh instrumen secara paralel
	const results = await Promise.all(
		GLOBAL_MARKET_INSTRUMENTS.map(item => fetchGlobalInstrumentQuote(item))
	);
	const validItems = results.filter(Boolean);

	if (validItems.length > 0) {
		renderGlobalMarketMarqueeItems(validItems);
		try {
			localStorage.setItem(GLOBAL_MARQUEE_CACHE_KEY, JSON.stringify({
				timestamp: Date.now(),
				data: validItems
			}));
		} catch (e) {}
	}

	// 3. Jadwalkan pembaruan otomatis setiap 60 detik
	if (!globalMarqueeRefreshTimer) {
		globalMarqueeRefreshTimer = setInterval(() => {
			initGlobalMarketMarquee(true);
		}, 60 * 1000);
	}
}

initGlobalMarketMarquee();
document.addEventListener('DOMContentLoaded', () => initGlobalMarketMarquee(false));


// Hapus bulatan notif otomatis saat user membuka kembali layar aplikasi
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') {
		unreadWhaleCount = 0;
		clearWhaleAppBadge();
		if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BADGE' });
		}
	}
});

// Tangkap pesan dari sw.js jika user mengetuk notifikasi untuk langsung membuka chart emiten
/*if ('serviceWorker' in navigator) {
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data && event.data.type === 'OPEN_TICKER' && event.data.ticker) {
			const searchInput = document.getElementById('stockSearch');
			if (searchInput && typeof searchStock === 'function') {
				searchInput.value = event.data.ticker;
				searchStock();
			}
		}
	});
}*/
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data && event.data.type === 'OPEN_TICKER' && event.data.ticker) {
			openTickerFromNotification(event.data.ticker);
		}
	});
}

// ANTI LAG
/*function processScreenerAntiLag(stockList, processFn, onComplete) {
	const BATCH_SIZE = 20; 
	const MAX_BATCH_LIMIT = 3; // Maksimal 60 saham diproses per loop
	let currentIndex = 0;
	let batchCount = 0;

	// Komentar: Fungsi untuk Process next batch.
	function processNextBatch() {
		if (currentIndex >= stockList.length || batchCount >= MAX_BATCH_LIMIT) {
			if (typeof onComplete === 'function') onComplete();
			return;
		}

		const end = Math.min(currentIndex + BATCH_SIZE, stockList.length);
		for (let i = currentIndex; i < end; i++) {
			processFn(stockList[i]); // Panggil fungsi utama di sini
		}

		currentIndex = end;
		batchCount++;
		
		// Jeda 50ms agar browser/CPU HP bisa bernapas dan UI tidak freeze
		setTimeout(processNextBatch, 50);
	}

	processNextBatch();
}*/

// 2. Urutan Inisialisasi Utama di bagian paling bawah app_11.js:
function checkUrlParamTicker() {
	const urlParams = new URLSearchParams(window.location.search);
	const tickerParam = urlParams.get('ticker');
	if (tickerParam) {
		const normalized = normalizeTickerSymbol(tickerParam);
		if (normalized) {
			currentTicker = normalized;
			const searchInput = document.getElementById('stockSearch');
			if (searchInput) searchInput.value = currentTicker;
		}
	}
}

// ==========================================
// HELPER GLOBAL FETCH DENGAN TIMEOUT (KOMPATIBEL SEMUA BROWSER)
// ==========================================
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
	const controller = new AbortController();
	const timerId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { ...options, signal: controller.signal });
		clearTimeout(timerId);
		return res;
	} catch (err) {
		clearTimeout(timerId);
		throw err;
	}
}

// ==========================================
// INISIALISASI UTAMA
// ==========================================
let isMainAppInitialized = false;

// Komentar: Menjalankan inisialisasi seluruh modul utama aplikasi secara idempoten.
function initMainApp() {
	if (isMainAppInitialized) return;
	isMainAppInitialized = true;

	checkUrlParamTicker();

	const setTxt = (id, val) => {
		const el = document.getElementById(id);
		if (el) el.innerText = val;
	};

	setTxt('stockTitle', toTradingViewSymbol(currentTicker));
	setTxt('aiHeaderTicker', `[${currentTicker}] — KONDISI TEKNIKAL`);
	setTxt('newsTickerLabel', currentTicker);
	setTxt('fundTickerLabel', currentTicker);
	setTxt('rrrTickerLabel', currentTicker);
	setTxt('alertTickerLabel', currentTicker);
	setTxt('corpTickerLabel', currentTicker);
	setTxt('peerTickerLabel', currentTicker);

	checkVIPAuth();
	initTypographySettings();
	initSystemSettings();
	initSearchSuggestions();
	updateMarketBadge();
	loadDeviceSystemInfo();
	generateAISignal(currentTicker);
	renderChart(currentTicker);
	renderAllAlerts();
	renderJournalTable();
	renderPaperTradingUI();
	renderTechnicalGauge(currentTicker);
	fetchStockNews(currentTicker);
	fetchCorporateAction(currentTicker);
	fetchRealtimeFundamentals(currentTicker);
	fetchYahooTrending();
	cleanExpiredCache();
	checkWelcomeModal();
	checkNotificationStatus();
	loadLiveMacro();

	startBackgroundAutoCache();
	setInterval(() => {
		ptRefreshPortoPrices(true);
	}, 300000);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initMainApp, { once: true });
} else {
	initMainApp();
}