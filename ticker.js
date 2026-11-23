// ==========================================
// 1. DAFTAR SAHAM REGULER (IDX WATCHLIST)
// ==========================================
const radarWatchlist = [
	"AALI", "ABBA", "ABMM", "ACES", "ACRO", "ACST", "ADCP", "ADHI", "ADMR", "ADRO",
	"AGII", "AGRO", "AKRA", "ALDO", "AMAG", "AMMN", "AMRT", "ANJT", "ANTM", "APLN",
	"ARCI", "AREA", "ARNA", "ARTO", "ASBI", "ASDM", "ASGR", "ASII", "ASJT", "ASLC",
	"ASLI", "ASMI", "ASRI", "ASRM", "ASSA", "ATIC", "ATLA", "AUTO", "AVIA", "AWAN",
	"AXIO", "BABP", "BABY", "BACA", "BAIK", "BAJA", "BALI", "BANK", "BAYU", "BBCA",
	"BBHI", "BBKP", "BBLD", "BBMD", "BBNI", "BBRI", "BBSI", "BBTN", "BBYB", "BCAP",
	"BDMN", "BEBS", "BELI", "BFIN", "BIPI", "BIRD", "BJBR", "BJTM", "BKSL", "BLES",
	"BMRI", "BMTR", "BNBR", "BNBS", "BNGA", "BOAT", "BOBA", "BOLI", "BREN", "BRIS",
	"BRMS", "BRPT", "BSBK", "BSDE", "BSSR", "BTPN", "BUDI", "BUKA", "BUKK", "BULL",
	"BUMI", "BVIC", "BWPT", "BYAN", "CAMP", "CARE", "CARS", "CASA", "CASS", "CATO",
	"CBRE", "CDIA", "CEKA", "CENT", "CFIN", "CGAS", "CHEM", "CHIP", "CINT", "CLEO",
	"CLPI", "CMNP", "CMRY", "COAL", "COCO", "CPIN", "CRSN", "CSAP", "CSRA", "CTBN",
	"CTRA", "CTTH", "CUAN", "CYBR", "DART", "DATA", "DEFI", "DEPO", "DEWA", "DFAM",
	"DGIK", "DGNS", "DIGI", "DILD", "DIMA", "DMAS", "DMND", "DNAR", "DNET", "DOID",
	"DOOH", "DOSS", "DPNS", "DPUM", "DRMA", "DSFI", "DSNG", "DSSA", "DUTI", "DVLA",
	"EAST", "ECII", "EDII", "ELIT", "ELSA", "EMDE", "EMTK", "ENRG", "EPAC", "EPMT",
	"ERAA", "ERAK", "ESIP", "ESSA", "ESTA", "EURO", "EXCL", "FAPA", "FAST", "FASW",
	"FILM", "FIRT", "FISH", "FITT", "FLMC", "FMII", "FORU", "FPNI", "FREN", "FUTR",
	"GDST", "GDYR", "GEMA", "GEMS", "GGRM", "GJTL", "GOLF", "GOOD", "GOTO", "GREN",
	"GRIA", "GRPM", "GTBO", "GTRA", "GTSI", "GULA", "GWSA", "GZCO", "HAIS", "HALO",
	"HATM", "HDFA", "HDTX", "HEAL", "HERO", "HEXA", "HILL", "HITS", "HMSP", "HOKI",
	"HOMI", "HOTL", "HRTA", "HRUM", "HUMI", "HYGN", "IATA", "IBFN", "IBOS", "IBST",
	"ICBP", "ICON", "IDPR", "IFII", "IFSH", "IGAR", "IKAI", "IKBI", "IKPM", "IMAS",
	"IMJS", "IMPC", "INAF", "INAI", "INCF", "INCI", "INCO", "INDF", "INDO", "INDR",
	"INDS", "INDY", "INET", "INKP", "INOV", "INPC", "INPP", "INRU", "INTP", "IPCC",
	"IPCM", "IPOL", "IPPE", "IPTV", "IRRA", "ISAT", "ISEA", "ISSP", "ITMA", "ITMG",
	"JARR", "JAST", "JASU", "JECC", "JGPA", "JKON", "JKSW", "JMAS", "JPFA", "JRPT",
	"JSMR", "JSPT", "JTPE", "KAEF", "KBAG", "KBLI", "KBLM", "KBLV", "KDSI", "KEEN",
	"KEJU", "KIAS", "KICI", "KIJA", "KING", "KINO", "KINR", "KKGI", "KLAS", "KLBF",
	"KMDS", "KMTR", "KOCI", "KOIN", "KOKA", "KONI", "KOPI", "KOTA", "KPIG", "KRAS",
	"KROX", "KRYA", "LABS", "LAJU", "LEAD", "LIVE", "LMAX", "LPCK", "LPGI", "LPIN",
	"LPKR", "LPLI", "LPOP", "LPPF", "LSIP", "LSPT", "LTLS", "LUCK", "MAHA", "MAIN",
	"MANG", "MAPA", "MAPB", "MAPI", "MARK", "MASA", "MAXI", "MAYA", "MBAP", "MBMA",
	"MBSS", "MBTO", "MCAS", "MCOL", "MCOR", "MDFC", "MDIA", "MDKA", "MDKI", "MEDC",
	"MEGA", "MENN", "MERK", "META", "MFIN", "MFMI", "MGLV", "MHKI", "MICE", "MIDI",
	"MIKA", "MINA", "MIRE", "MITS", "MKPI", "MLBI", "MLIA", "MLND", "MLPT", "MMIX",
	"MNCN", "MNDO", "MPMX", "MPPA", "MPXL", "MRAT", "MREI", "MSIN", "MSJA", "MSKY",
	"MSTI", "MTDL", "MTEL", "MTLA", "MTRA", "MTSM", "MUTU", "MYOH", "MYOR", "MYTX",
	"NAIK", "NANO", "NASA", "NASI", "NCKL", "NDKO", "NELI", "NELY", "NETV", "NFCX",
	"NICE", "NICK", "NICL", "NIKL", "NINE", "NISP", "NOBU", "NRCA", "NSSS", "NTBK",
	"NTRD", "OASA", "OBMD", "OCAP", "OCMD", "OILS", "OKAS", "OLIV", "OMRE", "OPMS",
	"PACK", "PADA", "PALM", "PAMA", "PAMG", "PANI", "PANR", "PANS", "PART", "PBID",
	"PBRX", "PBSA", "PCAR", "PDES", "PEGE", "PEHA", "PEVE", "PGAS", "PGJO", "PIPA",
	"PJAA", "PKPK", "PLIN", "PLND", "PMMP", "PNBN", "PNBS", "PNIN", "PNLF", "PNSE",
	"POOL", "PORT", "POWR", "PPGL", "PPRE", "PPRI", "PRDA", "PRIM", "PSAB", "PSDN",
	"PSGO", "PSSI", "PTBA", "PTDU", "PTIS", "PTMP", "PTPP", "PTPS", "PTPW", "PTRO",
	"PTSN", "PUDP", "PWON", "PYFA", "PZZA", "RAAM", "RAFI", "RAJA", "RALS", "RATU",
	"RBMS", "RCCC", "RDTX", "REAL", "RELF", "RELI", "RGAS", "RICY", "RIGS", "RISE",
	"RMKE", "RMKO", "ROCK", "RODA", "RONY", "ROTI", "RSCH", "SAFE", "SAGE", "SAME",
	"SAMF", "SAPX", "SBMA", "SCCO", "SCMA", "SCNP", "SDPC", "SDRA", "SEMA", "SFAN",
	"SFXI", "SGAR", "SGER", "SGLP", "SGRO", "SHID", "SICO", "SIDO", "SILO", "SIMP",
	"SINK", "SIPD", "SKBM", "SKLT", "SKRN", "SLIS", "SMAR", "SMBR", "SMCB", "SMDM",
	"SMDR", "SMGA", "SMGR", "SMIL", "SMKL", "SMKM", "SMLE", "SMMA", "SMRA", "SMSM",
	"SNLK", "SOFA", "SOLA", "SONA", "SOSI", "SOTN", "SPMA", "SPTO", "SQMI", "SREI",
	"SRSN", "SRTG", "SSIA", "SSMS", "SSSI", "SSTM", "STAA", "STAR", "STRK", "STTP",
	"SUPR", "SURE", "SURI", "SWAT", "SWID", "TALF", "TAPG", "TBIG", "TBLA", "TCID",
	"TCPI", "TEBE", "TECH", "TFCO", "TGRA", "TGUK", "TIFA", "TINC", "TINS", "TIPR",
	"TIRA", "TISC", "TKIM", "TLDN", "TLKM", "TMAN", "TMAS", "TMPO", "TNCA", "TOBA",
	"TOOL", "TOTE", "TOTO", "TOWR", "TPIA", "TPMA", "TRFA", "TRGU", "TRIM", "TRIN",
	"TRIS", "TRON", "TRST", "TRUE", "TRUK", "TSPC", "TUGU", "TULT", "TYRE", "UANG",
	"UCID", "UECU", "UIDA", "ULTJ", "UNIC", "UNTR", "UNVR", "URBN", "USBP", "UVCR",
	"VAST", "VERN", "VISI", "VKTR", "VRNA", "VTNY", "WEGE", "WEHA", "WICO", "WIDI",
	"WIFI", "WIIM", "WIKA", "WIMP", "WINE", "WINR", "WINS", "WIRG", "WITC", "WMUU",
	"WOOD", "WSBP", "WTON", "YPAS", "YULE", "ZATA", "ZBRA", "ZONE", "ZYRX"
];

