const galleryContainer = document.getElementById('gallery');
const overlay = document.getElementById('overlay');
const modalImage = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const closeBtn = document.getElementById('closeBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let items = [];
let currentIndex = -1;

// 1. Fungsi cek gambar
async function checkImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// 2. Fungsi acak
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 3. Inisialisasi
async function initGallery() {
    galleryContainer.innerHTML = "<p>Memuat galeri...</p>";
    
    const tempItems = [];
    for (let i = 1; i <= 1000; i++) {
        const path = `stockid_gambar/gain/IMG${i}.jpg`;
        const exists = await checkImage(path);
        
        if (exists) {
            tempItems.push({
                full: path,
                thumb: path
            });
        }
    }

    if (tempItems.length === 0) {
        galleryContainer.innerHTML = "<p>Tidak ada gambar berawalan 'img' ditemukan.</p>";
        return;
    }

    // ACAK urutan dulu
    const shuffled = shuffleArray(tempItems);
    
    // BERI LABEL BERURUTAN (1, 2, 3...) setelah diacak
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

// Event Listeners
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

// Jalankan
initGallery();