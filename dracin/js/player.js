// ============================================================
// player.js — Mengelola video player dan HLS.
// ============================================================

let hlsInstance = null;

export function openPlayer(videoEl, modalEl, infoEl, streamUrl, title) {
	// Tampilkan modal
	modalEl.classList.remove('hidden');

	// Bersihkan instance sebelumnya
	if (hlsInstance) {
		hlsInstance.destroy();
		hlsInstance = null;
	}
	videoEl.removeAttribute('src');
	videoEl.load();

	// Info
	if (infoEl) infoEl.textContent = title || '';

	// Inisialisasi stream
	if (streamUrl) {
		if (window.Hls && Hls.isSupported()) {
			hlsInstance = new Hls();
			hlsInstance.loadSource(streamUrl);
			hlsInstance.attachMedia(videoEl);
		} else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
			// Safari native HLS
			videoEl.src = streamUrl;
		} else {
			videoEl.src = streamUrl; // fallback: coba MP4 langsung
		}
		videoEl.play().catch(() => {
			// Autoplay diblokir browser; user harus klik play manual
		});
	}

	return { close: () => closePlayer(videoEl, modalEl) };
}

export function closePlayer(videoEl, modalEl) {
	modalEl.classList.add('hidden');
	videoEl.pause();
	videoEl.removeAttribute('src');
	videoEl.load();

	if (hlsInstance) {
		hlsInstance.destroy();
		hlsInstance = null;
	}
}

// Fullscreen manual (jika controls native tidak ada)
export function toggleFullscreen(containerEl) {
	if (document.fullscreenElement) {
		document.exitFullscreen();
	} else {
		containerEl.requestFullscreen().catch(() => {});
	}
}