import type { Catalog } from '../catalog';
import { slForm } from '../plural';
import type { DeviceLabel } from '$lib/devices/label';

/** A number with a decimal comma, as many decimals as it has: 0.25 → "0,25", 2 → "2". */
const num = (x: number): string => String(x).replace('.', ',');

/** Kje je video samo na telefonu, za »na«: »na telefonu Pixel 8«. */
const naNapravi = (d: DeviceLabel | null): string => {
	if (!d) return 'na drugi napravi';
	if (d.kind === 'android') return d.model ? `na telefonu ${d.model}` : 'na telefonu Android';
	const other: Record<string, string> = {
		iphone: 'na iPhonu',
		ipad: 'na iPadu',
		computer: 'na računalniku'
	};
	return other[d.kind] ?? 'na drugi napravi';
};
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const video: Catalog['video'] = {
	rate: (r) => `${num(r)}×`,
	rateChip: (r) => `${num(r)}×`,
	speed: 'Hitrost',
	speedOf: (r) => `Hitrost ${num(r)}×`,
	mirror: 'Zrcali',
	mirrored: 'Zrcaljeno',
	mute: 'Brez zvoka',
	repeat: 'Ponavljaj vse',
	play: 'Predvajaj',
	pause: 'Začasno ustavi',
	fullScreen: 'Čez cel zaslon',
	fromYouTube: 'z YouTuba ↗',
	player: 'Predvajalnik videa',
	untitled: 'Videoposnetek',
	recording: 'Posnetek',
	audio: 'Zvok',
	lessonVideo: 'Video lekcije',
	videoNo: (n) => `Video ${n}`,
	recordingOf: (figure) => `Posnetek · ${figure}`,
	closePlayer: 'Zapri predvajalnik',
	fullVideo: 'Cel video',
	looping: 'Se ponavlja',
	loop: 'Ponavljaj',
	sectionsCount: (n) => `Odseki (${n})`,
	timeline: 'Mesto v videu',
	showControls: 'Pokaži gumbe',
	loadingVideo: 'Nalaganje videa',
	zoom: (x) => `Povečava ${num(x)}×`,
	resetZoom: 'Ponastavi',
	show: 'Pokaži',
	hide: 'Skrij',
	secs: (s) => `${num(s)} s`,
	minus: (s) => `−${num(s)} s`,
	plus: (s) => `+${num(s)} s`,
	backBy: (s) => `−${num(s)} s, nazaj`,
	forwardBy: (s) => `+${num(s)} s, naprej`,

	markPoint: 'Označi točko',
	mark: 'Označi',
	section: 'Odsek',
	startSection: 'Začni odsek',
	endSection: 'Končaj odsek',
	endShort: (length) => `Konec · ${length}`,
	endSectionAt: (length) => `Končaj odsek · ${length}`,

	pointAt: (time) => `Točka pri ${time}`,
	point: 'točka',
	notLinked: 'Ni povezano',
	linkedTo: (labels) => `Povezano: ${labels}`,
	links: (labels) => `Povezave: ${labels}`,
	archived: '(arhivirano)',
	linked: 'povezano',
	link: 'Poveži',
	linkPoint: 'Poveži to točko',
	linkSection: 'Poveži ta odsek',
	linkToPosition: 'Poveži s položajem',
	linkToAny: 'Poveži z figuro, vajo ali položajem',

	spots: 'Odseki in točke',
	spotsCount: (n) => `Odseki in točke · ${n}`,
	all: 'Vse',
	closeList: 'Zapri seznam',
	loadFailed: 'Odsekov in točk ni bilo mogoče naložiti',
	empty: {
		lead: 'Še nič ni označeno.',
		mark: 'shrani ta trenutek;',
		section: 'shrani del, ki se ponavlja.'
	},
	editOf: (label) => `Uredi: ${label}`,

	editor: {
		renameOf: (label) => `Preimenuj: ${label}`,
		rename: 'Preimenuj',
		start: 'Začetek',
		end: 'Konec',
		moveStart: 'Premik začetka',
		moveEnd: 'Premik konca',
		movePoint: 'Premik točke',
		now: 'Zdaj',
		whole: (length) => `Cel odsek · ${length}`,
		earlier: '‹ Prej',
		shorter: 'Krajše',
		longer: 'Daljše',
		later: 'Pozneje ›',
		edges: 'Robova odseka: povlecite ročico ali pritisnite za skok',
		edgesHint: 'povlecite ročico · pritisnite za skok'
	},

	sheet: {
		name: 'Ime',
		nameHelp: 'Pustite prazno, da se pokažejo časi.',
		deleteTitle: (label) => `Želite izbrisati »${label}«?`,
		deletePoint: 'Točka bo izbrisana iz tega videa. Še nekaj sekund lahko to razveljavite.',
		deleteSection: 'Odsek bo izbrisan iz tega videa. Še nekaj sekund lahko to razveljavite.',
		unlinkFirst: 'Povezavo najprej odstranite tam; do takrat ta odsek ostane.',
		keep: 'Obdrži'
	},

	keys: {
		title: 'Tipke',
		toggle: 'predvajanje / premor',
		second: '1 s nazaj / naprej',
		tenth: '0,1 s nazaj / naprej',
		mark: 'označi točko (cel video)',
		section: 'začni / končaj odsek (cel video)',
		edges: 'začetek / konec na zdaj (urejanje)',
		jump: 'skok na začetek / zadnji dve sekundi',
		loop: 'ustavi / nadaljuj ponavljanje (urejanje)',
		back: 'eno raven nazaj',
		help: 'te tipke'
	},
	legend: {
		play: 'predvajanje',
		edges: 'začetek / konec tu',
		jump: 'skok na začetek / konec',
		mark: 'označi',
		section: 'odsek',
		loop: 'ponavljanje',
		all: 'vse tipke'
	},

	toast: {
		pointSaved: (time) => `Točka shranjena pri ${time}`,
		sectionSaved: (length) => `Odsek shranjen · ${length}`,
		playOn: 'Predvajajte še malo, nato končajte odsek',
		edgeSet: (edge, time) => `${edge === 'start' ? 'Začetek' : 'Konec'} nastavljen na ${time}`,
		deleted: (label) => `Izbrisano: ${label}`,
		saveFailed: 'Shranjevanje ni uspelo',
		restoreFailed: 'Obnovitev ni uspela',
		pointFailed: 'Točke ni bilo mogoče shraniti. Poskusite znova.'
	},

	refusal: {
		noVideo: 'Tega videa ni.',
		noSpot: 'Te točke ali odseka ni.',
		noSection: 'Tega odseka ni.',
		noLink: 'Te povezave ni.',
		labelText: 'Ime mora biti besedilo.',
		labelLong: (max) => `Ime je lahko dolgo največ ${max} znakov.`,
		noStart: 'Točka ali odsek potrebuje začetek.',
		endAfterStart: 'Odsek se mora končati za začetkom.',
		pointNoEnd: 'Točka nima konca.',
		sectionNeedsEnd: 'Odsek potrebuje konec.',
		linked: (labels) => `Povezano: ${labels}. Najprej odstranite povezavo.`,
		failed: (status) => `Ni uspelo (napaka ${status}).`
	},

	place: {
		onlyHere: 'samo na tem telefonu',
		onlyIphone: 'samo na tem iPhonu',
		uploading: (pct) => `nalagam ${pct} %`,
		both: 'na telefonu in na strežniku',
		on: (d) => naNapravi(d),
		missingGallery: 'ni več v galeriji',
		missingHere: 'ni več na tem telefonu',
		sheetTitle: 'Kje je ta video',
		thisPhone: 'Ta telefon',
		original: (size) => `Izvirnik · ${size} · predvaja se od tu`,
		server: 'Strežnik',
		notUploaded: 'Ni naložen. Računalnik in druge naprave ga ne morejo predvajati.',
		copy: (size) => `Kopija · ${size}`,
		upload: 'Naloži',
		remove: 'Odstrani',
		sheetNote:
			'Naloži pošlje manjšo kopijo (velikost iz Nastavitev → Video). Izvirnik vedno ostane na telefonu.',
		sheetNoteOriginal: 'Naloži pošlje izvirnik. Ta ostane tudi na telefonu.',
		frameTitle: (d) => capital(naNapravi(d)),
		frameBody:
			'Video je samo tam. Odseki so spodaj; predvajate ga lahko na tisti napravi ali tu, ko ga tam naložite.',
		iphoneTitle: 'Video je samo v tem iPhonu',
		iphoneBody:
			'iPhone lahko shranjene datoteke izbriše, ko mu zmanjka prostora ali ko aplikacije dolgo ne odprete. Video, ki je samo tu, bi izgubili. Varno je, ko ga naložite.',
		gotIt: 'Razumem',
		iphoneWhy: 'Zakaj je to pomembno',
		close: 'Zapri',
		saved: 'Shranjeno na tem telefonu',
		noSpace: 'Na telefonu ni dovolj prostora za ta video.',
		notSaved: 'Videa ni bilo mogoče shraniti na telefon.',
		deleteOnly:
			'Video je samo na tem telefonu. V aplikaciji ga ne bo več, tudi njegovih odsekov ne.',
		deleteOnlyIphone:
			'Video je samo v tem iPhonu: izbris je dokončen, tudi njegovih odsekov ne bo več.',
		alsoGallery: 'Izbriši tudi iz galerije',
		removeDone: 'Kopija s strežnika je odstranjena',
		uploadFailed: 'Nalaganje ni uspelo. Video ostane na telefonu.',
		move: {
			here: 'Videi s tega telefona · naložijo se v skupino',
			name: (n) => `Video ${n}`,
			onlyHere: (size) => `Samo na tem telefonu · ${size}`,
			button: 'Naloži in premakni',
			landed: 'Naložen',
			uploading: 'Nalaganje …',
			after: (n) => {
				const f = slForm(n);
				if (f === 'one')
					return 'Ko se naloži, se lekcija premakne sama. Če okno zaprete, se video vseeno naloži, lekcija pa ostane tu.';
				if (f === 'two')
					return 'Ko se naložita, se lekcija premakne sama. Če okno zaprete, se videa vseeno naložita, lekcija pa ostane tu.';
				return 'Ko se naložijo, se lekcija premakne sama. Če okno zaprete, se videi vseeno naložijo, lekcija pa ostane tu.';
			},
			elsewhere: (n, d) => {
				const kje = naNapravi(d);
				const f = slForm(n);
				if (f === 'one') return `1 video je ${kje}`;
				if (f === 'two') return `${n} videa sta ${kje}`;
				if (f === 'few') return `${n} videi so ${kje}`;
				return `${n} videov je ${kje}`;
			},
			elsewhereBody: (n) => {
				const f = slForm(n);
				if (f === 'one')
					return 'Na strežniku ga ni, zato se od tu ne more naložiti. Na tisti napravi odprite video in tapnite Naloži, potem lekcijo premaknite. Če jo premaknete zdaj, videa v aplikaciji ne boste več videli.';
				if (f === 'two')
					return 'Na strežniku ju ni, zato se od tu ne moreta naložiti. Na tisti napravi ju odprite in tapnite Naloži, potem lekcijo premaknite. Če jo premaknete zdaj, ju v aplikaciji ne boste več videli.';
				return 'Na strežniku jih ni, zato se od tu ne morejo naložiti. Na tisti napravi jih odprite in tapnite Naloži, potem lekcijo premaknite. Če jo premaknete zdaj, jih v aplikaciji ne boste več videli.';
			},
			without: (n) => (n === 1 ? 'Premakni brez videa' : 'Premakni brez videov'),
			notUploaded: 'Video s telefona še ni naložen. Naložite ga ali premaknite brez njega.'
		},
		copyLeaves: (n, d) => {
			const kje = naNapravi(d);
			const f = slForm(n);
			if (f === 'one') return `1 video je samo ${kje}: ostane, dokler ga tam ne naložite.`;
			if (f === 'two') return `${n} videa sta samo ${kje}: ostaneta, dokler ju tam ne naložite.`;
			if (f === 'few') return `${n} videi so samo ${kje}: ostanejo, dokler jih tam ne naložite.`;
			return `${n} videov je samo ${kje}: ostanejo, dokler jih tam ne naložite.`;
		},
		refusal: {
			tooBig: 'Video je večji od 1 GB, ne morem ga naložiti.',
			notHolder: 'Kopijo s strežnika lahko odstrani samo naprava z izvirnikom.',
			onServer: 'Ta video je že na strežniku.',
			noServerCopy: 'Ta video nima kopije na strežniku.',
			badFile: 'Navedite datoteko videa.',
			badSize: 'Navedite velikost videa.',
			badSlot: 'Navedite to napravo.',
			groupUploads: 'Videi skupine se vedno naložijo.',
			onDevice: 'Ta video je samo na napravi, tu ga ni mogoče prebrati.'
		}
	}
};
