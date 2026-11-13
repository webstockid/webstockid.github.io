// ============================================================
// app.js — Entry point. Orkestrasi semua modul.
// ============================================================

import * as api from './api.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as player from './player.js';
import * as profile from './profile.js';
import * as settings from './settings.js';

// ---------- Elemen global ----------
const searchInput = document.getElementById('searchInput');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const btnClosePlayer = document.getElementById('btnClosePlayer');
const btnProfile = document.getElementById('btnProfile');
const btnSettings = document.getElementById('btnSettings');
const modalProfile = document.getElementById('modalProfile');
const modalSettings = document.getElementById('modalSettings');

let searchTimeout = null;
let currentDrama = null;
let currentEpisodes = [];
let currentEpIndex = 0;

// ---------- Init ----------
async function init() {
	settings.loadSettings();
	setupModals();
	setupTabs();
	setupProfile();
	setupSettings();
	setupPlayerControls();
	await loadTrending();
}

async function loadTrending() {
	ui.showLoading();
	try {
		const trending = await api.getTrending();
		ui.renderDramaList(trending, 'Trending Drama China');
	} catch (err) {
		console.error('[App] Gagal memuat trending:', err);
		ui.showError('Gagal memuat data. Coba lagi nanti.');
	}
}

// ---------- Pencarian global ----------
searchInput.addEventListener('input', () => {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(async () => {
		const query = searchInput.value.trim();
		if (query.length < 2) {
			loadTrending();
			return;
		}
		ui.showLoading();
		try {
			const results = await api.searchDramas(query);
			ui.renderDramaList(results, `Hasil: "${query}"`);
		} catch (err) {
			console.error('[App] Gagal mencari:', err);
			ui.showError('Pencarian gagal.');
		}
	}, 500);
});

// ---------- Modal setup ----------
function setupModals() {
	btnProfile.addEventListener('click', () => openModal(modalProfile));
	btnSettings.addEventListener('click', () => openModal(modalSettings));

	document.querySelectorAll('[data-close]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const target = document.getElementById(btn.dataset.close);
			closeModal(target);
		});
	});

	[modalProfile, modalSettings].forEach((modal) => {
		modal.addEventListener('click', (e) => {
			if (e.target === modal) closeModal(modal);
		});
	});
}

function openModal(modal) {
	if (!modal) return;
	modal.classList.remove('hidden');
	modal.classList.add('flex');
	settings.playClickSound();
	settings.vibrate(10);

	const activeTab = modal.querySelector('.tab-btn.active');
	if (activeTab) {
		const tabName = activeTab.dataset.tab;
		if (modal.id === 'modalProfile') profile.renderProfilePanel(tabName);
	}
}

function closeModal(modal) {
	if (!modal) return;
	modal.classList.add('hidden');
	modal.classList.remove('flex');
}

// ---------- Tab navigation generik ----------
function setupTabs() {
	document.querySelectorAll('[data-tabs]').forEach((tabGroup) => {
		tabGroup.querySelectorAll('.tab-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const tabName = btn.dataset.tab;
				const parentModal = tabGroup.closest('.modal-overlay');

				tabGroup.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');

				parentModal.querySelectorAll('.tab-panel').forEach((panel) => {
					const isActive = panel.dataset.panel === tabName;
					panel.classList.toggle('hidden', !isActive);
					panel.classList.toggle('active', isActive);
				});

				if (parentModal.id === 'modalProfile') {
					profile.renderProfilePanel(tabName);
				}

				settings.playClickSound();
				settings.vibrate(10);
			});
		});
	});
}

