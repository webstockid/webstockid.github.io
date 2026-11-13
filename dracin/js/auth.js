// ============================================================
// auth.js — Login opsional, hanya untuk menandai pemilik histori
// ============================================================

const KEY = 'dracin_user_session';

export function getSession() {
	try {
		return JSON.parse(localStorage.getItem(KEY) || 'null');
	} catch {
		return null;
	}
}

export function setSession(data) {
	localStorage.setItem(KEY, JSON.stringify({
		...data,
		loginAt: Date.now(),
	}));
}

export function clearSession() {
	localStorage.removeItem(KEY);
}

export function isLoggedIn() {
	return getSession() !== null;
}