// ==========================================
// 2. DAFTAR SAHAM WARAN BEI (-W / -W2)
// ==========================================
const warrantWatchlist = [
	"ACRO-W", "ADCP-W", "AREA-W", "ASLI-W", "ATLA-W", "AWAN-W", "BABY-W", "BAIK-W", "BANK-W", "BBHI-W",
	"BBKP-W", "BCAP-W", "BEBS-W", "BIPI-W", "BLES-W", "BNBR-W", "BOAT-W", "BRMS-W", "BSBK-W", "BUMI-W",
	"CARE-W", "CBRE-W", "CGAS-W", "CHEM-W", "CHIP-W", "COAL-W", "CRSN-W", "CUAN-W", "CYBR-W", "DATA-W",
	"DEWA-W", "DOOH-W", "DOSS-W", "DRMA-W", "ELIT-W", "ENRG-W", "EPAC-W", "ESIP-W", "ESTA-W", "EURO-W",
	"FREN-W", "FREN-W2", "FUTR-W", "GOLF-W", "GOTO-W", "GRIA-W", "GRPM-W", "GTRA-W", "GTSI-W", "HAIS-W",
	"HALO-W", "HATM-W", "HILL-W", "HOMI-W", "HUMI-W", "HYGN-W", "IATA-W", "IBOS-W", "IKPM-W", "INET-W",
	"IPPE-W", "ISEA-W", "JARR-W", "KBAG-W", "KING-W", "KLAS-W", "KOCI-W", "KOKA-W", "KOTA-W", "KPIG-W",
	"KRYA-W", "LABS-W", "LAJU-W", "LEAD-W", "LIVE-W", "LMAX-W", "MAHA-W", "MANG-W", "MAXI-W", "MENN-W",
	"MHKI-W", "MINA-W", "MMIX-W", "MPXL-W", "MSJA-W", "MSTI-W", "MUTU-W", "NAIK-W", "NANO-W", "NASI-W",
	"NETV-W", "NICE-W", "NICL-W", "NINE-W", "NSSS-W", "NTBK-W", "OASA-W", "OLIV-W", "PACK-W", "PADA-W",
	"PANI-W", "PART-W", "PEVE-W", "PIPA-W", "PMMP-W", "PNBS-W", "PPGL-W", "PPRI-W", "PTMP-W", "PTPS-W",
	"RAAM-W", "RAFI-W", "REAL-W", "RELF-W", "RGAS-W", "RMKO-W", "RONY-W", "RSCH-W", "SAGE-W", "SBMA-W",
	"SEMA-W", "SICO-W", "SLIS-W", "SMGA-W", "SMIL-W", "SMKM-W", "SMLE-W", "SOLA-W", "STRK-W", "SURI-W",
	"SWID-W", "TGUK-W", "TOOL-W", "TRGU-W", "TRIN-W", "TRON-W", "TRUE-W", "TYRE-W", "UVCR-W", "VAST-W",
	"VERN-W", "VISI-W", "VKTR-W", "VTNY-W", "WIDI-W", "WIFI-W", "WINE-W", "WINR-W", "WIRG-W", "ZATA-W"
];

