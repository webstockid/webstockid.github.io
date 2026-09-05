// NAVIGASI & DROPDOWN
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
});

// WEB AUDIO ENGINE
const AudioFX = {
	ctx: null,
	init() {
		if (!this.ctx) {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (AudioCtx) this.ctx = new AudioCtx();
		}
		if (this.ctx && this.ctx.state === 'suspended') {
			this.ctx.resume();
		}
	},
	playAudioFile(filename) {
		try {
			const audio = new Audio(`stockid_suara/MC/${filename}`);
			audio.play().catch(e => {});
		} catch(e) {}
	},
	playClick() {
		const clicks = ['klik1.mp3', 'klik2.mp3', 'klik3.mp3', 'klik4.mp3'];
		const randomClick = clicks[Math.floor(Math.random() * clicks.length)];
		this.playAudioFile(randomClick);
	},
	playSuccess() {
		this.playAudioFile('sukses.mp3');
	},
	playAlert() {
		this.playAudioFile('loss.mp3');
	},
	playTokenExpired() {
		this.playAudioFile('hilang.mp3');
	},
	playSearch() {
		this.playAudioFile('cari.mp3');
	},
	playDelete(withPopup = false) {
		this.playAudioFile('hapus.mp3');
		if (withPopup) {
			// Memberikan interval 500ms agar suara tidak bertabrakan
			setTimeout(() => {
				this.playAudioFile('hilang.mp3');
			}, 1200);
		}
	},
	playWinJournal() {
		this.playAudioFile('win.mp3');
	},
	playLossJournal() {
		this.playAudioFile('loss.mp3');
	}
};

// GLOBAL CLICK LISTENER
document.addEventListener('click', function(e) {
	const target = e.target.closest('button, a, [onclick]');
	if (target) {
		const onclickAttr = target.getAttribute('onclick') || '';
		const textContent = target.innerText ? target.innerText.trim() : '';
		
		const hasTrashIcon = target.querySelector('.fa-trash') !== null || e.target.classList.contains('fa-trash');

		// 1. Kategori Hapus Satuan
		const isNormalDelete = 
			hasTrashIcon || 
			onclickAttr.includes('deleteJournalItem') || 
			onclickAttr.includes('removePriceAlert');

		// 2. Kategori Hapus/Close dengan Alert/Popup
		const isPopupAction = 
			!isNormalDelete && (
				textContent.includes('Hapus Semua') || 
				textContent.includes('Bersihkan Semua') || 
				onclickAttr.includes('clearJournalHistory') || 
				onclickAttr.includes('clearAllAlerts') ||
				onclickAttr.includes('closeCuanCelebration') ||
				onclickAttr.includes('closeLossCelebration') ||
				textContent === '✕' || 
				textContent === 'X'
			);

		if (isPopupAction) {
			AudioFX.playDelete(true); 
		} else if (isNormalDelete) {
			AudioFX.playDelete(false);
		} else {
			AudioFX.playClick();
		}

		if ('vibrate' in navigator) {
			navigator.vibrate(100);
		}
	}
});

// LOGIKA FRAKSI HARGA BURSA EFEK INDONESIA (BEI)
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
	if (direction === 'floor') {
		return Math.floor(price / tick) * tick;
	} else if (direction === 'ceil') {
		return Math.ceil(price / tick) * tick;
	}
	return Math.round(price / tick) * tick;
}

// POP-UP WELCOME CONTROL
function checkWelcomeModal() {
	const hideModal = localStorage.getItem('hide_welcome_modal');
	if (!hideModal) {
		const modal = document.getElementById('welcomeModal');
		if (modal) modal.classList.remove('hidden');
	}
}

function closeWelcomeModal(dontShowAgain) {
	const modal = document.getElementById('welcomeModal');
	if (modal) modal.classList.add('hidden');
	if (dontShowAgain) {
		localStorage.setItem('hide_welcome_modal', 'true');
	}
}

// DATABASE TOKEN VIP
const databaseVIP = {
	"1": { "tanggalExpired": "2040-07-25" },
	"FREE123": { "tanggalExpired": "2026-08-26" },
	"IRAM7363": { "tanggalExpired": "2026-10-24" },
	"ANDI2636": { "tanggalExpired": "2026-09-18" },
	"DHIO2838": { "tanggalExpired": "2026-08-25" },
	"ROID9283": { "tanggalExpired": "2026-08-29" },
	"RESKY9102": { "tanggalExpired": "2026-08-16" },
	"LUKITA1038": { "tanggalExpired": "2026-11-27" },
	"YOGA2636": { "tanggalExpired": "2027-02-28" },
	"ANNUR3747": { "tanggalExpired": "2027-06-20" },
	"KAYLA5272": { "tanggalExpired": "2027-06-10" },
	"ZULIA2937": { "tanggalExpired": "2026-08-22" },
	"YAYAT1635": { "tanggalExpired": "2027-03-08" },
	"PUTRI2738": { "tanggalExpired": "2026-11-09" },
	"TAMA2838": { "tanggalExpired": "2026-12-05" },
	"AHMAD1927": { "tanggalExpired": "2026-11-09" },
	"VANI5058": { "tanggalExpired": "2026-08-24" },
	"ULIL3759": { "tanggalExpired": "2026-08-23" },
	"DIMAS7363": { "tanggalExpired": "2027-03-23" },
	"NANDA9201": { "tanggalExpired": "2026-11-05" },
	"LIVIA6474": { "tanggalExpired": "2026-08-31" },
	"YOGA8374": { "tanggalExpired": "2027-02-28" },
	"ALDO7293": { "tanggalExpired": "2026-08-15" },
	"PUSPITA3102": { "tanggalExpired": "2026-12-31" },
	"TITO5920": { "tanggalExpired": "2026-11-15" },
	"ARA6192": { "tanggalExpired": "2026-09-05" },
	"IRHAM9137": { "tanggalExpired": "2026-10-24" },
	"FAUZIAH4940": { "tanggalExpired": "2026-09-09" },
	"OFENG1930": { "tanggalExpired": "2027-01-19" },
	"DWIKY5628": { "tanggalExpired": "2026-10-23" },
	"IKE1268": { "tanggalExpired": "2026-09-10" },
	"WIDI6474": { "tanggalExpired": "2026-08-31" },
	"PRAMUDYA7383": { "tanggalExpired": "2026-08-11" },
};

let globalStockData = null;
let searchCooldownTimer = null;
let exportCardCooldownTimer = null;
let peerRefreshCooldownTimer = null;
let isRadarScanning = false;

function isMarketOpen() {
	const now = new Date();
	const day = now.getDay();
	if (day === 0 || day === 6) return false;
	const hours = now.getHours();
	return hours >= 9 && hours < 16;
}

function cleanExpiredCache() {
	const FIVE_MINUTES = 5 * 60 * 1000;
	for (let i = localStorage.length - 1; i >= 0; i--) {
		const key = localStorage.key(i);
		if (key && key.startsWith('stock_cache_')) {
			try {
				const item = JSON.parse(localStorage.getItem(key));
				if (Date.now() - item.timestamp >= FIVE_MINUTES) {
					localStorage.removeItem(key);
				}
			} catch(e) {
				localStorage.removeItem(key);
			}
		}
	}
}

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

function setCachedStockData(ticker, data) {
	if (!data) return;
	const cacheKey = `stock_cache_${ticker}`;
	const cachePayload = {
		timestamp: Date.now(),
		data: data
	};
	localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
}

function getExtractName(token) {
	const match = token.match(/^[A-Za-z]+/);
	return match ? match[0] : token;
}

function calculateDaysLeft(expiredDateStr) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const expDate = new Date(expiredDateStr);
	expDate.setHours(0, 0, 0, 0);
	const diffTime = expDate - today;
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function checkVIPAuth() {
	const savedToken = localStorage.getItem('vip_token');
	const modal = document.getElementById('vipGatewayModal');
	const dashboard = document.getElementById('vipDashboard');

	if (!savedToken || !databaseVIP[savedToken]) {
		if(modal) modal.classList.remove('hidden');
		if(dashboard) dashboard.classList.add('hidden');
		return;
	}

	const account = databaseVIP[savedToken];
	const daysLeft = calculateDaysLeft(account.tanggalExpired);

	if (daysLeft < 0) {
		showError("Masa aktif Akses Token kamu telah habis. Silakan minta ke Admin.");
		localStorage.removeItem('vip_token');
		if(modal) modal.classList.remove('hidden');
		if(dashboard) dashboard.classList.add('hidden');
		return;
	}

	if(modal) modal.classList.add('hidden');
	if(dashboard) dashboard.classList.remove('hidden');

	const name = getExtractName(savedToken);
	document.getElementById('vipUserName').innerText = name;
	document.getElementById('vipDaysLeft').innerText = `${daysLeft} Hari Lagi`;
	document.getElementById('vipAccountStatus').innerText = `Status: VIP Aktif (${account.tanggalExpired})`;
}

function loginVIP() {
	const tokenInput = document.getElementById('tokenInput').value.trim().toUpperCase();

	if (!tokenInput) {
		showError("Silakan masukan token terlebih dahulu!");
		return;
	}

	if (!databaseVIP[tokenInput]) {
		showError("Akses Token tidak terdaftar / salah!");
		return;
	}

	const daysLeft = calculateDaysLeft(databaseVIP[tokenInput].tanggalExpired);
	if (daysLeft < 0) {
		showError("Akses Token ini sudah kedaluwarsa!");
		return;
	}

	localStorage.setItem('vip_token', tokenInput);
	document.getElementById('loginErrorMsg').classList.add('hidden');
	AudioFX.playSuccess();
	checkVIPAuth();
}

function logoutVIP() {
	localStorage.removeItem('vip_token');
	checkVIPAuth();
}

function showError(msg) {
	AudioFX.playTokenExpired();
	const errEl = document.getElementById('loginErrorMsg');
	if(errEl) {
		errEl.innerText = msg;
		errEl.classList.remove('hidden');
	}
}

// UTAMA & FITUR FITUR APP
let currentTicker = 'INET';
let currentInterval = 'D';

if (window.lucide) lucide.createIcons();

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

function renderChart(ticker) {
	const container = document.getElementById('tv_chart_container');
	if (!container) return;
	
	container.innerHTML = '';
	
	// Cek pengaman agar halaman tidak crash jika TradingView diblokir AdBlocker
	if (typeof TradingView !== 'undefined') {
		new TradingView.widget({
			"autosize": true,
			"symbol": `IDX:${ticker}`,
			"interval": currentInterval,
			"timezone": "Asia/Jakarta",
			"theme": "dark",
			"style": "1",
			"locale": "id",
			"toolbar_bg": "#f1f3f6",
			"enable_publishing": true,
			"allow_symbol_change": false,
			"container_id": "tv_chart_container",
			"studies": [
				"MAExp@tv-basicstudies",
				"MACD@tv-basicstudies",
				"VWAP@tv-basicstudies",
				"BB@tv-basicstudies",
			]
		});
	} else {
		container.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-xs text-center p-4">Widget TradingView terblokir oleh koneksi atau AdBlocker.<br>Matikan AdBlocker sesaat untuk memuat grafik.</div>`;
	}
}

function renderTechnicalGauge(ticker) {
	const container = document.getElementById('tv_technical_container');
	container.innerHTML = '';

	const script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
	script.async = true;
	script.text = JSON.stringify({
		"interval": "1D",
		"width": "100%",
		"isTransparent": true,
		"height": "380",
		"symbol": `IDX:${ticker}`,
		"showIntervalTabs": true,
		"displayMode": "single",
		"locale": "id",
		"colorTheme": "dark"
	});
	container.appendChild(script);
}

