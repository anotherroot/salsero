// Stran figure: dejstva, Posnetki in njihova okna, tri vrstice, preklopnik,
// Nova figura, Premakni v …, Arhiviraj, urejanje in zavrnitve strani.
// Names people gave (a move, a figure, a position) go after a colon or a "·",
// or in »…« in a question, never declined.
import type { Catalog } from '../catalog';
import { slCount, slForm } from '../plural';
import { nouns } from './nouns';

export const figure: Catalog['figure'] = {
	subtitle: {
		figure: 'Figura',
		teamFigure: (team) => `Figura · ${team}`,
		timing: (lead, start, length) => `${lead} · začne na ${start} · ${nouns.counts(length)}`,
		editing: (variation) => `Urejanje · ${variation}`
	},
	timing: {
		label: 'Začetek in dolžina',
		line: (start, length) => `Začne na ${start} · ${nouns.counts(length)}`,
		oneEight: ' · ena osmica',
		eights: (n) => ` · ${slCount(n, ['osmica', 'osmici', 'osmice', 'osmic'])}`,
		startsOnCount: (n) => `Začne na ${n}`,
		starts: (list) => `Začne na ${list}`,
		anyCount: 'Začne na katerokoli dobo',
		counts: (n) => nouns.counts(n),
		youChoose: 'dolžino izberete v kombinaciji',
		startsOnCounts: (list) => `Lahko začne na ${list}`
	},
	facts: 'Podatki',
	positions: 'Položaji',
	noPosition: 'Brez položaja',
	or: 'ali',
	notes: {
		placeholder: 'Štetje, drže, kar ste slišali na tečaju\u00a0…'
	},
	fields: {
		figurePlaceholder: 'npr. Básica, Doble, Iz križa',
		danced: 'Kako se pleše',
		style: 'Slog'
	},
	length: {
		startsOn: 'Začne na',
		counts: 'Dolžina',
		unit: 'dob',
		help: (max) => `Koliko dob traja, od 1 do ${max}. Ena osmica je 8.`,
		error: (max) => `Od 1 do ${max} dob. Ena osmica je 8.`,
		shortcuts: 'Hitre dolžine',
		canStartOn: 'Lahko začne na',
		all: 'Vse',
		onlyOne: 'Samo 1',
		count: (n) => `Doba ${n}`,
		youChoose: 'Izberete sami',
		youChooseHint: (n) =>
			`Določite jo v vsaki kombinaciji. Ko jo vadite samo, traja ${nouns.counts(n)}.`
	},
	edit: {
		stop: 'Končaj urejanje',
		label: (variation) => `Urejanje · ${variation}`,
		notSaved: 'Ni bilo shranjeno.'
	},
	practice: {
		doneToday: 'Danes opravljeno',
		paused: 'Na premoru · ni na seznamu Danes',
		fallback: 'Vadenje',
		practise: 'Vadi',
		adding: 'Dodajanje na Danes\u00a0…',
		addFailed: 'Dodajanje na Danes ni uspelo.',
		added: 'Zdaj je na Danes',
		open: 'Odpri'
	},
	menu: {
		exercise: 'Njena vaja',
		// Today's New exercise hint names this item: »Vadi samostojno«.
		create: 'Vadi samostojno',
		createMeta: 'Doda jo na Danes kot samostojno vajo',
		history: 'Zgodovina',
		move: 'Premakni v drug gib\u00a0…',
		moveMeta: 'Ali v nov, samostojen gib',
		archive: () => 'Arhiviraj figuro'
	},
	archive: {
		title: (variation) => `Želite arhivirati »${variation}«?`,
		button: () => 'Arhiviraj figuro',
		buttonLast: 'Arhiviraj in odstrani gib',
		kept: 'Njeni posnetki in zgodovina vadenja se ohranijo.',
		captionLast: (move, variation) =>
			`Z njo gre tudi gib: ${move}. »${variation}« je njegova zadnja figura.`,
		caption: (move, variation) => `»${variation}« zapusti gib: ${move}.`
	},
	remove: {
		title: (move) => `Gib bo odstranjen: ${move}`,
		body: (variation) =>
			`To je njegova zadnja figura (${variation}), gib brez figur pa ne obstaja. Izgine s seznama figur.`,
		kept: ' Njeni posnetki in zgodovina vadenja se ohranijo.'
	},
	recordings: {
		title: 'Posnetki',
		titleCount: (n) => `Posnetki · ${n}`,
		addLabel: 'Dodaj med posnetke',
		addVideo: 'Dodaj video',
		video: 'Videoposnetek',
		audio: 'Zvočni posnetek',
		fromYouTube: 'Z YouTuba',
		recording: 'Posnetek',
		recordingOf: (what) => `Posnetek · ${what}`,
		dayWithYear: (day, year) => `${day} ${year}`,
		missing: 'Datoteka manjka',
		unplayable: 'Tukaj se ne predvaja',
		play: (day) => `Predvajaj posnetek: ${day}`,
		playLabel: (label) => `Predvajaj: ${label}`,
		from: (day) => `Posnetek: ${day}`,
		download: 'Prenesi',
		openOnYouTube: 'Odpri na YouTubu',
		none: 'brez posnetkov',
		// The row's button: short, so the recording's name keeps its room; the label says it all.
		unlink: 'Odveži',
		unlinkLabel: (section, figure) => `Odstrani povezavo: ${section} → ${figure}`,
		notDeleted: 'Ni izbrisano',
		deleteLabel: 'Izbriši ta posnetek',
		deleteTitle: 'Želite izbrisati ta posnetek?',
		deleteBody: (day, size, goes) => `${day} · ${size}. ${goes}Tega ni mogoče razveljaviti.`,
		// The verb and the adjective agree with the count: gre, gresta, gredo.
		sectionsGo: (n) => {
			if (n === 0) return '';
			const form = slForm(n);
			if (form === 'one') return `Z njim gre tudi ${n} shranjeni odsek. `;
			if (form === 'two') return `Z njim gresta tudi ${n} shranjena odseka. `;
			if (form === 'few') return `Z njim gredo tudi ${n} shranjeni odseki. `;
			return `Z njim gre tudi ${n} shranjenih odsekov. `;
		},
		waitUpload: 'Počakajte, da se nalaganje konča'
	},
	add: {
		title: (figure) => `Dodaj: ${figure}`,
		section: 'Poveži odsek',
		sectionMeta: 'Del videa lekcije',
		video: 'Video s telefona',
		link: 'Povezava',
		linkMeta: 'YouTube ali katera koli spletna stran'
	},
	links: {
		saving: 'Shranjevanje v 480p\u00a0…',
		failed: (why) => `Ni bilo mogoče shraniti: ${why}`,
		unknownError: 'neznana napaka',
		remove: (title) => `Odstrani: ${title}`,
		saveLabel: (title) => `Shrani kot video: ${title}`,
		retryLabel: (title) => `Znova shrani: ${title}`,
		retry: 'Znova'
	},
	relations: {
		follows: 'Pred njo',
		leads: 'Sledi ji',
		routines: 'V kombinacijah',
		// The locative after "V": its own four forms.
		inRoutines: (n) =>
			`V ${slCount(n, ['kombinaciji', 'kombinacijah', 'kombinacijah', 'kombinacijah'])}`,
		none: 'Nobena',
		label: 'Figure in kombinacije okoli te figure',
		loops: 'se sklene',
		searchRoutines: 'Iskanje kombinacij',
		searchFigures: 'Iskanje figur',
		noRoutine: 'Nobena kombinacija ne ustreza.',
		noFigure: 'Nobena figura ne ustreza.',
		slot: (n, of) => `Mesto ${n} od ${of}`,
		slots: (slots, of) => {
			const head = slots.slice(0, -1).join(', ');
			const word = slForm(slots.length) === 'two' ? 'Mesti' : 'Mesta';
			return `${word} ${head} in ${slots[slots.length - 1]} od ${of}`;
		}
	},
	taughtIn: (n) => `Na lekcijah · ${n}`,
	switcher: {
		// The genitive after "od": 1 figure, 2+ figur.
		position: (i, count) => `${i} od ${slCount(count, ['figure', 'figur', 'figur', 'figur'])}`,
		previous: 'Prejšnja figura',
		next: 'Naslednja figura',
		of: (move) => `Figure giba: ${move}`,
		tabs: (move) => `Figure giba: ${move}`,
		tab: 'Figura',
		open: (move) => `Odpri: ${move}`,
		newOf: (move) => `Gib: ${move}`,
		namePlaceholder: 'npr. Doble, Iz križa',
		copyOf: (variation) =>
			`Začne kot kopija: ${variation}. Prevzame drže, začetek in dolžino ter opombe, posnetkov ne. Spremenite jih z Uredi.`
	},
	moveTo: {
		title: (variation) => `Premakni »${variation}« v\u00a0…`,
		label: (variation) => `Premik · ${variation}`,
		ownMove: 'Nov, samostojen gib',
		ownMoveMeta: (variation) => `Postane njegova prva figura: ${variation}`,
		newName: 'Ime novega giba',
		join: 'Ali jo dodajte k drugemu gibu',
		noOthers: 'Drugih gibov še ni.',
		move: 'Gib',
		choose: 'Izberite gib\u00a0…',
		pickTitle: 'Dodaj h gibu',
		search: 'Iskanje gibov',
		moves: 'Gibi',
		nameIn: (move) => `Ime v gibu: ${move}`,
		ctaLast: 'Premakni in odstrani gib',
		ctaTo: (move) => `Premakni v: ${move}`,
		ctaOwn: 'Premakni v nov gib',
		clash: (move, name) => `Figura s tem imenom že obstaja: ${move} · ${name}. Izberite drugo ime.`
	},
	refused: {
		notAdded: 'Za vadenje dodajte lekcijo s to figuro.',
		names: 'Vpišite ime figure (do 200 znakov).',
		timing: (max) => `Figura se začne na eni od dob 1–8 in traja od 1 do ${max} dob.`,
		newMoveName: 'Vpišite ime novega giba (do 200 znakov).',
		pickTarget: 'Izberite, kam jo želite premakniti.',
		sameMove: (variation, move) => `Figura je že v tem gibu: ${move} · ${variation}.`,
		alreadyPractised: 'To figuro že vadite samostojno.',
		recordingGone: 'Ta posnetek je bil že odstranjen.',
		pickSection: 'Izberite odsek.',
		linkGone: 'Ta povezava je bila že odstranjena.',
		onlyMedia: 'Naložiti je mogoče le video in zvočne datoteke.'
	}
};
