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
	loadingGrid: 'Nalaganje ritma skladbe\u00a0…',
	follow: 'Sledi',
	still: 'Mirno',
	routinePlace: (n, total) => `${n} od ${total}`,
	figures: (n) => slCount(n, RAZLICICA),
	startFrom: (n, names) => `Začni pri ${n}, ${names}`,
	or: 'ali',
	showFull: 'Pokaži kombinacijo čez cel zaslon',
	closeFull: 'Zapri kombinacijo čez cel zaslon',
	kind: { figure: 'Različica', drill: 'Vaja', routine: 'Kombinacija' },
	about: 'Podrobnosti',
	aboutOf: (name) => `Podrobnosti: ${name}`,
	aboutNotes: 'Zapiski',
	aboutPositions: 'Položaji',
	aboutSections: (n) =>
		n === 1
			? 'odsek iz lekcije'
			: slCount(n, [
					'odsek iz lekcije',
					'odseka iz lekcije',
					'odseki iz lekcije',
					'odsekov iz lekcije'
				]),
	aboutRecordings: (n) =>
		n === 1 ? 'posnetek' : slCount(n, ['posnetek', 'posnetka', 'posnetki', 'posnetkov']),
	aboutLinks: (n) =>
		n === 1 ? 'povezava' : slCount(n, ['povezava', 'povezavi', 'povezave', 'povezav']),
	starting: 'Zaganjanje\u00a0…',
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
	backToToday: 'Nazaj: Danes',
	backToMusic: 'Nazaj: Glasba'
};