function renderFundamentalWidget(ticker) {
	const container = document.getElementById('tv_fundamental_container');
	container.innerHTML = `
		<div class="space-y-4">
			<div id="tv_financials_widget" class="w-full h-[540px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"></div>
			<div id="tv_profile_widget" class="w-full h-[400px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"></div>
			<div id="tv_fundamental_data_widget" class="w-full h-[500px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"></div>
		</div>
	`;

	const profileContainer = document.getElementById('tv_profile_widget');
	const scriptProfile = document.createElement('script');
	scriptProfile.type = 'text/javascript';
	scriptProfile.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js';
	scriptProfile.async = true;
	scriptProfile.text = JSON.stringify({
		"width": "100%",
		"height": "100%",
		"colorTheme": "dark",
		"isTransparent": true,
		"symbol": `IDX:${ticker}`,
		"locale": "id"
	});
	profileContainer.appendChild(scriptProfile);

	const fundDataContainer = document.getElementById('tv_fundamental_data_widget');
	const scriptFundData = document.createElement('script');
	scriptFundData.type = 'text/javascript';
	scriptFundData.src = 'https://s3.tradingview.com/external-embedding/embed-widget-fundamental-data.js';
	scriptFundData.async = true;
	scriptFundData.text = JSON.stringify({
		"isTransparent": true,
		"largeChartUrl": "",
		"displayMode": "regular",
		"width": "100%",
		"height": "100%",
		"symbol": `IDX:${ticker}`,
		"colorTheme": "dark",
		"locale": "id"
	});
	fundDataContainer.appendChild(scriptFundData);

	const finContainer = document.getElementById('tv_financials_widget');
	const scriptFin = document.createElement('script');
	scriptFin.type = 'text/javascript';
	scriptFin.src = 'https://s3.tradingview.com/external-embedding/embed-widget-financials.js';
	scriptFin.async = true;
	scriptFin.text = JSON.stringify({
		"colorTheme": "dark",
		"isTransparent": true,
		"largeChartUrl": "",
		"displayMode": "regular",
		"width": "100%",
		"height": "100%",
		"symbol": `IDX:${ticker}`,
		"locale": "id",
		"showSymbolLogo": true
	});
	finContainer.appendChild(scriptFin);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchRealtimeStockData(ticker, forceFetch = false) {
	const cachedData = getCachedStockData(ticker);
	if (cachedData && !forceFetch) return cachedData;

	const targetSymbol = `${ticker}.JK`;
	const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
	
	const fetchWithTimeout = (url, timeoutMs = 3000) => {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
			fetch(url)
				.then(res => {
					clearTimeout(timer);
					if (res.ok) resolve(res);
					else reject(new Error('Response not OK'));
				})
				.catch(err => {
					clearTimeout(timer);
					reject(err);
				});
		});
	};

	const parseYahooJSON = (json) => {
		const result = json?.chart?.result?.[0] || json?.results?.[0];
		if (!result) return null;

		const quote = result.indicators?.quote?.[0] || result.quote;
		const prices = quote?.close?.filter(p => p !== null && p !== undefined) || [];
		const volumes = quote?.volume?.filter(v => v !== null && v !== undefined) || [];
		const highs = quote?.high?.filter(h => h !== null && h !== undefined) || [];
		const lows = quote?.low?.filter(l => l !== null && l !== undefined) || [];

		if (prices.length < 5) return null;

		const currentPrice = result.meta?.regularMarketPrice || prices[prices.length - 1];
		const previousClose = result.meta?.chartPreviousClose || prices[prices.length - 2];
		const changePct = parseFloat((((currentPrice - previousClose) / previousClose) * 100).toFixed(2));

		const getMA = (p) => roundToBEITick(prices.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, prices.length));
		const ma5 = getMA(5);
		const ma10 = getMA(10);
		const ma20 = getMA(20);

		const currentVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
		const realVolume = result.meta?.regularMarketVolume || currentVolume;
		const currentLot = Math.floor(realVolume / 100);
		const currentValuation = realVolume * currentPrice;

		const volSlice10 = volumes.slice(-10);
		const volMA10 = volSlice10.length > 0 ? Math.round(volSlice10.reduce((a, b) => a + b, 0) / volSlice10.length) : 1;
		const volRatio = volMA10 > 0 ? parseFloat((currentVolume / volMA10).toFixed(2)) : 1.0;

		const high20 = highs.length >= 20 ? roundToBEITick(Math.max(...highs.slice(-20))) : roundToBEITick(Math.max(...highs));
		const low20 = lows.length >= 20 ? roundToBEITick(Math.min(...lows.slice(-20))) : roundToBEITick(Math.min(...lows));

		// [FITUR BARU] Hitung Estimasi Harga Rata-Rata Bandar (VWAP 20 Hari)
		let totalVol20 = 0;
		let totalValue20 = 0;
		const len = prices.length;
		const period = Math.min(20, len);
		for(let i = len - period; i < len; i++) {
			const h = highs[i] || prices[i];
			const l = lows[i] || prices[i];
			const c = prices[i];
			const v = volumes[i] || 0;
			const typicalPrice = (h + l + c) / 3;
			totalVol20 += v;
			totalValue20 += (typicalPrice * v);
		}
		const bandarAvgPrice = totalVol20 > 0 ? roundToBEITick(totalValue20 / totalVol20) : roundToBEITick(currentPrice);

		return { ticker, price: roundToBEITick(currentPrice), prevClose: roundToBEITick(previousClose), changePct, ma5, ma10, ma20, currentVolume, volMA10, volRatio, high20, low20, currentLot, currentValuation, bandarAvgPrice };
	};

	const workerPromise = fetchWithTimeout(`${WORKER_URL}?symbol=${targetSymbol}`, 1800)
		.then(res => res.json())
		.then(json => parseYahooJSON(json));

	const yahooProxyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?interval=15m&range=5d`;
	const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooProxyUrl)}`;
	
	const yahooPromise = fetchWithTimeout(allOriginsUrl, 3000)
		.then(res => res.json())
		.then(wrapper => JSON.parse(wrapper.contents))
		.then(json => parseYahooJSON(json));

	let freshData = null;
	try {
		freshData = await Promise.race([
			workerPromise.catch(() => null),
			yahooPromise.catch(() => null)
		]);

		if (!freshData) {
			const results = await Promise.allSettled([workerPromise, yahooPromise]);
			for (const res of results) {
				if (res.status === 'fulfilled' && res.value) {
					freshData = res.value;
					break;
				}
			}
		}
	} catch (e) {
		console.warn(`Fetch error for ${ticker}`);
	}

	if (freshData) {
		setCachedStockData(ticker, freshData);
	} else if (cachedData) {
		return cachedData;
	}

	return freshData;
}

// Fungsi Global: Mengolah raw JSON dari Yahoo menjadi data matang
function parseYahooDataGlobal(json, ticker) {
	const result = json?.chart?.result?.[0] || json?.results?.[0];
	if (!result) return null;

	const quote = result.indicators?.quote?.[0] || result.quote;
	const prices = quote?.close?.filter(p => p !== null && p !== undefined) || [];
	const volumes = quote?.volume?.filter(v => v !== null && v !== undefined) || [];
	const highs = quote?.high?.filter(h => h !== null && h !== undefined) || [];
	const lows = quote?.low?.filter(l => l !== null && l !== undefined) || [];

	if (prices.length < 5) return null;

	const currentPrice = result.meta?.regularMarketPrice || prices[prices.length - 1];
	const previousClose = result.meta?.chartPreviousClose || prices[prices.length - 2];
	const changePct = parseFloat((((currentPrice - previousClose) / previousClose) * 100).toFixed(2));

	const getMA = (p) => roundToBEITick(prices.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, prices.length));
	const ma5 = getMA(5);
	const ma10 = getMA(10);
	const ma20 = getMA(20);

	const currentVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
	const realVolume = result.meta?.regularMarketVolume || currentVolume;
	const currentLot = Math.floor(realVolume / 100);
	const currentValuation = realVolume * currentPrice;

	const volSlice10 = volumes.slice(-10);
	const volMA10 = volSlice10.length > 0 ? Math.round(volSlice10.reduce((a, b) => a + b, 0) / volSlice10.length) : 1;
	const volRatio = volMA10 > 0 ? parseFloat((currentVolume / volMA10).toFixed(2)) : 1.0;

	const high20 = highs.length >= 20 ? roundToBEITick(Math.max(...highs.slice(-20))) : roundToBEITick(Math.max(...highs));
	const low20 = lows.length >= 20 ? roundToBEITick(Math.min(...lows.slice(-20))) : roundToBEITick(Math.min(...lows));

	// [FITUR BARU] Hitung Estimasi Harga Rata-Rata Bandar (VWAP 20 Hari)
	let totalVol20 = 0;
	let totalValue20 = 0;
	const len = prices.length;
	const period = Math.min(20, len);
	for(let i = len - period; i < len; i++) {
		const h = highs[i] || prices[i];
		const l = lows[i] || prices[i];
		const c = prices[i];
		const v = volumes[i] || 0;
		const typicalPrice = (h + l + c) / 3;
		totalVol20 += v;
		totalValue20 += (typicalPrice * v);
	}
	const bandarAvgPrice = totalVol20 > 0 ? roundToBEITick(totalValue20 / totalVol20) : roundToBEITick(currentPrice);

	return { ticker, price: roundToBEITick(currentPrice), prevClose: roundToBEITick(previousClose), changePct, ma5, ma10, ma20, currentVolume, volMA10, volRatio, high20, low20, currentLot, currentValuation, bandarAvgPrice };
}

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

async function generateAISignal(ticker, isManualSearch = false) {
	const now = new Date();
	const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

	document.getElementById('aiHeaderTicker').innerText = `[${ticker}] — KONDISI TEKNIKAL`;
	document.getElementById('aiDateStamp').innerText = `Update Live: ${dateStr} ${timeStr} WIB`;

	setTimeout(() => fetchStockNewsForAI(ticker), 10);

	const cachedData = getCachedStockData(ticker);
	
	if (cachedData) {
		globalStockData = cachedData;
		renderAISignalUI(ticker, cachedData, true);
		checkPriceAlertsRealtime(ticker, cachedData.price);
		checkWhaleAlertRealtime(ticker, cachedData); // [FITUR 5] Trigger Whale Alert

		fetchRealtimeStockData(ticker, true).then(freshData => {
			if (freshData) {
				globalStockData = freshData;
				renderAISignalUI(ticker, freshData, false);
				checkPriceAlertsRealtime(ticker, freshData.price);
				checkWhaleAlertRealtime(ticker, freshData); // [FITUR 5] Trigger Whale Alert
			}
		});
		return;
	}

	showAISkeletonLoading();

	const stockData = await fetchRealtimeStockData(ticker, false);
	if (stockData && stockData.ticker === ticker) {
		globalStockData = stockData;
		checkPriceAlertsRealtime(ticker, stockData.price);
		checkWhaleAlertRealtime(ticker, stockData); // [FITUR 5] Trigger Whale Alert
	}

	renderAISignalUI(ticker, stockData, false);
}

// [FITUR 5] FUNGSI WHALE DETECTOR (BACKGROUND ALERT)
function checkWhaleAlertRealtime(ticker, stockData) {
	if (!stockData || !stockData.price) return;
	
	// Curi Start: Volume Spike > 2.5x dan Harga belum terbang jauh (0% - 3%)
	if (stockData.volRatio >= 2.5 && stockData.changePct >= 0 && stockData.changePct <= 3.0) {
		const lastAlertKey = `whale_alert_${ticker}`;
		const lastAlertTime = localStorage.getItem(lastAlertKey);
		const now = Date.now();
		
		// Jeda 4 jam (14400000 ms) agar user tidak ter-spam notifikasi
		if (!lastAlertTime || (now - parseInt(lastAlertTime)) > 14400000) {
			const alertMsg = `🐋 WHALE DETECTED: Volume $${ticker} meledak ${stockData.volRatio}x lipat! Harga baru naik ${stockData.changePct}%. Bandar indikasi kumpulin barang!`;
			
			AudioFX.playSuccess(); 
			sendBrowserPushNotification(`STOCK ID WHALE RADAR: $${ticker}`, alertMsg);
			
			localStorage.setItem(lastAlertKey, now.toString());
		}
	}
}

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

