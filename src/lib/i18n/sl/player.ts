import type { Catalog } from '../catalog';
import { slCount } from '../plural';

// A routine's figures are versions (glossary: različica).
const RAZLICICA: [string, string, string, string] = [
	'različica',
	'različici',
	'različice',
	'različic'
];

export const player: Catalog['player'] = {
	title: 'Vadenje',
	pageTitle: (dance) => `Vadenje · ${dance}`,
	routineLine: (name, figures) => `${name} · ${slCount(figures, RAZLICICA)}`,
	voice: 'Glas',
	recordOwn: 'Posnemite svoje štetje',
	builtIn: 'Vgrajen',
	yours: 'Vaš',
	couldNotStart: 'Predvajalnika ni bilo mogoče zagnati.',
	couldNotStartBody: 'Nič se ne predvaja. Za nov poskus pritisnite Predvajaj.',
	loadingGrid: 'Nalaganje ritma skladbe …',
	calls: 'Napovedi',
	callsLabel: 'Napovedi · različica na 1, 2 ali 4 osmice',
	starting: 'Zaganjanje …',
	pickSongFirst: 'Najprej izberite skladbo.',
	songFailed: 'Te skladbe ni bilo mogoče naložiti. Izberite drugo ali uporabite štetje.',
	paused: (clock) => `Premor · ${clock}`,
	stopAndBack: 'Ustavi in pojdi nazaj',
	routine: 'Kombinacija',
	routineSlots: (n) => `Kombinacija · ${slCount(n, ['mesto', 'mesti', 'mesta', 'mest'])}`,
	routineSlotOf: (slot, total) => `Kombinacija · mesto ${slot} od ${total}`,
	now: 'Zdaj',
	countNotStarted: 'Štetje se še ni začelo',
	countDigit: (digit) => `Štetje ${digit}`,
	bpm: (n) => `${n} BPM`,
	// "1 napovedana različica", "2 napovedani različici", "5 napovedanih različic"
	called: (n) =>
		slCount(n, [
			'napovedana različica',
			'napovedani različici',
			'napovedane različice',
			'napovedanih različic'
		]),
	loggedAsSet: 'shranjeno kot vnos',
	saveTitle: 'Shrani vadenje',
	unsavedLabel: 'To vadenje',
	exercise: 'Vaja',
	chooseExercise: 'Izberite vajo …',
	chooseExerciseTitle: 'Izberite vajo',
	searchExercises: 'Iskanje vaj',
	noExercises: 'Še ni vaj.',
	notePlaceholder: 'Kaj si želite zapomniti?',
	dontSave: 'Ne shrani',
	backToToday: 'Nazaj: Danes',
	backToMusic: 'Nazaj: Glasba',
	refused: {
		couldNotSave: 'Tega vadenja ni bilo mogoče shraniti.',
		noteTooLong: 'Opomba je predolga: največ 2000 znakov.'
	}
};
