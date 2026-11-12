// Skupni izbirnik: vrstica za ustvarjanje, Končano, prazno polje, zavrnjena povezava,
// gumbi v vrstici ter naslovi skupin in druge vrstice. What is typed is quoted with » «;
// a row's name goes after a colon.
import type { Catalog } from '../catalog';
import { nouns } from './nouns';

export const picker: Catalog['picker'] = {
	createLead: (typed) => `Ni na seznamu? Ustvari »${typed}« kot`,
	createLeadBare: 'Ni na seznamu?',
	doneLinked: (n) => `Končano · povezano: ${n}`,
	doneField: (n) => `Končano · ${n}`,
	noMatch: (typed) => `Nič ne ustreza »${typed}«.`,
	notLinked: (label) => `Povezava ni uspela: ${label}. Poskusite znova.`,
	tryAgain: 'Poskusite znova.',
	play: (label) => `Predvajaj: ${label}`,
	addKeep: (label) => `Poveži in izbiraj naprej: ${label}`,
	linking: (label) => `Povezovanje: ${label}`,
	linked: 'Povezano',
	loading: 'Nalaganje',
	refused: 'Tega ni bilo mogoče povezati.',
	restore: 'Obnovi',
	restoring: 'Obnavljanje …',
	pickAnother: 'Izberi drugo',
	creating: 'Ustvarjanje …',
	notCreated: 'Tega ni bilo mogoče ustvariti.',
	moveField: {
		label: 'Gib',
		placeholder: 'Izberite ali vnesite gib …',
		title: 'Izberite gib',
		search: 'Iščite ali poimenujte nov gib',
		none: 'Gibov še ni. Vnesite ime, da ga ustvarite.',
		tag: 'Nov gib',
		group: 'Gibi'
	},
	elsewhere: {
		yours: 'Vaše',
		readOnly: (name) => `${name} · samo berete`,
		alsoIn: (names) => `tudi v: ${names}`,
		hasOwn: 'Ta skupina ima svojo',
		noneHere: (typed) => `Tu nič ne ustreza »${typed}«.`,
		offline: 'Za druga mesta potrebujete povezavo.',
		looking: 'Iskanje po vaših drugih mestih …',
		copyHere: (label) => `Kopiraj sem in poveži: ${label}`
	},
	groups: {
		figures: 'Figure',
		routines: 'Kombinacije',
		drills: 'Vaje',
		lessons: 'Lekcije',
		positions: 'Položaji',
		otherVideos: 'Drugi videi'
	},
	routineMeta: (slots, loops) => `${nouns.slots(slots)}${loops ? ' · se sklene' : ''}`,
	look: {
		preview: (label) => `Predogled: ${label}`,
		linkThis: 'Poveži to',
		addThis: 'Dodaj to',
		pickThis: 'Izberi to',
		startsOn: (count) => `Začne na ${count}`,
		endsAfter: (n) => `Traja ${nouns.counts(n)}`,
		ends: 'Konča',
		noPositions: 'Položaji niso nastavljeni',
		noVideo: 'Še ni videa',
		yourRecording: 'Vaš posnetek',
		soundOn: 'Vklopi zvok',
		soundOff: 'Izklopi zvok',
		andMore: (n) => `in še ${n}`,
		failed: 'Tega ni bilo mogoče naložiti.'
	}
};
