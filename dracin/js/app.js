// ============================================================
// app.js — Orkestrasi: memanggil API, merender UI, menangani event.
// ============================================================

import * as api from './api.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as player from './player.js';

// ----- Elemen global -----
const searchInput = document.getElementById('searchInput');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const btnClosePlayer = document.getElementById('btnClosePlayer');
const playerInfo = document.getElementById('playerInfo');

let searchTimeout = null;

// ----- Inisialisasi -----
async function init() {
	ui.showLoading();

	try {
		const trending = await api.getTrending();
		ui.renderDramaList(trending, '🔥 Trending Drama China');
	} catch (err) {
		console.error('Gagal memuat trending:', err);
		ui.showError('Gagal memuat data. Coba lagi nanti.');
	}
}

// ----- Pencarian (debounce) -----
searchInput.addEventListener('input', () => {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(async () => {
		const query = searchInput.value.trim();
		if (query.length < 2) {
			init(); // kembali ke trending jika kosong
			return;
		}

		ui.showLoading();
		try {
			const results = await api.searchDramas(query);
			ui.renderDramaList(results, `Hasil: "${query}"`);
		} catch (err) {
			console.error('Gagal mencari:', err);
			ui.showError('Pencarian gagal.');
		}
	}, 500);
});

// Ganti handler dramaSelected di app.js dengan ini:

window.addEventListener('dramaSelected', async (event) => {
	const { id, title } = event.detail;

	storage.saveToHistory({ id, title });

	try {
		const episodes = await api.getEpisodes(id);
		console.log('[App] Episodes:', episodes);

		if (!episodes || episodes.length === 0) {
			alert('Episode tidak tersedia untuk drama ini.');
			return;
		}

		// Ambil URL play episode pertama
		const streamUrl = await api.getPlayUrl(id, 1);
		console.log('[App] Stream URL:', streamUrl);

		if (!streamUrl) {
			alert('Link streaming tidak ditemukan. Coba drama lain.');
			return;
		}

		player.openPlayer(videoPlayer, playerModal, playerInfo, streamUrl, title);
	} catch (err) {
		console.error('[App] Error:', err);
		alert(`Gagal memuat: ${err.message}`);
	}
});

// ----- Tutup player -----
btnClosePlayer.addEventListener('click', () => {
	player.closePlayer(videoPlayer, playerModal);
});

// Klik backdrop untuk tutup
playerModal.addEventListener('click', (e) => {
	if (e.target === playerModal) {
		player.closePlayer(videoPlayer, playerModal);
	}
});

// ----- Jalankan -----
init();