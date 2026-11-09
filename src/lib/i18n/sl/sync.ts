import type { Catalog } from '../catalog';
import { slCount, slForm } from '../plural';

/** "5 sprememb čaka", "2 spremembi čakata": the verb agrees with the count. */
const changesWait = (n: number) =>
	`${slCount(n, ['sprememba', 'spremembi', 'spremembe', 'sprememb'])} ${
		{ one: 'čaka', two: 'čakata', few: 'čakajo', other: 'čaka' }[slForm(n)]
	}`;

// Sinhronizacija (offline phase 3). A person's name stands after a "·".
export const sync: Catalog['sync'] = {
	title: 'Sinhronizacija',
	status: {
		waiting: (n) => `${n} v čakanju`,
		refused: (n) => `Ni sinhronizirano: ${n}`,
		signIn: 'Prijavite se za sinhronizacijo'
	},
	strip: {
		offline: (n) => (n === 0 ? 'Brez povezave' : `Brez povezave · ${changesWait(n)}`),
		waiting: (n) => `${changesWait(n)} na pošiljanje`,
		sending: (n) => `Pošiljam ${n} …`,
		sent: 'Vse poslano',
		see: 'Poglej'
	},
	refusedHeading: 'Ni sinhronizirano',
	waitingHeading: 'V čakanju',
	retry: 'Poskusi znova',
	discard: 'Zavrzi',
	compare: 'Primerjaj',
	discardTitle: 'Želite zavreči to spremembo?',
	discardBody: 'Na strežniku ni bila nikoli shranjena.',
	discardMore: (n) => `Zavržejo se tudi spremembe, ki čakajo nanjo (${n}).`,
	held: 'Čaka na spremembo zgoraj',
	lastSynced: (when) => `Zadnja sinhronizacija: ${when}`,
	never: 'Še ni sinhronizirano',
	tryNow: 'Poskusi zdaj',
	allSynced: 'Vse je sinhronizirano.',
	signIn: 'Prijava',
	waitingBadge: 'Čaka',
	reason: {
		gone: 'Medtem je bilo arhivirano ali izbrisano.',
		clash: (by) => (by ? `Medtem spremenjeno · ${by}` : 'Medtem je nekdo spremenil.'),
		stale: 'Aplikacija je bila medtem posodobljena.',
		access: 'Tega ne morete več spreminjati.',
		error: 'Strežnik tega ni mogel shraniti.',
		notAllowed: 'Potrebna je povezava.',
		badIds: 'Ne ujema se s strežnikom.'
	},
	label: {
		log: (thing, when) => `Vnos · ${thing} · ${when}`,
		note: (thing) => `Opomba · ${thing}`,
		name: (thing) => `Ime · ${thing}`,
		new: (thing) => `Novo · ${thing}`,
		removed: (thing) => `Odstranjeno · ${thing}`,
		edit: (thing) => `Sprememba · ${thing}`,
		comment: (thing) => `Komentar · ${thing}`,
		heart: 'Srček na komentarju',
		other: 'Sprememba'
	},
	signOut: {
		title: (n) => `Nesinhronizirane spremembe: ${n}`,
		body: 'Se želite odjaviti in jih izgubiti?',
		confirm: 'Odjava'
	}
};
