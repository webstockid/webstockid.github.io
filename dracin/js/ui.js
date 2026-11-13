// ============================================================
// ui.js — Render komponen UI (versi Font Awesome)
// ============================================================

const appEl = document.getElementById('app');
const loadingEl = document.getElementById('loadingIndicator');

export function showLoading() {
	loadingEl.classList.remove('hidden');
	loadingEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
}

export function hideLoading() {
	loadingEl.classList.add('hidden');
}

export function showError(message) {
	loadingEl.classList.add('hidden');
	appEl.innerHTML = `
		<div class="error-msg">
			<i class="fa-solid fa-triangle-exclamation"></i> ${message}
		</div>
	`;
}

export function showEmpty(message = 'Tidak ada drama ditemukan.') {
	loadingEl.classList.add('hidden');
	appEl.innerHTML = `
		<div class="empty-msg">
			<i class="fa-regular fa-face-frown"></i> ${message}
		</div>
	`;
}

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
			<img src="${drama.poster || fallbackPoster()}" alt="${escapeHtml(drama.title)}" loading="lazy">
			<div class="drama-card-info">
				<div class="drama-card-title">${escapeHtml(drama.title)}</div>
				<div class="drama-card-meta">
					<i class="fa-solid fa-list-ol"></i>
					${drama.episodes ? drama.episodes + ' episode' : '—'}
				</div>
			</div>
		</div>
	`
		)
		.join('');

	appEl.innerHTML = `
		${title ? `<h2 class="section-title"><i class="fa-solid fa-fire"></i> ${escapeHtml(title)}</h2>` : ''}
		<div class="drama-grid">${cardsHtml}</div>
	`;

	appEl.querySelectorAll('.drama-card').forEach((card) => {
		card.addEventListener('click', () => {
			window.dispatchEvent(
				new CustomEvent('dramaSelected', {
					detail: { id: card.dataset.id, title: card.dataset.title },
				})
			);
		});
	});
}

function fallbackPoster() {
	return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22400%22/%3E%3Ctext x=%22150%22 y=%22200%22 fill=%22%23666%22 font-size=%2248%22 text-anchor=%22middle%22%3E%3F%3C/text%3E%3C/svg%3E';
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}