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

if (window.lucide) lucide.createIcons();

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

function switchTab(tabName) {
	const tabs = ['ai','bigmoney','custom','bsjp','peer','news','fundamental','paper','rrr','journal','alert','corporate','insider','heatmap','setting'];
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
	if (tabName === 'paper') renderPaperTradingUI();
	if (tabName === 'heatmap') {
		renderSectorHeatmap();
		fetchMacroAndCommodities();
	}
	if (tabName === 'fundamental') renderFundamentalWidget(currentTicker);
}

// ==========================================
// 4. WEB AUDIO ENGINE & HAPTIC VIBRATION
// ==========================================
let isSoundMuted = localStorage.getItem('stockid_sound_muted') === 'true';
let isVibrateMuted = localStorage.getItem('stockid_vibrate_muted') === 'true';

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
		if (isSoundMuted) return;
		try {
			const audio = new Audio(`stockid_suara/s/${filename}`);
			audio.play().catch(e => {});
		} catch(e) {}
	},
	playClick() {
		const clicks = ['klik1.mp3'];
		const randomClick = clicks[Math.floor(Math.random() * clicks.length)];
		this.playAudioFile(randomClick);
	},
	playSuccess() { this.playAudioFile('sukses.mp3'); },
	playAlert() { this.playAudioFile('loss.mp3'); },
	playTokenExpired() { this.playAudioFile('hilang.mp3'); },
	playSearch() { this.playAudioFile('cari.mp3'); },
	playNotif() { this.playAudioFile('notif.mp3'); },
	playDelete(withPopup = false) {
		this.playAudioFile('hapus.mp3');
		if (withPopup) {
			setTimeout(() => { this.playAudioFile('hilang.mp3'); }, 1800);
		}
	},
	playWinJournal() { this.playAudioFile('win.mp3'); },
	playLossJournal() { this.playAudioFile('loss.mp3'); }
};

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

function toggleGlobalSound() {
	isSoundMuted = !isSoundMuted;
	localStorage.setItem('stockid_sound_muted', isSoundMuted);
	updateGlobalAudioVibrateUI();
	if (!isSoundMuted && typeof AudioFX !== 'undefined') AudioFX.playClick();
}

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

// ==========================================
// 5. SISTEM PENGATURAN PREFERENSI (SETTING)
// ==========================================
function initSystemSettings() {
	const savedTheme = localStorage.getItem('stockid_theme') || 'dark';
	applyTheme(savedTheme);
	const themeRadio = document.querySelector(`input[name="settingTheme"][value="${savedTheme}"]`);
	if (themeRadio) themeRadio.checked = true;

	const savedFontSize = localStorage.getItem('stockid_font_size') || '16';
	applyFontSize(savedFontSize);
	const fontInput = document.getElementById('settingFontSize');
	if (fontInput) fontInput.value = savedFontSize;

	const savedFontFamily = localStorage.getItem('stockid_font_family') || 'Lexend';
	applyFontStyle(savedFontFamily);
	const fontRadio = document.querySelector(`input[name="settingFontStyle"][value="${savedFontFamily}"]`);
	if (fontRadio) fontRadio.checked = true;

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
	const notifTypeRadio = document.querySelector(`input[name="settingNotifType"][value="${savedNotifType}"]`);
	if (notifTypeRadio) notifTypeRadio.checked = true;
}

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