function renderAISignalUI(ticker, stockData, isCached) {
	const verdikEl = document.getElementById('aiVerdikText');
	const scoreEl = document.getElementById('aiScoreBadge');
	const descEl = document.getElementById('aiVerdikDesc');
	const buktiEl = document.getElementById('aiBuktiUtamaList');
	const kesimpulanEl = document.getElementById('aiKesimpulanText');

	let price = stockData ? roundToBEITick(stockData.price) : 100;

	let score = 3;
	let verdik = "NETRAL / KONSOLIDASI";
	let verdikClass = "font-bold text-amber-400 text-sm lg:text-base";
	let scoreClass = "font-bold bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";

	if (stockData) {
		const isAboveMA5 = stockData.price >= stockData.ma5;
		const isAboveMA10 = stockData.price >= stockData.ma10;
		const isAboveMA20 = stockData.price >= stockData.ma20;
		const isVolSpike = stockData.volRatio >= 1.00;

		if (isAboveMA5 && isAboveMA10 && isAboveMA20 && stockData.changePct > 1.5 && isVolSpike) {
			score = 5;
			verdik = "STRONG BULLISH BREAKOUT";
			verdikClass = "font-bold text-emerald-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-emerald-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if ((isAboveMA5 || isAboveMA10) && stockData.changePct >= 0) {
			score = 4;
			verdik = "BULLISH ACCUMULATION";
			verdikClass = "font-bold text-emerald-300 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-emerald-300 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.changePct < -2.5 && !isAboveMA10) {
			score = 1;
			verdik = "STRONG BEARISH / SELLING PRESSURE";
			verdikClass = "font-bold text-rose-500 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-rose-500 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.changePct < 0) {
			score = 2;
			verdik = "WEAK / BEARISH CORRECTION";
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
			: `volume transaksi cenderung moderat <strong class="text-rose-400">(${stockData.volRatio}x rerata volume harian)</strong>`;
		
		const maAlignText = (isAboveMA5 && isAboveMA10 && isAboveMA20)
			? "Struktur tren berada dalam susunan <strong class='text-emerald-400'>Bullish Alignment</strong> (Harga > MA5 > MA10 > MA20). Ini menandakan partisipasi pembeli mendominasi penuh seluruh horizon waktu jangka pendek."
			: (!isAboveMA10 && !isAboveMA20)
			? "Posisi harga berada <strong class='text-rose-400'>di bawah MA10 & MA20</strong>, mengindikasikan tekanan jual jangka pendek yang intensif dan kurva pergerakan dalam fase penurunan beruntun (*downtrend*)."
			: "Pergerakan harga berada dalam zona konsolidasi dinamis antar garis rata-rata, mengisyaratkan perebutan momentum antara kubu *bulls* dan *bears*.";

		descEl.innerHTML = `
			<p class="leading-relaxed"><strong class="text-sky-500">Mengapa?</strong> Saham <strong class="text-emerald-400 font-bold">${ticker}</strong> saat ini diperdagangkan pada level harga Rp ${price.toLocaleString('id-ID')} (${trendText}). ${maAlignText}</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong class="text-sky-500">Analisis Likuiditas & Volume:</strong> Terdeteksi bahwa ${volText}. Tingkat aktivitas volume ini mengonfirmasi kekuatan partisipasi institusi atau pelaku pasar utama dalam mendukung pergerakan harga hari ini.</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong class="text-sky-500">Rentang Volatilitas 20 Hari:</strong> Pergerakan saham ${ticker} bergerak dalam koridor rentang antara Rp ${stockData.low20.toLocaleString('id-ID')} <strong class="text-amber-500">(Support Kuat)</strong> hingga Rp ${stockData.high20.toLocaleString('id-ID')} <strong class="text-amber-500">(Resistance Tertinggi)</strong>.</p>
		`;

		buktiEl.innerHTML = `
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Harga: <strong class="text-sky-500 font-mono font-bold">Rp${price.toLocaleString('id-ID')}</strong> (${stockData.changePct >= 0 ? '+' : ''}${stockData.changePct}%)</span>
				<span class="text-[10px] lg:text-[11px] text-white">${isCached ? 'Cache Instant' : 'Live Data'}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Volume Transaksi:</span>
				<span class="font-mono text-sky-500 font-bold">${(stockData.currentLot || 0).toLocaleString('id-ID')} Lot</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Valuasi Transaksi:</span>
				<span class="font-mono text-emerald-400 font-bold">${formatValuationIDR(stockData.currentValuation)}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Estimasi AVG Bandar:</span>
				<span class="font-mono text-amber-400 font-bold">Rp ${(stockData.bandarAvgPrice || price).toLocaleString('id-ID')}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Posisi Tren MA5 / MA10 / MA20:</span>
				<span class="font-mono text-sky-500 font-bold">Rp ${stockData.ma5.toLocaleString('id-ID')} / ${stockData.ma10.toLocaleString('id-ID')} / ${stockData.ma20.toLocaleString('id-ID')}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Rasio Volume vs Rerata Harian:</span>
				<span class="font-bold font-mono ${isVolSpike ? 'text-emerald-400' : 'text-amber-400'}">${stockData.volRatio}x ${isVolSpike ? '(Spike Active)' : '(Normal)'}</span>
			</li>
		`;

		// [FITUR 1 & 2] AI ACTION BOARD & POWER METER BANDAR
		let actionLabel = "⏳ WAIT & SEE";
		let actionColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
		let actionDesc = "Tren sedang konsolidasi. Volume belum mengkonfirmasi arah yang jelas.";

		// --- REVISI LOGIKA REKOMENDASI AKSI (DIPERLONGGAR & DINAMIS) ---
		const checkAboveMA5 = stockData.price > stockData.ma5;
		const checkAboveMA10 = stockData.price > stockData.ma10;
		const checkAboveMA20 = stockData.price > stockData.ma20;
		const isVolBesar = stockData.volRatio >= 0.8;   // Dilonggarkan dari >= 1.0
		const isSpikeActive = stockData.volRatio >= 1.2; // Dilonggarkan dari >= 1.5

		// 1. STRONG BUY (Skor 5, di atas MA5, didukung volume/spike)
		if (score === 5 && checkAboveMA5 && isSpikeActive) {
			actionLabel = "🔥 STRONG BUY";
			actionColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
			actionDesc = "Momentum Breakout kuat! Skor maksimal dengan dukungan lonjakan volume aktif.";
		} 
		// 2. TAKE PROFIT / HOLD (Skor 4-5, stabil di atas MA menengah atau tren naik)
		else if (score >= 4 && (checkAboveMA10 || checkAboveMA20 || stockData.changePct > 2)) {
			actionLabel = "⚠️ TAKE PROFIT / HOLD";
			actionColor = "text-purple-400 bg-purple-500/10 border-purple-500/30";
			actionDesc = "Tren masih terjaga di atas garis MA menengah atau menguat stabil. Tahan atau amankan profit.";
		} 
		// 3. ACCUMULATE / CICIL (Skor 2-3, di atas MA5 atau koreksi sehat)
		else if ((score === 2 || score === 3) && (checkAboveMA5 || stockData.changePct >= -2)) {
			actionLabel = "🛒 ACCUMULATE (CICIL)";
			actionColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
			actionDesc = "Fase akumulasi / koreksi wajar. Harga bertahan dekat area support, cocok untuk cicil bertahap.";
		} 
		// 4. AVOID / CUTLOSS (Skor 1-2 atau tekanan jual tajam)
		else if (score <= 2 || stockData.changePct < -2.0) {
			actionLabel = "❌ AVOID / CUTLOSS";
			actionColor = "text-rose-400 bg-rose-500/10 border-rose-500/30";
			actionDesc = "Tekanan jual mendominasi atau struktur tren melemah di bawah MA utama. Batasi risiko segera.";
		}
		// --- END REVISI LOGIKA ---

		let bandarStatus = "Netral ⚖️";
		let bandarColor = "text-amber-400";
		let bandarBarColor = "from-amber-600 via-amber-400 to-yellow-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]";
		let bandarPct = 50;

		// Logika Bandar Power Meter dengan Warna Dinamis
		if (stockData.changePct >= 0 && stockData.volRatio >= 1.5) {
			bandarStatus = "Masif Akumulasi 🐋";
			bandarColor = "text-emerald-400";
			bandarBarColor = "from-emerald-600 via-emerald-400 to-teal-300 shadow-[0_0_20px_rgba(52,211,153,0.5)]";
			bandarPct = Math.min(100, 50 + (stockData.volRatio * 15));
		} else if (stockData.changePct < 0 && stockData.volRatio < 0.8) {
			bandarStatus = "Mark Down (Uji Support) 📉";
			bandarColor = "text-cyan-400";
			bandarBarColor = "from-cyan-600 via-cyan-400 to-blue-300 shadow-[0_0_15px_rgba(56,189,248,0.4)]";
			bandarPct = 35;
		} else if (stockData.changePct < 0 && stockData.volRatio >= 1.2) {
			bandarStatus = "Distribusi Kuat (Buangan) 🚨";
			bandarColor = "text-rose-400";
			bandarBarColor = "from-rose-600 via-rose-500 to-red-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]";
			bandarPct = Math.max(10, 50 - (stockData.volRatio * 15));
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
							<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Power Meter Bandar:
						</span>
						<span class="font-bold text-[10px] lg:text-[11px] ${bandarColor}">${bandarStatus}</span>
					</div>
					
					<!-- Container Bar dengan Efek Garis Barber Shop & Titik Kelap-kelip -->
					<div class="w-full bg-slate-950 rounded-full h-3 border border-slate-700/80 overflow-hidden relative p-0.5 shadow-inner">
						<div class="bg-gradient-to-r ${bandarBarColor} h-full rounded-full transition-all duration-1200 ease-out relative overflow-hidden" style="width: ${bandarPct}%">
							<!-- Efek Garis Melintir Terang-Gelap ala Barber Shop -->
							<div class="absolute inset-0 opacity-50" style="background-image: linear-gradient(135deg, rgba(255,255,255,0.4) 25%, rgba(0,0,0,0.4) 25%, rgba(0,0,0,0.4) 50%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.4) 75%, rgba(0,0,0,0.4) 75%, rgba(0,0,0,0.4)); background-size: 20px 20px; animation: barberShopMove 0.7s linear infinite;"></div>
							<!-- Titik Cahaya Terang Kelap-Kelip di Ujung Bar -->
							<div class="absolute right-0 top-0 bottom-0 w-2.5 bg-pink rounded-full shadow-[0_0_12px_#fff,0_0_20px_#38bdf8] animate-ping"></div>
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
		}

	} else {
		verdikEl.innerText = "NETRAL-SELEKTIF?";
		scoreEl.innerText = "-/-";
		descEl.innerText = `Menganalisis pergerakan teknikal emiten ${ticker} berbasis indikator grafik TradingView. Silakan evaluasi struktur pola harga harian sebelum melakukan transaksi....`;
	}

	const sl = roundToBEITick(price * 0.92, 'floor'); 
	const sup1 = roundToBEITick(price * 0.94, 'floor'); 
	const sup2 = roundToBEITick(price * 0.96, 'floor'); 
	const res1 = roundToBEITick(price * 1.04, 'ceil'); 
	const res2 = roundToBEITick(price * 1.08, 'ceil'); 
	const tp1 = roundToBEITick(price * 1.06, 'ceil'); 
	const tp2 = roundToBEITick(price * 1.10, 'ceil'); 

	document.getElementById('mapSupport1').innerText = `Rp ${sup1.toLocaleString('id-ID')} - ${sup2.toLocaleString('id-ID')}`;
	document.getElementById('mapResist1').innerText = `Rp ${res1.toLocaleString('id-ID')} - ${res2.toLocaleString('id-ID')}`;
	document.getElementById('mapTP').innerText = `Rp ${tp1.toLocaleString('id-ID')} / ${tp2.toLocaleString('id-ID')}`;
	document.getElementById('mapSL').innerText = `< Rp ${sl.toLocaleString('id-ID')}`;

	document.getElementById('tpBarSL').innerText = `SL: Rp ${sl.toLocaleString('id-ID')}`;
	document.getElementById('tpBarCurrent').innerText = `Harga: Rp ${price.toLocaleString('id-ID')}`;
	document.getElementById('tpBarTP').innerText = `TP1: Rp ${tp1.toLocaleString('id-ID')}`;

	const totalSpan = tp1 - sl;
	let calculatedProgress = totalSpan > 0 ? Math.round(((price - sl) / totalSpan) * 100) : 50;
	calculatedProgress = Math.max(0, Math.min(100, calculatedProgress));

	const progressBar = document.getElementById('tpProgressBar');
	progressBar.style.width = '0%';
	setTimeout(() => {
		progressBar.style.width = `${calculatedProgress}%`;
	}, 200);

	document.getElementById('tpProgressPercent').innerText = `Posisi: ${calculatedProgress}% dari Rentang SL - TP1`;

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

	document.getElementById('rrrEntry').value = price;
	document.getElementById('rrrSL').value = sl;
	document.getElementById('rrrTP').value = tp1;
	calculateSmartRRR();

	if (window.lucide) lucide.createIcons();
	AudioFX.playSuccess();
}

function startExportCardCooldown(seconds = 12) {
	const btn = document.getElementById('btnExportCard');
	if (!btn) return;

	btn.disabled = true;
	btn.classList.add('opacity-50', 'cursor-not-allowed');
	let remaining = seconds;

	if (exportCardCooldownTimer) clearInterval(exportCardCooldownTimer);

	btn.innerHTML = `<i data-lucide="download" class="w-3.5 h-3.5 lg:w-4 lg:h-4"></i> Export Card (${remaining}s)`;
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
			btn.innerHTML = `<i data-lucide="download" class="w-3.5 h-3.5 lg:w-4 lg:h-4"></i> Export Card (${remaining}s)`;
			if (window.lucide) lucide.createIcons();
		}
	}, 1000);
}

