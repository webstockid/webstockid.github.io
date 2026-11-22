// ============================================================
// player.js — Video player + HLS
// ============================================================

let hlsInstance = null;

export function openPlayer(videoEl, modalEl, infoEl, streamUrl, title) {
	modalEl.classList.remove('hidden');
	modalEl.classList.add('flex');

	if (hlsInstance) {
		hlsInstance.destroy();
		hlsInstance = null;
	}
	videoEl.removeAttribute('src');
	videoEl.load();

	if (infoEl) infoEl.textContent = title || '';

	if (streamUrl) {
		if (window.Hls && Hls.isSupported()) {
			hlsInstance = new Hls();
			hlsInstance.loadSource(streamUrl);
			hlsInstance.attachMedia(videoEl);
		} else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
			videoEl.src = streamUrl;
		} else {
			videoEl.src = streamUrl;
		}
		videoEl.play().catch(() => {});
	}

	return { close: () => closePlayer(videoEl, modalEl) };
}

export function closePlayer(videoEl, modalEl) {
	modalEl.classList.add('hidden');
	modalEl.classList.remove('flex');
	videoEl.pause();
	videoEl.removeAttribute('src');
	videoEl.load();

	if (hlsInstance) {
		hlsInstance.destroy();
		hlsInstance = null;
	}
}

export function toggleFullscreen(containerEl) {
	if (document.fullscreenElement) {
		document.exitFullscreen();
	} else {
		containerEl.requestFullscreen().catch(() => {});
	}
}