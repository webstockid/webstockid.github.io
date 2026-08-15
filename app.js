// ==================== NAVIGASI & DROPDOWN ====================
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

// ==================== WEB AUDIO ENGINE ====================
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
	playClick() {
		try {
			this.init();
			if (!this.ctx) return;
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(800, this.ctx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
			gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
			osc.connect(gain);
			gain.connect(this.ctx.destination);
			osc.start();
			osc.stop(this.ctx.currentTime + 0.05);
		} catch(e){}
	},
	playSuccess() {
		try {
			this.init();
			if (!this.ctx) return;
			const now = this.ctx.currentTime;
			const notes = [523.25, 659.25, 783.99, 1046.50];
			notes.forEach((freq, idx) => {
				const osc = this.ctx.createOscillator();
				const gain = this.ctx.createGain();
				osc.type = 'triangle';
				osc.frequency.setValueAtTime(freq, now + idx * 0.06);
				gain.gain.setValueAtTime(0, now + idx * 0.06);
				gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
				osc.connect(gain);
				gain.connect(this.ctx.destination);
				osc.start(now + idx * 0.06);
				osc.stop(now + idx * 0.06 + 0.25);
			});
		} catch(e){}
	},
	playAlert() {
		try {
			this.init();
			if (!this.ctx) return;
			const now = this.ctx.currentTime;
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(300, now);
			osc.frequency.setValueAtTime(450, now + 0.08);
			gain.gain.setValueAtTime(0.1, now);
			gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
			osc.connect(gain);
			gain.connect(this.ctx.destination);
			osc.start(now);
			osc.stop(now + 0.2);
		} catch(e){}
	}
};

document.addEventListener('click', function(e) {
	const target = e.target.closest('button, a, [onclick]');
	if (target) {
		AudioFX.playClick();
		if ('vibrate' in navigator) {
			navigator.vibrate(50);
		}
	}
});

// ==================== LOGIKA FRAKSI HARGA BURSA EFEK INDONESIA (BEI) ====================
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

// ==================== POP-UP WELCOME CONTROL ====================
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

// ==================== DATABASE TOKEN VIP ====================
const databaseVIP = {
	"1": { "tanggalExpired": "2040-07-25" },
	"000": { "tanggalExpired": "2026-08-15" },
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
	"TAMA2838": { "tanggalExpired": "2026-10-01" },
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
let globalRadarDataList = [];
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
	AudioFX.playAlert();
	const errEl = document.getElementById('loginErrorMsg');
	if(errEl) {
		errEl.innerText = msg;
		errEl.classList.remove('hidden');
	}
}

// ==================== UTAMA & FITUR FITUR APP ====================
let currentTicker = 'MDIA';
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
	document.getElementById('tv_chart_container').innerHTML = '';
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
		"height": "400",
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
	container.innerHTML = '';

	const script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-financials.js';
	script.async = true;
	script.text = JSON.stringify({
		"colorTheme": "dark",
		"isTransparent": true,
		"largeChartUrl": "",
		"displayMode": "regular",
		"width": "100%",
		"height": "480",
		"symbol": `IDX:${ticker}`,
		"locale": "id"
	});
	container.appendChild(script);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// OPTIMASI REALTIME DATA FETCHING