function exportTradingCard() {
	const btn = document.getElementById('btnExportCard');
	if (btn && btn.disabled) return;

	if (!globalStockData) {
		AudioFX.playAlert();
		showToast("Memuat data saham... Mohon tunggu sejenak.");
		return;
	}

	startExportCardCooldown(10);

	const price = roundToBEITick(globalStockData.price);
	const sl = roundToBEITick(price * 0.92, 'floor');
	const sup1 = roundToBEITick(price * 0.94, 'floor');
	const sup2 = roundToBEITick(price * 0.96, 'floor');
	const res1 = roundToBEITick(price * 1.04, 'ceil');
	const res2 = roundToBEITick(price * 1.08, 'ceil');
	const tp1 = roundToBEITick(price * 1.06, 'ceil');
	const tp2 = roundToBEITick(price * 1.10, 'ceil');

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

function startPeerRefreshCooldown(seconds = 18) {
	const btn = document.getElementById('btnRefreshPeer');
	if (!btn) return;

	btn.disabled = true;
	btn.classList.add('opacity-50', 'cursor-not-allowed');
	let remaining = seconds;

	if (peerRefreshCooldownTimer) clearInterval(peerRefreshCooldownTimer);

	btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh Data (${remaining}d)`;
	if (window.lucide) lucide.createIcons();

	peerRefreshCooldownTimer = setInterval(() => {
		remaining--;
		if (remaining <= 0) {
			clearInterval(peerRefreshCooldownTimer);
			btn.disabled = false;
			btn.classList.remove('opacity-50', 'cursor-not-allowed');
			btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh Data`;
			if (window.lucide) lucide.createIcons();
		} else {
			btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh Data (${remaining}d)`;
			if (window.lucide) lucide.createIcons();
		}
	}, 1000);
}

async function loadPeerAnalysisByPrice(targetTicker, isManualRefresh = false) {
	if (isManualRefresh) {
		const btn = document.getElementById('btnRefreshPeer');
		if (btn && btn.disabled) return;
		startPeerRefreshCooldown(20);
	}

	const body = document.getElementById('peerTableBody');
	document.getElementById('peerTickerLabel').innerText = targetTicker;
	const refLabel = document.getElementById('peerTickerRef');
	if (refLabel) refLabel.innerText = targetTicker;

	body.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400"><i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto mb-1 text-cyan-400"></i> Memuat saham-saham dengan harga serupa...</td></tr>`;
	if (window.lucide) lucide.createIcons();

	let baseData = globalStockData;
	if (!baseData || baseData.ticker !== targetTicker) {
		baseData = await fetchRealtimeStockData(targetTicker);
	}

	if (!baseData || !baseData.price) {
		body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Gagal memuat harga acuan $${targetTicker}.</td></tr>`;
		return;
	}

	const basePrice = baseData.price;
	const minPrice = basePrice * 0.75;
	const maxPrice = basePrice * 1.25;

	const sampleCandidates = uniqueRadarWatchlist.filter(t => t !== targetTicker);
	for (let i = sampleCandidates.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[sampleCandidates[i], sampleCandidates[j]] = [sampleCandidates[j], sampleCandidates[i]];
	}

	const peerResults = [baseData];
	const BATCH_SIZE = 8;

	for (let i = 0; i < sampleCandidates.length; i += BATCH_SIZE) {
		const batch = sampleCandidates.slice(i, i + BATCH_SIZE);
		const fetchedBatch = await Promise.all(batch.map(t => fetchRealtimeStockData(t)));
		
		for (const item of fetchedBatch) {
			if (item && item.price >= minPrice && item.price <= maxPrice) {
				peerResults.push(item);
			}
			if (peerResults.length >= 6) break;
		}

		if (peerResults.length >= 6) break;
	}

	let rowsHTML = '';
	peerResults.forEach(data => {
		if (!data) return;
		const isCurrent = data.ticker === targetTicker;
		const isPlus = data.changePct >= 0;
		const rowClass = isCurrent ? "bg-emerald-500/10 font-bold border-l-4 border-emerald-400" : "hover:bg-slate-800/50";

		rowsHTML += `
			<tr class="${rowClass}">
				<td class="p-3.5 text-white flex items-center gap-2">
					<strong class="text-emerald-400 font-mono">&dollar;${data.ticker}</strong>
				</td>
				<td class="p-3.5 text-white">Rp ${roundToBEITick(data.price).toLocaleString('id-ID')}</td>
				<td class="p-3.5 ${isPlus ? 'text-emerald-400' : 'text-rose-400'} font-bold">
					${isPlus ? '+' : ''}${data.changePct}%
				</td>
				<td class="p-3.5 ${data.price >= data.ma5 ? 'text-emerald-400' : 'text-rose-400'}">
					${data.price >= data.ma5 ? 'Bullish (Above MA5)' : 'Bearish (Below MA5)'}
				</td>
				<td class="p-3.5 ${data.volRatio >= 1.2 ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
					${data.volRatio}x Vol
				</td>
				<td class="p-3.5 text-center">
					<button onclick="selectSuggestion('${data.ticker}')" class="text-[10px] bg-emerald-600 hover:bg-cyan-600 text-white hover:text-white px-3 py-1 rounded-lg transition border-emerald-700/30 font-bold">
						Lihat Chart »
					</button>
				</td>
			</tr>
		`;
	});

	body.innerHTML = rowsHTML || `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ditemukan saham dengan range harga serupa.</td></tr>`;
}

function getJournalData() {
	return JSON.parse(localStorage.getItem('stockid_trading_journal') || '[]');
}

function saveJournalData(data) {
	localStorage.setItem('stockid_trading_journal', JSON.stringify(data));
	renderJournalTable();
}

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
	
	// Menggunakan custom showToast alih-alih alert bawaan browser
	showToast(`Trading Plan untuk $${currentTicker} berhasil disimpan ke Journal Trading!`);
}

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

function deleteJournalItem(id) {
	let journal = getJournalData();
	journal = journal.filter(item => item.id !== id);
	saveJournalData(journal);
}

/*function clearJournalHistory() {
	if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat Journal Trading?")) {
		localStorage.removeItem('stockid_trading_journal');
		renderJournalTable();
	}
}*/

async function clearJournalHistory() {
	const isConfirmed = await showConfirm("Apakah Kamu yakin ingin menghapus seluruh riwayat Journal Trading?");
	if (isConfirmed) {
		localStorage.removeItem('stockid_trading_journal');
		renderJournalTable();
		showToast("Riwayat Journal Trading berhasil dibersihkan.");
	}
}

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
	
	if (currentJournalView === 'kanban') {
		renderKanbanBoard();
	}

	let rows = '';
	journal.forEach(item => {
		let statusBadge = '<span class="text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">OPEN</span>';
		if (item.status === 'WIN') statusBadge = '<span class="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">WIN (TP)</span>';
		if (item.status === 'LOSS') statusBadge = '<span class="text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-[10px]">LOSS (SL)</span>';

		rows += `
			<tr class="hover:bg-slate-800/40">
				<td class="p-3.5 text-slate-400">${item.date}</td>
				<td class="p-3.5 font-bold text-pink-400">&dollar;${item.ticker}</td>
				<td class="p-3.5 text-sky-400">Rp ${item.entry.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-rose-400">Rp ${item.sl.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-emerald-400">Rp ${item.tp.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-cyan-400">${item.rrr}</td>
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

function autoFillRRRFromAI() {
	if (globalStockData && globalStockData.price) {
		const basePrice = globalStockData.price;
		const entry = roundToBEITick(basePrice * 0.96, 'floor');
		const sl = roundToBEITick(basePrice * 0.92, 'floor');
		const tp = roundToBEITick(basePrice * 1.06, 'ceil');

		document.getElementById('rrrEntry').value = entry;
		document.getElementById('rrrSL').value = sl;
		document.getElementById('rrrTP').value = tp;

		calculateSmartRRR();
		AudioFX.playSuccess();
	}
}

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
		evalEl.innerHTML = `✓ <strong>Rencana Trading Sangat Layak Eksekusi (RRR 1 : ${rrr})</strong><br><span class="text-[10px] lg:text-[11px] font-normal text-slate-300">Potensi profit jauh melebihi toleransi risiko batas modal Anda.</span>`;
	} else if (rrr >= 1.5) {
		evalEl.className = "p-2.5 rounded-lg text-[11px] lg:text-xs font-bold text-center bg-amber-500/10 text-amber-400 border border-amber-500/30";
		evalEl.innerHTML = `⚠ <strong>Rencana Trading Cukup Layak (RRR 1 : ${rrr})</strong><br><span class="text-[10px] lg:text-[11px] font-normal text-slate-300">Memenuhi standar minimal, namun disarankan memperketat entry dekat support.</span>`;
	} else {
		evalEl.className = "p-2.5 rounded-lg text-[11px] lg:text-xs font-bold text-center bg-rose-500/10 text-rose-400 border border-rose-500/30";
		evalEl.innerHTML = `✕ <strong>Risiko Terlalu Tinggi / Kurang Ideal (RRR 1 : ${rrr})</strong><br><span class="text-[10px] lg:text-[11px] font-normal text-slate-300">Potensi keuntungan tidak sebanding dengan risiko penurunan modal.</span>`;
	}
}

function initSearchSuggestions() {
	const input = document.getElementById('stockSearch');
	const box = document.getElementById('searchSuggestionsBox');

	if (!input || !box) return;

	input.addEventListener('focus', function() {
		AudioFX.playSearch();
	});

	input.addEventListener('input', function() {
		const val = this.value.trim().toUpperCase();
		if (!val) {
			box.classList.add('hidden');
			box.innerHTML = '';
			return;
		}

		const matches = uniqueRadarWatchlist.filter(item => item.includes(val)).slice(0, 10);

		if (matches.length > 0) {
			box.innerHTML = matches.map(ticker => `
				<div onclick="selectSuggestion('${ticker}')" class="px-4 py-2.5 hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-200 text-xs font-mono font-bold cursor-pointer transition flex items-center justify-between group">
					<span class="flex items-center gap-2">
						<i class="fa-solid fa-circle-arrow-right text-[10px] text-emerald-400 opacity-60 group-hover:opacity-100"></i>
						${ticker}
					</span>
					<span class="text-[9px] text-slate-500 group-hover:text-emerald-400">IDX</span>
				</div>
			`).join('');
			box.classList.remove('hidden');
		} else {
			box.classList.add('hidden');
			box.innerHTML = '';
		}
	});

	document.addEventListener('click', function(e) {
		const searchContainer = document.getElementById('searchContainer');
		if (searchContainer && !searchContainer.contains(e.target)) {
			box.classList.add('hidden');
		}
	});
}

function selectSuggestion(ticker) {
	const input = document.getElementById('stockSearch');
	const box = document.getElementById('searchSuggestionsBox');
	if (input) input.value = ticker;
	if (box) box.classList.add('hidden');
	searchStock(true);
}

async function startRadarProcess() {
	if (isRadarScanning) return;
	isRadarScanning = true;

	const btn = document.getElementById('btnStartRadar');
	const container = document.getElementById('bigMoneyList');

	btn.disabled = true;
	btn.className = "text-[10px] lg:text-xs text-white font-bold bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed";
	btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-amber-400"></i> Memindai Instan...`;
	if (window.lucide) lucide.createIcons();

	container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-12 lg:col-span-2"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400"></i> Memindai data pasar secara otomatis berdasar seluruh indikator...</div>`;

	const shuffled = [...uniqueRadarWatchlist];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	
	const validData = [];
	const BATCH_SIZE = 10;

	for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
		const batch = shuffled.slice(i, i + BATCH_SIZE);
		const results = await Promise.all(batch.map(ticker => fetchRealtimeStockData(ticker)));

		for (const res of results) {
			if (res && res.price > 0) {
				validData.push(res);
			}
		}

		if (validData.length > 0) {
			renderRadarItems(validData);
		}

		if (validData.length >= 10) {
			break;
		}
	}

	isRadarScanning = false;
	btn.disabled = false;
	btn.className = "text-[10px] lg:text-xs text-slate-950 font-bold bg-amber-400 hover:bg-amber-500 px-4 py-2 rounded-lg border border-amber-500/50 flex items-center justify-center gap-1.5 transition shadow-md";
	btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Mulai Pindai Pasar`;
	if (window.lucide) lucide.createIcons();

	if (validData.length === 0) {
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-2">Tidak ada data bursa yang berhasil ditangkap. Silakan coba kembali.</div>`;
	} else {
		AudioFX.playSuccess();
	}
}

function renderRadarItems(dataList) {
	const container = document.getElementById('bigMoneyList');
	const sorted = [...dataList].sort((a, b) => b.changePct - a.changePct);
	let htmlContent = '';

	if (sorted.length === 0) {
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-2">Tidak ada emiten potensial yang ditemukan saat ini.</div>`;
		return;
	}

	sorted.forEach((item, index) => {
		const ticker = item.ticker;
		const price = roundToBEITick(item.price);
		const changePct = item.changePct;
		
		const sl = roundToBEITick(price * 0.92, 'floor');
		const entryLow = roundToBEITick(price * 0.94, 'floor');
		const entryHigh = roundToBEITick(price * 0.96, 'floor');
		const tp1 = roundToBEITick(price * 1.06, 'ceil');
		const tp2 = roundToBEITick(price * 1.10, 'ceil');

		let statusSignal = "🔥 Momentum Breakout";
		let statusClass = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
		let alasanTeknikal = `Perubahan <strong>${changePct}%</strong> dan bertahan kokoh di atas garis Moving Average MA5 (Rp ${item.ma5.toLocaleString('id-ID')}), menandakan tekanan beli harian masih mendominasi pasar.`;

		// [FITUR 3] Deteksi Anomali Volume Bandar (Curi Start & Jebakan Batman)
		if (item.volRatio >= 2.0 && changePct >= 0 && changePct <= 2.5) {
			statusSignal = "🐋 Curi Start (Whale Acc)";
			statusClass = "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10";
			alasanTeknikal = `<strong>Anomali Volume Terdeteksi!</strong> Harga saham baru naik tipis (<strong>+${changePct}%</strong>), tapi volume meledak <strong>${item.volRatio}x lipat</strong> dari rata-rata. Bandar terindikasi sedang kumpulin barang diam-diam.`;
		} else if (item.volRatio < 0.8 && changePct > 4) {
			statusSignal = "🦇 Jebakan Batman (Fake Breakout)";
			statusClass = "text-rose-400 border-rose-500/30 bg-rose-500/10";
			alasanTeknikal = `<strong>Waspada!</strong> Harga naik sangat tinggi (<strong>+${changePct}%</strong>) namun tidak didukung oleh volume yang kuat (Hanya <strong>${item.volRatio}x</strong>). Kenaikan ini rawan dibanting. Hati-hati FOMO!`;
		} else if (item.ma5 > item.ma10 && item.price >= item.ma5 && changePct > 0.5 && changePct < 3) {
			statusSignal = "🚀 Golden Cross Setup";
			statusClass = "text-sky-400 border-sky-500/30 bg-sky-500/10";
			alasanTeknikal = `Sinyal perpotongan garis MA5 (Rp ${item.ma5.toLocaleString('id-ID')}) melintasi naik MA10/MA20 (*Golden Cross*). Pola pembalikan arah (*reversal*) awal berpotensi terbentuk.`;
		} else if (item.volRatio >= 1.5) {
			statusSignal = "⚡ Volume Accumulation";
			statusClass = "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
			alasanTeknikal = `Terjadi lonjakan volume transaksi hingga <strong>${item.volRatio}x lipat dari rata-rata 10 hari</strong>. Mengindikasikan partisipasi modal besar (*smart money*) di pasar.`;
		} else if (changePct < 0 && item.price >= item.ma20) {
			statusSignal = "🛡️ Support Retest";
			statusClass = "text-purple-400 border-purple-500/30 bg-purple-500/10";
			alasanTeknikal = `Harga sedang mengalami koreksi sehat (*pullback*) dan menguji area pertahanan MA20 (Rp ${item.ma20.toLocaleString('id-ID')}). Area ideal penampungan berisiko terukur.`;
		}

		htmlContent += `
			<div class="bg-slate-950 p-3.5 lg:p-4 rounded-xl border border-slate-800 space-y-3 relative">
				<div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
					<div class="flex items-center gap-2">
						<span class="bg-slate-800 text-amber-400 font-mono text-[10px] lg:text-xs px-2 py-0.5 rounded border border-slate-700">#${index + 1}</span>
						<div>
							<div class="flex items-center gap-2">
								<span class="font-bold text-white text-sm lg:text-base">&dollar;${ticker}</span>
								<button onclick="selectTickerFromRadar('${ticker}')" class="text-[10px] lg:text-[10px] bg-amber-300 hover:bg-emerald-600 text-black hover:text-white border-amber-500/30 font-bold px-2 py-0.5 rounded transition">
									Lihat Chart »
								</button>
							</div>
							<span class="text-[10px] lg:text-xs text-white block">Harga: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> (${changePct >= 0 ? '+' : ''}${changePct}%)</span>
						</div>
					</div>
					<span class="text-[9px] lg:text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusClass}">
						${statusSignal}
					</span>
				</div>

				<div class="grid grid-cols-2 gap-2 text-[10px] lg:text-xs">
					<div class="bg-slate-900/80 p-2 rounded border border-slate-800">
						<span class="text-white text-[9px] lg:text-[10px] block">Entry Ideal</span>
						<span class="font-bold text-amber-400 font-mono">Rp ${entryLow.toLocaleString('id-ID')} - ${entryHigh.toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2 rounded border border-slate-800">
						<span class="text-white text-[9px] lg:text-[10px] block">AVG Bandar</span>
						<span class="font-bold text-fuchsia-400 font-mono">Rp ${(item.bandarAvgPrice || item.ma20).toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2 rounded border border-slate-800">
						<span class="text-white text-[9px] lg:text-[10px] block">Target Profit (TP1/TP2)</span>
						<span class="font-bold text-emerald-300 font-mono">Rp ${tp1.toLocaleString('id-ID')} / ${tp2.toLocaleString('id-ID')}</span>
					</div>
					<div class="bg-slate-900/80 p-2 rounded border border-slate-800">
						<span class="text-white text-[9px] lg:text-[10px] block">Stop Loss (SL)</span>
						<span class="font-bold text-rose-400 font-mono">&lt; Rp ${sl.toLocaleString('id-ID')}</span>
					</div>
				</div>

				<div class="bg-slate-900/50 p-2.5 lg:p-3 rounded border border-slate-800 text-[10px] lg:text-xs text-slate-300 leading-relaxed space-y-1">
					<span class="text-amber-400 font-bold block text-[10px] lg:text-[11px]">ANALISIS TEKNIKAL OTOMATIS:</span>
					<p>${alasanTeknikal}</p>
				</div>
			</div>
		`;
	});

	container.innerHTML = htmlContent;
	if (window.lucide) lucide.createIcons();
}

function selectTickerFromRadar(ticker) {
	document.getElementById('stockSearch').value = ticker;
	searchStock(true);
	switchTab('ai');
}

async function fetchStockNewsForAI(ticker) {
	const cacheKey = `news_cache_${ticker}`;
	const cached = localStorage.getItem(cacheKey);

	if (cached) {
		try {
			const parsed = JSON.parse(cached);
			if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
				document.getElementById('aiBeritaList').innerHTML = parsed.html;
				return;
			}
		} catch(e){}
	}

	const rssUrl = `https://news.google.com/rss/search?q=${ticker}+saham+indonesia&hl=id&gl=ID&ceid=ID:id`;
	const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

	try {
		const res = await fetch(apiUrl);
		const data = await res.json();

		if (data.status === 'ok' && data.items && data.items.length > 0) {
			let beritaHTML = '';
			data.items.slice(0, 4).forEach(item => {
				const source = item.author || 'Media Nasional';
				const pubDate = new Date(item.pubDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
				beritaHTML += `<div class="bg-slate-900/50 p-2 rounded border border-slate-800/80">• <strong>${source} (${pubDate}):</strong> ${item.title}</div>`;
			});
			document.getElementById('aiBeritaList').innerHTML = beritaHTML;
			localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), html: beritaHTML }));
		} else {
			document.getElementById('aiBeritaList').innerHTML = `<div>Belum ada rilis berita khusus untuk emiten ${ticker} dalam 24 jam terakhir.</div>`;
		}
	} catch (e) {
		document.getElementById('aiBeritaList').innerHTML = `<div>Gagal memuat berita terkini. Gunakan indikator teknikal pada chart.</div>`;
	}
}

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
		btn.innerHTML = `<i data-lucide="bell-ring" class="w-3.5 h-3.5 text-teal-400"></i> Notifikasi Push Aktif`;
		btn.className = "text-[10px] lg:text-xs bg-emerald-500/10 text-teal-400 border border-emerald-500/30 font-bold px-3.5 py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-default";
	} else if (Notification.permission === "denied") {
		btn.innerHTML = `<i data-lucide="bell-off" class="w-3.5 h-3.5 text-rose-400"></i> Izin Notifikasi Ditolak`;
		btn.className = "text-[10px] lg:text-xs bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold px-3.5 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer";
	} else {
		btn.innerHTML = `<i data-lucide="bell" class="w-3.5 h-3.5 text-amber-400"></i> Aktifkan Notifikasi Push`;
		btn.className = "text-[10px] lg:text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-3.5 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer";
	}
	if (window.lucide) lucide.createIcons();
}

