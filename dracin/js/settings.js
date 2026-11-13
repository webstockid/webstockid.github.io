// ============================================================
// settings.js — Terapkan & simpan pengaturan user
// ============================================================

import * as storage from './storage.js';

const DEFAULTS = {
	theme: 'dark',
	accent: '#7c8fb8',
	fontSize: 16,
	fontFamily: 'system-ui, sans-serif',
	fontWeight: 400,
	animations: true,
	sound: false,
	vibration: false,
	volume: 100,
	brightness: 100,
};

let current = { ...DEFAULTS };

export function loadSettings() {
	const saved = storage.getSettings();
	current = { ...DEFAULTS, ...saved };
	applySettings(current);
	return current;
}

export function updateSetting(key, value) {
	current[key] = value;
	storage.saveSettings({ [key]: value });
	applySettings(current);
}

export function getSetting(key) {
	return current[key];
}

function applySettings(s) {
	document.documentElement.style.fontSize = s.fontSize + 'px';
	document.body.style.fontFamily = s.fontFamily;
	document.body.style.fontWeight = s.fontWeight;

	document.documentElement.style.setProperty('--accent', s.accent);
	document.documentElement.style.setProperty('--accent-hover', shadeColor(s.accent, 20));

	applyTheme(s.theme);

	document.body.classList.toggle('no-anim', !s.animations);

	document.body.style.filter = s.brightness < 100 ? `brightness(${s.brightness / 100})` : '';
}

function applyTheme(theme) {
	document.body.dataset.theme = theme;
	const root = document.documentElement;

	if (theme === 'light') {
		root.style.setProperty('--bg-primary', '#f5f5f7');
		root.style.setProperty('--bg-secondary', '#ffffff');
		root.style.setProperty('--bg-card', '#ebebef');
		root.style.setProperty('--text-primary', '#1a1a24');
		root.style.setProperty('--text-secondary', '#5a5a6a');
	} else if (theme === 'amoled') {
		root.style.setProperty('--bg-primary', '#000000');
		root.style.setProperty('--bg-secondary', '#0a0a0a');
		root.style.setProperty('--bg-card', '#141414');
		root.style.setProperty('--text-primary', '#f0f0f5');
		root.style.setProperty('--text-secondary', '#8a8a9a');
	} else {
		root.style.setProperty('--bg-primary', '#0f0f13');
		root.style.setProperty('--bg-secondary', '#1a1a24');
		root.style.setProperty('--bg-card', '#22222e');
		root.style.setProperty('--text-primary', '#f0f0f5');
		root.style.setProperty('--text-secondary', '#a0a0b0');
	}
}

function shadeColor(hex, percent) {
	const num = parseInt(hex.replace('#', ''), 16);
	const amt = Math.round(2.55 * percent);
	const r = Math.min(255, (num >> 16) + amt);
	const g = Math.min(255, ((num >> 8) & 0x00ff) + amt);
	const b = Math.min(255, (num & 0x0000ff) + amt);
	return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export function playClickSound() {
	if (!current.sound) return;
	try {
		const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.frequency.value = 600;
		osc.type = 'sine';
		gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.start();
		osc.stop(audioCtx.currentTime + 0.1);
	} catch {
		/* abaikan */
	}
}

export function vibrate(pattern = 20) {
	if (current.vibration && navigator.vibrate) {
		navigator.vibrate(pattern);
	}
}

export { DEFAULTS };