function applyNotifMuteSound(isChecked) {
	localStorage.setItem('stockid_notif_mute_sound', isChecked);
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

function applyNotifType(typeVal) {
	localStorage.setItem('stockid_notif_type', typeVal);
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

function applyTheme(theme) {
	if (theme === 'light') {
		document.body.classList.add('light-mode');
	} else {
		document.body.classList.remove('light-mode');
	}
	localStorage.setItem('stockid_theme', theme);
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

function applyFontSize(size) {
	document.documentElement.style.setProperty('font-size', `${size}px`, 'important');
	const label = document.getElementById('fontSizeLabel');
	if (label) label.innerText = `${size}px`;
	localStorage.setItem('stockid_font_size', size);
}

function applyFontStyle(fontName) {
	if (fontName !== 'Lexend') {
		let styleId = 'custom-font-style-loader';
		let styleEl = document.getElementById(styleId);
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = styleId;
			document.head.appendChild(styleEl);
		}
		styleEl.innerHTML = `
			@font-face {
				font-family: '${fontName}';
				src: url('Stockid_font/${fontName}.ttf') format('truetype');
				font-weight: 800;
				font-style: normal;
			}
		`;
	}
	document.documentElement.style.setProperty('--app-font-family', `"${fontName}"`);
	localStorage.setItem('stockid_font_family', fontName);
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

// ==========================================
// 6. UTILITAS & MODAL WELCOME
// ==========================================
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

function showToast(message, type = 'success', duration = 5000) {
	const container = document.getElementById('toastContainer');
	if (!container) return;
	const toastId = 'toast-' + Date.now();
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
	setTimeout(() => { toast.classList.remove('translate-y-4', 'opacity-0'); }, 10);
	setTimeout(() => {
		if (document.getElementById(toastId)) {
			toast.classList.add('translate-y-4', 'opacity-0');
			setTimeout(() => toast.remove(), 500);
		}
	}, duration);
}

function shareStockUrl() {
	const shareUrl = `${window.location.origin}${window.location.pathname}?ticker=${currentTicker}`;
	navigator.clipboard.writeText(shareUrl).then(() => {
		AudioFX.playSuccess();
	}).catch(() => {});
}

// ==========================================
// 7. SISTEM AUTENTIKASI VIP TOKEN
// ==========================================
const databaseVIP = {
	"HARDIGANTENG": { "tanggalExpired": "2090-01-01" },
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
	"TAMA2689": { "tanggalExpired": "2026-12-05" },
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
};

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
	if (!tokenInput) return showError("Silakan masukan token terlebih dahulu!");
	if (!databaseVIP[tokenInput]) return showError("Akses Token tidak terdaftar / salah!");
	const daysLeft = calculateDaysLeft(databaseVIP[tokenInput].tanggalExpired);
	if (daysLeft < 0) return showError("Akses Token ini sudah kedaluwarsa!");
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

function renderChart(ticker) {
	const container = document.getElementById('tv_chart_container');
	if (!container) return;
	container.innerHTML = '';
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
		"height": "350",
		"symbol": `IDX:${ticker}`,
		"showIntervalTabs": true,
		"displayMode": "single",
		"locale": "id",
		"colorTheme": "dark"
	});
	container.appendChild(script);
}

// ==========================================
// 9. INSIDER SEARCH (SEC EDGAR VIA CLOUDFLARE WORKER)
// ==========================================

async function handleInsiderSearch() {
	const selectEl = document.getElementById('insiderSearchInput');
	const cikNumber = selectEl.value;
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
			const res = await fetch(workerUrl, { signal: AbortSignal.timeout(10000) });
			if (!res.ok) throw new Error(`Worker merespons dengan status error: ${res.status}`); 
			
			let data = await res.text();
			
			if (data.trim().toLowerCase().startsWith('<!doctype html>') || data.trim().toLowerCase().startsWith('<html')) {
				throw new Error("Server SEC EDGAR menolak akses melalui Worker."); 
			}
			
			return isXml ? data : JSON.parse(data);
		} catch(error) {
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
		
		// REGEX PARSER OPTIMIZATION (ANTI-LAG & FIX NAMESPACE ERROR)
		let portfolioData = [];
		const infoTableRegex = /<([a-zA-Z0-9]*:)?infoTable[\s\S]*?<\/(\1)?infoTable>/gi;
		const nameRegex = /<([a-zA-Z0-9]*:)?nameOfIssuer>([^<]+)<\/(\1)?nameOfIssuer>/i;
		const cusipRegex = /<([a-zA-Z0-9]*:)?cusip>([^<]+)<\/(\1)?cusip>/i;
		const valRegex = /<([a-zA-Z0-9]*:)?value>([^<]+)<\/(\1)?value>/i;
		const sharesRegex = /<([a-zA-Z0-9]*:)?sshPrnamt>([^<]+)<\/(\1)?sshPrnamt>/i;
		
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
				//const value = parseFloat(valMatch[2].replace(/,/g, '')) * 1000;
				//const shares = parseFloat(sharesMatch[2].replace(/,/g, ''));
				
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
// 10. DATA FETCHING (DEDUPLICATION ENGINE)
// ==========================================
const pendingFetchRequests = new Map();

async function fetchRealtimeStockData(ticker, forceFetch = false) {
	const cachedData = getCachedStockData(ticker);
	if (cachedData && !forceFetch) return cachedData;
	
	if (pendingFetchRequests.has(ticker)) {
		return pendingFetchRequests.get(ticker);
	}

	const fetchPromise = (async () => {
		const targetSymbol = `${ticker}.JK`;
		const WORKER_URL = 'https://stockid-api.accespy-mail.workers.dev';
		
		const fetchWithTimeout = async (url, timeoutMs = 4000) => {
			const controller = new AbortController();
			const timerId = setTimeout(() => controller.abort(), timeoutMs);
			try {
				const res = await fetch(url, { signal: controller.signal });
				clearTimeout(timerId);
				if (!res.ok) throw new Error('Response not OK');
				return res;
			} catch (err) {
				clearTimeout(timerId);
				throw err;
			}
		};

		let freshData = null;
		
		// 1. Eksekusi Worker
		try {
			const res = await fetchWithTimeout(`${WORKER_URL}?symbol=${targetSymbol}`, 2500);
			const json = await res.json();
			freshData = parseYahooDataGlobal(json, ticker);
		} catch(e) {
			console.warn(`Worker Utama gagal untuk ${ticker}, memanggil Fallback...`);
		}

		// 2. Fallback Proxy Darurat
		if (!freshData) {
			try {
				const yahooProxyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${targetSymbol}?interval=15m&range=5d`;
				const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooProxyUrl)}`;
				const res = await fetchWithTimeout(allOriginsUrl, 6000);
				const wrapper = await res.json();
				freshData = parseYahooDataGlobal(JSON.parse(wrapper.contents), ticker);
			} catch(e) {
				console.error(`Kegagalan total menarik data ${ticker}`);
			}
		}

		if (freshData) {
			setCachedStockData(ticker, freshData);
		}
		
		pendingFetchRequests.delete(ticker);
		return freshData || cachedData;
	})();

	pendingFetchRequests.set(ticker, fetchPromise);
	return fetchPromise;
}

function parseYahooDataGlobal(json, ticker) {
	const result = json?.chart?.result?.[0] || json?.results?.[0];
	if (!result) return null;

	const timestamps = result.timestamp || [];
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

	const high20 = highs.length >= 20 ? roundToBEITick(Math.max(...highs.slice(-20))) : roundToBEITick(Math.max(...highs));
	const low20 = lows.length >= 20 ? roundToBEITick(Math.min(...lows.slice(-20))) : roundToBEITick(Math.min(...lows));

	let dailyData = {};
	let totalVol20 = 0;
	let totalValue20 = 0;
	const len = prices.length;
	const period = Math.min(20, len);

	for(let i = 0; i < len; i++) {
		if(timestamps[i] && volumes[i] !== null && prices[i] !== null) {
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

	return { 
		ticker, price: roundToBEITick(currentPrice), prevClose: roundToBEITick(previousClose), 
		changePct, ma5, ma10, ma20, currentVolume, volYesterday, volRatio, valRatio, high20, low20, 
		currentLot, currentValuation, bandarAvgPrice,
		historicalPrices: prices
	};
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

async function generateAISignal(ticker, isManualSearch = false) {
	const now = new Date();
	const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

	document.getElementById('aiHeaderTicker').innerHTML = `
		<div class="flex items-center gap-2">
			<div class="w-5 h-5 lg:w-6 lg:h-6 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
				<img 
					src="https://assets.stockbit.com/logos/companies/${ticker}.png" 
					alt="${ticker}" 
					class="w-full h-full object-contain drop-shadow-sm" 
					onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] lg:text-[10px] font-black text-slate-400 tracking-wider\\'>${ticker.substring(0,3)}</span>';};"
				>
			</div>
			<span>[${ticker}] — KONDISI TEKNIKAL</span>
		</div>
	`;
	document.getElementById('aiDateStamp').innerText = `Update: ${dateStr} ${timeStr} WIB`;

	setTimeout(() => fetchStockNewsForAI(ticker), 10);

	const cachedData = getCachedStockData(ticker);
	if (cachedData) {
		globalStockData = cachedData;
		renderAISignalUI(ticker, cachedData, true);
		checkPriceAlertsRealtime(ticker, cachedData.price);
		checkWhaleAlertRealtime(ticker, cachedData);

		fetchRealtimeStockData(ticker, true).then(freshData => {
			if (freshData) {
				globalStockData = freshData;
				renderAISignalUI(ticker, freshData, false);
				checkPriceAlertsRealtime(ticker, freshData.price);
				checkWhaleAlertRealtime(ticker, freshData);
			}
		});
		return;
	}

	showAISkeletonLoading();

	const stockData = await fetchRealtimeStockData(ticker, false);
	if (stockData && stockData.ticker === ticker) {
		globalStockData = stockData;
		checkPriceAlertsRealtime(ticker, stockData.price);
		checkWhaleAlertRealtime(ticker, stockData);
	}
	renderAISignalUI(ticker, stockData, false);
}

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
		} else if (stockData.price < stockData.ma10 && stockData.changePct >= -4 && stockData.changePct <= 1) {
			score = 2;
			verdik = "BEARISH CORRECTION";
			verdikClass = "font-bold text-rose-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-rose-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price < stockData.ma10 && stockData.changePct >= -8 && stockData.changePct <= 1) {
			score = 2;
			verdik = "BEARISH CORRECTION";
			verdikClass = "font-bold text-rose-400 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-rose-400 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price < stockData.ma20 && stockData.changePct < -4 && stockData.changePct <= 1) {
			score = 1;
			verdik = "SELLING PRESSURE";
			verdikClass = "font-bold text-red-500 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-red-500 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
		} else if (stockData.price < stockData.ma20 && stockData.changePct < -8 && stockData.changePct <= 1) {
			score = 1;
			verdik = "SELLING PRESSURE";
			verdikClass = "font-bold text-red-500 text-sm lg:text-base";
			scoreClass = "font-bold bg-slate-800 text-red-500 px-2.5 py-0.5 rounded text-xs lg:text-sm border border-slate-700";
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
			<p class="leading-relaxed"><strong class="text-sky-400">Mengapa?</strong> Saham <strong class="text-emerald-400 font-bold">${ticker}</strong> saat ini diperdagangkan pada level harga Rp ${price.toLocaleString('id-ID')} (${trendText}). ${maAlignText}</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong class="text-sky-400">Analisis Likuiditas & Volume:</strong> Terdeteksi bahwa ${volText}. Tingkat aktivitas volume ini mengonfirmasi kekuatan partisipasi institusi atau pelaku pasar utama dalam mendukung pergerakan harga hari ini.</p>
			<p class="leading-relaxed pt-1.5 border-t border-slate-900/60"><strong class="text-sky-400">Rentang Volatilitas 20 Hari:</strong> Pergerakan saham ${ticker} bergerak dalam koridor rentang antara Rp ${stockData.low20.toLocaleString('id-ID')} <strong class="text-amber-400">(Support Kuat)</strong> hingga Rp ${stockData.high20.toLocaleString('id-ID')} <strong class="text-amber-400">(Resistance Tertinggi)</strong>.</p>
		`;

		buktiEl.innerHTML = `
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Harga: <strong class="text-sky-400 font-bold">Rp${price.toLocaleString('id-ID')}</strong> (${stockData.changePct >= 0 ? '+' : ''}${stockData.changePct}%)</span>
				<span class="text-[10px] lg:text-[11px] text-white">${isCached ? 'Cache Instant' : 'Live Data'}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Volume Transaksi:</span>
				<span class="text-violet-400 font-bold">${(stockData.currentLot || 0).toLocaleString('id-ID')} Lot</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Valuasi Transaksi:</span>
				<span class="text-violet-400 font-bold">${formatValuationIDR(stockData.currentValuation)}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Estimasi AVG Bandar:</span>
				<span class="text-amber-400 font-bold">Rp ${(stockData.bandarAvgPrice || price).toLocaleString('id-ID')}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Posisi Tren MA5 / MA10 / MA20:</span>
				<span class="text-emerald-400 font-bold">Rp ${stockData.ma5.toLocaleString('id-ID')} / ${stockData.ma10.toLocaleString('id-ID')} / ${stockData.ma20.toLocaleString('id-ID')}</span>
			</li>
			<li class="flex justify-between items-center bg-slate-900/60 p-2 rounded border border-slate-800/80">
				<span>• Rasio Volume vs Rerata Harian:</span>
				<span class="font-bold ${isVolSpike ? 'text-emerald-400' : 'text-amber-400'}">${stockData.volRatio}x ${isVolSpike ? '(Spike Active)' : '(Normal)'}</span>
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
		} else if (stockData.price < stockData.ma20 && stockData.changePct < -1 && stockData.changePct <= 1) {
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
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Resistent <i data-lucide='git-pull-request-arrow' class='w-3 h-3'></i></span>";
			bandarColor = "text-amber-400";
			bandarBarColor = "from-amber-600 via-amber-400 to-yellow-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]";
			bandarPct = 65; 
		} else if (stockData.changePct >= -4 && stockData.volRatio > 0.5) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Resistent <i data-lucide='git-pull-request-arrow' class='w-3 h-3'></i></span>";
			bandarColor = "text-amber-400";
			bandarBarColor = "from-amber-600 via-amber-400 to-yellow-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]";
			bandarPct = 55; 
		} else if (stockData.changePct >= -4 && stockData.volRatio > 1) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Support <i data-lucide='hand-fist' class='w-3 h-3'></i></span>";
			bandarColor = "text-cyan-400";
			bandarBarColor = "from-cyan-600 via-cyan-400 to-blue-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]";
			bandarPct = 45; 
		} else if (stockData.changePct >= -8 && stockData.volRatio > 0.5) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Uji Support <i data-lucide='hand-fist' class='w-3 h-3'></i></span>";
			bandarColor = "text-cyan-400";
			bandarBarColor = "from-cyan-600 via-cyan-400 to-blue-400 shadow-[0_0_15px_rgba(56,189,248,0.4)]";
			bandarPct = 35; 
		} else if (stockData.changePct < -4 && stockData.price < stockData.ma20) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Distribusi Kuat <i data-lucide='siren' class='w-3 h-3'></i></span>";
			bandarColor = "text-rose-400";
			bandarBarColor = "from-rose-600 via-rose-400 to-red-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]";
			bandarPct = 25; 
		} else if (stockData.changePct < -8 && stockData.price < stockData.ma20) {
			bandarStatus = "<span class='inline-flex items-center gap-0.5'>Distribusi Kuat <i data-lucide='siren' class='w-3 h-3'></i></span>";
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
	let sup1 = fibo.entryLow, sup2 = fibo.entryHigh;
	let sl = fibo.sl;
	let tp1 = res1; 
	let tp2 = roundToBEITick(res2 * 1.03, 'ceil');

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
	
	// 1. Dynamic Fibo
	const fibo = getDynamicFiboLevels(globalStockData?.high20, globalStockData?.low20, price);
	let res1 = fibo.res1, res2 = fibo.res2;
	let sup1 = fibo.entryLow, sup2 = fibo.entryHigh;
	let sl = fibo.sl;
	let tp1 = res1; 
	let tp2 = roundToBEITick(res2 * 1.03, 'ceil');

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
// 13. PEER KOMPARASI SAHAM
// ==========================================
async function loadPeerAnalysisByPrice(targetTicker, isManualRefresh = false) {
	const btn = document.getElementById('btnRefreshPeer');
	
	if (isManualRefresh && btn) {
		if (btn.disabled) return;
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
		const recUrl = `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${targetTicker}.JK`;
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
				const watchlist = typeof uniqueRadarWatchlist !== 'undefined' ? uniqueRadarWatchlist : [targetTicker];
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
								<strong class="text-emerald-400 text-sm tracking-wide">&dollar;${data.ticker}</strong>
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
// 14. TRADING JOURNAL & KANBAN
// ==========================================
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

async function clearJournalHistory() {
	const isConfirmed = await showConfirm("Apakah Kamu yakin ingin menghapus seluruh riwayat Journal Trading?");
	if (isConfirmed) {
		localStorage.removeItem('stockid_trading_journal');
		renderJournalTable();
		showToast("Riwayat Journal Trading berhasil dibersihkan.");
		AudioFX.playTokenExpired();
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
				<td class="p-3.5 font-bold text-pink-400">
					<div class="flex items-center gap-2">
						<div class="w-5 h-5 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
							<img 
								src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
								alt="${item.ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
							>
						</div>
						<span>&dollar;${item.ticker}</span>
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

function allowDrop(ev) { ev.preventDefault(); }
function dragJournalCard(ev, id) { ev.dataTransfer.setData("text/plain", id); }
function dropJournalCard(ev, newStatus) {
	ev.preventDefault();
	const id = parseInt(ev.dataTransfer.getData("text/plain"));
	if (id) updateJournalStatus(id, newStatus);
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
					<div class="flex items-center gap-2">
						<div class="w-5 h-5 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
							<img 
								src="https://assets.stockbit.com/logos/companies/${item.ticker}.png" 
								alt="${item.ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${item.ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[8px] font-black text-slate-400 tracking-wider\\'>${item.ticker.substring(0,3)}</span>';};"
							>
						</div>
						<span class="font-bold text-pink-400 text-xs">&dollar;${item.ticker}</span>
					</div>
					<span class="text-[9px] text-slate-400">${item.date}</span>
				</div>
				<div class="grid grid-cols-3 gap-1 text-[10px] text-slate-300 bg-slate-950/10 p-2 rounded border border-slate-900 text-center">
					<div><span class="text-[7px] text-amber-400 block">ENTRY</span>Rp ${item.entry.toLocaleString('id-ID')}</div>
					<div><span class="text-[7px] text-rose-400 block">SL</span>Rp ${item.sl.toLocaleString('id-ID')}</div>
					<div><span class="text-[7px] text-emerald-400 block">TP</span>Rp ${item.tp.toLocaleString('id-ID')}</div>
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
// 15. SMART RRR CALCULATOR
// ==========================================
function autoFillRRRFromAI() {
	if (globalStockData && globalStockData.price) {
		const basePrice = globalStockData.price;
		const fibo = getDynamicFiboLevels(globalStockData.high20, globalStockData.low20, basePrice);
		
		let res2 = fibo.res2;
		let customTP2 = roundToBEITick(res2 * 1.03, 'ceil');

		document.getElementById('rrrEntry').value = fibo.entryLow;
		document.getElementById('rrrSL').value = fibo.sl;
		document.getElementById('rrrTP').value = customTP2;
		
		calculateSmartRRR();
		if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();
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
// 16. FITUR PENCARIAN & VOICE SEARCH
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
		const matches = uniqueRadarWatchlist.filter(item => item.includes(val)).slice(0, 10);
		if (matches.length > 0) {
			box.innerHTML = matches.map(ticker => `
				<div onclick="selectSuggestion('${ticker}')" class="px-4 py-2.5 hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-200 text-xs font-bold cursor-pointer transition flex items-center justify-between group">
					<span class="flex items-center gap-2.5">
						<div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
							<img 
								src="https://assets.stockbit.com/logos/companies/${ticker}.png" 
								alt="${ticker}" 
								class="w-full h-full object-contain drop-shadow-sm" 
								onerror="this.onerror=null; this.src='https://s3-symbol-logo.tradingview.com/idx/${ticker.toLowerCase()}.svg'; this.onerror=function(){this.outerHTML='<span class=\\'text-[9px] font-black text-slate-400 tracking-wider\\'>${ticker.substring(0,3)}</span>';};"
							>
						</div>
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
		if (searchContainer && !searchContainer.contains(e.target)) box.classList.add('hidden');
	});
}

function selectSuggestion(ticker) {
	const input = document.getElementById('stockSearch');
	const box = document.getElementById('searchSuggestionsBox');
	if (input) input.value = ticker;
	if (box) box.classList.add('hidden');
	searchStock(true);
}

function startSearchCooldown(seconds) {
	const btn = document.querySelector("button[onclick='searchStock()']");
	if (!btn) return;
	btn.disabled = true;
	btn.classList.add('opacity-50', 'cursor-not-allowed');
	let remaining = seconds;
	if (searchCooldownTimer) clearInterval(searchCooldownTimer);
	btn.innerText = `Cari (${remaining}d)`;

	searchCooldownTimer = setInterval(() => {
		remaining--;
		if (remaining <= 0) {
			clearInterval(searchCooldownTimer);
			btn.disabled = false;
			btn.classList.remove('opacity-50', 'cursor-not-allowed');
			btn.innerText = "Cari";
		} else {
			btn.innerText = `Cari(${remaining}d)`;
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
		// renderFundamentalWidget(currentTicker);
		renderAllAlerts();
		generateAISignal(currentTicker, false);
		fetchRealtimeFundamentals(currentTicker);
		fetchStockNews(currentTicker);
		fetchCorporateAction(currentTicker);

		if (!bypassCooldown) startSearchCooldown(5);
	}
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
			if (!foundTicker) foundTicker = uniqueRadarWatchlist.find(ticker => spacelessTranscript.includes(ticker));
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
// 17. RADAR SAHAM (AUTO SCREENER)
// ==========================================
async function startRadarProcess() {
	if (isRadarScanning) return;
	isRadarScanning = true;

	const btn = document.getElementById('btnStartRadar');
	const container = document.getElementById('bigMoneyList');

	btn.disabled = true;
	btn.className = "text-[10px] lg:text-xs text-white font-bold bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed";
	btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-amber-400"></i> Memindai Instan...`;
	if (window.lucide) lucide.createIcons();

	container.innerHTML = `<div class="text-center text-slate-400 text-xs py-12 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-950/10"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400"></i> Memindai saham secara otomatis berdasarkan seluruh indikator...</div>`;
	
	const shuffled = [...uniqueRadarWatchlist];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	
	const validData = [];
	const BATCH_SIZE = 20; 
	let maxBatchLimit = 0; // Tambahan limiter anti-lag

	for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
		maxBatchLimit++;
		if (maxBatchLimit > 3) break; // Membatasi max 60 saham agar UI tidak hang

		const batch = shuffled.slice(i, i + BATCH_SIZE);
		const results = await Promise.all(batch.map(ticker => fetchRealtimeStockData(ticker)));
		for (const res of results) {
			if (res && res.price > 0) validData.push(res);
		}
		if (validData.length > 0) renderRadarItems(validData);
		if (validData.length >= 10) break;
	}

	isRadarScanning = false;
	btn.disabled = false;
	btn.className = "text-[10px] lg:text-xs text-slate-900 font-bold bg-amber-400 hover:bg-amber-500 px-4 py-2 rounded-lg border border-amber-500/50 flex items-center justify-center gap-1.5 transition shadow-md";
	btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Pindai Ulang Pasar`;
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
		container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-2">Tidak ada saham potensial yang ditemukan saat ini.</div>`;
		return;
	}

	sorted.forEach((item, index) => {
		const ticker = item.ticker;
		const price = roundToBEITick(item.price);
		const changePct = item.changePct;
		
		const fibo = getDynamicFiboLevels(item.high20, item.low20, price);
		let entryLow = fibo.entryLow;
		let entryHigh = fibo.entryHigh;
		let sl = fibo.sl;
		let res1 = fibo.res1;
		let res2 = fibo.res2;
		let tp1 = res1;
		let tp2 = roundToBEITick(res2 * 1.03, 'ceil');

		let statusSignal = '<i data-lucide="flame" class="w-3.5 h-3.5 inline"></i> Momentum Breakout';
		let statusClass = "from-emerald-600/30 to-teal-500/10 border-emerald-500/30 text-emerald-400";
		let alasanTeknikal = `Perubahan <strong>${changePct}%</strong> dan bertahan kokoh di atas garis Moving Average MA5 (Rp ${item.ma5.toLocaleString('id-ID')}), menandakan tekanan beli harian masih mendominasi pasar.`;

		const currentHour = new Date().getHours();
		let targetRasio = currentHour < 11 ? 0.5 : (currentHour < 14 ? 0.8 : 1.2);

		if (item.volRatio >= targetRasio && changePct >= 0 && changePct <= 5) {
			statusSignal = '<i data-lucide="activity" class="w-3.5 h-3.5 inline"></i> Curi Start (Whale Acc)';
			statusClass = "from-fuchsia-600/30 to-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400";
			alasanTeknikal = `<strong>Anomali Volume Terdeteksi!</strong> Harga saham baru naik tipis (<strong>+${changePct}%</strong>), tapi volume hari ini sudah mencapai <strong>${(item.volRatio * 100).toFixed(0)}%</strong> dari total volume seharian kemarin. Bandar terindikasi sedang kumpulin barang.`;
		} else if (item.volRatio < (targetRasio * 0.5) && changePct > 4) {
			statusSignal = '<i data-lucide="alert-triangle" class="w-3.5 h-3.5 inline"></i> Jebakan Batman (Fake Breakout)';
			statusClass = "from-rose-600/30 to-rose-500/10 border-rose-500/30 text-rose-400";
			alasanTeknikal = `<strong>Waspada!</strong> Harga naik sangat tinggi (<strong>+${changePct}%</strong>) namun tidak didukung oleh volume yang kuat (Hanya <strong>${(item.volRatio * 100).toFixed(0)}%</strong> dari volume kemarin). Kenaikan ini rawan dibanting. Hati-hati FOMO!`;
		} else if (item.ma5 > item.ma10 && item.price >= item.ma5 && changePct > 0 && changePct < 5) {
			statusSignal = '<i data-lucide="rocket" class="w-3.5 h-3.5 inline"></i> Golden Cross Setup';
			statusClass = "from-yellow-600/30 to-amber-500/10 border-yellow-500/30 text-yellow-400";
			alasanTeknikal = `Sinyal perpotongan garis MA5 melintasi naik MA10/MA20 (*Golden Cross*). Pola pembalikan arah berpotensi terbentuk.`;
		} else if (item.volRatio >= targetRasio && changePct > 1) {
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
							Harga Last: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> 
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

function selectTickerFromRadar(ticker) {
	document.getElementById('stockSearch').value = ticker;
	searchStock(true);
	switchTab('ai');
}

// ==========================================
// 18. CUSTOM SCREENER BUILDER
// ==========================================
function toggleCustomDropdown(dropdownId) {
	const dropdown = document.getElementById(dropdownId);
	const isHidden = dropdown.classList.contains('hidden');
	
	['dropdownMA', 'dropdownVol', 'dropdownPrice'].forEach(id => {
		document.getElementById(id).classList.add('hidden');
	});

	if (isHidden) {
		dropdown.classList.remove('hidden');
		// if (typeof AudioFX !== 'undefined') AudioFX.playDelete();
	}
}

function selectCustomOption(inputId, value, label, dropdownId) {
	document.getElementById(inputId).value = value;
	document.getElementById(inputId + '_Label').innerText = label;
	document.getElementById(dropdownId).classList.add('hidden');
	if (typeof AudioFX !== 'undefined') AudioFX.playClick();
}

document.addEventListener('click', function(e) {
	const dropdowns = ['dropdownMA', 'dropdownVol', 'dropdownPrice'];
	dropdowns.forEach(id => {
		const el = document.getElementById(id);
		if (el && !el.classList.contains('hidden')) {
			if (!e.target.closest(`#${id}`) && !e.target.closest(`button[onclick="toggleCustomDropdown('${id}')"]`)) {
				el.classList.add('hidden');
			}
		}
	});
});

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

async function runCustomScreener() {
	const btn = document.getElementById('btnRunCustomScreener');
	if (btn && btn.disabled) return;

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
		
		const shuffled = [...uniqueRadarWatchlist].sort(() => 0.5 - Math.random());
		let passedItems = [];
		const BATCH_SIZE = 20;
		let maxBatchLimit = 0; // Tambahan limiter anti-lag

		for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
			maxBatchLimit++;
			if (maxBatchLimit > 3) break; // Membatasi max 60 saham agar UI tidak hang
            
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
				if (ruleVol === 'SPIKE_1.2') matchVol = (item.volRatio || 0) >= 1.2;
				else if (ruleVol === 'SPIKE_2.0') matchVol = (item.volRatio || 0) >= 2.0;
				else if (ruleVol === 'DRY') matchVol = (item.volRatio || 0) < 1.0;

				let matchPrice = true;
				if (rulePrice === 'GREEN') matchPrice = (item.changePct || 0) > 0;
				else if (rulePrice === 'RED') matchPrice = (item.changePct || 0) < 0;
				else if (rulePrice === 'BREAKOUT') matchPrice = (item.changePct || 0) >= 3.0;

				let matchRSI = true;
				if (item.historicalPrices && ruleRSI !== 'ALL') {
					const rsiValue = calculateRSI(item.historicalPrices);
					if (ruleRSI === 'OVERSOLD' && rsiValue >= 10) matchRSI = false; //30
					if (ruleRSI === 'OVERBOUGHT' && rsiValue <= 100) matchRSI = false; //70
				}
				
				if (matchMA && matchVol && matchPrice && matchRSI) passedItems.push(item);
			}
			if (passedItems.length >= 8) break;
		}
		
		if (passedItems.length === 0) {
			container.innerHTML = `<div class="text-center text-slate-400 text-xs py-8 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-950/10">Tidak ada saham yang cocok dengan kombinasi filter tersebut. Coba longgarkan kriterianya.</div>`;
			return;
		}

		let html = '';
		passedItems.forEach((item, index) => {
			const price = roundToBEITick(item.price);
			
			const fibo = getDynamicFiboLevels(item.high20, item.low20, price);
			let entryLow = fibo.entryLow;
			let entryHigh = fibo.entryHigh;
			let sl = fibo.sl;
			
			let res1 = fibo.res1;
			let res2 = fibo.res2;
			
			let tp1 = res1;
			let tp2 = roundToBEITick(res2 * 1.03, 'ceil');

			let infoMA = '';
			if (ruleMA === 'ABOVE_MA5') infoMA = `<li class="flex gap-2"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i> <span><strong class="text-emerald-400">Uptrend Pendek:</strong> Bertahan mantap di atas MA5.</span></li>`;
			else if (ruleMA === 'ABOVE_MA20') infoMA = `<li class="flex gap-2"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i> <span><strong class="text-emerald-400">Uptrend Menengah:</strong> Solid di atas support MA20.</span></li>`;
			else if (ruleMA === 'GOLDEN_CROSS') infoMA = `<li class="flex gap-2"><i data-lucide="crosshair" class="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0"></i> <span><strong class="text-amber-400">Golden Cross:</strong> MA5 melintasi naik di atas MA10.</span></li>`;
			else if (ruleMA === 'BELOW_MA20') infoMA = `<li class="flex gap-2"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0"></i> <span><strong class="text-rose-400">Oversold:</strong> Di bawah MA20, pantau rebound.</span></li>`;
			else infoMA = `<li class="flex gap-2"><i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0"></i> <span><strong class="text-slate-300">Tren:</strong> Bebas, posisi harga Rp ${price.toLocaleString('id-ID')}.</span></li>`;

			let infoVol = '';
			if (ruleVol === 'SPIKE_1.2') infoVol = `<li class="flex gap-2"><i data-lucide="zap" class="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0"></i> <span><strong class="text-blue-500">Volume Spike:</strong> Akumulasi ${item.volRatio}x rerata.</span></li>`;
			else if (ruleVol === 'SPIKE_2.0') infoVol = `<li class="flex gap-2"><i data-lucide="zap" class="w-3.5 h-3.5 text-fuchsia-400 mt-0.5 shrink-0"></i> <span><strong class="text-fuchsia-400">Volume Meledak:</strong> Akumulasi masif ${item.volRatio}x.</span></li>`;
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
								Harga Last: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> 
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

function getPaperAccount() {
	const defaultAccount = { cash: 100000000, portfolio: [], history: [] };
	const saved = localStorage.getItem('stockid_paper_account');
	if (!saved) return defaultAccount;
	try { return JSON.parse(saved); } catch (e) { return defaultAccount; }
}

function savePaperAccount(acc) {
	localStorage.setItem('stockid_paper_account', JSON.stringify(acc));
	renderPaperTradingUI();
}

function ptSyncCurrentTicker() {
	if (!globalStockData || !globalStockData.ticker) {
		AudioFX.playAlert();
		showToast("Pilih saham terlebih dahulu pada pencarian!", "warning");
		return;
	}
	document.getElementById('ptTicker').value = globalStockData.ticker;
	document.getElementById('ptPrice').value = roundToBEITick(globalStockData.price);
	ptCalculateTotal();
	showToast(`Berhasil sinkronisasi saham $${globalStockData.ticker} ke form Paper Trade.`);
}

function ptCalculateTotal() {
	const price = parseFloat(document.getElementById('ptPrice').value) || 0;
	const lots = parseInt(document.getElementById('ptLots').value) || 0;
	const total = price * lots * 100;
	document.getElementById('ptTotalValue').innerText = `Rp ${Math.round(total).toLocaleString('id-ID')}`;
}

function ptFillMaxLot() {
	const acc = getPaperAccount();
	const price = parseFloat(document.getElementById('ptPrice').value) || 0;
	if (price <= 0) return;
	const maxShares = Math.floor(acc.cash / price);
	const maxLots = Math.floor(maxShares / 100);
	document.getElementById('ptLots').value = Math.max(0, maxLots);
	ptCalculateTotal();
}

function ptExecuteBuy() {
	const ticker = document.getElementById('ptTicker').value.trim();
	const price = parseFloat(document.getElementById('ptPrice').value) || 0;
	const lots = parseInt(document.getElementById('ptLots').value) || 0;
	const tp = parseFloat(document.getElementById('ptTP').value) || 0;
	const sl = parseFloat(document.getElementById('ptSL').value) || 0;

	if (!ticker || price <= 0 || lots <= 0) return showToast("Data pembelian tidak valid!", "error");

	const totalCost = price * lots * 100;
	let acc = getPaperAccount();

	if (acc.cash < totalCost) {
		showToast("Buying Power (Cash) tidak mencukupi!", "error");
		AudioFX.playAlert();
		return;
	}

	acc.cash -= totalCost;

	const existingIndex = acc.portfolio.findIndex(p => p.ticker === ticker);
	if (existingIndex >= 0) {
		const current = acc.portfolio[existingIndex];
		const newTotalLots = current.lots + lots;
		const newAvgPrice = Math.round(((current.avgPrice * current.lots) + (price * lots)) / newTotalLots);
		acc.portfolio[existingIndex].lots = newTotalLots;
		acc.portfolio[existingIndex].avgPrice = newAvgPrice;
		if (tp > 0) acc.portfolio[existingIndex].tp = tp;
		if (sl > 0) acc.portfolio[existingIndex].sl = sl;
	} else {
		acc.portfolio.push({
			id: Date.now(),
			ticker: ticker,
			lots: lots,
			avgPrice: price,
			tp: tp,
			sl: sl,
			date: new Date().toLocaleDateString('id-ID')
		});
	}

	savePaperAccount(acc);
	AudioFX.playSuccess();
	showToast(`Berhasil membeli ${lots} lot $${ticker} secara virtual!`);
}

async function ptExecuteSell(id) {
    let acc = getPaperAccount();
    const itemIndex = acc.portfolio.findIndex(p => p.id === id);
    if (itemIndex < 0) return;

    const item = acc.portfolio[itemIndex];
    let sellPrice = item.avgPrice;
    
    const cached = getCachedStockData(item.ticker);
    if (globalStockData && globalStockData.ticker === item.ticker) {
        sellPrice = globalStockData.price;
    } else if (cached && cached.price) {
        sellPrice = cached.price;
    } else {
        const freshData = await fetchRealtimeStockData(item.ticker);
        if (freshData && freshData.price) sellPrice = freshData.price;
    }

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
			if (item.tp > 0 && data.price >= item.tp) { ptExecuteSell(item.id); continue; }
			if (item.sl > 0 && data.price <= item.sl) { ptExecuteSell(item.id); continue; }
		}
	}
	if (hasUpdates) renderPaperTradingUI();
	if (!isAuto) AudioFX.playSuccess();
}

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
							<span>&dollar;${item.ticker}</span>
						</div>
					</td>
					<td class="p-3.5 text-blue-400">${item.lots.toLocaleString('id-ID')} Lot</td>
					<td class="p-3.5 text-amber-400">Rp ${item.avgPrice.toLocaleString('id-ID')}</td>
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
							<span class="font-bold text-blue-400">&dollar;${h.ticker} <strong class='text-blue-400'>(${h.lots} Lot)</strong></span>
						</div>
						<span class="text-[9px] ${isWin ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border border-rose-500/30'} px-2 py-0.5 rounded font-bold">${h.status}</span>
					</div>
					<div class="flex justify-between text-[11px] text-slate-300 pb-1">
						<span class="font-bold text-sky-400">Beli: Rp ${h.buyPrice.toLocaleString('id-ID')}</span>
						<span class="font-bold text-sky-400">Jual: Rp ${h.sellPrice.toLocaleString('id-ID')}</span>
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

async function scanWhalesData() {
	if (isWhaleScanning) return;
	isWhaleScanning = true;

	const btn = document.getElementById('btnScanWhales');
	const container = document.getElementById('whaleResultsContainer');

	if (btn.disabled && btn.innerHTML.includes('Pending')) {
		isWhaleScanning = false;
		return;
	}

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
	const scanList = [...uniqueRadarWatchlist].sort(() => 0.5 - Math.random());

	try {
		for (const ticker of scanList) {
			const cachedItem = getCachedStockData(ticker);
			if (cachedItem && cachedItem.price) {
				const vol = cachedItem.volRatio || 0;
				const chg = cachedItem.changePct || 0;
				const price = cachedItem.price;
				const ma5 = cachedItem.ma5 || price;
				const valuasi = cachedItem.currentValuation || 0;
				let tier = 0, tierName = "", tierClass = "";
				
				// LOGIKA BARU WHALES (Digabung dengan 3 Tier)
				if (vol > 2 && valuasi > 2000000000 && chg >= 0 && chg <= 5) {
					if (price > ma5) {
						tier = 3; tierName = "PAUS KUAT (STRONG WHALE)";
						tierClass = "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]";
					} else if (price === ma5) { 
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
					const ma5 = item.ma5 || price;
					const valuasi = item.currentValuation || 0;
					let tier = 0, tierName = "", tierClass = "";
					
					// LOGIKA BARU WHALES (Digabung dengan 3 Tier)
					if (vol > 2 && valuasi > 2000000000 && chg >= 0 && chg <= 5) {
						if (price > ma5) {
							tier = 3; tierName = "PAUS KUAT (STRONG WHALE)";
							tierClass = "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]";
						} else if (price === ma5) { 
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
				if (foundWhales.length >= 10) break;
			}
		}
		
		foundWhales.sort((a, b) => b.currentValuation - a.currentValuation);
		foundWhales = foundWhales.slice(0, 10);

		if (foundWhales.length === 0) {
			container.innerHTML = `
				<div class="text-center text-slate-400 text-[11px] lg:text-xs py-10 col-span-full border border-slate-700 rounded-xl bg-slate-950/20">
					<i data-lucide="waves" class="w-6 h-6 mx-auto mb-2 text-slate-500"></i>
					Belum ada pergerakan Whale (Bandar) yang terdeteksi. Kondisi pasar saat ini cenderung sepi atau stabil.
				</div>
			`;
		} else {
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
										<span class="text-slate-400">Harga Last: <strong class="text-blue-400">Rp ${price.toLocaleString('id-ID')}</strong></span>
										<span class="w-1 h-1 rounded-full bg-slate-600 shrink-0"></span>
										<span class="text-slate-400">Vol: <strong class="text-fuchsia-400">${item.volRatio}x</strong></span>
									</div>
								</div>
							</div>
						</div>
						
						<div class="grid grid-cols-2 gap-3 text-[10px] lg:text-xs relative z-10">
							<div class="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-center">
								<span class="text-slate-400 font-medium uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1.5"><i data-lucide="target" class="w-3 h-3 text-amber-400"></i> Entry Agresif / Aman</span>
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
		let cooldown = foundWhales.length === 0 ? 60 : 30; 
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

function sendAIChatMessage() {
	const inputEl = document.getElementById('aiChatInput');
	const msgContainer = document.getElementById('aiChatMessages');
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
	AudioFX.playClick();

	// Indikator Loading
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
		const aiReply = await generateAIResponse(query);
		
		document.getElementById(loadingId).remove();

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
	}, 500);
}

function escapeHtml(text) {
	const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
	return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function generateAIResponse(prompt) {
	const lower = prompt.toLowerCase();
	let targetTicker = currentTicker;

	if (typeof uniqueRadarWatchlist !== 'undefined') {
		const foundMatch = uniqueRadarWatchlist.find(t => lower.includes(t.toLowerCase()));
		if (foundMatch) targetTicker = foundMatch;
	}

	const isCurrent = targetTicker === currentTicker;
	const data = isCurrent ? globalStockData : getCachedStockData(targetTicker);
	const formatRp = (num) => num ? `Rp ${num.toLocaleString('id-ID')}` : 'N/A';

	if (lower.includes('halo') || lower.includes('hai') || lower.includes('pagi') || lower.includes('siang') || lower.includes('sore') || lower.includes('malam')) {
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
	
	let sl = fibo.sl;
	let sup1 = fibo.entryLow;
	let sup2 = fibo.entryHigh;
	let res1 = fibo.res1;
	let res2 = fibo.res2;
	let tp1 = res1;
	let tp2 = roundToBEITick(res2 * 1.03, 'ceil');
	
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
								<span class="font-bold text-cyan-400 text-sm md:text-base tracking-wide">${ticker}</span>
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
		
		entry = fibo.entryLow;
		resist = fibo.res1;
		sl = fibo.sl;
		tp = roundToBEITick(fibo.res2 * 1.03, 'ceil');
	}

	document.getElementById('alertModalTicker').value = currentTicker || '';
	document.getElementById('alertModalEntry').value = entry || 0;
	document.getElementById('alertModalResistance').value = resist || 0;
	document.getElementById('alertModalTP').value = tp || 0;
	document.getElementById('alertModalSL').value = sl || 0;
	
	const modal = document.getElementById('editAlertModal');
	if (modal) modal.classList.remove('hidden');
}

function closeEditAlertModal() {
	const modal = document.getElementById('editAlertModal');
	if (modal) modal.classList.add('hidden');
}

function saveFinalEditedAlert() {
	const tickerInput = document.getElementById('alertModalTicker').value.trim();
	const entryInput = parseFloat(document.getElementById('alertModalEntry').value) || 0;
	const resistanceInput = parseFloat(document.getElementById('alertModalResistance').value) || 0;
	const tpInput = parseFloat(document.getElementById('alertModalTP').value) || 0;
	const slInput = parseFloat(document.getElementById('alertModalSL').value) || 0;
	
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

function syncAlertsFromAI() {
	let price = 100;
	let sl = 92, sup2 = 96, res2 = 108, tp2 = 110;

	if (globalStockData && globalStockData.price) {
		price = roundToBEITick(globalStockData.price);
		const fibo = getDynamicFiboLevels(globalStockData.high20, globalStockData.low20, price);
		
		sup2 = fibo.entryHigh;
		res2 = fibo.res2;
		sl = fibo.sl;
		
		tp2 = roundToBEITick(res2 * 1.03, 'ceil'); 
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
	
	const snoozeTarget = parseInt(localStorage.getItem('stockid_notif_snooze_target') || '0');
	if (snoozeTarget > Date.now()) return;

	const notifType = localStorage.getItem('stockid_notif_type') || 'both';
	if (notifType === 'whales') return;

	const muteNotifSound = localStorage.getItem('stockid_notif_mute_sound') === 'true';

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
				const alertMsg = `Harga terkini (Rp ${currentPrice.toLocaleString('id-ID')}), telah menyentuh area ${labelText} di Rp ${targetPrice.toLocaleString('id-ID')}`;
				//const alertMsg = `🎯 Alert $${ticker}! Harga terkini (Rp ${currentPrice.toLocaleString('id-ID')}) telah menyentuh area ${labelText} di Rp ${targetPrice.toLocaleString('id-ID')}`;
				
				// 1. Eksekusi Notifikasi Bawaan Aplikasi
				if (!muteNotifSound && typeof AudioFX !== 'undefined') {
					AudioFX.playSuccess();
				}
				showToast(alertMsg, "success");
				
				// 2. Eksekusi Browser Push Notification
				sendBrowserPushNotification(`🎯 STOCK ID ALERT: $${ticker}`, alertMsg);
				
				// 3. Eksekusi Telegram Webhook
				const telegramMsg = `<b>🔔 SMART ALERT</b> \nSaham: <b>${ticker}</b>\nStatus: Menyentuh <b>${labelText}</b>\nHarga Terkini: <b>Rp ${currentPrice.toLocaleString('id-ID')}</b>`;
				//const telegramMsg = `🚨 <b>SMART ALERT</b> 🚨\nSaham: <b>${ticker}</b>\nStatus: <b>Menyentuh ${labelText}</b>\nHarga Terkini: <b>Rp ${currentPrice.toLocaleString('id-ID')}</b>`;
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

	if (updated) saveAlerts(ticker, alerts);
}

function checkWhaleAlertRealtime(ticker, stockData) {
	const latestData = getCachedStockData(ticker) || stockData;
	if (!latestData || !latestData.price) return;
	
	const snoozeTarget = parseInt(localStorage.getItem('stockid_notif_snooze_target') || '0');
	if (snoozeTarget > Date.now()) return;

	const notifType = localStorage.getItem('stockid_notif_type') || 'both';
	if (notifType === 'smart_alert') return;

	const muteNotifSound = localStorage.getItem('stockid_notif_mute_sound') === 'true';
	
	const currentHour = new Date().getHours();
	let strictRasio = currentHour < 11 ? 0.8 : (currentHour < 14 ? 1.2 : 1.5);
	
	if (latestData.volRatio >= strictRasio && latestData.changePct >= 0 && latestData.changePct <= 5.0) {
		const lastAlertKey = `whale_alert_${ticker}`;
		const lastAlertTime = localStorage.getItem(lastAlertKey);
		const now = Date.now();
		
		const ONE_HOUR = 60 * 60 * 1000;
		
		if (!lastAlertTime || (now - parseInt(lastAlertTime)) > ONE_HOUR) {
			const alertMsg = `🐳 WHALE DETECTED \nSaham: $${ticker}\nVolume: Mencapai ${(latestData.volRatio * 100).toFixed(0)}% dari volume kemarin!\nHarga baru naik ${latestData.changePct}%, Bandar indikasi kumpulin barang!`;
			//const alertMsg = `🐳 WHALE DETECTED: Volume $${ticker} mencapai ${(latestData.volRatio * 100).toFixed(0)}% dari total volume kemarin! Harga baru naik ${latestData.changePct}%. Bandar indikasi kumpulin barang!`;
			
			if (!muteNotifSound && typeof AudioFX !== 'undefined') {
				AudioFX.playNotif(); 
			}
			
			sendBrowserPushNotification(`🐳 STOCK ID WHALE RADAR`, alertMsg);
			//sendBrowserPushNotification(`WHALE RADAR: $${ticker}`, alertMsg);
			showToast(alertMsg, "info", 5000); 
			const teleMsg = `<b>🐳 WHALE DETECTED</b>\nSaham: <b>$${ticker}</b>\nVolume: Mencapai <b>${(latestData.volRatio * 100).toFixed(0)}%</b> dari volume kemarin!\nHarga baru naik <b>${latestData.changePct}%</b>, Bandar indikasi kumpulin barang!`;
			//const teleMsg = `🐋 <b>WHALE DETECTED: $${ticker}</b>\nVolume Tembus <b>${(latestData.volRatio * 100).toFixed(0)}%</b> dari volume kemarin!\nHarga naik <b>+${latestData.changePct}%</b>\n<i>Bandar terindikasi sedang kumpulin barang!</i>`;
			sendTelegramAlert(teleMsg);
			
			localStorage.setItem(lastAlertKey, now.toString());
		}
	}
}

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

async function fetchRealtimeFundamentals(ticker) {
	const container = document.getElementById('yahooFundamentalContainer');
	const tvContainer = document.getElementById('tv_fundamental_container');
	
	if (tvContainer) {
		tvContainer.innerHTML = '';
		tvContainer.classList.add('hidden');
	}

	if (!container) return;

	const labelMetrik = document.querySelector('#tabContent-fundamental .text-fuchsia-400.font-bold:not(#fundTickerLabel)');
	if (labelMetrik) {
		labelMetrik.innerHTML = '<i data-lucide="database" class="w-3.5 h-3.5 inline"></i> Global Financial Data API (Free)';
	}

	container.classList.remove('hidden');
	container.innerHTML = `
		<div class="flex flex-col items-center justify-center py-12 space-y-3">
			<i data-lucide="loader-2" class="w-8 h-8 animate-spin text-fuchsia-400"></i>
			<span class="text-xs text-slate-400 animate-pulse">Mengekstrak data fundamental perusahaan secara real-time...</span>
		</div>
	`;
	if (window.lucide) lucide.createIcons();

	try {
		const targetSymbol = `${ticker}.JK`;
		const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${targetSymbol}?modules=summaryDetail,defaultKeyStatistics,financialData,assetProfile`;
		
		const proxies = [
			`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
			`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
			`https://corsproxy.io/?${encodeURIComponent(url)}`
		];

		let result = null;
		for (let i = 0; i < proxies.length; i++) {
			try {
				const res = await fetch(proxies[i], { signal: AbortSignal.timeout(7000) });
				if (!res.ok) continue;
				let data = await res.json();
				if (proxies[i].includes('allorigins')) data = JSON.parse(data.contents);
				
				if (data && data.quoteSummary && data.quoteSummary.result) {
					result = data.quoteSummary.result[0];
					break;
				}
			} catch (e) {
				console.warn(`Proxy ${i} failed for fundamentals.`);
			}
		}

		if (!result) {
			throw new Error("Data fundamental perusahaan tidak ditemukan di database global.");
		}

		// Ekstraksi Objek
		const profile = result.assetProfile || {};
		const summary = result.summaryDetail || {};
		const stats = result.defaultKeyStatistics || {};
		const finance = result.financialData || {};

		// Formatting Data
		const companyName = profile.longName || ticker;
		const sector = profile.sector || 'Sektor N/A';
		const industry = profile.industry || 'Industri N/A';
		const website = profile.website || '#';
		const description = profile.longBusinessSummary || 'Deskripsi perusahaan belum tersedia di database.';

		const mktCap = summary.marketCap?.raw ? formatValuationIDR(summary.marketCap.raw) : 'N/A';
		const peRatio = summary.trailingPE?.raw ? summary.trailingPE.raw.toFixed(2) + 'x' : 'N/A';
		const pbRatio = stats.priceToBook?.raw ? stats.priceToBook.raw.toFixed(2) + 'x' : 'N/A';
		const divYield = summary.dividendYield?.raw ? (summary.dividendYield.raw * 100).toFixed(2) + '%' : '0.00%';
		const roe = finance.returnOnEquity?.raw ? (finance.returnOnEquity.raw * 100).toFixed(2) + '%' : 'N/A';
		const debtToEquity = finance.debtToEquity?.raw ? (finance.debtToEquity.raw / 100).toFixed(2) + 'x' : 'N/A';
		const beta = stats.beta?.raw ? stats.beta.raw.toFixed(2) : 'N/A';

		container.innerHTML = `
			<div class="space-y-4">
				<div class="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-start gap-4 shadow-sm">
					<div>
						<h3 class="text-base lg:text-lg font-bold text-white mb-1">${companyName}</h3>
						<div class="flex flex-wrap gap-2 text-[10px] lg:text-[11px] mb-2">
							<span class="bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 px-2 py-0.5 rounded font-bold">${sector}</span>
							<span class="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-bold">${industry}</span>
							<span class="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-bold">IDX</span>
						</div>
						<p class="text-[10px] lg:text-xs text-slate-400 leading-relaxed line-clamp-3">${description}</p>
					</div>
				</div>

				<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Market Cap</span>
						<span class="text-sm lg:text-base font-bold text-emerald-400">${mktCap}</span>
					</div>
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">P/E Ratio</span>
						<span class="text-sm lg:text-base font-bold text-amber-400">${peRatio}</span>
					</div>
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">P/B Ratio</span>
						<span class="text-sm lg:text-base font-bold text-cyan-400">${pbRatio}</span>
					</div>
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Dividend Yield</span>
						<span class="text-sm lg:text-base font-bold text-fuchsia-400">${divYield}</span>
					</div>
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Return on Equity (ROE)</span>
						<span class="text-sm lg:text-base font-bold text-blue-400">${roe}</span>
					</div>
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Debt to Equity</span>
						<span class="text-sm lg:text-base font-bold text-rose-400">${debtToEquity}</span>
					</div>
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Beta (Volatilitas)</span>
						<span class="text-sm lg:text-base font-bold text-white">${beta}</span>
					</div>
					<div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center flex flex-col justify-center">
						<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Website Resmi</span>
						${website !== '#' ? `<a href="${website}" target="_blank" class="text-[10px] lg:text-xs font-bold text-sky-400 hover:underline mt-1 truncate">Kunjungi <i data-lucide="external-link" class="w-3 h-3 inline"></i></a>` : '<span class="text-[10px] lg:text-xs font-bold text-slate-500 mt-1">Tidak Tersedia</span>'}
					</div>
				</div>
			</div>
		`;
		
		if (window.lucide) lucide.createIcons();
		if (typeof AudioFX !== 'undefined') AudioFX.playSuccess();

	} catch (error) {
		container.innerHTML = `
			<div class="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl text-center space-y-2">
				<i data-lucide="alert-triangle" class="w-6 h-6 text-rose-400 mx-auto"></i>
				<h4 class="text-sm font-bold text-rose-400">Gagal Memuat Fundamental</h4>
				<p class="text-xs text-slate-400">${error.message}</p>
			</div>
		`;
		if (window.lucide) lucide.createIcons();
	}
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
			document.getElementById('aiBeritaList').innerHTML = `<div>Belum ada rilis berita khusus untuk saham ${ticker} dalam 24 jam terakhir.</div>`;
		}
	} catch (e) {
		document.getElementById('aiBeritaList').innerHTML = `<div>Gagal memuat berita terkini. Gunakan indikator teknikal pada chart.</div>`;
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
				const date = item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Berita Realtime';
				container.innerHTML += `
					<a href="${item.link}" target="_blank" class="block p-3.5 bg-slate-950/10 hover:bg-slate-800 border border-slate-800 rounded-lg transition duration-150">
						<div class="flex items-center gap-1.5 mb-2">
							<span class="text-[9px] lg:text-[10px] bg-blue-500/20 text-blue-500 font-bold px-2 py-0.5 rounded border border-blue-500/30">${item.publisher}</span>
							<span class="text-[10px] lg:text-xs text-white">${date}</span>
						</div>
						<h4 class="text-xs lg:text-sm font-bold text-slate-200 line-clamp-2">${item.title}</h4>
					</a>
				`;
			});
			hasNews = true;
		}
	} catch (e) {}

	const rssUrl = `https://news.google.com/rss/search?q=${ticker}+saham+OR+bursa+indonesia+OR+ekonomi&hl=id&gl=ID&ceid=ID:id`;
	const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
	try {
		const response = await fetch(apiUrl);
		const data = await response.json();
		if (data.status === 'ok' && data.items && data.items.length > 0) {
			data.items.slice(0, 9).forEach(item => {
				const date = new Date(item.pubDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
				container.innerHTML += `
					<a href="${item.link}" target="_blank" class="block p-3.5 bg-slate-950/10 hover:bg-slate-800 border border-slate-800 rounded-lg transition duration-150">
						<div class="flex items-center gap-1.5 mb-2">
							<span class="text-[9px] lg:text-[10px] bg-sky-400/20 text-sky-400 font-bold px-2 py-0.5 rounded border border-sky-400/30">${item.source?.title || 'Google News'}</span>
							<span class="text-[10px] lg:text-xs text-white">${date}</span>
						</div>
						<h4 class="text-xs lg:text-sm font-bold text-slate-200 line-clamp-2">${item.title}</h4>
					</a>
				`;
			});
			hasNews = true;
		}
	} catch (e) {}

	if (hasNews) AudioFX.playSuccess();
	else container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-4">Tidak ada berita khusus ditemukan untuk ${ticker} hari ini.</div>`;
}

async function fetchCorporateAction(ticker) {
	const container = document.getElementById('corporateContainer');
	container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-10 lg:col-span-3"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-fuchsia-400"></i> Memuat Kalender & Aksi Korporasi...</div>`;
	if (window.lucide) lucide.createIcons();

	let calendarUI = '';
	try {
		const calUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}.JK?modules=calendarEvents`;
		const proxies = [
			`https://api.allorigins.win/get?url=${encodeURIComponent(calUrl)}`,
			`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(calUrl)}`,
			`https://corsproxy.io/?${encodeURIComponent(calUrl)}`
		];
		let calResult = null;
		for (let p of proxies) {
			const res = await fetch(p);
			// const res = await fetch(p, { signal: AbortSignal.timeout(4000) });
			if (res.ok) {
				let data = await res.json();
				if (p.includes('allorigins')) data = JSON.parse(data.contents);
				calResult = data?.quoteSummary?.result?.[0]?.calendarEvents;
				if (calResult) break;
			}
		}
		
		if (calResult) {
			const divDate = calResult.exDividendDate?.fmt || 'Belum Terjadwal';
			const earnDate = calResult.earnings?.earningsDate?.[0]?.fmt || 'Belum Terjadwal';
			
			calendarUI = `
				<div class="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-2 gap-3 mb-3">
					<div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
						<div>
							<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Ex-Date Dividen</span>
							<span class="text-emerald-400 font-bold text-xs lg:text-sm">${divDate}</span>
						</div>
						<i data-lucide="coins" class="w-6 h-6 text-emerald-500/30"></i>
					</div>
					<div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
						<div>
							<span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Rilis Laporan (Earnings)</span>
							<span class="text-cyan-400 font-bold text-xs lg:text-sm">${earnDate}</span>
						</div>
						<i data-lucide="file-bar-chart-2" class="w-6 h-6 text-cyan-500/30"></i>
					</div>
				</div>
			`;
		}
	} catch(e) {}

	const query = encodeURIComponent(`${ticker} AND (dividen OR RUPS OR "right issue" OR "stock split" OR buyback OR tender OR IPO)`);
	const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`;
	const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

	try {
		const response = await fetch(apiUrl);
		const data = await response.json();
		container.innerHTML = calendarUI; 
		
		if (data.status === 'ok' && data.items && data.items.length > 0) {
			data.items.slice(0, 9).forEach(item => {
				const date = new Date(item.pubDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
				container.innerHTML += `
					<a href="${item.link}" target="_blank" class="block p-3.5 bg-slate-950/10 hover:bg-slate-800 border border-slate-800 rounded-lg transition duration-150">
						<div class="flex items-center gap-1.5 mb-1">
							<span class="text-[9px] lg:text-[10px] bg-fuchsia-500/20 text-fuchsia-400 font-bold px-2 py-0.5 rounded border border-fuchsia-500/30">Aksi Korporasi</span>
							<span class="text-[10px] lg:text-xs text-white">${date}</span>
						</div>
						<h4 class="text-xs lg:text-sm font-bold text-slate-200 line-clamp-2">${item.title}</h4>
					</a>
				`;
			});
			if (window.lucide) lucide.createIcons();
			AudioFX.playSuccess();
		} else if (!calendarUI) {
			container.innerHTML = `<div class="text-center text-white text-xs lg:text-sm py-8 lg:col-span-3">Belum ada kabar aksi korporasi / kalender terbaru untuk ${ticker}.</div>`;
		}
	} catch (e) {
		container.innerHTML = calendarUI + `<div class="text-center text-slate-400 text-xs lg:text-sm py-8 lg:col-span-3">Gagal memuat berita aksi korporasi.</div>`;
	}
}

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
// 24. BACKGROUND WORKER & TRIGGER CELEBRATION
// ==========================================
function startBackgroundAutoCache() {
	const FIVE_MINUTES = 5 * 60 * 1000;
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

// ==========================================
// 25. PENDETEKSI PERANGKAT (TENTANG APLIKASI)
// ==========================================
function loadDeviceSystemInfo() {
	const osEl = document.getElementById('infoOS');
	const browserEl = document.getElementById('infoBrowser');
	const hwEl = document.getElementById('infoHardware');
	const gpuEl = document.getElementById('infoGPU');
	
	if (!osEl) return;

	// 1. Deteksi Sistem Operasi
	const ua = navigator.userAgent;
	let os = "Tidak Diketahui";
	if (ua.indexOf("Win") !== -1) os = "Windows OS";
	else if (ua.indexOf("Mac") !== -1 && ua.indexOf("iPhone") === -1 && ua.indexOf("iPad") === -1) os = "MacOS";
	else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS (Apple)";
	else if (ua.indexOf("Android") !== -1) os = "Android OS";
	else if (ua.indexOf("Linux") !== -1) os = "Linux";
	
	// 2. Deteksi Nama Browser
	let browser = "Lainnya";
	if (ua.indexOf("Edg") !== -1) browser = "Microsoft Edge";
	else if (ua.indexOf("Chrome") !== -1) browser = "Google Chrome (Blink)";
	else if (ua.indexOf("Firefox") !== -1) browser = "Mozilla Firefox (Gecko)";
	else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Apple Safari (WebKit)";
	else if (ua.indexOf("Opera") !== -1 || ua.indexOf("OPR") !== -1) browser = "Opera";
	
	// 3. Deteksi Core Prosesor (CPU) & RAM
	const cores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " Cores" : "N/A";
	const ram = navigator.deviceMemory ? "~" + navigator.deviceMemory + " GB" : "N/A";
	
	// 4. Deteksi Chipset Grafis (GPU WebGL)
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
	} catch(e) {
		console.warn("GPU deteksi diblokir oleh peramban.");
	}

	// 5. Injeksi ke HTML
	osEl.innerText = os;
	browserEl.innerText = browser;
	hwEl.innerText = `${cores} | RAM: ${ram}`;
	
	gpu = gpu.replace(/ANGLE \(\vert{}\)|Direct3D.*|OpenGL.*/g, '').trim(); 
	gpuEl.innerText = gpu.length > 60 ? gpu.substring(0, 60) + "..." : gpu;
	gpuEl.title = gpu; // Tooltip akan muncul jika tulisan terlalu panjang
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

function checkUrlParamTicker() {
	const urlParams = new URLSearchParams(window.location.search);
	const tickerParam = urlParams.get('ticker');
	if (tickerParam) currentTicker = tickerParam.toUpperCase();
}

// ==========================================
// 26. MULTI-TIMEFRAME AI ANALYSIS
// ==========================================
async function analyzeAITimeframe(tfLabel) {
	const targetSymbol = `${currentTicker}.JK`;
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
// 29. FITUR BSJP SCREENER (REAL-TIME ENGINE)
// ==========================================
let isBSJPScanning = false;
let bsjpCooldownTimer = null;

async function startBSJPProcess() {
	if (isBSJPScanning) return;
	isBSJPScanning = true;

	const btn = document.getElementById('btnStartBSJP');
	const container = document.getElementById('bsjpListContainer');
	
	if (btn.disabled && btn.innerHTML.includes('Pending')) {
		isBSJPScanning = false;
		return;
	}
	
	btn.disabled = true;
	btn.className = "w-full sm:w-auto bg-slate-800 text-white font-bold px-6 py-2.5 rounded-lg border border-slate-700 flex items-center justify-center gap-2 shrink-0 cursor-not-allowed opacity-70";
	btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-orange-400"></i> Memindai BSJP...`;
	if (window.lucide) lucide.createIcons();
	
	container.innerHTML = `<div class="text-center text-slate-400 text-xs py-12 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-900/30"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500"></i> Menyaring saham yang cocok untuk BSJP...</div>`;
	
	const shuffledWatchlist = [...uniqueRadarWatchlist].sort(() => 0.5 - Math.random());
	let bsjpCandidates = [];

	const currentHour = new Date().getHours();
	let targetRasio = currentHour < 11 ? 0.5 : (currentHour < 14 ? 0.8 : 1.2);

	try {
		for (const ticker of shuffledWatchlist) {
			const cachedItem = getCachedStockData(ticker);
			if (cachedItem && cachedItem.price) {
				// Strategi 1: Moderat (Original)
				const isStrategi1 = cachedItem.currentValuation > 5000000000 && cachedItem.price >= cachedItem.ma10 && cachedItem.volRatio >= 2 && cachedItem.changePct > 0 && cachedItem.changePct < 10;
				
				// Strategi 2: Ketat (Baru)
				const isStrategi2 = cachedItem.currentValuation > 5000000000 && cachedItem.price > cachedItem.ma10 && cachedItem.volRatio > 2 && cachedItem.changePct >= 0 && cachedItem.changePct <= 10;
				
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
					
					// Strategi 1: Moderat (Original)
					const isStrategi1 = item.volRatio >= 2 && item.currentValuation > 5000000000 && item.price >= item.ma10 && item.changePct > 0 && item.changePct < 10;
					
					// Strategi 2: Ketat (Baru)
					const isStrategi2 = item.volRatio > 2 && item.currentValuation > 5000000000 && item.price > item.ma10 && item.changePct >= 0 && item.changePct <= 10;
					
					if (isStrategi1 || isStrategi2) {
						if (!bsjpCandidates.some(c => c.ticker === item.ticker)) {
							bsjpCandidates.push(item);
						}
					}
				}
				if (bsjpCandidates.length >= 10) break;
			}
		}
		
		if (bsjpCandidates.length === 0) {
			container.innerHTML = `<div class="text-center text-slate-400 text-xs py-8 lg:col-span-2 border border-slate-800 rounded-xl bg-slate-900/30">Belum ada saham yang memenuhi syarat ketat BSJP pada sesi ini.</div>`;
		} else {
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
							Harga Last: <strong class="text-white">Rp ${price.toLocaleString('id-ID')}</strong> 
						</span>
					</div>
				</div>
				
				<!-- Trading Plan Matrix (Fibo) -->
				<div class="grid grid-cols-2 gap-2 text-[10px] lg:text-xs mt-3">
					<div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left relative overflow-hidden">
						<div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50"></div>
						<span class="text-slate-400 block mb-1 flex items-center gap-1.5 font-medium uppercase tracking-wider text-[9px]"><i data-lucide="target" class="w-3 h-3 text-amber-400"></i> Entry Sore (Clossing)</span>
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
							<span><strong class="text-emerald-400">Posisi Tren:</strong> Harga ditutup di atas garis Moving Average 5 (Rp ${item.ma5.toLocaleString('id-ID')}). Tren jangka pendek valid ke atas.</span>
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

// Inisialisasi
document.addEventListener("DOMContentLoaded", () => {
    applyGlobalButtonGradients();
    
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        for (let m of mutations) {
            if (m.addedNodes.length > 0) {
                shouldUpdate = true;
                break;
            }
        }
        if (shouldUpdate) {
            setTimeout(applyGlobalButtonGradients, 1000);
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});

// ANTI LAG
/*function processScreenerAntiLag(stockList, processFn, onComplete) {
    const BATCH_SIZE = 20; 
    const MAX_BATCH_LIMIT = 3; // Maksimal 60 saham diproses per loop
    let currentIndex = 0;
    let batchCount = 0;

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

// ==========================================
// INISIALISASI UTAMA
// ==========================================
document.getElementById('stockTitle').innerText = `IDX:${currentTicker}`;
document.getElementById('aiHeaderTicker').innerText = `[${currentTicker}] — KONDISI TEKNIKAL`;
document.getElementById('newsTickerLabel').innerText = currentTicker;
document.getElementById('fundTickerLabel').innerText = currentTicker;
document.getElementById('rrrTickerLabel').innerText = currentTicker;
document.getElementById('alertTickerLabel').innerText = currentTicker;
document.getElementById('corpTickerLabel').innerText = currentTicker;
document.getElementById('peerTickerLabel').innerText = currentTicker;

checkVIPAuth();
initSystemSettings();
initSearchSuggestions();
updateMarketBadge();
generateAISignal(currentTicker);
renderChart(currentTicker);
renderAllAlerts();
renderJournalTable();
renderPaperTradingUI();
renderTechnicalGauge(currentTicker);
//renderFundamentalWidget(currentTicker);
cleanExpiredCache();
checkUrlParamTicker();
checkNotificationStatus();
checkWelcomeModal();
fetchStockNews(currentTicker);
fetchCorporateAction(currentTicker);
fetchRealtimeFundamentals(currentTicker);
fetchYahooTrending();
loadDeviceSystemInfo();

document.addEventListener('DOMContentLoaded', () => {
    loadLiveMacro();
});

startBackgroundAutoCache();
setInterval(() => {
	ptRefreshPortoPrices(true);
}, 300000);