function requestNotificationPermission() {
	if (!("Notification" in window)) {
		showToast("Browser Anda tidak mendukung Web Push Notification.");
		return;
	}

	Notification.requestPermission().then(permission => {
		checkNotificationStatus();
		if (permission === "granted") {
			sendBrowserPushNotification("Stock ID Screener Alert", `System push notification berhasil diaktifkan!`);
			AudioFX.playSuccess();
		} else if (permission === "denied") {
			AudioFX.playAlert();
			showToast("Izin notifikasi telah ditolak. Silakan izinkan melalui pengaturan browser Anda.");
		}
	});
}

function sendBrowserPushNotification(title, message) {
	if ("Notification" in window && Notification.permission === "granted") {
		if (navigator.serviceWorker) {
			navigator.serviceWorker.ready.then(registration => {
				registration.showNotification(title, {
					body: message,
					icon: 'stockid_gambar/stockicon.jpg',
					vibrate: [200, 100, 200, 100, 200, 100, 200],
					tag: 'stockid-alert-' + Date.now(),
					requireInteraction: true
				});
			}).catch(() => {
				new Notification(title, { body: message, icon: 'stockid_gambar/stockicon.jpg' });
			});
		} else {
			new Notification(title, { body: message, icon: 'stockid_gambar/stockicon.jpg' });
		}
	}
}

function getAlerts(ticker) {
	return JSON.parse(localStorage.getItem(`alerts_${ticker}`) || '[]');
}

function saveAlerts(ticker, alerts) {
	localStorage.setItem(`alerts_${ticker}`, JSON.stringify(alerts));
	renderAllAlerts();
}

