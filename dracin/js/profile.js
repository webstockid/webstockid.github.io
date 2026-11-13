// ============================================================
// profile.js — Logika modal profile (nama, avatar, histori,
// like, simpan, grafik, export/import/hapus)
// ============================================================

import * as storage from './storage.js';

const KEY_AVATAR = 'dracin_avatar';
const KEY_LIKES = 'dracin_likes';
const KEY_SAVED = 'dracin_saved';

// ---------- Data helpers ----------
export function getLikes() {
	try {
		return JSON.parse(localStorage.getItem(KEY_LIKES) || '[]');
	} catch {
		return [];
	}
}

export function getSaved() {
	try {
		return JSON.parse(localStorage.getItem(KEY_SAVED) || '[]');
	} catch {
		return [];
	}
}

function saveList(key, list) {
	localStorage.setItem(key, JSON.stringify(list));
}

export function toggleLike(drama) {
	const likes = getLikes();
	const idx = likes.findIndex((d) => d.id === drama.id);
	if (idx >= 0) {
		likes.splice(idx, 1);
		saveList(KEY_LIKES, likes);
		return false;
	}
	likes.unshift({ ...drama, likedAt: Date.now() });
	saveList(KEY_LIKES, likes);
	return true;
}

export function toggleSave(drama) {
	const saved = getSaved();
	const idx = saved.findIndex((d) => d.id === drama.id);
	if (idx >= 0) {
		saved.splice(idx, 1);
		saveList(KEY_SAVED, saved);
		return false;
	}
	saved.unshift({ ...drama, savedAt: Date.now() });
	saveList(KEY_SAVED, saved);
	return true;
}

export function isLiked(id) {
	return getLikes().some((d) => d.id === id);
}

export function isSaved(id) {
	return getSaved().some((d) => d.id === id);
}

// ---------- Render panel tab ----------
export function renderProfilePanel(tab) {
	const history = storage.getHistory();
	const likes = getLikes();
	const saved = getSaved();

	if (tab === 'stats') {
		renderStatsChart(history, likes, saved);
		return;
	}

	const map = {
		history: { data: history, el: 'panelHistory', empty: 'Belum ada histori.' },
		likes: { data: likes, el: 'panelLikes', empty: 'Belum ada yang di-like.' },
		saved: { data: saved, el: 'panelSaved', empty: 'Belum ada yang disimpan.' },
	};

	const conf = map[tab];
	if (!conf) return;

	const el = document.getElementById(conf.el);
	if (!el) return;

	if (conf.data.length === 0) {
		el.innerHTML = `<p class="empty-msg">${conf.empty}</p>`;
		return;
	}

	el.innerHTML = conf.data
		.map(
			(item) => `
		<div class="history-item" data-id="${item.id}">
			<div class="history-item-title">${escapeHtml(item.title || 'Tanpa Judul')}</div>
			<div class="history-item-meta">${new Date(
				item.watchedAt || item.likedAt || item.savedAt || Date.now()
			).toLocaleDateString('id-ID')}</div>
		</div>
	`
		)
		.join('');
}

// ---------- Grafik canvas sederhana ----------
function renderStatsChart(history, likes, saved) {
	const canvas = document.getElementById('statsChart');
	if (!canvas) return;

	// Sesuaikan resolusi agar tajam di retina
	const dpr = window.devicePixelRatio || 1;
	const cssW = canvas.clientWidth || 400;
	const cssH = 200;
	canvas.width = cssW * dpr;
	canvas.height = cssH * dpr;
	canvas.style.height = cssH + 'px';

	const ctx = canvas.getContext('2d');
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, cssW, cssH);

	const data = [
		{ label: 'Histori', value: history.length, color: '#7c8fb8' },
		{ label: 'Like', value: likes.length, color: '#b88c9a' },
		{ label: 'Simpan', value: saved.length, color: '#8fa88c' },
	];

	const max = Math.max(...data.map((d) => d.value), 1);
	const barW = Math.min(60, cssW / 6);
	const gap = (cssW - barW * data.length) / (data.length + 1);

	data.forEach((d, i) => {
		const barH = (d.value / max) * (cssH - 60);
		const x = gap + i * (barW + gap);
		const y = cssH - 40 - barH;

		// Gradient glossy
		const grad = ctx.createLinearGradient(0, y, 0, y + barH);
		grad.addColorStop(0, d.color);
		grad.addColorStop(1, d.color + '88');
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.roundRect(x, y, barW, barH, [8, 8, 0, 0]);
		ctx.fill();

		ctx.fillStyle = '#f0f0f5';
		ctx.font = '600 12px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(d.value, x + barW / 2, y - 6);

		ctx.fillStyle = '#a0a0b0';
		ctx.font = '11px sans-serif';
		ctx.fillText(d.label, x + barW / 2, cssH - 18);
	});
}

// ---------- Avatar ----------
export function getAvatar() {
	return localStorage.getItem(KEY_AVATAR) || '';
}

export function setAvatar(dataUrl) {
	localStorage.setItem(KEY_AVATAR, dataUrl);
}

// ---------- Export / Import / Hapus ----------
export function exportAllData() {
	const bundle = {
		version: 1,
		exportedAt: Date.now(),
		history: storage.getHistory(),
		likes: getLikes(),
		saved: getSaved(),
		settings: storage.getSettings(),
		avatar: getAvatar(),
		profileName: localStorage.getItem('dracin_profile_name') || '',
	};

	const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `dracin-backup-${Date.now()}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

export function importAllData(jsonText) {
	const bundle = JSON.parse(jsonText);
	if (Array.isArray(bundle.history)) saveList('dracin_history', bundle.history);
	if (Array.isArray(bundle.likes)) saveList(KEY_LIKES, bundle.likes);
	if (Array.isArray(bundle.saved)) saveList(KEY_SAVED, bundle.saved);
	if (bundle.settings) storage.saveSettings(bundle.settings);
	if (bundle.avatar) setAvatar(bundle.avatar);
	if (bundle.profileName) localStorage.setItem('dracin_profile_name', bundle.profileName);
}

export function deleteAllData() {
	localStorage.removeItem('dracin_history');
	localStorage.removeItem(KEY_LIKES);
	localStorage.removeItem(KEY_SAVED);
	localStorage.removeItem(KEY_AVATAR);
	localStorage.removeItem('dracin_settings');
	localStorage.removeItem('dracin_profile_name');
}

// ---------- Helper ----------
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}