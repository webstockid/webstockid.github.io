// ============================================================
// storage.js — Wrapper localStorage
// ============================================================

const KEYS = {
	HISTORY: 'dracin_history',
	SETTINGS: 'dracin_settings',
};

const MAX_HISTORY = 50;

export function saveToHistory(drama) {
	const history = getHistory();
	const filtered = history.filter((item) => item.id !== drama.id);
	filtered.unshift({ ...drama, watchedAt: Date.now() });
	localStorage.setItem(KEYS.HISTORY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
}

export function getHistory() {
	try {
		return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]');
	} catch {
		return [];
	}
}

export function clearHistory() {
	localStorage.removeItem(KEYS.HISTORY);
}

export function saveSettings(settings) {
	const current = getSettings();
	localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
}

export function getSettings() {
	try {
		return JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}');
	} catch {
		return {};
	}
}