let openAlertDropdowns = new Set();

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
				if (alerts && alerts.length > 0) {
					groupedAlerts.push({ ticker, alerts });
				}
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
			<div class="bg-slate-950 rounded-xl border ${borderHighlight} overflow-hidden transition-all duration-200 col-span-1 md:col-span-2 lg:col-span-3">
				<div onclick="toggleAlertAccordion('${ticker}')" class="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition select-none group">
					<div class="flex items-center gap-3 md:gap-4">
						<div class="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-700/60 font-bold text-white group-hover:border-emerald-500/40 transition text-xs md:text-sm shrink-0">
							$
						</div>
						<div class="flex flex-col">
							<div class="flex items-center gap-2">
								<span class="font-bold text-teal text-sm md:text-base tracking-wide">${ticker}</span>
								${isCurrent ? '<span class="bg-emerald-500/20 text-teal-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 hidden sm:inline-block">DIBUKA</span>' : ''}
							</div>
							<span class="font-bold ${activeCount > 0 ? 'text-teal-400' : 'text-slate-500'} text-[10px] md:text-xs mt-0.5">${activeCount} Alert Aktif</span>
						</div>
					</div>
					
					<div class="flex items-center gap-3 md:gap-4 text-right">
						<div class="flex flex-col items-end">
							<span class="text-[9px] md:text-[10px] text-slate-400">Tgl Dibuat</span>
							<span class="font-mono text-teal-400 text-[10px] md:text-xs font-bold">${alertDate}</span>
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

			let statusBadge = '';
			let toggleBtn = '';
			let rowBorder = 'border-slate-800/60';

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
							<strong class="text-slate-200 font-mono text-xs md:text-sm">Rp ${targetPrice.toLocaleString('id-ID')}</strong>
						</div>
						${statusBadge}
					</div>
					<div class="flex items-center gap-2">
						${toggleBtn}
						<button onclick="removePriceAlert('${ticker}', ${index})" class="text-slate-500 hover:text-rose-400 font-bold px-1.5 py-0.5 transition rounded hover:bg-rose-500/10" title="Hapus Alert"><i class="fa-solid fa-trash text-[10px]"></i></button>
					</div>
				</div>
			`;
		});

		htmlContent += `
				</div>
			</div>
		`;
	});

	container.innerHTML = htmlContent;
}

/*
function clearAllAlerts() {
	if (confirm("Yakin ingin menghapus SEMUA riwayat alert pada seluruh saham?")) {
		let keysToRemove = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith('alerts_')) {
				keysToRemove.push(key);
			}
		}
		keysToRemove.forEach(k => localStorage.removeItem(k));
		renderAllAlerts();
		AudioFX.playSuccess();
	}
}
*/

async function clearAllAlerts() {
    const isConfirmed = await showConfirm("Apakah Kamu yakin ingin menghapus seluruh riwayat Alert pada seluruh saham?");
    if (isConfirmed) {
        let keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('alerts_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        renderAllAlerts();
        showToast("Semua Alert berhasil dibersihkan.");
        AudioFX.playSuccess();
    }
}

function syncAlertsFromAI() {
	let price = 100;
	if (globalStockData && globalStockData.price) {
		price = roundToBEITick(globalStockData.price);
	}

	const sl = roundToBEITick(price * 0.92, 'floor'); 
	const sup2 = roundToBEITick(price * 0.96, 'floor'); 
	const res2 = roundToBEITick(price * 1.08, 'ceil'); 
	const tp2 = roundToBEITick(price * 1.10, 'ceil'); 

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
	
	// Menggunakan custom showToast alih-alih alert bawaan browser
	showToast(`4 Target Harga AI ($${currentTicker}) berhasil disinkronkan ke Push Notification Alert!`);
}

function toggleAlertStatus(ticker, index) {
	let alerts = getAlerts(ticker);
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
		saveAlerts(ticker, alerts);
	}
}

function removePriceAlert(ticker, index) {
	let alerts = getAlerts(ticker);
	alerts.splice(index, 1);
	saveAlerts(ticker, alerts);
}

function checkPriceAlertsRealtime(ticker, currentPrice) {
	if (!currentPrice || currentPrice <= 0) return;

	let alerts = getAlerts(ticker);
	let updated = false;

	alerts.forEach((alertObj, idx) => {
		const targetPrice = typeof alertObj === 'object' ? alertObj.price : alertObj;
		const isActive = typeof alertObj === 'object' ? alertObj.active : true;
		const labelText = typeof alertObj === 'object' && alertObj.label ? alertObj.label : 'Target';

		if (isActive) {
			const isSupportOrSL = labelText.toLowerCase().includes('stop loss') || labelText.toLowerCase().includes('support') || labelText.toLowerCase().includes('entry');
			const conditionMet = isSupportOrSL ? (currentPrice <= targetPrice) : (currentPrice >= targetPrice);

			if (conditionMet) {
				const alertMsg = `🎯 Alert $${ticker}! Harga terkini (Rp ${currentPrice.toLocaleString('id-ID')}) telah menyentuh area ${labelText} di Rp ${targetPrice.toLocaleString('id-ID')}`;
				
				AudioFX.playSuccess();
				sendBrowserPushNotification(`STOCK ID ALERT: $${ticker}`, alertMsg);

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

	if (updated) {
		saveAlerts(ticker, alerts);
	}
}

async function fetchStockNews(ticker) {
	const container = document.getElementById('newsContainer');
	container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-10 lg:col-span-4"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400"></i> Memuat variasi berita terkini (Yahoo & Google)...</div>`;
	if (window.lucide) lucide.createIcons();

	let hasNews = false;
	container.innerHTML = '';

	try {
		const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}.JK&newsCount=9`;
		const response = await fetch(yahooUrl);
		const data = await response.json();

		if (data.news && data.news.length > 0) {
			data.news.slice(0, 9).forEach(item => {
				const date = item.providerPublishTime 
					? new Date(item.providerPublishTime * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) 
					: 'Berita Realtime';

				container.innerHTML += `
					<a href="${item.link}" target="_blank" class="block p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition duration-150">
						<div class="flex items-center gap-1.5 mb-2">
							<span class="text-[9px] lg:text-[10px] bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/30">${item.publisher}</span>
							<span class="text-[10px] lg:text-xs text-white">${date}</span>
						</div>
						<h4 class="text-xs lg:text-sm font-bold text-slate-200 line-clamp-2">${item.title}</h4>
					</a>
				`;
			});
			hasNews = true;
		}
	} catch (e) {
		console.warn("Yahoo News fetch failed:", e);
	}

	const rssUrl = `https://news.google.com/rss/search?q=${ticker}+saham+OR+bursa+indonesia+OR+ekonomi&hl=id&gl=ID&ceid=ID:id`;
	const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

	try {
		const response = await fetch(apiUrl);
		const data = await response.json();

		if (data.status === 'ok' && data.items && data.items.length > 0) {
			data.items.slice(0, 9).forEach(item => {
				const date = new Date(item.pubDate).toLocaleDateString('id-ID', {
					day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
				});

				container.innerHTML += `
					<a href="${item.link}" target="_blank" class="block p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition duration-150">
						<div class="flex items-center gap-1.5 mb-2">
							<span class="text-[9px] lg:text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">${item.source?.title || 'Google News'}</span>
							<span class="text-[10px] lg:text-xs text-white">${date}</span>
						</div>
						<h4 class="text-xs lg:text-sm font-bold text-slate-200 line-clamp-2">${item.title}</h4>
					</a>
				`;
			});
			hasNews = true;
		}
	} catch (e) {
		console.warn("Google News fetch failed:", e);
	}

	if (hasNews) {
		AudioFX.playSuccess();
	} else {
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-4">Tidak ada berita khusus ditemukan untuk ${ticker} hari ini.</div>`;
	}
}

async function fetchCorporateAction(ticker) {
	const container = document.getElementById('corporateContainer');
	container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-10 lg:col-span-3">Memuat data aksi korporasi...</div>`;
	
	const query = encodeURIComponent(`${ticker} AND (dividen OR RUPS OR "right issue" OR "stock split" OR buyback OR tender OR IPO)`);
	const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`;
	const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

	try {
		const response = await fetch(apiUrl);
		const data = await response.json();

		if (data.status === 'ok' && data.items && data.items.length > 0) {
			container.innerHTML = '';
			data.items.slice(0, 9).forEach(item => {
				const date = new Date(item.pubDate).toLocaleDateString('id-ID', {
					day: 'numeric', month: 'short', year: 'numeric'
				});

				container.innerHTML += `
					<a href="${item.link}" target="_blank" class="block p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition duration-150">
						<div class="flex items-center gap-1.5 mb-1">
							<span class="text-[9px] lg:text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">Aksi Korporasi</span>
							<span class="text-[10px] lg:text-xs text-white">${date}</span>
						</div>
						<h4 class="text-xs lg:text-sm font-bold text-slate-200 line-clamp-2">${item.title}</h4>
					</a>
				`;
			});
			AudioFX.playSuccess();
		} else {
			container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-3">Belum ada kabar aksi korporasi terbaru untuk ${ticker}.</div>`;
		}
	} catch (e) {
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-3">Gagal memuat data aksi korporasi.</div>`;
	}
}

function switchTab(tabName) {
	const tabs = ['ai','bigmoney','peer','news','fundamental','rrr','journal','alert','corporate','heatmap'];
	tabs.forEach(tab => {
		const btn = document.getElementById(`tabBtn-${tab}`);
		const content = document.getElementById(`tabContent-${tab}`);
		
		if (tab === tabName) {
			if(btn) btn.className = "flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-bold rounded-lg text-emerald-400 bg-slate-800 border border-slate-700 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 lg:px-4 transition";
			if (content) content.classList.remove('hidden');
		} else {
			if(btn) btn.className = "flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-bold rounded-lg text-white hover:text-slate-200 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 lg:px-4 transition";
			if (content) content.classList.add('hidden');
		}
	});

	if (tabName === 'journal') renderJournalTable();
	if (tabName === 'alert') renderAllAlerts();
	if (tabName === 'heatmap') renderSectorHeatmap();
}

function shareStockUrl() {
	const shareUrl = `${window.location.origin}${window.location.pathname}?ticker=${currentTicker}`;
	navigator.clipboard.writeText(shareUrl).then(() => {
		AudioFX.playSuccess();
	}).catch(() => {});
}

function checkUrlParamTicker() {
	const urlParams = new URLSearchParams(window.location.search);
	const tickerParam = urlParams.get('ticker');
	if (tickerParam) {
		currentTicker = tickerParam.toUpperCase();
	}
}

function startSearchCooldown(seconds) {
	const btn = document.querySelector("button[onclick='searchStock()']");
	if (!btn) return;

	btn.disabled = true;
	btn.classList.add('opacity-50', 'cursor-not-allowed');
	let remaining = seconds;

	if (searchCooldownTimer) clearInterval(searchCooldownTimer);

	btn.innerText = `Cari (${remaining}s)`;

	searchCooldownTimer = setInterval(() => {
		remaining--;
		if (remaining <= 0) {
			clearInterval(searchCooldownTimer);
			btn.disabled = false;
			btn.classList.remove('opacity-50', 'cursor-not-allowed');
			btn.innerText = "Cari";
		} else {
			btn.innerText = `Cari(${remaining}s)`;
		}
	}, 1000);
}

function searchStock(bypassCooldown = false) {
	const btn = document.querySelector("button[onclick='searchStock()']");
	if (!bypassCooldown && btn && btn.disabled) return;

	const input = document.getElementById('stockSearch').value.trim().toUpperCase();
	const box = document.getElementById('searchSuggestionsBox');
	if (box) box.classList.add('hidden');

	if (input) {
		currentTicker = input;
		document.getElementById('stockTitle').innerText = `IDX:${currentTicker}`;
		document.getElementById('aiHeaderTicker').innerText = `[${currentTicker}] — KONDISI TEKNIKAL`;
		document.getElementById('newsTickerLabel').innerText = currentTicker;
		document.getElementById('fundTickerLabel').innerText = currentTicker;
		document.getElementById('rrrTickerLabel').innerText = currentTicker;
		document.getElementById('alertTickerLabel').innerText = currentTicker;
		document.getElementById('corpTickerLabel').innerText = currentTicker;
		document.getElementById('peerTickerLabel').innerText = currentTicker;
		
		renderChart(currentTicker);
		renderTechnicalGauge(currentTicker);
		renderFundamentalWidget(currentTicker);
		renderAllAlerts();
		generateAISignal(currentTicker, false);
		fetchStockNews(currentTicker);
		fetchCorporateAction(currentTicker);

		if (!bypassCooldown) {
			startSearchCooldown(5);
		}
	}
}

