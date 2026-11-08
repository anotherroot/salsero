import type { Catalog } from '../catalog';
import { slCount } from '../plural';

type Forms = [one: string, two: string, few: string, other: string];

const VAJA: Forms = ['vaja', 'vaji', 'vaje', 'vaj'];

// No past tense about the reader ("Vse vaje so opravljene", not "Opravili ste"),
// and an exercise's name always before a "·" or after a colon.
export const today: Catalog['today'] = {
	row: {
		done: 'Opravljeno',
		added: 'Dodano',
		ahead: 'Vnaprej',
		fromClass: (day) => `z lekcije ${day}`,
		upNext: 'Naslednja',
		notToday: 'Ne danes'
	},
	reviewOf: (title) => `Ponovitev: ${title}`,
	hero: {
		forToday: (n) => `${slCount(n, VAJA)} za danes`,
		left: (n) => `Še ${slCount(n, VAJA)} za danes`,
		doneOf: (done, total) => `Opravljeno: ${done} od ${total}`,
		about: (minutes) => `približno ${minutes} min`,
		// The count is in the list's heading ("Vaje · 5"); "Vseh 5 vaj je opravljenih" is too long here.
		allDone: () => 'Vse opravljeno',
		allDoneMeta: 'Današnja vadba je končana',
		everything: 'Vse vaje so opravljene',
		everythingMeta: (when) => `Naslednja je na vrsti ${when}`,
		nothingLeft: 'Za danes ni nič več',
		nothingLeftMeta: (when) => `Ostale so spet na vrsti ${when}`,
		nothingDue: 'Danes ni nič na vrsti',
		nothingDueMeta: 'Spodaj lahko vadite vnaprej',
		nothingOn: 'Danes ni ničesar',
		nothingOnMeta: 'Vse vaje so na premoru',
		start: 'Začni vadbo',
		resume: 'Nadaljuj vadbo'
	},
	list: {
		warmup: (n) => `Ogrevanje · ${n}`,
		// Not "Vadba": that is a session (glossary).
		practice: (nothingLeft, n) => `${nothingLeft ? 'Opravljeno danes' : 'Vaje'} · ${n}`,
		next: (n) => `Dodaj še ${n}`,
		nextUp: 'Naslednja na vrsti',
		andMore: (day, n) => `${day} · in še ${n}`,
		seeComing: 'Poglej, kaj prihaja',
		emptyTitle: 'Še ni ničesar za vadbo',
		emptyBody: 'Iz svojih figur sestavite kombinacijo ali dodajte svojo vajo.',
		buildRoutine: 'Sestavi kombinacijo',
		previousDay: 'Prejšnji dan',
		nextDay: 'Naslednji dan',
		backToToday: 'Nazaj na danes',
		pickToOpen: 'Izberite vajo, da jo odprete.',
		soFar: 'Danes doslej'
	},
	totals: (exercises) => slCount(exercises, VAJA),
	coming: {
		waiting: 'Naslednje na vrsti',
		paused: 'Na premoru',
		nothing: 'Še nič ne prihaja.',
		putOn: (name) => `Dodaj za danes: ${name}`,
		onToday: 'Za danes',
		doneToday: 'Opravljeno danes'
	},
	past: {
		loggedToday: 'Vneseno danes',
		loggedThatDay: 'Vneseno tisti dan',
		addSet: (name) => `Dodaj za ta dan: ${name}`,
		done: 'Opravljeno',
		nothingToday: 'Danes še ni vnosov',
		nothingThatDay: 'Ta dan ni vnosov',
		forgot: 'Manjka kakšen vnos za ta dan?',
		pick: 'Izberite vajo\u00a0…',
		logOn: (day) => `Dodaj za ${day}`,
		search: 'Iskanje vaj',
		none: 'Še ni vaj.'
	},
	newExercise: {
		title: 'Nova vaja',
		name: 'Ime',
		placeholder: 'npr. osnovni korak son, ploskanje clave',
		notes: 'Opombe',
		optional: '(neobvezno)',
		add: 'Dodaj vajo',
		hint: 'Za samostojno vadbo figure jo odprite in pritisnite »Vadi samostojno«.'
	},
	tile: {
		figurePartner: 'Različica, v paru',
		figureSolo: 'Različica, solo',
		routine: 'Kombinacija',
		lesson: 'Ponavljanje lekcije',
		drill: 'Vaja',
		doneToday: (label) => `${label}, opravljeno danes`,
		done: 'Opravljeno'
	},
	toast: {
		notToday: (name) => `${name} · ne danes`,
		onToday: (name) => `${name} · dodano za danes`
	},
	deletedGroup: (title, team) => `${title} · ${team} (izbrisana)`,
	refused: {
		addMore: 'Ni bilo mogoče dodati več vaj. Poskusite znova.',
		addToToday: 'Ni bilo mogoče dodati za danes. Poskusite znova.',
		skip: 'Ni bilo mogoče preskočiti. Poskusite znova.',
		putBack: 'Ni bilo mogoče vrniti. Poskusite znova.',
		undo: 'Ni bilo mogoče razveljaviti. Poskusite znova.',
		addExercise: 'Vaje ni bilo mogoče dodati.',
		pickWhat: 'Izberite vajo, ki jo želite dodati ali preskočiti.',
		noPick: 'Te izbire ni.',
		nothingToAdd: 'Za danes ni več ničesar za dodati.',
		name: 'Vpišite ime (do 200 znakov).',
		noExercise: 'Te vaje ni.',
		archived: 'Ta vaja je arhivirana.',
		paused: 'Ta vaja je na premoru.',
		warmupOrder: 'Vrstnega reda ni bilo mogoče shraniti. Poskusite znova.'
	}
};
