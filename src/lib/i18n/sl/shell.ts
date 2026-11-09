import type { Catalog } from '../catalog';

// U+00A0 before "…" and "%": they never start a line.
export const shell: Catalog['shell'] = {
	tabs: {
		today: 'Danes',
		moves: 'Figure',
		lessons: 'Lekcije',
		groups: 'Skupine',
		music: 'Glasba',
		myClass: 'Moj tečaj',
		you: 'Jaz',
		musicToPick: (label) => `${label}, seznam čaka na izbiro`
	},
	mainNav: 'Glavno',
	mine: 'Moje',
	settings: 'Nastavitve',
	backTo: (title) => `Nazaj: ${title}`,
	lists: {
		comingUp: 'Prihaja',
		coverage: 'Pokritost',
		noPosition: 'Brez položaja',
		myCount: 'Moje štetje'
	},
	groupMode: {
		workIn: 'Delo v',
		workInGroup: 'Delo v skupini',
		switchGroup: 'Zamenjaj skupino',
		workingIn: 'Delate tu'
	},
	reload: {
		title: 'Aplikacija je posodobljena',
		staleTitle: 'Ta stran je zastarela',
		staleLine: 'Za nadaljevanje jo znova naložite.',
		reload: 'Znova naloži',
		unsaved: 'Stran ostane odprta, da se nič neshranjenega ne izgubi.',
		held: 'Stran ostane odprta, dokler to teče.',
		open: 'Stran ostane odprta, dokler je to odprto.',
		next: 'Posodobitev se naloži na naslednji strani.'
	},
	error: {
		offlineTitle: 'Brez povezave',
		offlineHeading: 'Niste povezani',
		offlineBody:
			'Ta stran potrebuje strežnik. Preverite povezavo in poskusite znova; nič shranjenega se ne izgubi.',
		notFoundTitle: 'Ni najdeno',
		notFoundHeading: 'Tu ni ničesar',
		notFoundBody: 'Ta stran ne obstaja ali pa je bilo to, kar je prikazovala, izbrisano.',
		title: 'Napaka',
		heading: 'Nekaj je šlo narobe',
		serverBody: 'Strežnik te strani ni mogel odpreti. Čez trenutek poskusite znova.',
		body: 'Vrnite se in poskusite znova.',
		code: (status) => `NAPAKA ${status}`,
		goToday: 'Odpri Danes'
	},
	update: {
		downloading: (pct) => `Prenašanje\u00a0… ${pct}\u00a0%`,
		installing: 'Nameščanje\u00a0…',
		update: 'Posodobi',
		fromPlay: 'Posodobi prek Google Play',
		permission: 'Tej aplikaciji dovolite nameščanje posodobitev, nato se vrnite.',
		busy: 'Posodobitev sledi, ko se nalaganje konča.',
		current: 'Imate najnovejšo različico aplikacije.',
		offline: 'Ni povezave.',
		download: 'Prenos se je prekinil.',
		check: 'Prenos ni prestal preverjanja.',
		install: 'Namestitev ni uspela.',
		rowTitle: 'Nova različica aplikacije',
		hide: 'Skrij do jutri',
		// Always with the noun »aplikacija« (the glossary).
		version: (name) => `Različica aplikacije ${name} je pripravljena`,
		ready: 'Pripravljeno za namestitev',
		neededTitle: 'Potrebna je posodobitev',
		neededBody: 'Ta različica aplikacije ne deluje več. Za nadaljevanje jo posodobite.'
	},
	getApp: {
		title: 'Prenesi aplikacijo',
		intro: 'Vadite kar z začetnega zaslona telefona.',
		openOnPhone: 'To stran odprite na telefonu.',
		qr: 'Koda QR za to stran',
		download: (app, size) => `Prenesi ${app} · ${size}`,
		notReady: 'Aplikacija za Android še ni pripravljena.',
		open: (app) => `Odpri ${app}`,
		androidSteps: [
			'1. Brskalnik vpraša, ali dovolite nameščanje aplikacij iz njega: dovolite, nato pritisnite Namesti.',
			'2. Če Play Protect pravi, da aplikacije ne pozna, pritisnite Vseeno namesti.',
			'3. Odprite aplikacijo in se prijavite s svojim novim računom.'
		],
		sketch: 'Skica zaslona z dovoljenjem: vklopljeno stikalo',
		ios: 'V Safariju pritisnite Deli, nato Dodaj na začetni zaslon.',
		iosNote:
			'Na iPhonu se videi lekcij naložijo le, dokler je stran odprta, dnevnega opomnika pa ni.',
		skip: 'Preskoči, uporabljaj v brskalniku'
	},
	unsaved: {
		title: 'Neshranjene spremembe',
		// No agreement with what is unsaved: its noun's gender is the caller's.
		line: (labels) => `Še ni shranjeno: ${labels}.`,
		saving: 'Shranjevanje\u00a0…',
		notSaved: 'Ni shranjeno',
		stay: 'Ostani',
		stayAndFix: 'Ostani in popravi',
		without: (verb) => `${verb} brez shranjevanja`,
		leave: 'Zapusti',
		didNotSave: 'Shranjevanje ni uspelo.',
		notSent: 'Ni bilo poslano.'
	},
	clash: {
		goneSub: 'Nič ni bilo shranjeno. Preden to zaprete, kopirajte svoje besedilo.',
		sub: 'Njihovo je shranjeno, vaše še ne: uredite ga, nato izberite.',
		nothingTyped: 'Nič ni bilo vpisano.',
		theirs: 'Njihovo',
		yours: 'Vaše',
		empty: '(prazno)',
		alsoChanged: (fields) => `Spremenjeno tudi: ${fields}. »Shrani moje« tudi tam ohrani vaše.`,
		saveMine: 'Shrani moje',
		keepTheirs: 'Obdrži njihovo'
	},
	clearSearch: 'Počisti iskanje',
	dismiss: 'Zapri',
	stepper: { slower: 'Počasneje', faster: 'Hitreje' },
	upload: {
		title: (pct) => `Nalaganje\u00a0… ${pct}\u00a0%`,
		helper: 'Aplikacijo lahko uporabljate naprej; zaprtje zavihka nalaganje ustavi',
		bar: (what) => `Nalaganje: ${what}`,
		nouns: { file: 'datoteka', recording: 'posnetek', videos: 'videi' },
		anUpload: 'Nalaganje',
		failed: 'Nalaganje ni uspelo.',
		tooLarge: (limit) => `Datoteka je prevelika (največ ${limit}).`,
		connection: 'Nalaganje ni uspelo. Preverite povezavo in poskusite znova.',
		inBackground: 'Stisnjeno in naloženo v ozadju',
		larger: (limit) => `Datoteka je večja od ${limit}.`,
		empty: 'Datoteka je prazna.',
		interrupted: 'Nalaganje je bilo prekinjeno. Poskusite znova.'
	},
	offline: {
		needsConnection: 'Potrebna je povezava. Nič se ni spremenilo.',
		/** At the top of a sheet whose actions need a connection (offline phase 3). */
		needsConnectionFor: 'Za te je potrebna povezava'
	}
};