function startBackgroundAutoCache() {
	const FIVE_MINUTES = 5 * 60 * 1000;
	
	const runBackgroundFetch = () => {
		if (window.Worker) {
			const bgWorker = new Worker('data-worker.js');
			
			// Dengarkan balasan dari robot data-worker
			bgWorker.onmessage = function(e) {
				const { status, ticker, rawData } = e.data;
				
				if (status === 'success' && rawData) {
					const parsedData = parseYahooDataGlobal(rawData, ticker);
					
					if (parsedData) {
						// Simpan ke LocalStorage secara instan
						setCachedStockData(ticker, parsedData);
						
						// Cek target alert secara 
						checkPriceAlertsRealtime(ticker, parsedData.price); 
					}
				} else if (status === 'done') {
					bgWorker.terminate(); // Hentikan robot jika semua antrean selesai
				}
			};

			let activeTickers = new Set();
			
			// 1. Masukkan saham yang sedang aktif dilihat user
			if (typeof currentTicker !== 'undefined') activeTickers.add(currentTicker);
			
			// 2. Masukkan saham yang dipasang Smart Alert oleh user
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.startsWith('alerts_')) {
					const t = key.replace('alerts_', '');
					try {
						const alerts = JSON.parse(localStorage.getItem(key));
						const hasActive = alerts.some(a => typeof a === 'object' ? a.active && !a.triggered : true);
						if (hasActive) activeTickers.add(t);
					} catch(err) {}
				}
			}

			// 3. AMBIL SELURUH EMITEN DARI WATCHLIST.JS
			if (typeof uniqueRadarWatchlist !== 'undefined' && Array.isArray(uniqueRadarWatchlist)) {
				uniqueRadarWatchlist.forEach(t => activeTickers.add(t));
			}

			// Kirim seluruh daftar emiten ke latar belakang
			bgWorker.postMessage({ tickers: Array.from(activeTickers) });
		}
	};
	
	runBackgroundFetch();
	
	setInterval(runBackgroundFetch, FIVE_MINUTES);
}

document.getElementById('stockSearch').addEventListener('keypress', function(e) {
	if (e.key === 'Enter') searchStock();
});

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
		let foundTicker = null;

		if (typeof uniqueRadarWatchlist !== 'undefined') {
			const words = transcript.split(' ');
			foundTicker = uniqueRadarWatchlist.find(ticker => words.includes(ticker));

			if (!foundTicker) {
				foundTicker = uniqueRadarWatchlist.find(ticker => spacelessTranscript.includes(ticker));
			}
		}

		if (!foundTicker) {
			foundTicker = transcript.replace(/COBA|DONG|ANALISA|CARI|SAHAM|BUKA|TOLONG/g, '').replace(/\s+/g, '').trim();
		}

		if (foundTicker) {
			input.value = foundTicker;
			searchStock(true);
		} else {
			input.placeholder = "Gagal menangkap kode saham...";
		}
	};

	recognition.onerror = function(event) {
		console.error("Voice search error: " + event.error);
		input.placeholder = "Gagal mendengar, coba lagi...";
	};

	recognition.onend = function() {
		voiceIcon.classList.remove('fa-microphone-lines', 'text-rose-500', 'animate-pulse');
		voiceIcon.classList.add('fa-microphone', 'text-slate-400');
		setTimeout(() => {
			input.placeholder = "Cari emiten (BBCA...) atau klik Mic";
		}, 2000);
	};

	recognition.start();
}

// DATA SELEBRASI (GAMBAR & TEKS RANDOM)
const cuanImages = [
	'https://media4.giphy.com/media/H3QHCSPLCKb4Ukf2yy/giphy.gif',
	'https://media0.giphy.com/media/ZIz7wYItfiYpCHA60F/giphy.gif',
	'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif',
	'https://media.giphy.com/media/3o6gDWzmAzrpi5DQU8/giphy.gif'
];

