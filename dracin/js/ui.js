// ============================================================
// ui.js — Render komponen UI dengan Tailwind utility classes
// ============================================================

const appEl = document.getElementById('app');
const loadingEl = document.getElementById('loadingIndicator');

export function showLoading() {
	if (!loadingEl) return;
	loadingEl.classList.remove('hidden');
	loadingEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
}

export function hideLoading() {
	if (!loadingEl) return;
	loadingEl.classList.add('hidden');
}

export function showError(message) {
	hideLoading();
	appEl.innerHTML = `
		<div class="py-10 text-center text-text-sub">
			<i class="fa-solid fa-triangle-exclamation"></i> ${message}
		</div>
	`;
}

export function showEmpty(message = 'Tidak ada drama ditemukan.') {
	hideLoading();
	appEl.innerHTML = `
		<div class="py-10 text-center text-sm text-text-sub">
			<i class="fa-regular fa-face-frown"></i> ${message}
		</div>
	`;
}

export function renderDramaList(dramas, title = '') {
	hideLoading();

	if (!dramas || dramas.length === 0) {
		showEmpty();
		return;
	}

	const cardsHtml = dramas
		.map(
			(drama) => `
		<div
			class="drama-card cursor-pointer overflow-hidden rounded-xl bg-card shadow-lg transition hover:-translate-y-1 hover:shadow-2xl active:scale-[0.97]"
			data-id="${drama.id}"
			data-title="${escapeHtml(drama.title)}"
		>
			<img
				src="${drama.poster || fallbackPoster()}"
				alt="${escapeHtml(drama.title)}"
				loading="lazy"
				class="aspect-[3/4] w-full bg-[#2a2a3a] object-cover"
			>
			<div class="px-2.5 py-2">
				<div class="truncate text-[0.85rem] font-semibold">${escapeHtml(drama.title)}</div>
				<div class="mt-0.5 text-xs text-text-sub">
					<i class="fa-solid fa-list-ol"></i>
					${drama.episodes ? drama.episodes + ' episode' : '—'}
				</div>
			</div>
		</div>
	`
		)
		.join('');

	appEl.innerHTML = `
		${title ? `<h2 class="mb-3 mt-6 text-lg font-bold first:mt-0"><i class="fa-solid fa-fire"></i> ${escapeHtml(title)}</h2>` : ''}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
			${cardsHtml}
		</div>
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