// ---------- Profile modal ----------
function setupProfile() {
	const nameInput = document.getElementById('profileNameInput');
	const btnSaveName = document.getElementById('btnSaveProfileName');
	const avatarImg = document.getElementById('profileAvatar');
	const avatarUpload = document.getElementById('avatarUpload');

	nameInput.value = localStorage.getItem('dracin_profile_name') || '';
	avatarImg.src = profile.getAvatar() || defaultAvatarDataUrl();

	btnSaveName.addEventListener('click', () => {
		localStorage.setItem('dracin_profile_name', nameInput.value.trim());
		settings.playClickSound();
		settings.vibrate(15);
		btnSaveName.innerHTML = '<i class="fa-solid fa-check"></i> Tersimpan';
		setTimeout(() => {
			btnSaveName.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Nama';
		}, 1500);
	});

	avatarUpload.addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			avatarImg.src = ev.target.result;
			profile.setAvatar(ev.target.result);
		};
		reader.readAsDataURL(file);
	});

	document.getElementById('btnExportData').addEventListener('click', () => {
		profile.exportAllData();
	});

	document.getElementById('importDataInput').addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				profile.importAllData(ev.target.result);
				alert('Data berhasil diimpor. Halaman akan dimuat ulang.');
				location.reload();
			} catch (err) {
				alert('Gagal mengimpor: ' + err.message);
			}
		};
		reader.readAsText(file);
	});

	document.getElementById('btnDeleteData').addEventListener('click', () => {
		if (confirm('Yakin ingin menghapus semua data? Tindakan ini tidak bisa dibatalkan.')) {
			profile.deleteAllData();
			location.reload();
		}
	});
}

function defaultAvatarDataUrl() {
	return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect fill=%22%23222%22 width=%2280%22 height=%2280%22/%3E%3Ccircle cx=%2240%22 cy=%2230%22 r=%2214%22 fill=%22%23555%22/%3E%3Cpath d=%22M10 75 Q10 48 40 48 Q70 48 70 75%22 fill=%22%23555%22/%3E%3C/svg%3E';
}

// ---------- Settings modal ----------
function setupSettings() {
	const themeSel = document.getElementById('settingTheme');
	themeSel.value = settings.getSetting('theme');
	themeSel.addEventListener('change', () => settings.updateSetting('theme', themeSel.value));

	const swatches = document.querySelectorAll('.accent-swatch');
	swatches.forEach((sw) => {
		sw.classList.toggle('selected', sw.dataset.color === settings.getSetting('accent'));
		sw.addEventListener('click', () => {
			swatches.forEach((s) => s.classList.remove('selected'));
			sw.classList.add('selected');
			settings.updateSetting('accent', sw.dataset.color);
		});
	});

	const fontSize = document.getElementById('settingFontSize');
	const fontSizeVal = document.getElementById('fontSizeVal');
	fontSize.value = settings.getSetting('fontSize');
	fontSizeVal.textContent = fontSize.value + 'px';
	fontSize.addEventListener('input', () => {
		fontSizeVal.textContent = fontSize.value + 'px';
		settings.updateSetting('fontSize', Number(fontSize.value));
	});

	const fontFamily = document.getElementById('settingFontFamily');
	fontFamily.value = settings.getSetting('fontFamily');
	fontFamily.addEventListener('change', () => settings.updateSetting('fontFamily', fontFamily.value));

	const fontWeight = document.getElementById('settingFontWeight');
	const fontWeightVal = document.getElementById('fontWeightVal');
	fontWeight.value = settings.getSetting('fontWeight');
	fontWeightVal.textContent = fontWeight.value;
	fontWeight.addEventListener('input', () => {
		fontWeightVal.textContent = fontWeight.value;
		settings.updateSetting('fontWeight', Number(fontWeight.value));
	});

	bindToggle('settingAnimations', 'animations');
	bindToggle('settingSound', 'sound');
	bindToggle('settingVibration', 'vibration');

	bindRange('settingVolume', 'volume', 'volumeVal', '%');
	bindRange('settingBrightness', 'brightness', 'brightnessVal', '%');

	document.getElementById('btnExportSettings').addEventListener('click', () => {
		profile.exportAllData();
	});

	document.getElementById('importSettingsInput').addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				profile.importAllData(ev.target.result);
				location.reload();
			} catch (err) {
				alert('Gagal impor: ' + err.message);
			}
		};
		reader.readAsText(file);
	});

	document.getElementById('btnDeleteSettings').addEventListener('click', () => {
		if (confirm('Hapus semua data?')) {
			profile.deleteAllData();
			location.reload();
		}
	});
}

function bindToggle(id, key) {
	const el = document.getElementById(id);
	el.checked = !!settings.getSetting(key);
	el.addEventListener('change', () => settings.updateSetting(key, el.checked));
}

