// ============================================================
// ui.js — Semua manipulasi DOM terpusat di sini.
// ============================================================

const appEl = document.getElementById('app');
const loadingEl = document.getElementById('loadingIndicator');

export function showLoading() {
	loadingEl.classList.remove('hidden');
	loadingEl.textContent = 'Memuat...';
}

export function hideLoading() {
	loadingEl.classList.add('hidden');
}

export function showError(message) {
	loadingEl.classList.add('hidden');
	appEl.innerHTML = `<div class="error-msg">⚠️ ${message}</div>`;
}

export function showEmpty(message = 'Tidak ada drama ditemukan.') {
	loadingEl.classList.add('hidden');
	appEl.innerHTML = `<div class="empty-msg">${message}</div>`;
}

// ----- Render daftar drama -----
export function renderDramaList(dramas, title = '') {
	loadingEl.classList.add('hidden');

	if (!dramas || dramas.length === 0) {
		showEmpty();
		return;
	}

	const cardsHtml = dramas
		.map(
			(drama) => `
		<div class="drama-card" data-id="${drama.id}" data-title="${escapeHtml(drama.title)}">
			<img src="${drama.poster || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22400%22/%3E%3C/svg%3E'}" 
			     alt="${escapeHtml(drama.title)}" loading="lazy">
			<div class="drama-card-info">
				<div class="drama-card-title">${escapeHtml(drama.title)}</div>
				<div class="drama-card-meta">${drama.episodes ? drama.episodes + ' episode' : ''}</div>
			</div>
		</div>
	`
		)
		.join('');

	appEl.innerHTML = `
		${title ? `<h2 class="section-title">${escapeHtml(title)}</h2>` : ''}
		<div class="drama-grid">${cardsHtml}</div>
	`;

	// Event delegation untuk klik card
	appEl.querySelectorAll('.drama-card').forEach((card) => {
		card.addEventListener('click', () => {
			const id = card.dataset.id;
			const title = card.dataset.title;
			// Custom event agar app.js bisa menangani
			window.dispatchEvent(new CustomEvent('dramaSelected', { detail: { id, title } }));
		});
	});
}

// ----- Helper keamanan -----
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}