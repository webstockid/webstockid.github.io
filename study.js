const databaseVIP = {
	"HARDIGANTENG": { "tanggalExpired": "2026-10-15" },
	"DIMAS1928": { "tanggalExpired": "2040-08-01" },
	"IRAM1827": { "tanggalExpired": "2040-01-01" },
	"ZULIA1307": { "tanggalExpired": "2027-09-17" },
	"ANGGORO1462": { "tanggalExpired": "2027-09-16" },
	"ANNUR1276": { "tanggalExpired": "2027-06-20" },
	"KAYLA1102": { "tanggalExpired": "2027-06-10" },
	"YAYAT1502": { "tanggalExpired": "2027-03-08" },
	"YOGA1692": { "tanggalExpired": "2027-02-28" },
	"OFENG1730": { "tanggalExpired": "2027-01-19" },
	"PUSPITA1083": { "tanggalExpired": "2026-12-31" },
	"DIKA2018": { "tanggalExpired": "2026-12-30" },
	"ARIF2196": { "tanggalExpired": "2026-12-25" },
	"DHIO2317": { "tanggalExpired": "2026-12-23" },
	"IZZUDIN2285": { "tanggalExpired": "2026-12-15" },
	"ZAKI2410": { "tanggalExpired": "2026-12-08" },
	"RAFLI2591": { "tanggalExpired": "2026-12-05" },
	"0": { "tanggalExpired": "2026-12-05" },
	"RESKY2701": { "tanggalExpired": "2026-12-04" },
	"AGUNG2810": { "tanggalExpired": "2026-11-30" },
	"LUKITA2957": { "tanggalExpired": "2026-11-27" },
	"TITO3012": { "tanggalExpired": "2026-11-15" },
	"SARAH3175": { "tanggalExpired": "2026-11-14" },
	"PUTRI3270": { "tanggalExpired": "2026-11-09" },
	"AHMAD3387": { "tanggalExpired": "2026-11-09" },
	"NANDA3489": { "tanggalExpired": "2026-11-05" },
	"DEVAN3561": { "tanggalExpired": "2026-11-02" },
	"IRHAM3670": { "tanggalExpired": "2026-10-24" },
	"DWIKY3792": { "tanggalExpired": "2026-10-23" },
	"ERICK3826": { "tanggalExpired": "2026-10-21" },
	"RAFAEL": { "tanggalExpired": "2026-10-01" },
	"FASYA7384": { "tanggalExpired": "2026-11-05" },
	"VIPKING": { "tanggalExpired": "2040-12-31" },
	"SULTANVIP": { "tanggalExpired": "2040-12-31" }
};

const materialsData = [
    { id: 'materi_1', title: 'Cara Scalping Tipis Tipis', category: 'Analisa Transaksi & Orderbook', url: 'study001.html' },
    { id: 'materi_2', title: 'Cara Mencari Saham Berpotensi Bagger', category: 'Analisa Transaksi & Fundamental', url: 'study002.html' }
];

function getExtractName(token) {
	const match = token.match(/^[A-Za-z]+/);
	return match ? match[0] : token;
}

function calculateDaysLeft(expiredDateStr) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const expDate = new Date(expiredDateStr);
	expDate.setHours(0, 0, 0, 0);
	const diffTime = expDate - today;
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

document.addEventListener("DOMContentLoaded", () => {
    checkStudyAuth();
    loadCurrentMaterialProgress();
});

function checkStudyAuth() {
    const token = localStorage.getItem('vip_token_study');
    const skip = localStorage.getItem('skip_login_study');
    const modal = document.getElementById('studyLoginModal');
    const dashboard = document.getElementById('studyDashboardPanel');

    if (token && databaseVIP[token]) {
        const account = databaseVIP[token];
        const daysLeft = calculateDaysLeft(account.tanggalExpired);
        
        if (daysLeft < 0) {
            localStorage.removeItem('vip_token_study');
            showStudyLoginModal();
            return;
        }

        if (modal) {
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
        
        if (dashboard) dashboard.classList.remove('hidden');
        
        const name = getExtractName(token);
        document.getElementById('dashUserName').innerText = name;
        document.getElementById('dashDaysLeft').innerText = `${daysLeft} Hari Lagi`;
        document.getElementById('dashLogoutBtn').classList.remove('hidden');
        document.getElementById('dashLoginBtn').classList.add('hidden');
        
        updateProgressDashboard();
    } else if (skip === 'true') {
        if (modal) {
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
        if (dashboard) dashboard.classList.remove('hidden');
        
        document.getElementById('dashUserName').innerText = "Non-Member";
        document.getElementById('dashUserName').classList.replace('text-emerald-400', 'text-slate-400');
        document.getElementById('dashUserStatus').innerHTML = `Silakan login untuk menyimpan progress.`;
        document.getElementById('dashLogoutBtn').classList.add('hidden');
        document.getElementById('dashLoginBtn').classList.remove('hidden');
        
        updateProgressDashboard(true);
    } else {
        showStudyLoginModal();
    }
}

function showStudyLoginModal() {
    const modal = document.getElementById('studyLoginModal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-95');
        }, 10);
    }
}

function processStudyLogin() {
    const tokenInput = document.getElementById('studyTokenInput').value.trim().toUpperCase();
    const errorEl = document.getElementById('studyLoginError');
    
    if (!tokenInput) {
        errorEl.innerText = "Silakan masukan token terlebih dahulu!";
        errorEl.classList.remove('hidden');
        return;
    }
    if (!databaseVIP[tokenInput]) {
        errorEl.innerText = "Akses Token tidak terdaftar / salah!";
        errorEl.classList.remove('hidden');
        return;
    }
    const daysLeft = calculateDaysLeft(databaseVIP[tokenInput].tanggalExpired);
    if (daysLeft < 0) {
        errorEl.innerText = "Akses Token ini sudah kedaluwarsa!";
        errorEl.classList.remove('hidden');
        return;
    }
    
    localStorage.setItem('vip_token_study', tokenInput);
    localStorage.removeItem('skip_login_study');
    errorEl.classList.add('hidden');
    
    checkStudyAuth();
    loadCurrentMaterialProgress();
}

