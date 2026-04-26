const galleryContainer = document.getElementById('gallery');
const overlay = document.getElementById('overlay');
const modalImage = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const closeBtn = document.getElementById('closeBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let items = [];
let currentIndex = -1;

// 1. Fungsi cek gambar (Tanpa perubahan)
function checkImage(url) {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(true);
		img.onerror = () => resolve(false);
		img.src = url;
	});
}

// 2. Fungsi acak (Tanpa perubahan)
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

// 3. Inisialisasi: Menghilangkan 'await' di dalam loop untuk kecepatan
async function initGallery() {
	const promises = [];
	const maxFiles = 200; // Sesuaikan dengan perkiraan jumlah file Anda
	// Kita tembak semua pengecekan sekaligus (Paralel)
	for (let i = 1; i <= maxFiles; i++) {
		const path = `stockid_gambar/gain/img${i}.jpg`;
		promises.push(
		checkImage(path).then(exists => {
			if (exists) return { full: path, thumb: path };
			return null;
		})
	);
}

// Menunggu semua "janji" pengecekan selesai secara kolektif
const results = await Promise.all(promises);
const validItems = results.filter(item => item !== null);
if (validItems.length === 0) {
	galleryContainer.innerHTML = "<p>Tidak ada gambar ditemukan.</p>";
	return;
}

// Acak hasil yang sudah pasti ada filenya
const shuffled = shuffleArray(validItems);
// Beri penomoran berurutan
items = shuffled.map((item, index) => ({
	...item,
	title: `Stock ID Gain ${index + 1}`
}));

renderGallery();
}

// 4. Render ke HTML
function renderGallery() {
	galleryContainer.innerHTML = "";
	items.forEach((g, idx) => {
		const a = document.createElement('button');
		a.className = 'divgain';
		a.setAttribute('data-index', idx);
		a.innerHTML = `
		<img loading="lazy" src="${g.thumb}" alt="${g.title}">
		<div class="caption-gain">${g.title}</div>
		`;
		a.addEventListener('click', () => openModal(idx));
		galleryContainer.appendChild(a);
	});
}

// --- Logika Modal ---
function openModal(index) {
	const item = items[index];
	if (!item) return;
	currentIndex = index;
	modalImage.src = item.full;
	modalImage.alt = item.title;
	modalCaption.textContent = item.title;
	overlay.classList.add('open');
	overlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
	overlay.classList.remove('open');
	overlay.setAttribute('aria-hidden', 'true');
	setTimeout(() => { modalImage.src = ''; }, 300);
	currentIndex = -1;
}

function showNext(delta) {
	if (currentIndex === -1) return;
	const next = (currentIndex + delta + items.length) % items.length;
	openModal(next);
}

closeBtn.addEventListener('click', closeModal);
prevBtn.addEventListener('click', () => showNext(-1));
nextBtn.addEventListener('click', () => showNext(1));
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

window.addEventListener('keydown', (e) => {
	if (overlay.classList.contains('open')) {
		if (e.key === 'Escape') closeModal();
		if (e.key === 'ArrowRight') showNext(1);
		if (e.key === 'ArrowLeft') showNext(-1);
	}
});

initGallery();