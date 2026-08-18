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
			osc.type = 'sine'; //sine
			osc.frequency.setValueAtTime(1300, this.ctx.currentTime); //800
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
				osc.type = 'square'; //triangle
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
			osc.frequency.setValueAtTime(800, now); //300
			osc.frequency.setValueAtTime(1000, now + 0.08); //450
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
			navigator.vibrate(80);
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

// HELPER FORMAT ANGKA RINGKAS (K, M, B, T)
function formatNumberAbbr(num) {
	if (!num || isNaN(num)) return '0';
	if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
	if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
	if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
	if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
	return num.toLocaleString('id-ID');
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
		"height": "540",
		"symbol": `IDX:${ticker}`,
		"locale": "id"
	});
	container.appendChild(script);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchRealtimeStockData(ticker, isBackground = false) {
	if (!isBackground) {
		const cached = getCachedStockData(ticker);
		if (cached) {
			return cached;
		}
	}

	try {
		const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.JK?range=1mo&interval=1d`;
		const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
		const data = await res.json();
		const parsed = JSON.parse(data.contents);
		const result = parsed.chart.result[0];

		const meta = result.meta;
		const quote = result.indicators.quote[0];
		const prices = quote.close.filter(p => p !== null);
		const volumes = quote.volume.filter(v => v !== null);

		const currentPrice = meta.regularMarketPrice || prices[prices.length - 1];
		const prevClose = meta.chartPreviousClose || prices[prices.length - 2];
		const change = currentPrice - prevClose;
		const changePercent = (change / prevClose) * 100;

		const currentVolShares = meta.regularMarketVolume || volumes[volumes.length - 1] || 0;
		const currentVolLot = Math.round(currentVolShares / 100);
		const currentValueIDR = Math.round(currentVolShares * currentPrice);

		const ma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / Math.min(prices.length, 5);
		const ma10 = prices.slice(-10).reduce((a, b) => a + b, 0) / Math.min(prices.length, 10);
		const ma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / Math.min(prices.length, 20);

		const recentVols = volumes.slice(-10);
		const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
		const volRatio = (currentVolShares / (avgVol || 1)).toFixed(1);

		const payload = {
			ticker,
			price: currentPrice,
			change,
			changePercent,
			volumeLot: currentVolLot,
			valueIDR: currentValueIDR,
			ma5: roundToBEITick(ma5),
			ma10: roundToBEITick(ma10),
			ma20: roundToBEITick(ma20),
			volRatio,
			high: meta.regularMarketDayHigh || currentPrice,
			low: meta.regularMarketDayLow || currentPrice
		};

		setCachedStockData(ticker, payload);
		return payload;
	} catch (err) {
		console.warn(`Gagal fetch Yahoo Finance ${ticker}, memakai simulasi fallback.`, err);
		const simPrice = roundToBEITick(Math.floor(Math.random() * 2000) + 100);
		const simChange = Math.floor(Math.random() * 40) - 20;
		const simVolShares = Math.floor(Math.random() * 5000000) + 10000;
		const simVolLot = Math.round(simVolShares / 100);
		const simValIDR = Math.round(simVolShares * simPrice);

		const simPayload = {
			ticker,
			price: simPrice,
			change: simChange,
			changePercent: (simChange / simPrice) * 100,
			volumeLot: simVolLot,
			valueIDR: simValIDR,
			ma5: roundToBEITick(simPrice * 0.98),
			ma10: roundToBEITick(simPrice * 0.95),
			ma20: roundToBEITick(simPrice * 0.92),
			volRatio: (Math.random() * 2 + 0.5).toFixed(1),
			high: simPrice + 10,
			low: simPrice - 10
		};
		setCachedStockData(ticker, simPayload);
		return simPayload;
	}
}

async function generateAISignal(ticker) {
	const aiText = document.getElementById('aiAnalysisText');
	const aiBadge = document.getElementById('aiSignalBadge');
	const aiTp = document.getElementById('aiTargetPrice');
	const aiSl = document.getElementById('aiStopLoss');

	aiText.innerHTML = `<div class="skeleton h-16 w-full rounded-lg"></div>`;

	const data = await fetchRealtimeStockData(ticker);
	globalStockData = data;

	document.getElementById('stockPrice').innerText = `Rp ${data.price.toLocaleString('id-ID')}`;
	const sign = data.change >= 0 ? '+' : '';
	const badgeClass = data.change >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
	
	const changeBadge = document.getElementById('stockChangeBadge');
	changeBadge.innerText = `${sign}${data.changePercent.toFixed(2)}%`;
	changeBadge.className = `text-xs font-bold px-2.5 py-1 rounded-lg border ${badgeClass}`;
	
	document.getElementById('stockChangeRaw').innerText = `(${sign}${data.change})`;

	// UPDATE UI VOLUME LOT & VALUE IDR
	const volEl = document.getElementById('stockVolume');
	const valEl = document.getElementById('stockValue');
	if (volEl) volEl.innerText = `${formatNumberAbbr(data.volumeLot)} Lot`;
	if (valEl) valEl.innerText = `Rp ${formatNumberAbbr(data.valueIDR)}`;

	document.getElementById('rrrEntryPrice').value = data.price;
	
	let rawTp = data.price * 1.05;
	let rawSl = data.price * 0.96;

	if (data.price > data.ma5 && data.volRatio >= 1.2) {
		rawTp = data.price * 1.08;
		rawSl = data.price * 0.95;
	} else if (data.price < data.ma10) {
		rawTp = data.price * 1.03;
		rawSl = data.price * 0.97;
	}

	const tp = roundToBEITick(rawTp, 'ceil');
	const sl = roundToBEITick(rawSl, 'floor');

	document.getElementById('rrrTargetPrice').value = tp;
	document.getElementById('rrrStopLoss').value = sl;
	calculateRRR();

	let signal = "HOLD / NEUTRAL";
	let signalStyle = "bg-amber-500/20 text-amber-400 border-amber-500/30";
	let reason = "";

	if (data.price > data.ma5 && data.volRatio >= 1.5) {
		signal = "STRONG BUY";
		signalStyle = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
		reason = `Saham ${ticker} menunjukkan dorongan beli kuat dengan rasio volume ${data.volRatio}x rerata 10 hari & bergerak kokoh di atas MA5 (Rp ${data.ma5}). Tren jangka pendek sangat bullish.`;
	} else if (data.price > data.ma10) {
		signal = "BUY ON BREAKOUT";
		signalStyle = "bg-teal-500/20 text-teal-400 border-teal-500/30";
		reason = `Saham ${ticker} bertahan di atas MA10 (Rp ${data.ma10}). Volume relatif konstan (${data.volRatio}x). Berpotensi menguji resisten terdekat.`;
	} else {
		signal = "AVOID / WAIT";
		signalStyle = "bg-rose-500/20 text-rose-400 border-rose-500/30";
		reason = `Saham ${ticker} saat ini berada di bawah MA10 (Rp ${data.ma10}) dengan tekanan jual. Disarankan wait & see hingga ada konfirmasi pembalikan arah di support terdekat.`;
	}

	aiBadge.innerText = signal;
	aiBadge.className = `text-xs font-bold px-3 py-1 rounded-xl border ${signalStyle}`;
	aiTp.innerText = `Rp ${tp.toLocaleString('id-ID')}`;
	aiSl.innerText = `Rp ${sl.toLocaleString('id-ID')}`;
	aiText.innerText = reason;

	checkPriceAlertsRealtime(ticker, data.price);
}

function calculateRRR() {
	const entry = parseFloat(document.getElementById('rrrEntryPrice').value) || 0;
	const tp = parseFloat(document.getElementById('rrrTargetPrice').value) || 0;
	const sl = parseFloat(document.getElementById('rrrStopLoss').value) || 0;

	if (entry <= 0 || tp <= 0 || sl <= 0) return;

	const profit = ((tp - entry) / entry) * 100;
	const loss = ((entry - sl) / entry) * 100;
	const ratio = loss > 0 ? (profit / loss).toFixed(2) : '0.00';

	document.getElementById('rrrProfitPercent').innerText = `+${profit.toFixed(2)}%`;
	document.getElementById('rrrLossPercent').innerText = `-${loss.toFixed(2)}%`;
	document.getElementById('rrrRatio').innerText = `1 : ${ratio}`;
}

async function fetchStockNews(ticker) {
	const container = document.getElementById('stockNewsContainer');
	container.innerHTML = `<div class="skeleton h-20 w-full rounded-xl"></div>`;

	await sleep(400);

	const dummyNews = [
		{ title: `Performa Keuangan ${ticker} Catat Tren Positif di Kuartal Ini`, source: "MarketNews", time: "2 jam yang lalu" },
		{ title: `Analisis Pergerakan Volume & Aliran Dana Asing pada Saham ${ticker}`, source: "SahamInfo", time: "5 jam yang lalu" },
		{ title: `Rencana Ekspansi Bisnis Mendorong Prospek Cerah ${ticker}`, source: "FinanAsia", time: "1 hari yang lalu" }
	];

	container.innerHTML = dummyNews.map(n => `
		<div class="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1 hover:border-emerald-500/30 transition">
			<a href="#" class="font-bold text-slate-200 hover:text-emerald-400 transition block leading-snug">${n.title}</a>
			<div class="flex justify-between text-[10px] text-slate-400">
				<span>${n.source}</span>
				<span>${n.time}</span>
			</div>
		</div>
	`).join('');
}

async function fetchCorporateActions(ticker) {
	const container = document.getElementById('corporateActionWidget');
	container.innerHTML = `<div class="skeleton h-16 w-full rounded-xl"></div>`;

	await sleep(300);

	const actions = [
		{ type: "RUPS Tahunan", date: "15 Sep 2026", desc: "Persetujuan Laporan Keuangan" },
		{ type: "Dividen Cash", date: "28 Okt 2026", desc: "Estimasi Cum-Date Dividen" }
	];

	container.innerHTML = actions.map(a => `
		<div class="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
			<div>
				<span class="text-xs font-bold text-emerald-400 block">${a.type}</span>
				<span class="text-[10px] text-slate-400">${a.desc}</span>
			</div>
			<span class="text-[10px] font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 text-slate-300">${a.date}</span>
		</div>
	`).join('');
}

async function renderPeerComparison(ticker) {
	const container = document.getElementById('peerComparisonWidget');
	container.innerHTML = `<div class="skeleton h-20 w-full rounded-xl"></div>`;

	await sleep(400);

	const peers = [ticker, "TLKM", "ISAT", "EXCL"].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
	let html = '';

	for (let p of peers) {
		const pData = await fetchRealtimeStockData(p, true);
		const sign = pData.change >= 0 ? '+' : '';
		const textColor = pData.change >= 0 ? 'text-emerald-400' : 'text-rose-400';

		html += `
			<div class="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition cursor-pointer" onclick="changeTickerFromPeer('${p}')">
				<div>
					<span class="font-bold text-white block">${p}</span>
					<span class="text-[10px] text-slate-400 font-mono">Rp ${pData.price.toLocaleString('id-ID')}</span>
				</div>
				<span class="text-xs font-bold ${textColor} font-mono">${sign}${pData.changePercent.toFixed(2)}%</span>
			</div>
		`;
	}

	container.innerHTML = html;
}

function changeTickerFromPeer(ticker) {
	document.getElementById('stockSearch').value = ticker;
	searchStock();
}

function refreshPeerComparison() {
	if (peerRefreshCooldownTimer) return;
	renderPeerComparison(currentTicker);
	peerRefreshCooldownTimer = setTimeout(() => {
		peerRefreshCooldownTimer = null;
	}, 3000);
}

function searchStock() {
	if (searchCooldownTimer) return;
	const input = document.getElementById('stockSearch').value.trim().toUpperCase();
	if (!input) return;

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
	generateAISignal(currentTicker);
	fetchStockNews(currentTicker);
	fetchCorporateActions(currentTicker);
	renderPeerComparison(currentTicker);

	document.getElementById('searchSuggestions').classList.add('hidden');

	searchCooldownTimer = setTimeout(() => {
		searchCooldownTimer = null;
	}, 1000);
}

function changeInterval(intv) {
	currentInterval = intv;
	renderChart(currentTicker);
}

// SEARCH AUTOCOMPLETE SUGGESTIONS
function initSearchSuggestions() {
	const input = document.getElementById('stockSearch');
	const container = document.getElementById('searchSuggestions');

	input.addEventListener('input', function() {
		const val = this.value.trim().toUpperCase();
		if (!val) {
			container.classList.add('hidden');
			return;
		}

		const matches = radarWatchlist.filter(s => s.startsWith(val)).slice(0, 5);
		if (matches.length === 0) {
			container.classList.add('hidden');
			return;
		}

		container.innerHTML = matches.map(m => `
			<div onclick="selectSuggestion('${m}')" class="px-4 py-2.5 hover:bg-slate-800 text-xs font-bold text-slate-200 hover:text-emerald-400 cursor-pointer transition border-b border-slate-800/60 last:border-none flex justify-between">
				<span>IDX:${m}</span>
				<span class="text-[10px] text-slate-400 font-normal">Saham BEI</span>
			</div>
		`).join('');
		container.classList.remove('hidden');
	});
}

function selectSuggestion(ticker) {
	document.getElementById('stockSearch').value = ticker;
	searchStock();
}

// PRICE ALERT ENGINE
function getAlertsKey() {
	return `price_alerts_${currentTicker}`;
}

function renderAlertList(ticker) {
	const listEl = document.getElementById('activeAlertList');
	const alerts = JSON.parse(localStorage.getItem(getAlertsKey()) || '[]');

	if (alerts.length === 0) {
		listEl.innerHTML = `<div class="text-slate-400 text-center py-2">Belum ada pengingat aktif</div>`;
		return;
	}

	listEl.innerHTML = alerts.map((targetPrice, idx) => `
		<div class="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
			<span class="font-mono text-emerald-400 font-bold">Target: Rp ${targetPrice.toLocaleString('id-ID')}</span>
			<button onclick="removePriceAlert(${idx})" class="text-rose-400 hover:text-rose-300 text-xs">
				<i class="fa-solid fa-trash"></i>
			</button>
		</div>
	`).join('');
}

function addPriceAlert() {
	const input = document.getElementById('alertPriceInput');
	const val = parseInt(input.value);
	if (!val || val <= 0) return;

	const alerts = JSON.parse(localStorage.getItem(getAlertsKey()) || '[]');
	if (!alerts.includes(val)) {
		alerts.push(val);
		localStorage.setItem(getAlertsKey(), JSON.stringify(alerts));
		renderAlertList(currentTicker);
		AudioFX.playSuccess();
	}
	input.value = '';
}

function removePriceAlert(index) {
	const alerts = JSON.parse(localStorage.getItem(getAlertsKey()) || '[]');
	alerts.splice(index, 1);
	localStorage.setItem(getAlertsKey(), JSON.stringify(alerts));
	renderAlertList(currentTicker);
}

function checkPriceAlertsRealtime(ticker, price) {
	const key = `price_alerts_${ticker}`;
	const alerts = JSON.parse(localStorage.getItem(key) || '[]');
	const triggered = [];

	alerts.forEach(target => {
		if (Math.abs(price - target) / target <= 0.01) {
			triggered.push(target);
			AudioFX.playAlert();
			if (Notification.permission === 'granted') {
				new Notification(`Stock ID Alert: ${ticker}`, {
					body: `Harga ${ticker} menyentuh target Rp ${target.toLocaleString('id-ID')}!`,
					icon: 'stockid_gambar/stockicon.jpg'
				});
			} else {
				alert(`[ALERT HARGA] Saham ${ticker} telah mencapai/mendekati target Rp ${target.toLocaleString('id-ID')}!`);
			}
		}
	});

	if (triggered.length > 0) {
		const remaining = alerts.filter(a => !triggered.includes(a));
		localStorage.setItem(key, JSON.stringify(remaining));
		if (ticker === currentTicker) renderAlertList(ticker);
	}
}

function checkNotificationStatus() {
	if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
		Notification.requestPermission();
	}
}

// RADAR SCANNER ENGINE
async function scanRadarWatchlist() {
	if (isRadarScanning) return;
	isRadarScanning = true;

	const container = document.getElementById('radarWatchlistContainer');
	container.innerHTML = `
		<div class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
			<i class="fa-solid fa-spinner animate-spin text-emerald-400 text-xl"></i>
			<p class="text-xs text-slate-400">Memindai watchlist saham BEI...</p>
		</div>
	`;

	const sampleTickers = radarWatchlist.slice(0, 15);
	globalRadarDataList = [];

	for (let t of sampleTickers) {
		const res = await fetchRealtimeStockData(t, true);
		if (res.volRatio >= 1.2 && res.price > res.ma5) {
			globalRadarDataList.push(res);
		}
		await sleep(150);
	}

	if (globalRadarDataList.length === 0) {
		container.innerHTML = `
			<div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-center">
				Tidak ditemukan saham dengan indikator breakout ber-volume saat ini.
			</div>
		`;
	} else {
		container.innerHTML = globalRadarDataList.map(r => `
			<div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 transition cursor-pointer" onclick="selectSuggestion('${r.ticker}')">
				<div>
					<div class="flex items-center gap-2">
						<span class="font-bold text-white">${r.ticker}</span>
						<span class="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Vol ${r.volRatio}x</span>
					</div>
					<span class="text-[10px] text-slate-400 font-mono">Rp ${r.price.toLocaleString('id-ID')}</span>
				</div>
				<span class="text-xs font-bold text-emerald-400 font-mono">+${r.changePercent.toFixed(2)}%</span>
			</div>
		`).join('');
	}

	isRadarScanning = false;
}

// EXPORT KARTU ANALISA KE GAMBAR (PNG)
function openExportModal() {
	if (!globalStockData) return;
	const modal = document.getElementById('exportModal');

	document.getElementById('cardStockTitle').innerText = `IDX:${globalStockData.ticker}`;
	document.getElementById('cardStockPrice').innerText = `Rp ${globalStockData.price.toLocaleString('id-ID')}`;
	const sign = globalStockData.change >= 0 ? '+' : '';
	document.getElementById('cardStockChange').innerText = `${sign}${globalStockData.changePercent.toFixed(2)}%`;

	document.getElementById('cardSignal').innerText = document.getElementById('aiSignalBadge').innerText;
	document.getElementById('cardTargetPrice').innerText = document.getElementById('aiTargetPrice').innerText;
	document.getElementById('cardStopLoss').innerText = document.getElementById('aiStopLoss').innerText;

	document.getElementById('cardVolRatio').innerText = `${globalStockData.volRatio}x`;
	document.getElementById('cardMA5').innerText = `Rp ${globalStockData.ma5.toLocaleString('id-ID')}`;
	document.getElementById('cardMA10').innerText = `Rp ${globalStockData.ma10.toLocaleString('id-ID')}`;

	document.getElementById('cardAnalysisSummary').innerText = document.getElementById('aiAnalysisText').innerText;
	document.getElementById('cardTimestamp').innerText = `Dibuat: ${new Date().toLocaleString('id-ID')}`;

	modal.classList.remove('hidden');
}

function closeExportModal() {
	document.getElementById('exportModal').classList.add('hidden');
}

function downloadAnalysisCard() {
	if (exportCardCooldownTimer) return;
	const cardContainer = document.getElementById('exportCardPreview');

	html2canvas(cardContainer, {
		backgroundColor: '#020617',
		scale: 2
	}).then(canvas => {
		const link = document.createElement('a');
		link.download = `StockID_Analisa_${currentTicker}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
		AudioFX.playSuccess();
	});

	exportCardCooldownTimer = setTimeout(() => {
		exportCardCooldownTimer = null;
	}, 2000);
}

function checkUrlParamTicker() {
	const params = new URLSearchParams(window.location.search);
	const tickerParam = params.get('ticker');
	if (tickerParam) {
		currentTicker = tickerParam.toUpperCase();
	}
}

// BACKGROUND FETCH ENGINE (SETIAP 5 MENIT)
function startBackgroundSync() {
	const FIVE_MINUTES = 5 * 60 * 1000;

	const runBackgroundFetch = async () => {
		if (!isMarketOpen()) return;
		const sampleList = radarWatchlist.slice(0, 10);
		for (let ticker of sampleList) {
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
fetchCorporateActions(currentTicker);
renderPeerComparison(currentTicker);
checkWelcomeModal();
startBackgroundSync();