async function fetchRealtimeStockData(ticker, forceFetch = false) {
	const cachedData = getCachedStockData(ticker);
	if (cachedData && !forceFetch) return cachedData;

	const targetSymbol = `${ticker}.JK`;
	const WORKER_URL = 'https://stockid-api-proxy.accespy-mail.workers.dev';
	
	const fetchWithTimeout = (url, timeoutMs = 1800) => {
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
		const volSlice10 = volumes.slice(-10);
		const volMA10 = volSlice10.length > 0 ? Math.round(volSlice10.reduce((a, b) => a + b, 0) / volSlice10.length) : 1;
		const volRatio = volMA10 > 0 ? parseFloat((currentVolume / volMA10).toFixed(2)) : 1.0;

		const high20 = highs.length >= 20 ? roundToBEITick(Math.max(...highs.slice(-20))) : roundToBEITick(Math.max(...highs));
		const low20 = lows.length >= 20 ? roundToBEITick(Math.min(...lows.slice(-20))) : roundToBEITick(Math.min(...lows));

		return { ticker, price: roundToBEITick(currentPrice), prevClose: roundToBEITick(previousClose), changePct, ma5, ma10, ma20, currentVolume, volMA10, volRatio, high20, low20 };
	};

	const workerPromise = fetchWithTimeout(`${WORKER_URL}?symbol=${targetSymbol}`, 1800)
		.then(res => res.json())
		.then(json => parseYahooJSON(json));

	const yahooProxyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?interval=15m&range=5d`;
	const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooProxyUrl)}`;
	
	const yahooPromise = fetchWithTimeout(allOriginsUrl, 2000)
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

// LOGIKA GENERATE AI SIGNAL & EKSKUSI SMART ALERT CHECK
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

		fetchRealtimeStockData(ticker, true).then(freshData => {
			if (freshData) {
				globalStockData = freshData;
				renderAISignalUI(ticker, freshData, false);
				checkPriceAlertsRealtime(ticker, freshData.price);
			}
		});
		return;
	}

	showAISkeletonLoading();

	const stockData = await fetchRealtimeStockData(ticker, false);
	if (stockData && stockData.ticker === ticker) {
		globalStockData = stockData;
		checkPriceAlertsRealtime(ticker, stockData.price);
	}

	renderAISignalUI(ticker, stockData, false);
}