function bindRange(id, key, valId, suffix = '') {
	const el = document.getElementById(id);
	const val = document.getElementById(valId);
	el.value = settings.getSetting(key);
	if (val) val.textContent = el.value + suffix;
	el.addEventListener('input', () => {
		if (val) val.textContent = el.value + suffix;
		settings.updateSetting(key, Number(el.value));
	});
}

// ---------- Player controls ----------
function setupPlayerControls() {
	btnClosePlayer.addEventListener('click', () => {
		player.closePlayer(videoPlayer, playerModal);
	});

	playerModal.addEventListener('click', (e) => {
		if (e.target === playerModal) player.closePlayer(videoPlayer, playerModal);
	});

	document.getElementById('btnLike').addEventListener('click', () => {
		if (!currentDrama) return;
		const liked = profile.toggleLike(currentDrama);
		updateLikeButton(liked);
		settings.playClickSound();
		settings.vibrate(15);
	});

	document.getElementById('btnSave').addEventListener('click', () => {
		if (!currentDrama) return;
		const saved = profile.toggleSave(currentDrama);
		updateSaveButton(saved);
		settings.playClickSound();
		settings.vibrate(15);
	});

	document.getElementById('btnPrevEp').addEventListener('click', () => {
		if (currentEpIndex > 0) playEpisode(currentEpIndex - 1);
	});
	document.getElementById('btnNextEp').addEventListener('click', () => {
		if (currentEpIndex < currentEpisodes.length - 1) playEpisode(currentEpIndex + 1);
	});
}

function updateLikeButton(liked) {
	const btn = document.getElementById('btnLike');
	btn.classList.toggle('active', liked);
	btn.querySelector('i').className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
}

function updateSaveButton(saved) {
	const btn = document.getElementById('btnSave');
	btn.classList.toggle('active', saved);
	btn.querySelector('i').className = saved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
}

// ---------- Drama selected ----------
window.addEventListener('dramaSelected', async (event) => {
	const { id, title } = event.detail;
	storage.saveToHistory({ id, title });

	try {
		const episodes = await api.getEpisodes(id);
		if (!episodes || episodes.length === 0) {
			alert('Episode tidak tersedia.');
			return;
		}

		currentDrama = { id, title };
		currentEpisodes = episodes;
		currentEpIndex = 0;

		document.getElementById('playerDramaTitle').textContent = title;
		document.getElementById('playerEpisodeCount').textContent = episodes.length;
		updateLikeButton(profile.isLiked(id));
		updateSaveButton(profile.isSaved(id));
		renderEpisodeList();

		playEpisode(0);
		playerModal.classList.remove('hidden');
		playerModal.classList.add('flex');
	} catch (err) {
		console.error('[App] Gagal memuat episode:', err);
		alert('Gagal memuat episode: ' + err.message);
	}
});

function playEpisode(index) {
	const ep = currentEpisodes[index];
	if (!ep) return;
	const url = ep.url || ep.play_url || ep.video_url || ep.m3u8 || '';
	if (!url) {
		alert('Link video tidak ditemukan.');
		return;
	}

	currentEpIndex = index;
	const title = `${currentDrama.title} — Episode ${index + 1}`;
	player.openPlayer(videoPlayer, playerModal, null, url, title);

	document.getElementById('btnPrevEp').disabled = index === 0;
	document.getElementById('btnNextEp').disabled = index === currentEpisodes.length - 1;

	document.querySelectorAll('.episode-chip').forEach((chip, i) => {
		const isActive = i === index;
		chip.classList.toggle('bg-accent', isActive);
		chip.classList.toggle('text-white', isActive);
		chip.classList.toggle('bg-white/5', !isActive);
		chip.classList.toggle('hover:bg-white/10', !isActive);
	});
}

function renderEpisodeList() {
	const list = document.getElementById('episodeList');
	list.innerHTML = currentEpisodes
		.map(
			(ep, i) => `
		<button
			class="episode-chip shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs transition ${
				i === 0 ? 'bg-accent text-white' : 'bg-white/5 hover:bg-white/10'
			}"
			data-index="${i}"
		>
			Episode ${i + 1}
		</button>
	`
		)
		.join('');

	list.querySelectorAll('.episode-chip').forEach((chip) => {
		chip.addEventListener('click', () => {
			playEpisode(Number(chip.dataset.index));
			settings.playClickSound();
		});
	});
}

// ---------- Start ----------
init();