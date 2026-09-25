/**
 * STOCK ID SCREENER — CHATGPT EDITION
 *
 * Prinsip:
 * - Tidak berpura-pura menjadi model AI.
 * - Signal berasal dari data pasar + aturan teknikal yang dapat diaudit.
 * - Satu sumber state, satu lapisan data, satu renderer.
 * - Tidak memakai random ranking untuk screener.
 * - Tidak menyimpan kredensial rahasia di frontend.
 *
 * Kompatibel dengan sebagian besar ID DOM dari engine lama.
 */

(() => {
	'use strict';

	const CONFIG = {
		market: {
			openHour: 9,
			closeHour: 16,
			timezone: 'Asia/Jakarta'
		},
		cache: {
			stockTtl: 5 * 60 * 1000,
			newsTtl: 10 * 60 * 1000
		},
		data: {
			workerUrl: 'https://stockid-api.accespy-mail.workers.dev',
			yahooChart: 'https://query1.finance.yahoo.com/v8/finance/chart',
			proxies: [
				url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
				url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
				url => `https://corsproxy.io/?${encodeURIComponent(url)}`
			]
		},
		radar: {
			batchSize: 8,
			maxResults: 12
		},
		paper: {
			startingCash: 100_000_000
		}
	};

	const state = {
		ticker: 'MDIA',
		interval: 'D',
		stock: null,
		searchTimer: null,
		exportTimer: null,
		radarBusy: false,
		whaleBusy: false,
		journalView: 'table',
		openAlerts: new Set(),
		heatmapLoaded: false
	};

	const DOM = id => document.getElementById(id);

	const storage = {
		get(key, fallback = null) {
			try {
				const value = localStorage.getItem(key);
				return value === null ? fallback : JSON.parse(value);
			} catch {
				return fallback;
			}
		},
		set(key, value) {
			localStorage.setItem(key, JSON.stringify(value));
		},
		remove(key) {
			localStorage.removeItem(key);
		}
	};

	const format = {
		price(value) {
			return Number(value || 0).toLocaleString('id-ID');
		},
		idr(value) {
			return `Rp ${format.price(value)}`;
		},
		pct(value) {
			const n = Number(value || 0);
			return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
		},
		compactIDR(value) {
			const n = Number(value || 0);
			if (n >= 1e12) return `Rp ${(n / 1e12).toFixed(2)} T`;
			if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(2)} M`;
			if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(2)} Jt`;
			return format.idr(n);
		}
	};

	const html = {
		escape(value) {
			return String(value ?? '')
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
				.replaceAll("'", '&#039;');
		}
	};

	const ui = {
		setText(id, value) {
			const el = DOM(id);
			if (el) el.textContent = value;
		},
		setHTML(id, value) {
			const el = DOM(id);
			if (el) el.innerHTML = value;
		},
		show(id) {
			DOM(id)?.classList.remove('hidden');
		},
		hide(id) {
			DOM(id)?.classList.add('hidden');
		},
		icons() {
			if (window.lucide) window.lucide.createIcons();
		},
		toast(message, type = 'info') {
			const container = DOM('toastContainer');
			if (!container) return;

			const palette = {
				success: ['emerald', 'circle-check'],
				error: ['rose', 'circle-x'],
				warning: ['amber', 'triangle-alert'],
				info: ['sky', 'circle-info']
			};
			const [color, icon] = palette[type] || palette.info;
			const node = document.createElement('div');
			node.className = `pointer-events-auto flex items-start gap-3 max-w-sm rounded-xl border border-${color}-500/30 bg-slate-900/95 px-4 py-3 text-xs text-slate-200 shadow-2xl`;
			node.innerHTML = `
				<i data-lucide="${icon}" class="mt-0.5 h-4 w-4 shrink-0 text-${color}-400"></i>
				<span class="leading-relaxed">${html.escape(message)}</span>
			`;
			container.appendChild(node);
			ui.icons();
			setTimeout(() => node.remove(), 3600);
		}
	};

	const audio = {
		muted: localStorage.getItem('stockid_sound_muted') === 'true',
		vibrateMuted: localStorage.getItem('stockid_vibrate_muted') === 'true',
		play(file) {
			if (this.muted) return;
			try {
				const sound = new Audio(`stockid_suara/MC/${file}`);
				sound.play().catch(() => {});
			} catch {}
		},
		click() {
			this.play('klik1.mp3');
		},
		success() {
			this.play('sukses.mp3');
		},
		alert() {
			this.play('loss.mp3');
		},
		vibrate(ms = 70) {
			if (!this.vibrateMuted && navigator.vibrate) navigator.vibrate(ms);
		}
	};

	const market = {
		isOpen() {
			const now = new Date();
			const day = now.getDay();
			if (day === 0 || day === 6) return false;
			const hour = now.getHours() + now.getMinutes() / 60;
			return hour >= CONFIG.market.openHour && hour < CONFIG.market.closeHour;
		},
		updateBadge() {
			const badge = DOM('marketStatusBadge');
			if (!badge) return;
			const open = this.isOpen();
			badge.innerHTML = open
				? '<span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span> Market Live'
				: '<span class="h-2 w-2 rounded-full bg-amber-400"></span> Market Closed';
		}
	};

	const cache = {
		stockKey(ticker) {
			return `stock_cache_${ticker}`;
		},
		newsKey(ticker) {
			return `news_cache_${ticker}`;
		},
		getStock(ticker) {
			const item = storage.get(this.stockKey(ticker));
			if (!item || Date.now() - item.timestamp > CONFIG.cache.stockTtl) return null;
			return item.data || null;
		},
		setStock(ticker, data) {
			if (data) storage.set(this.stockKey(ticker), { timestamp: Date.now(), data });
		},
		clean() {
			const now = Date.now();
			for (let i = localStorage.length - 1; i >= 0; i--) {
				const key = localStorage.key(i);
				if (!key) continue;
				if (!key.startsWith('stock_cache_') && !key.startsWith('news_cache_')) continue;
				const item = storage.get(key);
				const ttl = key.startsWith('stock_cache_') ? CONFIG.cache.stockTtl : CONFIG.cache.newsTtl;
				if (!item?.timestamp || now - item.timestamp > ttl) localStorage.removeItem(key);
			}
		}
	};

	const technical = {
		beTick(price) {
			if (price < 200) return 1;
			if (price < 500) return 2;
			if (price < 2000) return 5;
			if (price < 5000) return 10;
			return 25;
		},
		round(price, direction = 'round') {
			const value = Number(price || 0);
			if (value <= 0) return 0;
			const tick = this.beTick(value);
			const ratio = value / tick;
			if (direction === 'floor') return Math.floor(ratio) * tick;
			if (direction === 'ceil') return Math.ceil(ratio) * tick;
			return Math.round(ratio) * tick;
		},
		average(values, period) {
			const slice = values.slice(-period);
			if (!slice.length) return 0;
			return slice.reduce((sum, value) => sum + value, 0) / slice.length;
		},
		rsi(values, period = 14) {
			if (values.length <= period) return null;
			let gain = 0;
			let loss = 0;
			for (let i = values.length - period; i < values.length; i++) {
				const delta = values[i] - values[i - 1];
				if (delta >= 0) gain += delta;
				else loss += Math.abs(delta);
			}
			if (loss === 0) return 100;
			const rs = gain / loss;
			return Number((100 - 100 / (1 + rs)).toFixed(2));
		},
		volatility(values, period = 20) {
			const slice = values.slice(-period);
			if (slice.length < 2) return 0;
			const returns = [];
			for (let i = 1; i < slice.length; i++) {
				returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
			}
			const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
			const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
			return Number((Math.sqrt(variance) * 100).toFixed(2));
		}
	};

	const api = {
		async fetchJSON(url, timeout = 6000) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeout);
			try {
				const response = await fetch(url, { signal: controller.signal });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return await response.json();
			} finally {
				clearTimeout(timer);
			}
		},
		async yahooChart(ticker) {
			const symbol = `${ticker}.JK`;
			const url = `${CONFIG.data.yahooChart}/${symbol}?interval=1d&range=3mo&events=history`;
			for (const makeProxy of CONFIG.data.proxies) {
				try {
					const data = await this.fetchJSON(makeProxy(url), 6500);
					const payload = data?.contents ? JSON.parse(data.contents) : data;
					if (payload?.chart?.result?.[0]) return payload;
				} catch {}
			}
			return null;
		},
		async stock(ticker, force = false) {
			const cached = !force ? cache.getStock(ticker) : null;
			if (cached) return cached;

			const worker = async () => {
				const url = `${CONFIG.data.workerUrl}?symbol=${encodeURIComponent(ticker)}.JK`;
				const data = await this.fetchJSON(url, 3500);
				return this.parse(data, ticker);
			};
			const yahoo = async () => this.parse(await this.yahooChart(ticker), ticker);

			let fresh = null;
			try {
				fresh = await Promise.race([
					worker().catch(() => null),
					yahoo().catch(() => null)
				]);
			} catch {}

			if (!fresh) {
				const results = await Promise.allSettled([worker(), yahoo()]);
				fresh = results.find(result => result.status === 'fulfilled' && result.value)?.value || null;
			}

			if (fresh) cache.setStock(ticker, fresh);
			return fresh || cached;
		},
		parse(json, ticker) {
			const result = json?.chart?.result?.[0] || json?.results?.[0];
			if (!result) return null;

			const quote = result.indicators?.quote?.[0] || result.quote || {};
			const close = (quote.close || []).filter(Number.isFinite);
			const high = (quote.high || []).filter(Number.isFinite);
			const low = (quote.low || []).filter(Number.isFinite);
			const volume = (quote.volume || []).filter(Number.isFinite);
			if (close.length < 5) return null;

			const price = Number(result.meta?.regularMarketPrice || close.at(-1));
			const previous = Number(result.meta?.chartPreviousClose || close.at(-2) || price);
			const ma5 = technical.round(technical.average(close, 5));
			const ma10 = technical.round(technical.average(close, 10));
			const ma20 = technical.round(technical.average(close, 20));
			const currentVolume = Number(result.meta?.regularMarketVolume || volume.at(-1) || 0);
			const volumeBase = technical.average(volume, 10) || 1;
			const volRatio = Number((currentVolume / volumeBase).toFixed(2));
			const periodHigh = technical.round(Math.max(...high.slice(-20)));
			const periodLow = technical.round(Math.min(...low.slice(-20)));
			const typicalValue = close.slice(-20).reduce((sum, closePrice, index) => {
				const sourceIndex = Math.max(0, high.length - 20) + index;
				const h = high[sourceIndex] || closePrice;
				const l = low[sourceIndex] || closePrice;
				const v = volume[sourceIndex] || 0;
				return sum + ((h + l + closePrice) / 3) * v;
			}, 0);
			const volume20 = volume.slice(-20).reduce((sum, value) => sum + value, 0);
			const avgVolumePrice = volume20 ? technical.round(typicalValue / volume20) : price;

			return {
				ticker,
				price: technical.round(price),
				previousClose: technical.round(previous),
				changePct: Number((((price - previous) / previous) * 100).toFixed(2)),
				ma5,
				ma10,
				ma20,
				currentVolume,
				currentLot: Math.floor(currentVolume / 100),
				volRatio,
				currentValuation: currentVolume * price,
				high20: periodHigh,
				low20: periodLow,
				bandarAvgPrice: avgVolumePrice,
				rsi14: technical.rsi(close),
				volatility20: technical.volatility(close),
				closeSeries: close.slice(-60)
			};
		}
	};

	const signalEngine = {
		analyze(data) {
			if (!data) {
				return {
				score: 0,
				label: 'DATA TIDAK TERSEDIA',
				tone: 'neutral',
				action: 'Menunggu data',
				reasons: ['Data harga atau volume belum tersedia.'],
				flags: []
			};
			}

			let score = 0;
			const reasons = [];
			const flags = [];
			const trend = data.price > data.ma5 && data.ma5 >= data.ma10 && data.ma10 >= data.ma20;
			const belowTrend = data.price < data.ma10 && data.ma10 < data.ma20;
			const volumeStrong = data.volRatio >= 1.5;
			const breakout = data.price >= data.high20;

			if (data.price > data.ma20) {
				score += 1;
				reasons.push('Harga berada di atas MA20.');
			} else {
				score -= 1;
				reasons.push('Harga berada di bawah MA20.');
			}

			if (trend) {
				score += 2;
				reasons.push('MA5, MA10, dan MA20 tersusun naik.');
			} else if (belowTrend) {
				score -= 2;
				reasons.push('Struktur MA menunjukkan tekanan turun.');
			} else {
				reasons.push('Struktur MA belum memberikan alignment yang jelas.');
			}

			if (data.changePct > 0) score += 1;
			if (data.changePct < 0) score -= 1;

			if (volumeStrong) {
				score += 1;
				reasons.push(`Volume ${data.volRatio}x rata-rata 10 hari.`);
			} else {
				reasons.push(`Volume ${data.volRatio}x rata-rata 10 hari.`);
			}

			if (breakout && volumeStrong) {
				score += 1;
				reasons.push('Harga berada di area high 20 hari dengan dukungan volume.');
			}

			if (data.rsi14 !== null) {
				if (data.rsi14 >= 70) {
					flags.push('RSI tinggi');
					reasons.push(`RSI ${data.rsi14} berada di zona tinggi.`);
				} else if (data.rsi14 <= 30) {
					flags.push('RSI rendah');
					reasons.push(`RSI ${data.rsi14} berada di zona rendah.`);
				}
			}

			score = Math.max(-5, Math.min(5, score));

			let label = 'NETRAL';
			let tone = 'neutral';
			let action = 'Tunggu konfirmasi';
			if (score >= 4) {
				label = 'BULLISH';
				tone = 'positive';
				action = 'Pantau breakout dan volume';
			} else if (score >= 2) {
				label = 'CENDERUNG BULLISH';
				tone = 'positive';
				action = 'Pantau pullback';
			} else if (score <= -4) {
				label = 'BEARISH';
				tone = 'negative';
				action = 'Prioritaskan manajemen risiko';
			} else if (score <= -2) {
				label = 'CENDERUNG BEARISH';
				tone = 'negative';
				action = 'Tunggu struktur membaik';
			}

			return { score, label, tone, action, reasons, flags, trend, volumeStrong };
		},
		riskLevels(data) {
			if (!data) return null;
			const price = data.price;
			return {
				entryLow: technical.round(price * 0.96, 'floor'),
				entryHigh: technical.round(price * 0.99, 'floor'),
				stop: technical.round(price * 0.92, 'floor'),
				target1: technical.round(price * 1.05, 'ceil'),
				target2: technical.round(price * 1.10, 'ceil'),
				support: data.low20,
				resistance: data.high20
			};
		}
	};

	function renderSignal(ticker, data, cached = false) {
		const signal = signalEngine.analyze(data);
		const risk = signalEngine.riskLevels(data);
		const tone = {
			positive: ['text-emerald-400', 'bg-emerald-500/10', 'border-emerald-500/30'],
			negative: ['text-rose-400', 'bg-rose-500/10', 'border-rose-500/30'],
			neutral: ['text-amber-400', 'bg-amber-500/10', 'border-amber-500/30']
		}[signal.tone];

		ui.setText('aiVerdikText', signal.label);
		ui.setText('aiScoreBadge', `${signal.score > 0 ? '+' : ''}${signal.score}/5`);

		const score = DOM('aiScoreBadge');
		if (score) score.className = `rounded-lg border px-2.5 py-1 text-xs font-bold ${tone[0]} ${tone[1]} ${tone[2]}`;

		const verdik = DOM('aiVerdikText');
		if (verdik) verdik.className = `text-sm font-bold lg:text-base ${tone[0]}`;

		if (data) {
			ui.setHTML('aiVerdikDesc', `
				<div class="space-y-2 leading-relaxed">
					<p><strong class="text-sky-400">Ringkasan:</strong> ${html.escape(ticker)} diperdagangkan di ${format.idr(data.price)} dengan perubahan ${format.pct(data.changePct)}.</p>
					<p><strong class="text-sky-400">Struktur:</strong> MA5 ${format.idr(data.ma5)}, MA10 ${format.idr(data.ma10)}, MA20 ${format.idr(data.ma20)}.</p>
					<p><strong class="text-sky-400">Volume:</strong> ${data.volRatio}x rata-rata 10 hari. ${data.rsi14 === null ? 'RSI belum tersedia.' : `RSI14 ${data.rsi14}.`}</p>
					<p><strong class="text-sky-400">Rentang 20 hari:</strong> ${format.idr(data.low20)} — ${format.idr(data.high20)}.</p>
				</div>
			`);

			ui.setHTML('aiBuktiUtamaList', signal.reasons.map(reason => `
				<li class="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-xs text-slate-300">${html.escape(reason)}</li>
			`).join(''));

			ui.setHTML('aiKesimpulanText', `
				<div class="space-y-2">
					<div class="inline-flex rounded-lg border px-3 py-1.5 text-xs font-bold ${tone[0]} ${tone[1]} ${tone[2]}">${html.escape(signal.action)}</div>
					<p class="text-xs leading-relaxed text-slate-300">Signal ini bersifat rule-based dan bukan jaminan arah harga. ${cached ? 'Data awal berasal dari cache; pembaruan live akan dicoba.' : 'Data terakhir berhasil diperbarui.'}</p>
				</div>
			`);

			ui.setHTML('aiRiskMap', risk ? `
				<div class="grid grid-cols-2 gap-2 text-xs">
					<div class="rounded-lg border border-slate-800 bg-slate-900/60 p-2"><span class="block text-slate-500">Entry</span><strong class="text-amber-400">${format.idr(risk.entryLow)} — ${format.idr(risk.entryHigh)}</strong></div>
					<div class="rounded-lg border border-slate-800 bg-slate-900/60 p-2"><span class="block text-slate-500">Stop</span><strong class="text-rose-400">${format.idr(risk.stop)}</strong></div>
					<div class="rounded-lg border border-slate-800 bg-slate-900/60 p-2"><span class="block text-slate-500">Target 1</span><strong class="text-emerald-400">${format.idr(risk.target1)}</strong></div>
					<div class="rounded-lg border border-slate-800 bg-slate-900/60 p-2"><span class="block text-slate-500">Target 2</span><strong class="text-emerald-400">${format.idr(risk.target2)}</strong></div>
					<div class="col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2"><span class="block text-slate-500">Support / Resistance 20H</span><strong class="text-sky-400">${format.idr(risk.support)} / ${format.idr(risk.resistance)}</strong></div>
				</div>
			` : '');
		}
	}

	async function loadStock(ticker, { force = false } = {}) {
		ticker = String(ticker || '').replace(/[^A-Z0-9.]/gi, '').toUpperCase();
		if (!ticker) return;
		state.ticker = ticker;
		
		['stockTitle', 'newsTickerLabel', 'fundTickerLabel', 'rrrTickerLabel', 'alertTickerLabel', 'corpTickerLabel', 'peerTickerLabel'].forEach(id => ui.setText(id, id === 'stockTitle' ? `IDX:${ticker}` : ticker));
		ui.setText('aiHeaderTicker', `[${ticker}] — KONDISI TEKNIKAL`);
		ui.setText('aiDateStamp', `Update ${new Date().toLocaleString('id-ID')}`);

		const cached = cache.getStock(ticker);
		if (cached && !force) {
			state.stock = cached;
			renderSignal(ticker, cached, true);
		}

		const data = await api.stock(ticker, force);
		if (!data) {
			if (!cached) {
				ui.toast(`Data ${ticker} belum tersedia.`, 'error');
				renderSignal(ticker, null);
			}
			return;
		}

		state.stock = data;
		renderSignal(ticker, data, false);
		checkPriceAlerts(ticker, data.price);
		updateRiskFields(data);
	}

	function updateRiskFields(data) {
		const risk = signalEngine.riskLevels(data);
		if (!risk) return;
		ui.setText('mapSupport1', format.idr(risk.support));
		ui.setText('mapResist1', format.idr(risk.resistance));
		ui.setText('mapSL', format.idr(risk.stop));
		ui.setText('mapTP', `${format.idr(risk.target1)} / ${format.idr(risk.target2)}`);
	}

	function renderChart(ticker) {
		const container = DOM('tv_chart_container');
		if (!container || typeof TradingView === 'undefined') return;
		container.innerHTML = '';
		new TradingView.widget({
			autosize: true,
			symbol: `IDX:${ticker}`,
			interval: state.interval,
			timezone: CONFIG.market.timezone,
			theme: 'dark',
			style: '1',
			locale: 'id',
			allow_symbol_change: true,
			container_id: 'tv_chart_container',
			studies: ['MAExp@tv-basicstudies', 'MACD@tv-basicstudies', 'RSI@tv-basicstudies', 'BB@tv-basicstudies', 'VWAP@tv-basicstudies']
		});
	}

	function renderTechnicalGauge(ticker) {
		const container = DOM('tv_technical_container');
		if (!container) return;
		container.innerHTML = '';
		const script = document.createElement('script');
		script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
		script.async = true;
		script.text = JSON.stringify({
			interval: '1D',
			width: '100%',
			height: '350',
			symbol: `IDX:${ticker}`,
			isTransparent: true,
			showIntervalTabs: true,
			displayMode: 'single',
			locale: 'id',
			colorTheme: 'dark'
		});
		container.appendChild(script);
	}

	function searchStock(bypassCooldown = false) {
		const input = DOM('stockSearch');
		if (!input) return;
		const ticker = input.value.trim().toUpperCase();
		if (!ticker) return;
		if (!bypassCooldown && state.searchTimer) return;

		loadStock(ticker);
		renderChart(ticker);
		renderTechnicalGauge(ticker);
		renderAlerts();
		fetchStockNews(ticker);
		fetchCorporateAction(ticker);
		fetchRealtimeFundamentals(ticker);

		if (!bypassCooldown) startCooldown(5);
	}

	function startCooldown(seconds) {
		const button = document.querySelector("button[onclick='searchStock()']");
		if (!button) return;
		let left = seconds;
		clearInterval(state.searchTimer);
		button.disabled = true;
		button.classList.add('opacity-50', 'cursor-not-allowed');
		button.textContent = `Cari (${left})`;
		state.searchTimer = setInterval(() => {
			left -= 1;
			if (left <= 0) {
				clearInterval(state.searchTimer);
				state.searchTimer = null;
				button.disabled = false;
				button.classList.remove('opacity-50', 'cursor-not-allowed');
				button.textContent = 'Cari';
				return;
			}
			button.textContent = `Cari (${left})`;
		}, 1000);
	}

	function initSearch() {
		const input = DOM('stockSearch');
		const box = DOM('searchSuggestionsBox');
		if (!input) return;
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') searchStock();
		});
		input.addEventListener('input', () => {
			if (!box || typeof uniqueRadarWatchlist === 'undefined') return;
			const query = input.value.trim().toUpperCase();
			if (!query) return ui.hide('searchSuggestionsBox');
			const matches = uniqueRadarWatchlist.filter(ticker => ticker.includes(query)).slice(0, 8);
			box.innerHTML = matches.map(ticker => `
				<button type="button" class="block w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-emerald-500/10" onclick="selectSuggestion('${ticker}')">${ticker}</button>
			`).join('');
			matches.length ? ui.show('searchSuggestionsBox') : ui.hide('searchSuggestionsBox');
		});
	}

	function selectSuggestion(ticker) {
		ui.setText('stockSearch', ticker);
		const input = DOM('stockSearch');
		if (input) input.value = ticker;
		ui.hide('searchSuggestionsBox');
		searchStock(true);
	}

	function startVoiceSearch() {
		const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!Recognition) return ui.toast('Browser ini belum mendukung pencarian suara.', 'warning');
		const input = DOM('stockSearch');
		const recognition = new Recognition();
		recognition.lang = 'id-ID';
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		recognition.onstart = () => {
			ui.setText('stockSearch', '');
			if (input) input.placeholder = 'Mendengarkan...';
		};
		recognition.onresult = event => {
			const transcript = event.results[0][0].transcript.toUpperCase().replace(/\s+/g, '');
			const known = typeof uniqueRadarWatchlist !== 'undefined' ? uniqueRadarWatchlist : [];
			const ticker = known.find(item => transcript.includes(item)) || transcript.replace(/CARI|SAHAM|ANALISA|BUKA|TOLONG/g, '');
			if (input) input.value = ticker;
			searchStock(true);
		};
		recognition.onend = () => {
			if (input) input.placeholder = 'Cari saham (MDIA...)';
		};
		recognition.onerror = () => ui.toast('Pencarian suara gagal. Coba lagi.', 'error');
		recognition.start();
	}

	async function runRadar() {
		if (state.radarBusy) return;
		state.radarBusy = true;
		const container = DOM('bigMoneyList');
		if (!container) return;
		const watchlist = Array.from(new Set(typeof uniqueRadarWatchlist !== 'undefined' ? uniqueRadarWatchlist : []));
		container.innerHTML = '<div class="col-span-full py-10 text-center text-xs text-slate-400">Memindai data pasar...</div>';

		const results = [];
		for (let i = 0; i < watchlist.length; i += CONFIG.radar.batchSize) {
			const batch = watchlist.slice(i, i + CONFIG.radar.batchSize);
			const data = await Promise.all(batch.map(ticker => api.stock(ticker)));
			for (const item of data) {
				if (item) results.push({ data: item, signal: signalEngine.analyze(item) });
			}
			if (results.length >= CONFIG.radar.maxResults * 2) break;
		}

		results.sort((a, b) => {
			if (b.signal.score !== a.signal.score) return b.signal.score - a.signal.score;
			return b.data.volRatio - a.data.volRatio;
		});

		const selected = results.slice(0, CONFIG.radar.maxResults);
		container.innerHTML = selected.length ? selected.map(({ data, signal }, index) => radarCard(data, signal, index)).join('') : '<div class="col-span-full py-8 text-center text-xs text-slate-400">Data radar tidak tersedia.</div>';
		ui.icons();
		state.radarBusy = false;
	}

	function radarCard(data, signal, index) {
		const tone = signal.score >= 2 ? 'emerald' : signal.score <= -2 ? 'rose' : 'amber';
		return `
			<article class="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
				<div class="mb-3 flex items-start justify-between gap-3">
					<div><span class="text-[10px] text-slate-500">#${index + 1}</span><h3 class="font-bold text-white">${html.escape(data.ticker)}</h3></div>
					<span class="rounded-full border border-${tone}-500/30 bg-${tone}-500/10 px-2 py-1 text-[9px] font-bold text-${tone}-400">${signal.label}</span>
				</div>
				<div class="grid grid-cols-2 gap-2 text-[11px]">
					<div class="rounded-lg bg-slate-900 p-2"><span class="block text-slate-500">Harga</span><strong class="text-white">${format.idr(data.price)}</strong></div>
					<div class="rounded-lg bg-slate-900 p-2"><span class="block text-slate-500">Perubahan</span><strong class="${data.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${format.pct(data.changePct)}</strong></div>
					<div class="rounded-lg bg-slate-900 p-2"><span class="block text-slate-500">Volume</span><strong class="text-sky-400">${data.volRatio}x</strong></div>
					<div class="rounded-lg bg-slate-900 p-2"><span class="block text-slate-500">RSI14</span><strong class="text-violet-400">${data.rsi14 ?? '-'}</strong></div>
				</div>
				<div class="mt-3 flex items-center justify-between gap-2">
					<span class="text-[10px] text-slate-500">Score ${signal.score > 0 ? '+' : ''}${signal.score}/5</span>
					<button type="button" onclick="selectTickerFromRadar('${data.ticker}')" class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-white hover:border-emerald-500/50">Lihat</button>
				</div>
			</article>
		`;
	}

	function selectTickerFromRadar(ticker) {
		const input = DOM('stockSearch');
		if (input) input.value = ticker;
		searchStock(true);
		if (typeof switchTab === 'function') switchTab('ai');
	}

	async function runCustomScreener() {
		const container = DOM('csResultsContainer');
		if (!container) return;
		const ruleMA = DOM('csRuleMA')?.value || 'ANY';
		const ruleVol = DOM('csRuleVol')?.value || 'ANY';
		const rulePrice = DOM('csRulePrice')?.value || 'ANY';
		const watchlist = Array.from(new Set(typeof uniqueRadarWatchlist !== 'undefined' ? uniqueRadarWatchlist : []));
		container.innerHTML = '<div class="col-span-full py-10 text-center text-xs text-slate-400">Menjalankan filter...</div>';

		const rows = [];
		for (let i = 0; i < watchlist.length; i += 8) {
			const batch = await Promise.all(watchlist.slice(i, i + 8).map(ticker => api.stock(ticker)));
			for (const item of batch) {
				if (!item) continue;
				const maOK = ruleMA === 'ABOVE_MA5' ? item.price > item.ma5 : ruleMA === 'ABOVE_MA20' ? item.price > item.ma20 : ruleMA === 'GOLDEN_CROSS' ? item.ma5 > item.ma10 : ruleMA === 'BELOW_MA20' ? item.price < item.ma20 : true;
				const volOK = ruleVol === 'SPIKE_1.2' ? item.volRatio >= 1.2 : ruleVol === 'SPIKE_2.0' ? item.volRatio >= 2 : ruleVol === 'DRY' ? item.volRatio < 1 : true;
				const priceOK = rulePrice === 'GREEN' ? item.changePct > 0 : rulePrice === 'RED' ? item.changePct < 0 : rulePrice === 'BREAKOUT' ? item.changePct >= 3 : true;
				if (maOK && volOK && priceOK) rows.push(item);
			}
			if (rows.length >= 20) break;
		}

		rows.sort((a, b) => b.changePct - a.changePct);
		container.innerHTML = rows.length ? rows.slice(0, 20).map((item, index) => `
			<article class="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
				<div class="flex items-center justify-between"><strong class="text-white">${index + 1}. ${html.escape(item.ticker)}</strong><span class="text-xs ${item.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${format.pct(item.changePct)}</span></div>
				<div class="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span>Harga <b class="text-white">${format.idr(item.price)}</b></span><span>Vol <b class="text-sky-400">${item.volRatio}x</b></span><span>MA5 <b>${format.idr(item.ma5)}</b></span><span>MA20 <b>${format.idr(item.ma20)}</b></span></div>
			</article>
		`).join('') : '<div class="col-span-full py-8 text-center text-xs text-slate-400">Tidak ada saham yang memenuhi filter.</div>';
		ui.icons();
	}

	function getPaperAccount() {
		return storage.get('stockid_paper_account', {
			cash: CONFIG.paper.startingCash,
			portfolio: [],
			history: []
		});
	}

	function savePaperAccount(account) {
		storage.set('stockid_paper_account', account);
		renderPaperTrading();
	}

	function paperBuy() {
		const ticker = DOM('ptTicker')?.value.trim().toUpperCase();
		const price = Number(DOM('ptPrice')?.value || 0);
		const lots = Number(DOM('ptLots')?.value || 0);
		const tp = Number(DOM('ptTP')?.value || 0);
		const sl = Number(DOM('ptSL')?.value || 0);
		if (!ticker || price <= 0 || lots <= 0) return ui.toast('Isi ticker, harga, dan lot dengan benar.', 'error');

		const account = getPaperAccount();
		const cost = price * lots * 100;
		if (cost > account.cash) return ui.toast('Cash paper trading tidak mencukupi.', 'error');
		account.cash -= cost;

		const existing = account.portfolio.find(item => item.ticker === ticker);
		if (existing) {
			const totalLots = existing.lots + lots;
			existing.avgPrice = ((existing.avgPrice * existing.lots) + (price * lots)) / totalLots;
			existing.lots = totalLots;
			if (tp > 0) existing.tp = tp;
			if (sl > 0) existing.sl = sl;
		} else {
			account.portfolio.push({ id: crypto.randomUUID?.() || String(Date.now()), ticker, lots, avgPrice: price, tp, sl, date: new Date().toISOString() });
		}
		savePaperAccount(account);
		ui.toast(`Buy virtual ${ticker} ${lots} lot berhasil.`, 'success');
	}

	async function paperSell(id) {
		const account = getPaperAccount();
		const index = account.portfolio.findIndex(item => String(item.id) === String(id));
		if (index < 0) return;
		const item = account.portfolio[index];
		const data = await api.stock(item.ticker, true);
		const sellPrice = data?.price || item.avgPrice;
		const cost = item.avgPrice * item.lots * 100;
		const proceeds = sellPrice * item.lots * 100;
		const pnl = proceeds - cost;
		account.cash += proceeds;
		account.portfolio.splice(index, 1);
		account.history.unshift({ ticker: item.ticker, lots: item.lots, buyPrice: item.avgPrice, sellPrice, pnl, pnlPct: item.avgPrice ? (pnl / cost) * 100 : 0, date: new Date().toISOString() });
		savePaperAccount(account);
		ui.toast(`Sell ${item.ticker}: ${format.idr(pnl)} (${format.pct((pnl / cost) * 100)}).`, pnl >= 0 ? 'success' : 'warning');
	}

	function renderPaperTrading() {
		const account = getPaperAccount();
		let assets = 0;
		let floating = 0;
		for (const item of account.portfolio) {
			const current = state.stock?.ticker === item.ticker ? state.stock.price : cache.getStock(item.ticker)?.price || item.avgPrice;
			assets += current * item.lots * 100;
			floating += (current - item.avgPrice) * item.lots * 100;
		}
		const equity = account.cash + assets;
		const realized = account.history.reduce((sum, item) => sum + item.pnl, 0);
		const wins = account.history.filter(item => item.pnl > 0).length;
		ui.setText('ptCash', format.idr(account.cash));
		ui.setText('ptEquity', format.idr(equity));
		ui.setText('ptRealizedPnL', `${realized >= 0 ? '+' : ''}${format.idr(realized)}`);
		ui.setText('ptUnrealizedPnL', `Floating ${floating >= 0 ? '+' : ''}${format.idr(floating)}`);
		ui.setText('ptWinRate', `Win Rate: ${account.history.length ? Math.round(wins / account.history.length * 100) : 0}% (${wins}/${account.history.length})`);
	}

	function journalData() {
		return storage.get('stockid_trading_journal', []);
	}

	function saveJournalData(data) {
		storage.set('stockid_trading_journal', data);
		renderJournal();
	}

	function saveTradingPlanToJournal() {
		const entry = Number(DOM('rrrEntry')?.value || 0);
		const sl = Number(DOM('rrrSL')?.value || 0);
		const tp = Number(DOM('rrrTP')?.value || 0);
		if (!(entry > sl && tp > entry)) return ui.toast('Entry, Stop Loss, dan Take Profit belum valid.', 'warning');
		const journal = journalData();
		journal.unshift({
			id: crypto.randomUUID?.() || String(Date.now()),
			ticker: state.ticker,
			entry,
			sl,
			tp,
			rrr: (tp - entry) / (entry - sl),
			status: 'PLANNED',
			createdAt: new Date().toISOString()
		});
		saveJournalData(journal);
		ui.toast('Trading plan disimpan ke jurnal.', 'success');
	}

	function renderJournal() {
		const data = journalData();
		const container = DOM('journalTableBody');
		if (!container) return;
		container.innerHTML = data.length ? data.map(item => `
			<tr class="border-b border-slate-800 text-xs">
				<td class="p-3 font-bold text-white">${html.escape(item.ticker)}</td>
				<td class="p-3 text-slate-300">${format.idr(item.entry)}</td>
				<td class="p-3 text-rose-400">${format.idr(item.sl)}</td>
				<td class="p-3 text-emerald-400">${format.idr(item.tp)}</td>
				<td class="p-3 text-sky-400">1:${Number(item.rrr || 0).toFixed(2)}</td>
				<td class="p-3 text-slate-400">${html.escape(item.status)}</td>
			</tr>
		`).join('') : '<tr><td colspan="6" class="p-6 text-center text-xs text-slate-500">Belum ada jurnal.</td></tr>';
	}

	function getAlerts(ticker) {
		return storage.get(`alerts_${ticker}`, []);
	}

	function saveAlerts(ticker, alerts) {
		storage.set(`alerts_${ticker}`, alerts);
		renderAlerts();
	}

	function renderAlerts() {
		const container = DOM('alertsContainer');
		if (!container) return;
		const groups = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith('alerts_')) continue;
			const ticker = key.replace('alerts_', '');
			const alerts = getAlerts(ticker);
			if (alerts.length) groups.push({ ticker, alerts });
		}
		if (!groups.length) {
			container.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-slate-500">Belum ada price alert.</div>';
			return;
		}
		container.innerHTML = groups.map(group => `
			<div class="col-span-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/30">
				<button class="flex w-full items-center justify-between p-3 text-left hover:bg-slate-900" onclick="toggleAlertAccordion('${group.ticker}')">
					<span><strong class="text-white">${html.escape(group.ticker)}</strong><span class="ml-2 text-[10px] text-slate-500">${group.alerts.length} alert</span></span>
					<span class="text-slate-500">⌄</span>
				</button>
				<div id="alert-body-${group.ticker}" class="${state.openAlerts.has(group.ticker) ? '' : 'hidden'} border-t border-slate-800 p-2">
					${group.alerts.map((item, index) => `
						<div class="flex items-center justify-between gap-3 rounded-lg bg-slate-900 p-2.5 text-xs">
							<div><span class="block text-[10px] text-slate-500">${html.escape(item.label || 'Target')}</span><strong class="text-white">${format.idr(item.price)}</strong></div>
							<div class="flex items-center gap-2"><span class="text-[9px] ${item.active === false ? 'text-slate-500' : item.triggered ? 'text-emerald-400' : 'text-amber-400'}">${item.triggered ? 'TRIGGERED' : item.active === false ? 'OFF' : 'ON'}</span><button onclick="removePriceAlert('${group.ticker}', ${index})" class="text-rose-400">Hapus</button></div>
						</div>
					`).join('')}
				</div>
			</div>
		`).join('');
	}

	function toggleAlertAccordion(ticker) {
		state.openAlerts.has(ticker) ? state.openAlerts.delete(ticker) : state.openAlerts.add(ticker);
		renderAlerts();
	}

	function removePriceAlert(ticker, index) {
		const alerts = getAlerts(ticker);
		alerts.splice(index, 1);
		saveAlerts(ticker, alerts);
	}

	function syncAlertsFromSignal() {
		if (!state.stock) return ui.toast('Data saham belum tersedia.', 'warning');
		const risk = signalEngine.riskLevels(state.stock);
		const alerts = [
			{ price: risk.stop, label: 'Stop Loss', active: true, triggered: false },
			{ price: risk.support, label: 'Support', active: true, triggered: false },
			{ price: risk.resistance, label: 'Resistance', active: true, triggered: false },
			{ price: risk.target1, label: 'Take Profit', active: true, triggered: false }
		];
		saveAlerts(state.ticker, alerts);
		state.openAlerts.add(state.ticker);
		renderAlerts();
	}

	function checkPriceAlerts(ticker, price) {
		const alerts = getAlerts(ticker);
		let changed = false;
		for (const alert of alerts) {
			if (alert.active === false || alert.triggered) continue;
			const supportSide = /support|stop|entry/i.test(alert.label || '');
			const hit = supportSide ? price <= alert.price : price >= alert.price;
			if (!hit) continue;
			alert.active = false;
			alert.triggered = true;
			changed = true;
			ui.toast(`${ticker}: ${alert.label || 'Target'} tercapai di ${format.idr(price)}.`, 'success');
			if ('Notification' in window && Notification.permission === 'granted') new Notification(`Stock ID — ${ticker}`, { body: `${alert.label || 'Target'} tercapai di ${format.idr(price)}.` });
		}
		if (changed) saveAlerts(ticker, alerts);
	}

	async function requestNotifications() {
		if (!('Notification' in window)) return ui.toast('Browser tidak mendukung notifikasi.', 'warning');
		const permission = await Notification.requestPermission();
		ui.toast(permission === 'granted' ? 'Notifikasi aktif.' : 'Notifikasi belum diizinkan.', permission === 'granted' ? 'success' : 'warning');
	}

	async function fetchStockNews(ticker) {
		const container = DOM('newsContainer');
		if (!container) return;
		const cached = storage.get(cache.newsKey(ticker));
		if (cached && Date.now() - cached.timestamp < CONFIG.cache.newsTtl) {
			container.innerHTML = cached.html;
			return;
		}
		const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(`${ticker} saham Indonesia`)}&hl=id&gl=ID&ceid=ID:id`;
		try {
			const response = await api.fetchJSON(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}`, 7000);
			const items = response?.items || [];
			const rendered = items.slice(0, 9).map(item => `
				<a href="${html.escape(item.link)}" target="_blank" rel="noopener noreferrer" class="block rounded-lg border border-slate-800 bg-slate-950/30 p-3 hover:bg-slate-900">
					<span class="block text-[9px] text-slate-500">${html.escape(item.author || 'News')} · ${new Date(item.pubDate).toLocaleDateString('id-ID')}</span>
					<strong class="mt-1 block text-xs text-slate-200">${html.escape(item.title)}</strong>
				</a>
			`).join('') || '<div class="py-8 text-center text-xs text-slate-500">Tidak ada berita yang ditemukan.</div>';
			container.innerHTML = rendered;
			storage.set(cache.newsKey(ticker), { timestamp: Date.now(), html: rendered });
		} catch {
			container.innerHTML = '<div class="py-8 text-center text-xs text-slate-500">Berita tidak dapat dimuat saat ini.</div>';
		}
	}

	async function fetchCorporateAction(ticker) {
		const container = DOM('corporateContainer');
		if (!container) return;
		const query = encodeURIComponent(`${ticker} (dividen OR RUPS OR "right issue" OR "stock split" OR buyback)`);
		try {
			const data = await api.fetchJSON(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(`https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`)}`, 7000);
			container.innerHTML = (data?.items || []).slice(0, 9).map(item => `
				<a href="${html.escape(item.link)}" target="_blank" rel="noopener noreferrer" class="block rounded-lg border border-slate-800 bg-slate-950/30 p-3">
					<span class="text-[9px] text-fuchsia-400">Aksi korporasi · ${new Date(item.pubDate).toLocaleDateString('id-ID')}</span>
					<strong class="mt-1 block text-xs text-slate-200">${html.escape(item.title)}</strong>
				</a>
			`).join('') || '<div class="py-8 text-center text-xs text-slate-500">Belum ada berita aksi korporasi.</div>';
		} catch {
			container.innerHTML = '<div class="py-8 text-center text-xs text-slate-500">Data aksi korporasi tidak tersedia.</div>';
		}
	}

	async function fetchRealtimeFundamentals(ticker) {
		const container = DOM('yahooFundamentalContainer');
		if (!container) return;
		const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}.JK?modules=assetProfile,financialData,defaultKeyStatistics,summaryDetail,majorHoldersBreakdown,institutionOwnership`;
		for (const makeProxy of CONFIG.data.proxies) {
			try {
				const raw = await api.fetchJSON(makeProxy(url), 7000);
				const data = raw?.contents ? JSON.parse(raw.contents) : raw;
				const result = data?.quoteSummary?.result?.[0];
				if (!result) continue;
				const profile = result.assetProfile || {};
				const financial = result.financialData || {};
				const stats = result.defaultKeyStatistics || {};
				const detail = result.summaryDetail || {};
				container.innerHTML = `
					<div class="grid grid-cols-2 gap-3 text-xs">
						<div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span class="block text-slate-500">Sektor</span><strong class="text-white">${html.escape(profile.sector || '-')}</strong></div>
						<div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span class="block text-slate-500">Industri</span><strong class="text-white">${html.escape(profile.industry || '-')}</strong></div>
						<div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span class="block text-slate-500">P/E</span><strong class="text-sky-400">${html.escape(detail.trailingPE?.fmt || '-')}</strong></div>
						<div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span class="block text-slate-500">P/B</span><strong class="text-sky-400">${html.escape(stats.priceToBook?.fmt || '-')}</strong></div>
						<div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span class="block text-slate-500">ROE</span><strong class="text-emerald-400">${html.escape(financial.returnOnEquity?.fmt || '-')}</strong></div>
						<div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><span class="block text-slate-500">Margin</span><strong class="text-emerald-400">${html.escape(financial.profitMargins?.fmt || '-')}</strong></div>
					</div>
				`;
				return;
			} catch {}
		}
		container.innerHTML = '<div class="py-8 text-center text-xs text-slate-500">Data fundamental tidak dapat dimuat.</div>';
	}

	function initSettings() {
		const theme = localStorage.getItem('stockid_theme') || 'dark';
		if (theme === 'light') document.body.classList.add('light-mode');
		const fontSize = localStorage.getItem('stockid_font_size') || '16';
		document.documentElement.style.fontSize = `${fontSize}px`;
	}

	function switchTab(tabName) {
		const tabs = ['ai', 'bigmoney', 'custom', 'peer', 'news', 'fundamental', 'paper', 'rrr', 'journal', 'alert', 'corporate', 'insider', 'heatmap', 'setting'];
		for (const tab of tabs) {
			const button = DOM(`tabBtn-${tab}`);
			const content = DOM(`tabContent-${tab}`);
			if (button) button.classList.toggle('bg-slate-800', tab === tabName);
			if (button) button.classList.toggle('text-emerald-400', tab === tabName);
			if (content) content.classList.toggle('hidden', tab !== tabName);
		}
		if (tabName === 'journal') renderJournal();
		if (tabName === 'alert') renderAlerts();
		if (tabName === 'paper') renderPaperTrading();
	}

	function init() {
		const params = new URLSearchParams(location.search);
		const urlTicker = params.get('ticker');
		if (urlTicker) state.ticker = urlTicker.toUpperCase();

		initSettings();
		cache.clean();
		market.updateBadge();
		initSearch();
		renderJournal();
		renderAlerts();
		renderPaperTrading();
		
		const input = DOM('stockSearch');
		if (input) input.value = state.ticker;
		loadStock(state.ticker);
		renderChart(state.ticker);
		renderTechnicalGauge(state.ticker);
		fetchStockNews(state.ticker);
		fetchCorporateAction(state.ticker);
		fetchRealtimeFundamentals(state.ticker);

		setInterval(() => market.updateBadge(), 30_000);
		setInterval(() => {
			if (state.ticker) loadStock(state.ticker, { force: true });
		}, 5 * 60 * 1000);
	}

	window.StockIDChatGPT = {
		state,
		api,
		technical,
		signalEngine,
		loadStock,
		runRadar,
		runCustomScreener,
		searchStock,
		requestNotifications
	};

	Object.assign(window, {
		searchStock,
		selectSuggestion,
		startVoiceSearch,
		startRadarProcess: runRadar,
		selectTickerFromRadar,
		runCustomScreener,
		syncAlertsFromAI: syncAlertsFromSignal,
		toggleAlertAccordion,
		removePriceAlert,
		saveTradingPlanToJournal,
		ptExecuteBuy: paperBuy,
		ptExecuteSell: paperSell,
		renderPaperTradingUI: renderPaperTrading,
		renderJournalTable: renderJournal,
		renderAllAlerts: renderAlerts,
		switchTab,
		requestNotificationPermission: requestNotifications
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