function skipStudyLogin() {
    localStorage.setItem('skip_login_study', 'true');
    checkStudyAuth();
    loadCurrentMaterialProgress();
}

function logoutStudyVIP() {
    localStorage.removeItem('vip_token_study');
    localStorage.removeItem('skip_login_study');
    checkStudyAuth();
}

function getStudyProgress() {
    const token = localStorage.getItem('vip_token_study');
    if (!token) return {}; 
    
    const saved = localStorage.getItem(`study_progress_${token}`);
    return saved ? JSON.parse(saved) : {};
}

function updateProgressDashboard(isNonMember = false) {
    if (isNonMember) {
        document.getElementById('dashProgressCount').innerText = "0";
        document.getElementById('dashProgressBar').style.width = "0%";
        return;
    }

    const progress = getStudyProgress();
    const totalMaterials = materialsData.length;
    let understoodCount = 0;
    
    for (let key in progress) {
        if (progress[key] === 'sudah') {
            understoodCount++;
        }
    }
    
    document.getElementById('dashProgressCount').innerText = understoodCount;
    document.querySelector('#dashProgressCount').nextSibling.textContent = ` / ${totalMaterials} Materi Paham`;
    
    let percentage = (understoodCount / totalMaterials) * 100;
    document.getElementById('dashProgressBar').style.width = `${percentage}%`;
}

function setMaterialProgress(materialId, status) {
    const token = localStorage.getItem('vip_token_study');
    if (!token) {
        alert("Silakan Login VIP terlebih dahulu untuk menyimpan progress belajar Anda.");
        showStudyLoginModal();
        return;
    }

    let progress = getStudyProgress();
    progress[materialId] = status;
    localStorage.setItem(`study_progress_${token}`, JSON.stringify(progress));
    
    applyProgressStyle(status);
    updateProgressDashboard();
}

function loadCurrentMaterialProgress() {
    const path = window.location.pathname;
    let materialId = 'materi_1';
    if (path.includes('studyy.html')) {
        materialId = 'materi_2';
    }
    
    const progress = getStudyProgress();
    const status = progress[materialId];
    
    applyProgressStyle(status);
}

function applyProgressStyle(status) {
    const btnBelum = document.getElementById('btn-prog-belum');
    const btnSeparuh = document.getElementById('btn-prog-separuh');
    const btnSudah = document.getElementById('btn-prog-sudah');
    
    if(!btnBelum || !btnSeparuh || !btnSudah) return;

    const baseClass = "flex-1 min-w-[120px] bg-slate-800 border border-slate-700 text-slate-300 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex flex-col items-center gap-1.5 group";
    
    btnBelum.className = baseClass + " hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30";
    btnSeparuh.className = baseClass + " hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/30";
    btnSudah.className = baseClass + " hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30";

    if (status === 'belum') {
        btnBelum.className = "flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex flex-col items-center gap-1.5 group bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] scale-105";
        btnBelum.querySelector('i').classList.add('animate-bounce');
    } else {
        btnBelum.querySelector('i').classList.remove('animate-bounce');
    }
    
    if (status === 'separuh') {
        btnSeparuh.className = "flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex flex-col items-center gap-1.5 group bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-105";
        btnSeparuh.querySelector('i').classList.add('animate-pulse');
    } else {
        btnSeparuh.querySelector('i').classList.remove('animate-pulse');
    }

    if (status === 'sudah') {
        btnSudah.className = "flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex flex-col items-center gap-1.5 group bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-105";
        btnSudah.querySelector('i').style.transform = "scale(1.2)";
        setTimeout(() => { btnSudah.querySelector('i').style.transform = "scale(1)"; }, 200);
    } else {
        btnSudah.querySelector('i').style.transform = "scale(1)";
    }
}

function handleSearchMaterial() {
    const input = document.getElementById('searchMaterialInput').value.toLowerCase().trim();
    const resultBox = document.getElementById('searchResultsBox');
    
    if (input.length === 0) {
        resultBox.classList.add('hidden');
        return;
    }
    
    const matches = materialsData.filter(mat => 
        mat.title.toLowerCase().includes(input) || 
        mat.category.toLowerCase().includes(input)
    );
    
    if (matches.length > 0) {
        let html = '';
        matches.forEach(match => {
            html += `
                <a href="${match.url}" class="block p-3 hover:bg-slate-800 transition-colors group">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-book text-emerald-400 text-xs"></i>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">${match.title}</h4>
                            <p class="text-[10px] text-slate-400">${match.category}</p>
                        </div>
                    </div>
                </a>
            `;
        });
        resultBox.innerHTML = html;
        resultBox.classList.remove('hidden');
    } else {
        resultBox.innerHTML = `<div class="p-4 text-center text-xs text-slate-500">Materi tidak ditemukan.</div>`;
        resultBox.classList.remove('hidden');
    }
}

document.addEventListener('click', function(e) {
    const searchContainer = document.getElementById('searchResultsBox');
    const searchInput = document.getElementById('searchMaterialInput');
    if (searchContainer && searchInput) {
        if (!searchContainer.contains(e.target) && e.target !== searchInput) {
            searchContainer.classList.add('hidden');
        }
    }
});

const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`;
document.head.appendChild(styleSheet);