// ==========================================
// 3. NORMALISASI SIMBOL & HELPER SAHAM WARAN
// ==========================================
function normalizeTickerSymbol(ticker) {
	if (!ticker || typeof ticker !== 'string') return '';
	let clean = ticker.trim().toUpperCase().replace(/\.JK$/i, '').replace(/^IDX:/i, '');
	// Ubah format 5+ karakter tanpa strip (misal: BSBKW -> BSBK-W) sesuai standar BEI & Yahoo Finance
	if (/^[A-Z]{4}W\d*$/i.test(clean)) {
		clean = clean.replace(/^([A-Z]{4})(W\d*)$/i, '$1-$2');
	}
	return clean;
}

function isWarrantTicker(ticker) {
	const clean = normalizeTickerSymbol(ticker);
	return /^[A-Z]{4}-W\d*$/i.test(clean);
}

function getParentTicker(ticker) {
	const clean = normalizeTickerSymbol(ticker);
	return isWarrantTicker(clean) ? clean.replace(/-W\d*$/i, '') : clean;
}

function toYahooTickerSymbol(ticker) {
	const clean = normalizeTickerSymbol(ticker);
	return clean ? `${clean}.JK` : '';
}

function toTradingViewSymbol(ticker) {
	const clean = normalizeTickerSymbol(ticker);
	if (!clean) return '';
	// TradingView IDX menggunakan format tanpa strip untuk waran (contoh: IDX:BSBKW)
	return isWarrantTicker(clean) ? `IDX:${clean.replace(/-/g, '')}` : `IDX:${clean}`;
}

