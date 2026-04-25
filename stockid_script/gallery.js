const galleryContainer = document.getElementById('gallery');
const overlay = document.getElementById('overlay');
const modalImage = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const closeBtn = document.getElementById('closeBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let items = [];
let currentIndex = -1;

// FUNGSI UTAMA: Mengambil data dari PHP
async function loadGallery() {
    try {
        // Memanggil file PHP untuk mendapatkan daftar nama file asli
        const response = await fetch('gain.php');
        const fileList = await response.json();

        if (fileList.length === 0) {
            galleryContainer.innerHTML = "<p>Tidak ada gambar dalam folder.</p>";
            return;
        }

        // Memetakan file ke dalam array gallery
        items = fileList.map((fileName, i) => ({
            thumb: `stockid_gambar/gain/${fileName}`,
            full: `stockid_gambar/gain/${fileName}`,
            title: fileName // Menampilkan nama asli file sebagai judul
        }));

        renderGallery();
    } catch (error) {
        console.error("Gagal memuat folder gambar:", error);
        galleryContainer.innerHTML = "<p>Error: Pastikan server PHP aktif.</p>";
    }
}

// Menampilkan gambar ke dalam HTML
function renderGallery() {
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

// Logika Modal
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

// Event Listeners
closeBtn.addEventListener('click', closeModal);
prevBtn.addEventListener('click', () => showNext(-1));
nextBtn.addEventListener('click', () => showNext(1));

overlay.addEventListener('click', (e) => { 
    if (e.target === overlay) closeModal(); 
});

window.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('open')) {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowRight') showNext(1);
        if (e.key === 'ArrowLeft') showNext(-1);
    }
});

// Jalankan fungsi saat halaman dibuka
loadGallery();