import type { Catalog } from '../catalog';

/** A number with a decimal comma, as many decimals as it has: 0.25 → "0,25", 2 → "2". */
const num = (x: number): string => String(x).replace('.', ',');

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
	linkToAny: 'Poveži z različico, vajo ali položajem',

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
	}
};
