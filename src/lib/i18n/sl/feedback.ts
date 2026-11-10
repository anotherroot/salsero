import type { Catalog } from '../catalog';
import { slCount } from '../plural';

export const feedback: Catalog['feedback'] = {
	section: 'Povratne informacije',
	row: 'Pošljite povratne informacije',
	rowSub: 'Kaj ne deluje ali manjka?',
	title: 'Povratne informacije',
	intro:
		'Napišite, kaj ste naredili in kaj se je zgodilo. Zraven se pošljejo stran, na kateri ste bili, različica aplikacije ter vaš telefon ali brskalnik.',
	label: 'Vaše sporočilo',
	placeholder: 'Ko tapnem …, se zgodi …',
	send: 'Pošlji',
	sending: 'Pošiljam',
	sent: 'Hvala! Poslano.',
	couldNotSend: 'Ni se poslalo. Poskusite znova.',
	refusals: {
		empty: 'Najprej kaj napišite.',
		tooLong: 'Predolgo je: največ 4000 znakov.'
	},
	admin: {
		section: 'Povratne informacije',
		waiting: (n) =>
			slCount(n, ['novo sporočilo', 'novi sporočili', 'nova sporočila', 'novih sporočil']),
		none: 'Povratnih informacij še ni.',
		done: 'Opravljeno',
		reopen: 'Znova odpri',
		showDone: (n) => `Opravljeno (${n})`,
		hideDone: 'Skrij opravljeno',
		sent: (when) => `Poslano ${when}`,
		page: (path) => `Stran: ${path}`,
		trail: (paths) => `Pred tem: ${paths}`,
		errors: 'Napake na strani',
		app: (version, play) => `Aplikacija za Android ${version}${play}`,
		inBrowser: 'V brskalniku',
		window: (size) => `Okno ${size}`,
		site: (when) => `Spletna stran z dne ${when}`,
		didNotSave: 'Ni se shranilo.',
		gone: 'Tega sporočila ni več.'
	}
};
