// ==========================================
// 1. DAFTAR SAHAM REGULER (IDX WATCHLIST)
// ==========================================
const radarWatchlist = [
	"AALI", "ABBA", "ABMM", "ACES", "ACST", "ADCP", "ADHI", "ADMR", "ADRO", "AGII",
	"AGRO", "AKRA", "ALDO", "AMAG", "AMMN", "AMRT", "ANJT", "ANTM", "APLN", "ARCI",
	"ARNA", "ARTO", "ASBI", "ASDM", "ASGR", "ASII", "ASJT", "ASLC", "ASMI", "ASRM",
	"ASSA", "ASRI", "ATIC", "AUTO", "AVIA", "AWAN", "AXIO", "BABP", "BACA", "BAJA",
	"BALI", "BANK", "BAYU", "BBCA", "BBHI", "BBKP", "BBLD", "BBMD", "BBNI", "BBRI",
	"BBSI", "BBTN", "BBYB", "BDMN", "BELI", "BFIN", "BIRD", "BJBR", "BJTM", "BKSL",
	"BMRI", "BMTR", "BNBR", "BNBS", "BNGA", "BOBA", "BOLI", "BREN", "BRIS", "BRMS",
	"BRPT", "BSDE", "BSSR", "BTPN", "BUDI", "BUKA", "BUKK", "BULL", "BUMI", "BVIC",
	"BWPT", "BYAN", "CAMP", "CARE", "CARS", "CASA", "CASS", "CATO", "CBRE", "CDIA",
	"CEKA", "CENT", "CFIN", "CGAS", "CHIP", "CINT", "CLEO", "CLPI", "CMNP", "CMRY",
	"COCO", "CPIN", "CSAP", "CSRA", "CTBN", "CTRA", "CTTH", "CUAN", "DART", "DEFI",
	"DEPO", "DEWA", "DFAM", "DGIK", "DGNS", "DIGI", "DILD", "DIMA", "DMAS", "DMND",
	"DNAR", "DNET", "DOID", "DPNS", "DPUM", "DRMA", "DSFI", "DSNG", "DSSA", "DUTI",
	"DVLA", "EAST", "ECII", "EDII", "ELSA", "EMDE", "EMTK", "ENRG", "EPMT", "ERAA",
	"ERAK", "ESIP", "ESSA", "ESTA", "EURO", "EXCL", "FAPA", "FAST", "FASW", "FILM",
	"FIRT", "FISH", "FITT", "FLMC", "FMII", "FORU", "FPNI", "GDST", "GDYR", "GEMA",
	"GEMS", "GGRM", "GJTL", "GOOD", "GOTO", "GREN", "GTBO", "GULA", "GWSA", "GZCO",
	"HAIS", "HDFA", "HDTX", "HEAL", "HERO", "HEXA", "HILL", "HITS", "HMSP", "HOKI",
	"HOTL", "HRTA", "HRUM", "HUMI", "IATA", "IBFN", "IBOS", "IBST", "ICBP", "ICON",
	"IDPR", "IFII", "IFSH", "IGAR", "IKAI", "IKBI", "IMAS", "IMJS", "IMPC", "INAF",
	"INAI", "INCF", "INCI", "INCO", "INDF", "INDO", "INDR", "INDS", "INDY", "INET",
	"INKP", "INOV", "INPC", "INPP", "INRU", "INTP", "IPCC", "IPCM", "IPOL", "IPTV",
	"IRRA", "ISAT", "ISSP", "ITMA", "ITMG", "JARR", "JAST", "JASU", "JECC", "JGPA",
	"JKON", "JKSW", "JMAS", "JPFA", "JRPT", "JSMR", "JSPT", "JTPE", "KAEF", "KBAG",
	"KBLI", "KBLM", "KBLV", "KDSI", "KEEN", "KEJU", "KIAS", "KICI", "KIJA", "KINO",
	"KINR", "KKGI", "KLBF", "KMDS", "KMTR", "KOCI", "KOIN", "KONI", "KOPI", "KOTA",
	"KPIG", "KRAS", "KROX", "LEAD", "LPCK", "LPGI", "LPIN", "LPKR", "LPLI", "LPOP",
	"LPPF", "LSIP", "LSPT", "LTLS", "LUCK", "MAIN", "MAPA", "MAPB", "MAPI", "MARK",
	"MASA", "MAYA", "MBAP", "MBMA", "MBSS", "MBTO", "MCAS", "MCOR", "MCOL", "MDFC",
	"MDIA", "MDKA", "MDKI", "MEDC", "MEGA", "MERK", "META", "MFIN", "MFMI", "MGLV",
	"MICE", "MIDI", "MIKA", "MINA", "MIRE", "MITS", "MKPI", "MLBI", "MLIA", "MLND",
	"MLPT", "MMIX", "MNCN", "MNDO", "MPMX", "MPPA", "MRAT", "MREI", "MSIN", "MSKY",
	"MTDL", "MTEL", "MTLA", "MTRA", "MTSM", "MYOH", "MYOR", "MYTX", "NASA", "NASI",
	"NCKL", "NDKO", "NELI", "NELY", "NFCX", "NICE", "NICK", "NICL", "NIKL", "NINE",
	"NISP", "NOBU", "NRCA", "NSSS", "NTRD", "OASA", "OBMD", "OCAP", "OCMD", "OILS",
	"OKAS", "OMRE", "OPMS", "PALM", "PAMA", "PAMG", "PANI", "PANR", "PANS", "PBID",
	"PBRX", "PBSA", "PCAR", "PDES", "PEGE", "PEHA", "PGAS", "PGJO", "PIPA", "PJAA",
	"PKPK", "PLIN", "PLND", "PMMP", "PNBN", "PNBS", "PNIN", "PNLF", "PNSE", "POOL",
	"PORT", "POWR", "PPGL", "PPRE", "PRDA", "PRIM", "PSAB", "PSDN", "PSGO", "PSSI",
	"PTBA", "PTDU", "PTIS", "PTMP", "PTPP", "PTRO", "PTSN", "PTPW", "PUDP", "PWON",
	"PYFA", "PZZA", "RAJA", "RALS", "RATU", "RBMS", "RCCC", "RDTX", "RELI", "RICY",
	"RIGS", "RISE", "RMKE", "ROCK", "RODA", "ROTI", "SAFE", "SAME", "SAMF", "SAPX",
	"SBMA", "SCCO", "SCMA", "SCNP", "SDPC", "SDRA", "SEMA", "SFAN", "SFXI", "SGAR",
	"SGER", "SGLP", "SGRO", "SHID", "SIDO", "SILO", "SIMP", "SINK", "SIPD", "SKBM",
	"SKLT", "SKRN", "SMAR", "SMBR", "SLIS", "SMCB", "SMDM", "SMDR", "SMGR", "SMIL",
	"SMKL", "SMMA", "SMRA", "SMSM", "SNLK", "SOFA", "SONA", "SOSI", "SOTN", "SPMA",
	"SPTO", "SQMI", "SREI", "SRSN", "SRTG", "SSIA", "SSMS", "SSSI", "SSTM", "STAA",
	"STAR", "STTP", "SUPR", "SURE", "SWAT", "TALF", "TAPG", "TBIG", "TBLA", "TCID",
	"TCPI", "TEBE", "TECH", "TFCO", "TGRA", "TIFA", "TINC", "TINS", "TIPR", "TIRA",
	"TISC", "TKIM", "TLDN", "TLKM", "TMAN", "TMAS", "TMPO", "TNCA", "TOBA", "TOTE",
	"TOTO", "TOWR", "TPIA", "TPMA", "TRFA", "TRIM", "TRIN", "TRIS", "TRST", "TRUE",
	"TRUK", "TSPC", "TUGU", "TULT", "TYRE", "UANG", "UCID", "UECU", "UIDA", "ULTJ",
	"UNIC", "UNTR", "UNVR", "URBN", "USBP", "VKTR", "VRNA", "VTNY", "WEGE", "WEHA",
	"WICO", "WIDI", "WIFI", "WIIM", "WIKA", "WIMP", "WINE", "WINS", "WITC", "WMUU",
	"WOOD", "WSBP", "WTON", "YPAS", "YULE", "ZBRA", "ZONE", "ZYRX"
];

const uniqueRadarWatchlist = [...new Set(radarWatchlist)];

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

const uniqueWarrantWatchlist = [...new Set(warrantWatchlist)];

// ==========================================
// 3. HELPER RELASI WARAN & SAHAM INDUK
// ==========================================
function getParentTickerFromWarrant(warrantTicker) {
	if (!warrantTicker) return "";
	return warrantTicker.toUpperCase().split("-")[0].trim();
}

const warrantPairs = uniqueWarrantWatchlist.map(warrant => ({
	warrant: warrant,
	parent: getParentTickerFromWarrant(warrant)
}));