const uniqueRadarWatchlist = [
	...new Set(radarWatchlist.map(normalizeTickerSymbol).filter(Boolean))
];

const uniqueWarrantWatchlist = [
	...new Set(warrantWatchlist.map(normalizeTickerSymbol).filter(Boolean))
];

// Mengambil daftar waran aktif milik satu saham induk (contoh: "FREN" -> ["FREN-W", "FREN-W2"])
function getWarrantsByParent(parentTicker) {
	const parent = getParentTicker(parentTicker);
	if (!parent) return [];
	return uniqueWarrantWatchlist.filter(w => getParentTicker(w) === parent);
}

// Mengecek apakah saham induk memiliki seri waran yang terdaftar
function hasWarrant(ticker) {
	return getWarrantsByParent(ticker).length > 0;
}

// ==========================================
// 4. KONEKTOR WATCHLIST UNTUK APP.JS
// ==========================================
function getAllCombinedTickers() {
	const sources = [
		typeof uniqueRadarWatchlist !== 'undefined' ? uniqueRadarWatchlist : null,
		typeof radarWatchlist !== 'undefined' ? radarWatchlist : null,
		typeof uniqueWarrantWatchlist !== 'undefined' ? uniqueWarrantWatchlist : null,
		typeof warrantWatchlist !== 'undefined' ? warrantWatchlist : null,
		typeof waranWatchlist !== 'undefined' ? waranWatchlist : null,
		typeof uniqueWaranWatchlist !== 'undefined' ? uniqueWaranWatchlist : null,
		typeof watchlistWaran !== 'undefined' ? watchlistWaran : null,
		typeof warrantTickers !== 'undefined' ? warrantTickers : null,
		typeof warrantList !== 'undefined' ? warrantList : null,
		typeof daftarWaran !== 'undefined' ? daftarWaran : null,
		typeof daftarSahamWaran !== 'undefined' ? daftarSahamWaran : null,
		typeof sahamWaran !== 'undefined' ? sahamWaran : null,
		typeof idxWarrants !== 'undefined' ? idxWarrants : null,
		typeof allTickers !== 'undefined' ? allTickers : null
	];

	const merged = new Set();
	sources.forEach(list => {
		if (Array.isArray(list)) {
			list.forEach(item => {
				const norm = normalizeTickerSymbol(item);
				if (norm) merged.add(norm);
			});
		}
	});
	return Array.from(merged);
}

function getRegularStockTickers() {
	return getAllCombinedTickers().filter(t => !isWarrantTicker(t));
}

function getWarrantStockTickers() {
	return getAllCombinedTickers().filter(t => isWarrantTicker(t));
}