// RENDER UI HASIL ANALISA
function renderAISignalUI(ticker, stockData, isCached) {
	const verdikEl = document.getElementById('aiVerdikText');
	const scoreEl = document.getElementById('aiScoreBadge');
	const descEl = document.getElementById('aiVerdikDesc');
	const buktiEl = document.getElementById('aiBuktiUtamaList');
	const kesimpulanEl = document.getElementById('aiKesimpulanText');

	let price = stockData ? roundToBEITick(stockData.price) : 100;

	let score = 3;
	let verdik = "NETRAL / KONSOLIDASI";
	let verdikClass = "font-black text-amber-400 text-sm lg:text-base";
	let scoreClass = "font-bold bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";

	if (stockData) {
		const isAboveMA5 = stockData.price >= stockData.ma5;
		const isAboveMA10 = stockData.price >= stockData.ma10;
		const isAboveMA20 = stockData.price >= stockData.ma20;
		const isVolSpike = stockData.volRatio >= 1.00;

		if (isAboveMA5 && isAboveMA10 && isAboveMA20 && stockData.changePct > 1.5 && isVolSpike) {
			score = 5;
			verdik = "STRONG BULLISH BREAKOUT";
			verdikClass = "font-black text-emerald-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-emerald-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if ((isAboveMA5 || isAboveMA10) && stockData.changePct >= 0) {
			score = 4;
			verdik = "BULLISH ACCUMULATION";
			verdikClass = "font-black text-emerald-300 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-emerald-300 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.changePct < -2.5 && !isAboveMA10) {
			score = 1;
			verdik = "STRONG BEARISH / SELLING PRESSURE";
			verdikClass = "font-black text-rose-500 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-rose-500 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.changePct < 0) {
			score = 2;
			verdik = "WEAK / BEARISH CORRECTION";
			verdikClass = "font-black text-rose-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-rose-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		}

		verdikEl.innerText = verdik;
		verdikEl.className = verdikClass;
		scoreEl.innerText = `${score}/5`;
		scoreEl.className = scoreClass;

		const trendText = stockData.changePct >= 0 ? `menguat +${stockData.changePct}%` : `terkoreksi ${stockData.changePct}%`;
		const volText = isVolSpike 
			? `<strong class="text-emerald-400">terjadi lonjakan volume (${stockData.volRatio}x rerata volume harian)</strong>` 
			: `volume transaksi cenderung moderat (${stockData.volRatio}x rerata volume harian)`;
		
		const maAlignText = (isAboveMA5 && isAboveMA10 && isAboveMA20)
			? "Struktur tren berada dalam susunan <strong class='text-emerald-400'>Bullish Alignment</strong> (Harga > MA5 > MA10 > MA20). Ini menandakan partisipasi pembeli mendominasi penuh seluruh horizon waktu jangka pendek."
			: (!isAboveMA10 && !isAboveMA20)
			? "Posisi harga berada <strong class='text-rose-400'>di bawah MA10 & MA20</strong>, mengindikasikan tekanan jual jangka pendek yang intensif dan kurva pergerakan dalam fase penurunan beruntun (*downtrend*)."
			: "Pergerakan harga berada dalam zona konsolidasi dinamis antar garis rata-rata, mengisyaratkan perebutan momentum antara kubu *bulls* dan *bears*.";

		descEl.innerHTML = `
			<p class="leading-relaxed"><strong>Mengapa Verdik Ini Diberikan?</strong> Saham ${ticker} saat ini diperdagangkan pada level harga Rp ${price.toLocaleString('id-ID')} (${trendText}). ${maAlignText}</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong>Analisis Likuiditas & Volume:</strong> Terdeteksi bahwa ${volText}. Tingkat aktivitas volume ini mengonfirmasi kekuatan partisipasi institusi atau pelaku pasar utama dalam mendukung pergerakan harga hari ini.</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong>Rentang Volatilitas 20 Hari:</strong> Pergerakan saham ${ticker} bergerak dalam koridor rentang antara Rp ${stockData.low20.toLocaleString('id-ID')} (Support Kuat 20 Hari) hingga Rp ${stockData.high20.toLocaleString('id-ID')} (Resistance Tertinggi 20 Hari). Posisi saat ini memberikan *Risk/Reward Ratio* yang patut dipertimbangkan sebelum mengeksekusi *Trading Plan*.</p>
		`;

		buktiEl.innerHTML = `
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Harga: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> (${stockData.changePct >= 0 ? '+' : ''}${stockData.changePct}%)</span>
				<span class="text-[10px] lg:text-[11px] text-white">${isCached ? 'Cache Instant' : 'Live Data'}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Posisi Tren MA5 / MA10 / MA20:</span>
				<span class="font-mono text-emerald-400">Rp ${stockData.ma5.toLocaleString('id-ID')} / ${stockData.ma10.toLocaleString('id-ID')} / ${stockData.ma20.toLocaleString('id-ID')}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Rasio Volume vs Rerata Volume Harian:</span>
				<span class="font-bold font-mono ${isVolSpike ? 'text-emerald-400' : 'text-amber-400'}">${stockData.volRatio}x ${isVolSpike ? '(Spike Active)' : '(Normal)'}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Terendah 20 Hari / Rentang Tertinggi:</span>
				<span class="font-mono text-cyan-400">Rp ${stockData.low20.toLocaleString('id-ID')} - Rp ${stockData.high20.toLocaleString('id-ID')}</span>
			</li>
		`;

	} else {
		verdikEl.innerText = "NETRAL-SELEKTIF";
		scoreEl.innerText = "3/5";
		descEl.innerText = `Menganalisis pergerakan teknikal emiten ${ticker} berbasis indikator grafik TradingView. Silakan evaluasi struktur pola harga harian sebelum melakukan transaksi.`;
	}

	const sl = roundToBEITick(price * 0.92, 'floor'); 
	const sup1 = roundToBEITick(price * 0.94, 'floor'); 
	const sup2 = roundToBEITick(price * 0.96, 'floor'); 
	const res1 = roundToBEITick(price * 1.05, 'ceil'); 
	const res2 = roundToBEITick(price * 1.08, 'ceil'); 
	const tp1 = roundToBEITick(price * 1.06, 'ceil'); 
	const tp2 = roundToBEITick(price * 1.14, 'ceil'); 

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

	const rrrRatioVal = ((tp1 - price) / Math.max(1, (price - sl))).toFixed(2);
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

// COOLDOWN LOGIC EXPORT CARD (10 DETIK)
function startExportCardCooldown(seconds = 10) {
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

// FITUR: EXPORT TRADING PLAN CARD
function exportTradingCard() {
	const btn = document.getElementById('btnExportCard');
	if (btn && btn.disabled) return;

	if (!globalStockData) {
		AudioFX.playAlert();
		alert("Memuat data saham... Mohon tunggu sejenak.");
		return;
	}

	startExportCardCooldown(10);

	const price = roundToBEITick(globalStockData.price);
	const sl = roundToBEITick(price * 0.92, 'floor');
	const tp2 = roundToBEITick(price * 1.14, 'ceil');
	const sup1 = roundToBEITick(price * 0.94, 'floor');
	const res1 = roundToBEITick(price * 1.05, 'ceil');

	const now = new Date();
	const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

	document.getElementById('cardDateStr').innerText = dateStr;
	document.getElementById('cardTicker').innerText = `$${currentTicker}`;
	document.getElementById('cardPrice').innerText = `Rp ${price.toLocaleString('id-ID')}`;
	document.getElementById('cardEntry').innerText = `Rp ${sup1.toLocaleString('id-ID')} - ${price.toLocaleString('id-ID')}`;
	document.getElementById('cardSL').innerText = `< Rp ${sl.toLocaleString('id-ID')}`;
	document.getElementById('cardTP2').innerText = `Rp ${tp2.toLocaleString('id-ID')}`;
	document.getElementById('cardRES1').innerText = `Rp ${res1.toLocaleString('id-ID')}`;

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

// DAFTAR RADAR & WATCHLIST LENGKAP UNTUK SERUAN KOMPARASI
const radarWatchlist = [
	'MDIA', 'KOTA', 'BNBR', 'JGLE', 'ELTY', 'BBCA', 'BBRI', 'BMRI', 'BBNI', 'BBTN',
	'BRIS', 'ARTO', 'BJTM', 'BJBR', 'BDMN', 'NISP', 'BNGA', 'BTPN', 'PNBN', 'PNLF',
	'BBYB', 'BBHI', 'AGRO', 'TLKM', 'ASII', 'GOTO', 'AMMN', 'BREN', 'TPIA', 'BYAN',
	'BRPT', 'MDKA', 'UNVR', 'EMTK', 'SCMA', 'BUKA', 'BELI', 'WIFI', 'MTDL', 'PGAS',
	'ANTM', 'INCO', 'MEDC', 'ADRO', 'PTBA', 'ITMG', 'HRUM', 'INDY', 'AKRA', 'CUAN',
	'PTRO', 'MBMA', 'NCKL', 'TINS', 'BRMS', 'ENRG', 'DEWA', 'RAJA', 'SGER', 'DOID',
	'BSSR', 'KKGI', 'HUMI', 'LEAD', 'PSSI', 'SMDR', 'TMAS', 'WINS', 'PANI', 'BSDE',
	'CTRA', 'PWON', 'SMRA', 'KPIG', 'ASRI', 'SSIA', 'KIJA', 'JSMR', 'PTPP', 'ADHI',
	'WEGE', 'WTON', 'TOWR', 'TBIG', 'EXCL', 'ISAT', 'CENT', 'META', 'DILD', 'JRPT',
	'MKPI', 'BKSL', 'ICBP', 'INDF', 'CPIN', 'JPFA', 'AMRT', 'ACES', 'MAPI', 'ERAA',
	'KLBF', 'MIKA', 'HEAL', 'SIDO', 'MYOR', 'CMRY', 'ROTI', 'MAPA', 'GGRM', 'HMSP',
	'WIIM', 'SILO', 'SAME', 'KAEF', 'TSPC', 'IRRA', 'INKP', 'TKIM', 'INTP', 'SMGR',
	'SMCB', 'SMBR', 'AUTO', 'DRMA', 'SMSM', 'GJTL', 'BIRD', 'ASSA', 'AVIA', 'ESSA',
	'UNTR', 'SRTG', 'CASS', 'IMAS', 'MPMX', 'WOOD', 'SPTO', 'MLPL', 'RALS', 'MPPA',
	'ULTJ', 'AALI', 'LSIP', 'SIMP', 'TAPG', 'DSNG', 'BWPT', 'SGRO', 'SSMS', 'NSSS',
	'TBLA', 'MIDI', 'STAA', 'MAIN', 'FOOD', 'ALII', 'CITA', 'MDKI', 'VKTR', 'RATU',
	'FORU', 'MNCN', 'FILM', 'KEEN', 'POWR', 'MCAS', 'DIVA', 'AXIO', 'MLPT', 'DNET',
	'ISSP', 'KRAS', 'BAJA', 'LTLS', 'AGII', 'ALDO', 'BFIN', 'CFIN', 'HDFA', 'MFIN',
	'APLN', 'LPKR', 'LPCK', 'DMAS', 'GPRA', 'AMAG', 'BBLD', 'BHAT', 'BINA', 'BIPI',
	'BISR', 'BMAS', 'BMTR', 'BOLA', 'CSAP', 'CSRA', 'DLTA', 'DYAN', 'HERO', 'HEXA'
];
const uniqueRadarWatchlist = [...new Set(radarWatchlist)];

// COOLDOWN LOGIC REFRESH PEER DATA (12 DETIK)
function startPeerRefreshCooldown(seconds = 12) {
	const btn = document.getElementById('btnRefreshPeer');
	if (!btn) return;

	btn.disabled = true;
	btn.classList.add('opacity-50', 'cursor-not-allowed');
	let remaining = seconds;

	if (peerRefreshCooldownTimer) clearInterval(peerRefreshCooldownTimer);

	btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh Data (${remaining}s)`;
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
			btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh Data (${remaining}s)`;
			if (window.lucide) lucide.createIcons();
		}
	}, 1000);
}

// FITUR NO. 2: PEER KOMPARASI HARGA SERUPA
async function loadPeerAnalysisByPrice(targetTicker, isManualRefresh = false) {
	if (isManualRefresh) {
		const btn = document.getElementById('btnRefreshPeer');
		if (btn && btn.disabled) return;
		startPeerRefreshCooldown(12);
	}

	const body = document.getElementById('peerTableBody');
	document.getElementById('peerTickerLabel').innerText = targetTicker;
	const refLabel = document.getElementById('peerTickerRef');
	if (refLabel) refLabel.innerText = targetTicker;

	body.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 font-sans"><i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto mb-1 text-cyan-400"></i> Memuat saham-saham dengan harga serupa...</td></tr>`;
	if (window.lucide) lucide.createIcons();

	let baseData = globalStockData;
	if (!baseData || baseData.ticker !== targetTicker) {
		baseData = await fetchRealtimeStockData(targetTicker);
	}

	if (!baseData || !baseData.price) {
		body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 font-sans">Gagal memuat harga acuan $${targetTicker}.</td></tr>`;
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
				<td class="p-3.5 text-white font-sans flex items-center gap-2">
					<strong class="text-amber-400 font-mono">&dollar;${data.ticker}</strong>
				</td>
				<td class="p-3.5 text-white">Rp ${roundToBEITick(data.price).toLocaleString('id-ID')}</td>
				<td class="p-3.5 ${isPlus ? 'text-emerald-400' : 'text-rose-400'} font-bold">
					${isPlus ? '+' : ''}${data.changePct}%
				</td>
				<td class="p-3.5 ${data.price >= data.ma5 ? 'text-emerald-400' : 'text-rose-400'}">
					${data.price >= data.ma5 ? 'Bullish (Above MA5)' : 'Bearish (Below MA5)'}
				</td>
				<td class="p-3.5 ${data.volRatio >= 1.2 ? 'text-cyan-400 font-bold' : 'text-slate-400'}">
					${data.volRatio}x Vol
				</td>
				<td class="p-3.5 text-center font-sans">
					<button onclick="selectSuggestion('${data.ticker}')" class="text-[10px] bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 px-3 py-1 rounded-lg transition border border-slate-700 font-semibold">
						Buka Chart
					</button>
				</td>
			</tr>
		`;
	});

	body.innerHTML = rowsHTML || `<tr><td colspan="6" class="p-4 text-center text-slate-400 font-sans">Tidak ditemukan saham dengan range harga serupa.</td></tr>`;
}

// FITUR JOURNAL TRADING & WIN RATE TRACKER
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
		alert("Silakan lengkapi Entry, SL, dan TP yang valid terlebih dahulu!");
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
	alert(`Trading Plan untuk $${currentTicker} berhasil disimpan ke Journal Trading!`);
}

function updateJournalStatus(id, newStatus) {
	let journal = getJournalData();
	journal = journal.map(item => {
		if (item.id === id) item.status = newStatus;
		return item;
	});
	saveJournalData(journal);
}

function deleteJournalItem(id) {
	let journal = getJournalData();
	journal = journal.filter(item => item.id !== id);
	saveJournalData(journal);
}

function clearJournalHistory() {
	if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat Journal Trading?")) {
		localStorage.removeItem('stockid_trading_journal');
		renderJournalTable();
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
		body.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 font-sans">Belum ada Trading Plan tersimpan. Gunakan tombol "Simpan ke Journal" di kalkulator Smart RRR.</td></tr>`;
		return;
	}

	let rows = '';
	journal.forEach(item => {
		let statusBadge = '<span class="text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-sans">OPEN</span>';
		if (item.status === 'WIN') statusBadge = '<span class="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-sans">WIN (TP)</span>';
		if (item.status === 'LOSS') statusBadge = '<span class="text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-sans">LOSS (SL)</span>';

		rows += `
			<tr class="hover:bg-slate-800/40">
				<td class="p-3.5 text-slate-400">${item.date}</td>
				<td class="p-3.5 font-bold text-amber-400">&dollar;${item.ticker}</td>
				<td class="p-3.5 text-white">Rp ${item.entry.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-rose-400">Rp ${item.sl.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-emerald-400">Rp ${item.tp.toLocaleString('id-ID')}</td>
				<td class="p-3.5 text-cyan-400">${item.rrr}</td>
				<td class="p-3.5">${statusBadge}</td>
				<td class="p-3.5 text-center font-sans space-x-1">
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
	if (globalStockData) {
		const price = roundToBEITick(globalStockData.price);
		const sl = roundToBEITick(price * 0.95, 'floor');
		const tp = roundToBEITick(price * 1.15, 'ceil');

		document.getElementById('rrrEntry').value = price;
		document.getElementById('rrrSL').value = sl;
		document.getElementById('rrrTP').value = tp;
		calculateSmartRRR();
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
		evalEl.className = "p-2.5 rounded-lg text-[11px] lg:text-xs font-semibold text-center bg-slate-900 text-white";
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
	maxLotsEl.innerText = `${maxLots.toLocaleString('id-ID')} Lot (${(maxLots * 100).toLocaleString('id-ID')} lembar)`;
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

// LOGIKA DROPDOWN SUGGESTION PENCARIAN
function initSearchSuggestions() {
	const input = document.getElementById('stockSearch');
	const box = document.getElementById('searchSuggestionsBox');

	if (!input || !box) return;

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
					<span class="text-[9px] text-slate-500 group-hover:text-emerald-400 font-sans">IDX</span>
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

// FITUR NO. 3: RADAR BANDAR AUTOMATIC FULL SCAN
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
			globalRadarDataList = validData;
			renderRadarItems(validData);
		}

		if (validData.length >= 10) {
			break;
		}
	}

	isRadarScanning = false;
	btn.disabled = false;
	btn.className = "text-[10px] lg:text-xs text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-lg border border-amber-500/50 flex items-center justify-center gap-1.5 transition shadow-md";
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

		const entryLow = roundToBEITick(price * 0.94, 'floor');
		const entryHigh = roundToBEITick(price * 0.96, 'floor');
		const sl = roundToBEITick(price * 0.92, 'floor');
		const tp1 = roundToBEITick(price * 1.06, 'ceil');
		const tp2 = roundToBEITick(price * 1.14, 'ceil');

		let statusSignal = "🔥 Momentum Breakout";
		let statusClass = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
		let alasanTeknikal = `Perubahan <strong>${changePct}%</strong> dan bertahan kokoh di atas garis Moving Average MA5 (Rp ${item.ma5.toLocaleString('id-ID')}), menandakan tekanan beli harian masih mendominasi pasar.`;

		if (item.ma5 > item.ma10 && item.price >= item.ma5 && changePct > 0.5 && changePct < 3) {
			statusSignal = "🚀 Golden Cross Setup";
			statusClass = "text-sky-400 border-sky-500/30 bg-sky-500/10";
			alasanTeknikal = `Sinyal perpotongan garis MA5 (Rp ${item.ma5.toLocaleString('id-ID')}) melintasi naik MA10/MA20 (*Golden Cross*). Pola pembalikan arah (*reversal*) awal berpotensi terbentuk.`;
		} else if (item.volRatio >= 1.3) {
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
								<span class="font-black text-white text-sm lg:text-base">&dollar;${ticker}</span>
								<button onclick="selectTickerFromRadar('${ticker}')" class="text-[9px] lg:text-[10px] bg-blue-500/20 text-blue-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 font-bold px-2 py-0.5 rounded transition">
									Lihat Chart
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
						<span class="text-white text-[9px] lg:text-[10px] block">Support MA10</span>
						<span class="font-bold text-cyan-400 font-mono">Rp ${item.ma10.toLocaleString('id-ID')}</span>
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
	loadPeerAnalysisByPrice(ticker);
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

// ==================== FITUR 1: SMART ALERT & BROWSER PUSH NOTIFICATION SYSTEM ====================
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
		btn.innerHTML = `<i data-lucide="bell-ring" class="w-3.5 h-3.5 text-emerald-400"></i> Notifikasi Push Aktif`;
		btn.className = "text-[10px] lg:text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-3.5 py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-default";
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
		alert("Browser Anda tidak mendukung Web Push Notification.");
		return;
	}

	Notification.requestPermission().then(permission => {
		checkNotificationStatus();
		if (permission === "granted") {
			sendBrowserPushNotification("Stock ID Screener Alert", `System push notification berhasil diaktifkan!`);
			AudioFX.playSuccess();
		} else if (permission === "denied") {
			AudioFX.playAlert();
			alert("Izin notifikasi telah ditolak. Silakan izinkan melalui pengaturan browser Anda.");
		}
	});
}

function sendBrowserPushNotification(title, message) {
	if ("Notification" in window && Notification.permission === "granted") {
		try {
			new Notification(title, {
				body: message,
				icon: 'stockid_gambar/stockicon.jpg',
				tag: 'stockid-alert'
			});
		} catch(e){}
	}
}

function getAlerts(ticker) {
	return JSON.parse(localStorage.getItem(`alerts_${ticker}`) || '[]');
}

function saveAlerts(ticker, alerts) {
	localStorage.setItem(`alerts_${ticker}`, JSON.stringify(alerts));
	renderAlertList(ticker);
}

function renderAlertList(ticker) {
	const container = document.getElementById('alertListContainer');
	const labelTicker = document.getElementById('alertActiveTicker');
	if (labelTicker) labelTicker.innerText = ticker;

	const alerts = getAlerts(ticker);

	if (alerts.length === 0) {
		container.innerHTML = `<div class="text-center text-slate-400 py-6 lg:col-span-3 font-sans text-xs">Belum ada alert harga yang dipasang untuk $${ticker}.</div>`;
		return;
	}

	container.innerHTML = '';
	alerts.forEach((alertObj, index) => {
		const isCustomObj = typeof alertObj === 'object';
		const targetPrice = isCustomObj ? alertObj.price : alertObj;
		const isActive = isCustomObj ? alertObj.active : true;

		container.innerHTML += `
			<div class="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 ${isActive ? 'border-l-4 border-l-emerald-400' : 'opacity-60'}">
				<div>
					<span class="text-[10px] text-slate-400 block font-sans">Target Trigger:</span>
					<strong class="text-emerald-400 font-mono text-sm">Rp ${targetPrice.toLocaleString('id-ID')}</strong>
				</div>
				<div class="flex items-center gap-2 font-sans">
					<button onclick="toggleAlertStatus('${ticker}', ${index})" class="text-[10px] ${isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'} px-2 py-1 rounded-md border font-bold transition">
						${isActive ? 'AKTIF' : 'OFF'}
					</button>
					<button onclick="removePriceAlert('${ticker}', ${index})" class="text-slate-400 hover:text-rose-400 font-bold px-2 py-1 transition">✕</button>
				</div>
			</div>
		`;
	});
}

function addPriceAlert() {
	const priceInput = document.getElementById('alertPriceInput');
	const rawPrice = parseFloat(priceInput.value);
	const price = roundToBEITick(rawPrice);

	if (!price || price <= 0) {
		AudioFX.playAlert();
		alert("Masukkan harga target yang valid!");
		return;
	}

	let alerts = getAlerts(currentTicker);
	alerts.push({ price: price, active: true, triggered: false });
	saveAlerts(currentTicker, alerts);

	priceInput.value = '';
	AudioFX.playSuccess();
}

function toggleAlertStatus(ticker, index) {
	let alerts = getAlerts(ticker);
	if (alerts[index]) {
		if (typeof alerts[index] === 'object') {
			alerts[index].active = !alerts[index].active;
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

		if (isActive && currentPrice >= targetPrice) {
			const alertMsg = `🎯 Sinyal Alert $${ticker}! Harga terkini telah menyentuh/menembus target Rp ${targetPrice.toLocaleString('id-ID')}`;
			
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
	});

	if (updated) {
		saveAlerts(ticker, alerts);
	}
}

async function fetchStockNews(ticker) {
	const container = document.getElementById('newsContainer');
	container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-10 lg:col-span-3">Memuat berita terkini ${ticker}...</div>`;
	
	const rssUrl = `https://news.google.com/rss/search?q=${ticker}+saham+indonesia&hl=id&gl=ID&ceid=ID:id`;
	const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

	try {
		const response = await fetch(apiUrl);
		const data = await response.json();

		if (data.status === 'ok' && data.items && data.items.length > 0) {
			container.innerHTML = '';
			data.items.slice(0, 9).forEach(item => {
				const date = new Date(item.pubDate).toLocaleDateString('id-ID', {
					day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
				});

				container.innerHTML += `
					<a href="${item.link}" target="_blank" class="block p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition duration-150">
						<h4 class="text-xs lg:text-sm font-semibold text-slate-200 line-clamp-2">${item.title}</h4>
						<div class="flex justify-between items-center mt-2 text-[10px] lg:text-xs text-white">
							<span>${item.author || 'Google News'}</span>
							<span>${date}</span>
						</div>
					</a>
				`;
			});
			AudioFX.playSuccess();
		} else {
			container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-3">Tidak ada berita khusus ditemukan untuk ${ticker}.</div>`;
		}
	} catch (e) {
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-3">Berita tidak dapat dijangkau sementara.</div>`;
	}
}

async function fetchCorporateAction(ticker) {
	const container = document.getElementById('corporateContainer');
	container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-10 lg:col-span-3">Memuat aksi korporasi ${ticker}...</div>`;
	
	const query = encodeURIComponent(`${ticker} (dividen OR RUPS OR "right issue" OR "stock split" OR buyback)`);
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
							<span class="text-[9px] lg:text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded border border-emerald-500/30">Aksi Korporasi</span>
							<span class="text-[10px] lg:text-xs text-white">${date}</span>
						</div>
						<h4 class="text-xs lg:text-sm font-semibold text-slate-200 line-clamp-2">${item.title}</h4>
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
	const tabs = ['ai','bigmoney','peer','news','fundamental','rrr','journal','alert','corporate'];
	tabs.forEach(tab => {
		const btn = document.getElementById(`tabBtn-${tab}`);
		const content = document.getElementById(`tabContent-${tab}`);
		
		if (tab === tabName) {
			if(btn) btn.className = "flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-semibold rounded-lg text-emerald-400 bg-slate-800 border border-slate-700 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 lg:px-4 transition";
			if (content) content.classList.remove('hidden');
		} else {
			if(btn) btn.className = "flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-semibold rounded-lg text-white hover:text-slate-200 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 lg:px-4 transition";
			if (content) content.classList.add('hidden');
		}
	});

	if (tabName === 'peer') loadPeerAnalysisByPrice(currentTicker);
	if (tabName === 'journal') renderJournalTable();
	if (tabName === 'alert') renderAlertList(currentTicker);
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
			btn.innerText = `Cari (${remaining}s)`;
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
		renderAlertList(currentTicker);
		generateAISignal(currentTicker, false);
		fetchStockNews(currentTicker);
		fetchCorporateAction(currentTicker);
		loadPeerAnalysisByPrice(currentTicker);

		if (!bypassCooldown) {
			startSearchCooldown(7);
		}
	}
}

// FITUR: SYSTEM BACKGROUND PRE-FETCHER & ALERT CHECKER
function startBackgroundAutoCache() {
	const FIVE_MINUTES = 5 * 60 * 1000;
	
	const runBackgroundFetch = async () => {
		const currentData = await fetchRealtimeStockData(currentTicker, true);
		if (currentData) {
			checkPriceAlertsRealtime(currentTicker, currentData.price);
		}

		const popularTickers = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'GOTO', 'AMMN', 'CUAN', 'ANTM', 'PANI'];
		for (const ticker of popularTickers) {
			if (ticker !== currentTicker) {
				const bgData = await fetchRealtimeStockData(ticker, true);
				if (bgData) {
					checkPriceAlertsRealtime(ticker, bgData.price);
				}
				await sleep(200);
			}
		}
	};

	runBackgroundFetch();
	setInterval(runBackgroundFetch, FIVE_MINUTES);
}

document.getElementById('stockSearch').addEventListener('keypress', function(e) {
	if (e.key === 'Enter') searchStock();
});

// INITIALIZATION ON LOAD
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
renderAlertList(currentTicker);
generateAISignal(currentTicker);
fetchStockNews(currentTicker);
fetchCorporateAction(currentTicker);
renderJournalTable();
checkWelcomeModal();
startBackgroundAutoCache();