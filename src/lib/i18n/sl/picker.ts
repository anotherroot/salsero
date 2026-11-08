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
	groups: {
		figures: 'Različice',
		routines: 'Kombinacije',
		drills: 'Vaje',
		lessons: 'Lekcije',
		positions: 'Položaji',
		otherVideos: 'Drugi videi'
	},
	routineMeta: (slots, loops) => `${nouns.slots(slots)}${loops ? ' · se sklene' : ''}`
};