const cuanTexts = [
	{ title: "TAKE PROFIT TERCAPAI! 🚀", desc: "Gua bilang juga apa, cuan luber kan lo!" },
	{ title: "CUAN MAKSIMAL! ??", desc: "Asik! Bisa beli cilok seember nih." },
	{ title: "BULLSEYE! 😎", desc: "Nyeblak dulu gak sih?!" },
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

// FUNGSI TRIGGER SELEBRASI
function triggerCuanCelebration() {
	const modal = document.getElementById('cuanModal');
	const content = document.getElementById('cuanModalContent');
	const imgContainer = document.getElementById('cuanImageContainer');
	const titleEl = document.getElementById('cuanTitle');
	const descEl = document.getElementById('cuanDesc');

	const randomImg = cuanImages[Math.floor(Math.random() * cuanImages.length)];
	const randomText = cuanTexts[Math.floor(Math.random() * cuanTexts.length)];

	imgContainer.innerHTML = `
		<div class="bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1 w-full">
			<img src="${randomImg}" alt="Profit Cuan" class="w-full h-48 md:h-64 object-contain rounded">
		</div>
	`;
	
	titleEl.innerText = randomText.title;
	descEl.innerText = randomText.desc;

	modal.classList.remove('hidden');
	setTimeout(() => {
		modal.classList.remove('opacity-0');
		modal.classList.add('opacity-100');
		content.classList.remove('scale-50');
		content.classList.add('scale-100');
	}, 10);

	setTimeout(() => {
		closeCuanCelebration();
	}, 2700);
}

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

function triggerLossCelebration() {
	const modal = document.getElementById('lossModal');
	const content = document.getElementById('lossModalContent');
	const imgContainer = document.getElementById('lossImageContainer');
	const titleEl = document.getElementById('lossTitle');
	const descEl = document.getElementById('lossDesc');

	const randomImg = lossImages[Math.floor(Math.random() * lossImages.length)];
	const randomText = lossTexts[Math.floor(Math.random() * lossTexts.length)];

	imgContainer.innerHTML = `
		<div class="bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center p-1 w-full">
			<img src="${randomImg}" alt="Risk Management" class="w-full h-48 md:h-64 object-contain rounded">
		</div>
	`;
	
	titleEl.innerText = randomText.title;
	descEl.innerText = randomText.desc;

	modal.classList.remove('hidden');
	setTimeout(() => {
		modal.classList.remove('opacity-0');
		modal.classList.add('opacity-100');
		content.classList.remove('scale-50');
		content.classList.add('scale-100');
	}, 10);

	setTimeout(() => {
		closeLossCelebration();
	}, 2700);
}

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

let currentJournalView = 'table';

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

function allowDrop(ev) {
	ev.preventDefault();
}

function dragJournalCard(ev, id) {
	ev.dataTransfer.setData("text/plain", id);
}

function dropJournalCard(ev, newStatus) {
	ev.preventDefault();
	const id = parseInt(ev.dataTransfer.getData("text/plain"));
	if (id) {
		updateJournalStatus(id, newStatus);
	}
}

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
					<span class="font-bold text-pink-400 font-mono text-xs">&dollar;${item.ticker}</span>
					<span class="text-[9px] text-slate-400 font-mono">${item.date}</span>
				</div>
				<div class="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-900 text-center">
					<div><span class="text-[7px] text-slate-500 block">ENTRY</span>Rp ${item.entry.toLocaleString('id-ID')}</div>
					<div><span class="text-[7px] text-rose-400 block">SL</span>Rp ${item.sl.toLocaleString('id-ID')}</div>
					<div><span class="text-[7px] text-emerald-400 block">TP</span>Rp ${item.tp.toLocaleString('id-ID')}</div>
				</div>
				<div class="flex items-center justify-between pt-1">
					<span class="text-[9px] text-cyan-400 font-mono font-bold">RRR: ${item.rrr}</span>
					<div class="flex items-center gap-1">
						${item.status !== 'OPEN' ? `<button onclick="updateJournalStatus(${item.id}, 'OPEN')" class="text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-bold transition">Open</button>` : ''}
						${item.status !== 'WIN' ? `<button onclick="updateJournalStatus(${item.id}, 'WIN')" class="text-[8px] bg-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 px-1.5 py-0.5 rounded font-bold transition">WIN</button>` : ''}
						${item.status !== 'LOSS' ? `<button onclick="updateJournalStatus(${item.id}, 'LOSS')" class="text-[8px] bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-1.5 py-0.5 rounded font-bold transition">LOSS</button>` : ''}
						<button onclick="deleteJournalItem(${item.id})" class="text-[8px] text-slate-500 hover:text-rose-400 px-1 py-0.5 transition" title="Hapus">✕</button>
					</div>
				</div>
			</div>
		`;

		if (item.status === 'WIN') {
			htmlWin += cardHTML;
			countWin++;
		} else if (item.status === 'LOSS') {
			htmlLoss += cardHTML;
			countLoss++;
		} else {
			htmlOpen += cardHTML;
			countOpen++;
		}
	});

	colOpen.innerHTML = htmlOpen || `<div class="text-center text-slate-500 text-[10px] py-16 italic">Tidak ada plan open.</div>`;
	colWin.innerHTML = htmlWin || `<div class="text-center text-slate-500 text-[10px] py-16 italic">Belum ada take profit.</div>`;
	colLoss.innerHTML = htmlLoss || `<div class="text-center text-slate-500 text-[10px] py-16 italic">Belum ada stop loss.</div>`;

	document.getElementById('kanbanCountOpen').innerText = countOpen;
	document.getElementById('kanbanCountWin').innerText = countWin;
	document.getElementById('kanbanCountLoss').innerText = countLoss;
}

let isHeatmapLoaded = false;
function renderSectorHeatmap() {
	const container = document.getElementById('tv_heatmap_container');
	if (!container || isHeatmapLoaded) return;

	container.innerHTML = '';
	const script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
	script.async = true;
	script.text = JSON.stringify({
		"exchange": "IDX",
		"grouping": "sector",
		"width": "100%",
		"height": "100%",
		"colorTheme": "dark",
		"locale": "id",
		"showSymbolLogo": true
	});
	container.appendChild(script);
	isHeatmapLoaded = true;
}

// FLOATING AI CHAT ASSISTANT
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
		setTimeout(() => {
			chatWindow.classList.add('hidden');
		}, 300);
	}
	if (window.lucide) lucide.createIcons();
}

document.addEventListener('keypress', function(e) {
	if (e.key === 'Enter') {
		const inputEl = document.getElementById('aiChatInput');
		if (document.activeElement === inputEl) {
			sendAIChatMessage();
		}
	}
});

function sendAIChatMessage() {
	const inputEl = document.getElementById('aiChatInput');
	const msgContainer = document.getElementById('aiChatMessages');
	const query = inputEl.value.trim();

	if (!query) return;

	// Render pesan User
	msgContainer.innerHTML += `
		<div class="flex items-start justify-end gap-2">
			<div class="bg-emerald-500/20 text-emerald-300 p-2.5 rounded-xl rounded-tr-none border border-emerald-500/30 leading-relaxed max-w-[85%]">
				${escapeHtml(query)}
			</div>
		</div>
	`;
	inputEl.value = '';
	msgContainer.scrollTop = msgContainer.scrollHeight;
	AudioFX.playClick();

	// Simulasi respons AI cerdas secara responsif
	setTimeout(() => {
		const aiReply = generateAIResponse(query);
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
		AudioFX.playSuccess();
	}, 600);
}

function escapeHtml(text) {
	const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
	return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function generateAIResponse(prompt) {
	const lower = prompt.toLowerCase();
	let targetTicker = currentTicker;

	// Deteksi apakah user menyebut emiten tertentu (misal: "bca", "bbri")
	if (typeof uniqueRadarWatchlist !== 'undefined') {
		const foundMatch = uniqueRadarWatchlist.find(t => lower.includes(t.toLowerCase()));
		if (foundMatch) {
			targetTicker = foundMatch;
		}
	}

	const isCurrent = targetTicker === currentTicker;
	const data = isCurrent ? globalStockData : getCachedStockData(targetTicker);

	// Helper format Rupiah
	const formatRp = (num) => num ? `Rp ${num.toLocaleString('id-ID')}` : 'N/A';

	// 1. Kategori: Greeting
	if (lower.includes('halo') || lower.includes('hai') || lower.includes('pagi') || lower.includes('siang') || lower.includes('sore') || lower.includes('malam')) {
		return `Halo! Gue AI Assistant Stock ID. Mau bahas teknikal <strong class="text-emerald-400">$${targetTicker}</strong> atau ada emiten lain yang mau di-screening hari ini?`;
	}

	// 2. Kategori: Ucapan Terima Kasih
	if (lower.includes('terimakasih') || lower.includes('makasih') || lower.includes('thanks') || lower.includes('oke')) {
		return `Sama-sama cuy! Selalu terapin disiplin <i>money management</i> ya. Cuan meluber untuk member Stock ID VIP! 🚀`;
	}

	// Jika data saham belum ada di cache atau belum diload
	if (!data) {
		return `Untuk menganalisa <strong class="text-cyan-400">$${targetTicker}</strong> lebih presisi, silakan cari emiten tersebut di kolom pencarian atas terlebih dahulu agar gue bisa menarik data bursa terbarunya.`;
	}

	// Kalkulasi Level Pivot Cerdas
	const price = data.price;
	const sl = roundToBEITick(price * 0.92, 'floor');
	const sup1 = roundToBEITick(price * 0.94, 'floor');
	const sup2 = roundToBEITick(price * 0.96, 'floor');
	const res1 = roundToBEITick(price * 1.04, 'ceil');
	const res2 = roundToBEITick(price * 1.08, 'ceil');
	const tp1 = roundToBEITick(price * 1.06, 'ceil');
	const tp2 = roundToBEITick(price * 1.10, 'ceil');
	
	// 3. Kategori: Entry / Support / Area Beli
	if (lower.includes('entry') || lower.includes('area entry') || lower.includes('support') || lower.includes('area support') || lower.includes('area') || lower.includes('area masuk') || lower.includes('masuk') || lower.includes('serok') || lower.includes('beli')) {
		return `
			<strong class="text-amber-400 flex items-center gap-1.5"><i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Area Entry & Support $${targetTicker}:</strong>
			Harga saat ini berada di <span class="font-mono text-white">${formatRp(price)}</span>.<br>
			Area akumulasi (entry ideal) yang disarankan berada di rentang support kuat <strong class="font-mono text-amber-400">${formatRp(sup1)} - ${formatRp(sup2)}</strong>.<br>
			<span class="text-[10px] text-slate-400 mt-1 block"><i>Tips: Cicil beli jika harga mantul (rebound) dari area ini.</i></span>
		`;
	}

	// 4. Kategori: Resistance / Target Profit / Jual
	if (lower.includes('resistance') || lower.includes('resist') || lower.includes('resis') || lower.includes('target') || lower.includes('target profit') || lower.includes('profit') || lower.includes('take profit') || lower.includes('tp') || lower.includes('keluar') || lower.includes('jual') || lower.includes('area jual')) {
		return `
			<strong class="text-cyan-400 flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5"></i> Target Profit & Resistance $${targetTicker}:</strong>
			Resistance terdekat untuk <i>take profit</i> ada di kisaran <strong class="font-mono text-cyan-400">${formatRp(res1)} - ${formatRp(res2)}</strong>.<br>
			Jika berhasil <i>breakout</i> dengan volume tinggi, kamu bisa set TP1 di <strong class="text-white">${formatRp(tp1)}</strong> dan TP2 di <strong class="text-white">${formatRp(tp2)}</strong>. Jangan lupa gunakan <i>trailing stop</i>!
		`;
	}

	// 5. Kategori: Stop Loss / Cut Loss / Batas Risiko
	if (lower.includes('stoploss') || lower.includes('stop loss') || lower.includes('area stop loss') || lower.includes('cutloss') || lower.includes('cut loss') || lower.includes('area cut loss') || lower.includes('cl') || lower.includes('risiko') || lower.includes('buang') || lower.includes('rugi')) {
		return `
			<strong class="text-rose-400 flex items-center gap-1.5"><i data-lucide="shield-alert" class="w-3.5 h-3.5"></i> Batas Risiko (Stop Loss) $${targetTicker}:</strong>
			Untuk membatasi kerugian, pasang Stop Loss ketat jika harga ditutup di bawah <strong class="font-mono text-rose-400">${formatRp(sl)}</strong>.<br>
			<span class="text-[10px] text-slate-400 mt-1 block"><i>Note: Disiplin SL sangat penting jika tren berbalik arah dan menjebol support!</i></span>
		`;
	}

	// 6. Kategori: Moving Average (MA) / Tren
	if (lower.includes('ma5') || lower.includes('ma10') || lower.includes('ma20') || lower.includes('moving average') || lower.includes('ma') || lower.includes('tren') || lower.includes('skor')) {
		const trendText = price >= data.ma5 ? '<span class="text-emerald-400 font-bold">di atas MA5 (Fase Bullish / Menguat)</span>' : '<span class="text-rose-400 font-bold">di bawah MA5 (Fase Koreksi / Lemah)</span>';
		return `
			<strong class="text-fuchsia-400 flex items-center gap-1.5"><i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Posisi Moving Average $${targetTicker}:</strong>
			<ul class="space-y-0.5 mt-1 list-inside font-mono">
				<li>• MA5 : <span class="text-white">${formatRp(data.ma5)}</span></li>
				<li>• MA10: <span class="text-white">${formatRp(data.ma10)}</span></li>
				<li>• MA20: <span class="text-white">${formatRp(data.ma20)}</span></li>
			</ul>
			<div class="mt-1.5 border-t border-slate-700/50 pt-1.5">
				Struktur saat ini: Harga (${formatRp(price)}) berada ${trendText}.
			</div>
		`;
	}

	// 7. Kategori: Volume & Valuasi Transaksi
	if (lower.includes('lot') || lower.includes('volume') || lower.includes('valuasi') || lower.includes('rasio') || lower.includes('likuiditas') || lower.includes('transaksi') || lower.includes('ramai') || lower.includes('sepi')) {
		const volStatus = data.volRatio >= 1.5 ? '<span class="text-emerald-400 font-bold">Spike (Sangat Ramai) ⚡</span>' : (data.volRatio >= 1.0 ? '<span class="text-amber-400 font-bold">Normal</span>' : '<span class="text-slate-400">Sepi</span>');
		return `
			<strong class="text-emerald-400 flex items-center gap-1.5"><i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i> Analisis Volume $${targetTicker}:</strong>
			<ul class="space-y-0.5 mt-1 font-mono">
				<li>• Total Lot: <span class="text-white">${(data.currentLot || 0).toLocaleString('id-ID')} Lot</span></li>
				<li>• Valuasi: <span class="text-white">${formatRp(data.currentValuation)}</span></li>
				<li>• Rasio Rerata: <span class="text-white">${data.volRatio}x</span> (${volStatus})</li>
			</ul>
			<div class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">Lonjakan volume (Spike) adalah konfirmasi mutlak yang menguatkan validasi <i>breakout</i>.</div>
		`;
	}

	// 8. Kategori: General Prospek / Pandangan Utama
	if (lower.includes('coba') || lower.includes('coba lihat') || lower.includes('prospek') || lower.includes('analisa') || lower.includes('coba analisa') || lower.includes('bagaimana') || lower.includes('gimana') || lower.includes('review') || lower.includes('teknikal')) {
		const saran = (price >= data.ma5 && data.volRatio >= 1) 
			? 'Tren cukup solid, pertimbangkan <strong class="text-emerald-400">Buy on Breakout</strong> atau *Pullback*.' 
			: 'Tren cenderung tertekan, sebaiknya <strong class="text-amber-400">Wait & See</strong> atau *Buy on Support* dengan SL ketat.';
			
		return `
			<strong class="text-emerald-400 flex items-center gap-1.5"><i data-lucide="cpu" class="w-3.5 h-3.5"></i> Ringkasan Teknis AI untuk $${targetTicker}:</strong>
			Harga terkini <strong class="text-white">${formatRp(price)}</strong> (<span class="${data.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${data.changePct >= 0 ? '+' : ''}${data.changePct}%</span>).<br>
			Secara umum, ruang pergerakan terdekat berada di antara support <strong class="font-mono text-amber-400">${formatRp(sup2)}</strong> dan resistance <strong class="font-mono text-cyan-400">${formatRp(res1)}</strong>.<br><br>
			<span class="text-slate-300">💡 <b>Saran:</b> ${saran}</span>
		`;
	}

	// 9. Kategori: Fallback (Pertanyaan Kompleks yang tidak terdefinisi secara spesifik)
	return `
		Poin yang sangat detail! Untuk <strong class="text-emerald-400">$${targetTicker}</strong> (Posisi: ${formatRp(price)}), fokus utamanya ada di ketahanan <b>Support ${formatRp(sup2)}</b> dan uji <b>Resist ${formatRp(res1)}</b>.<br><br>
		Adakah metrik khusus yang ingin kamu gali seperti kalkulasi <i>Moving Average (MA)</i>, status <i>Volume</i> harian, atau butuh titik <i>Stop Loss</i>?
	`;
}

// CUSTOM CONFIRM MODAL (MENGGANTIKAN NATIVE confirm())
function showConfirm(message) {
	return new Promise((resolve) => {
		let modal = document.getElementById('customConfirmModal');
		
		// Buat elemen modal secara otomatis jika belum ada di HTML
		if (!modal) {
			modal = document.createElement('div');
			modal.id = 'customConfirmModal';
			// Perbaikan: Ubah z-[110] menjadi z-[90] agar tidak menimpa toast alert (z-[100])
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

		// Hapus event listener lama agar tidak menumpuk
		btnOk.onclick = () => closeModel(true);
		btnCancel.onclick = () => closeModel(false);
	});
}

// MODIFIED MODERN ALERT (TOAST NOTIFICATION)
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    
    // Konfigurasi warna & ikon berdasarkan tipe
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
        borderColor = 'border-cyan-500/40';
        iconColor = 'text-cyan-400';
        iconClass = 'fa-circle-info';
    }

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-xl ${bgColor} border ${borderColor} shadow-2xl backdrop-blur-xl text-slate-200 text-xs sm:text-sm font-bold transform translate-y-4 opacity-0 transition-all duration-300 max-w-sm`;
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} ${iconColor} text-base shrink-0"></i>
        <div class="flex-1 leading-relaxed">${message}</div>
        <button onclick="document.getElementById('${toastId}').remove()" class="text-slate-400 hover:text-white transition p-1 shrink-0">
            <i class="fa-solid fa-xmark text-xs"></i>
        </button>
    `;

    container.appendChild(toast);

    // Animasi Muncul
    setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    }, 10);

    // Otomatis Hilang Setelah 3.5 Detik
    setTimeout(() => {
        if (document.getElementById(toastId)) {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }
    }, 3500);
}

initSearchSuggestions();
checkVIPAuth();
cleanExpiredCache();
updateMarketBadge();
checkUrlParamTicker();
checkNotificationStatus();

document.getElementById('stockTitle').innerText = `IDX:${currentTicker}`;
document.getElementById('aiHeaderTicker').innerText = `[${currentTicker}] — KONDISI TEKNIKAL`;
document.getElementById('newsTickerLabel').innerText = currentTicker;
document.getElementById('fundTickerLabel').innerText = currentTicker;
document.getElementById('rrrTickerLabel').innerText = currentTicker;
document.getElementById('alertTickerLabel').innerText = currentTicker;
document.getElementById('corpTickerLabel').innerText = currentTicker;
document.getElementById('peerTickerLabel').innerText = currentTicker;

renderChart(currentTicker);
renderTechnicalGauge(currentTicker);
renderFundamentalWidget(currentTicker);
renderAllAlerts();
generateAISignal(currentTicker);
fetchStockNews(currentTicker);
fetchCorporateAction(currentTicker);
renderJournalTable();
checkWelcomeModal();
startBackgroundAutoCache();