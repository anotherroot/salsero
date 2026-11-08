// Položaji: seznam, Brez položaja, Nov položaj in urejanje, drža, predloge, stran
// položaja in oznake različice. Position names are people's own (or dance terms):
// after a colon or in » «, never declined.
import type { Catalog } from '../catalog';
import { slCount, slForm, type SlForm } from '../plural';
import { nouns } from './nouns';

/** A verb agreeing with a count of različice: 1 ustreza, 2 ustrezata, 3 ustrezajo, 5 ustreza. */
const agree = (n: number, forms: Record<SlForm, string>): string => forms[slForm(n)];

export const positions: Catalog['positions'] = {
	// Figures arriving in a position and leaving it: 1 prihod, 2 prihoda, 3 prihodi, 5 prihodov.
	counts: {
		ins: (n) => slCount(n, ['prihod', 'prihoda', 'prihodi', 'prihodov']),
		outs: (n) => slCount(n, ['odhod', 'odhoda', 'odhodi', 'odhodov'])
	},
	gaps: {
		deadEnd: 'slepa ulica',
		orphan: 'nedosegljiv',
		island: 'otok'
	},
	list: {
		// The count after a colon: the verb would have to agree with it.
		tagged: (done, total) => `Različice s položaji: ${done} od ${total}.`,
		optional: 'Položaji niso obvezni: različica brez položaja v kombinaciji ustreza kjer koli.',
		unused: 'neuporabljen',
		// The lesson's title is the teacher's: after a colon.
		fromLesson: (type, lesson) => `${type} · lekcija: ${lesson}`,
		yours: (n) => `Vaši · ${n}`,
		mapRow: 'Zemljevid',
		noMatch: 'Noben položaj ne ustreza',
		noneOwn: 'Svojih položajev še nimate.',
		groupNote: 'Položaji skupine. Njene različice lahko označite le z njimi.',
		templates: 'Predloge',
		search: 'Iskanje položajev',
		filter: 'Filtri položajev',
		chips: { all: 'Vsi', gaps: 'Vrzeli' }
	},
	empty: {
		title: 'Še ni položajev',
		body: 'Začnite z grobimi položaji iz predloge ali naredite svoje.',
		firstRun: (figures) =>
			`Vaše različice (${figures}) nimajo položajev, in to je v redu: ustrezajo kjer koli. Položaje dodajte, ko želite, da kombinacije preverijo, kaj lahko sledi čemu.`,
		actions: {
			templates: 'Začni s predlogo',
			create: 'Nov položaj',
			how: 'Kako delujejo položaji'
		}
	},
	none: {
		title: 'Brez položaja',
		rowMeta: (n) =>
			`${nouns.figures(n)} · ${agree(n, { one: 'ustreza', two: 'ustrezata', few: 'ustrezajo', other: 'ustreza' })} kjer koli`,
		head: (total, none, partial) =>
			`${nouns.figures(total)} · brez: ${none}, le z začetkom ali koncem: ${partial}`,
		fits: {
			title: 'Ustreza kjer koli',
			body: 'Različica brez položaja lahko sledi čemur koli in vodi v kar koli: urejevalnik kombinacij jo ponudi povsod in pri njej nikoli ne označi prekinitve.'
		},
		groups: {
			none: 'Brez začetka in konca',
			onlyEnd: 'Samo konec',
			onlyStart: 'Samo začetek'
		},
		endsIn: (names) => `konča v: ${names}`,
		startsIn: (names) => `začne v: ${names}`,
		startsOn: (n) => `začne na ${n}`,
		empty: 'Vsaka različica ima položaj na začetku in na koncu.',
		edit: 'Položaji'
	},
	sheet: {
		newTitle: 'Nov položaj',
		newSub: 'Slog je sprva vaš slog novih različic (Nastavitve)',
		add: 'Dodaj položaj',
		save: 'Shrani',
		typeHelp: 'En slog, iz istega seznama kot pri različici.',
		crossed: 'Desni roki zgoraj',
		archive: 'Arhiviraj položaj',
		archiveBody:
			'Arhivira se kot različica: Obnovi ga vrne. Različice ga izgubijo in brez drugega nimajo položaja.',
		picture: 'Slika',
		change: 'Zamenjaj',
		pictureLegend: 'Njegove točke'
	},
	fields: {
		name: 'Ime',
		namePlaceholder: 'npr. Cerrada, Manos cruzadas',
		type: 'Slog',
		hands: 'Roke',
		crossed: 'Prekrižani roki',
		facing: 'Postavitev',
		frame: 'Okvir',
		notes: 'Opombe',
		notesPlaceholder: 'Kako se roke srečajo, kje je teža …'
	},
	failed: {
		save: 'Shranjevanje ni uspelo. Poskusite znova.',
		archive: 'Arhiviranje ni uspelo. Poskusite znova.',
		templates: 'Položaji niso bili dodani. Poskusite znova.'
	},
	busy: {
		adding: 'Dodajanje položaja',
		addingMany: 'Dodajanje položajev',
		saving: 'Shranjevanje',
		archiving: 'Arhiviranje položaja'
	},
	editTitle: (name) => `Uredi: ${name}`,
	recording: (figure) => `Posnetek · ${figure}`,
	pictureLine: (video, time) => `Iz: ${video}, pri ${time}`,
	// Drža is feminine: odprta, zaprta.
	hold: {
		hands: { two: 'Dve roki', one: 'Ena roka', none: 'Brez rok' },
		handsShort: { two: 'Dve', one: 'Ena', none: 'Brez' },
		facing: {
			face: 'Obraz v obraz',
			side: 'Drug ob drugem',
			shadow: 'Senca',
			back: 'Hrbet ob hrbtu'
		},
		frame: { open: 'Odprta', closed: 'Zaprta' },
		crossed: 'Prekrižani, desna zgoraj',
		notCrossed: 'Neprekrižani'
	},
	templates: {
		title: 'Začni s predlogo',
		pick: 'Predloga',
		youHaveIt: 'Že imate',
		note: (type) =>
			`Grobi položaji za začetek: pozneje jih preimenujte, spremenite ali odstranite. Dobijo slog: ${type}. Kar že imate s tem imenom, se preskoči.`,
		// The accusative after "Dodaj": 3 položaje, not položaji.
		add: (n) => `Dodaj ${slCount(n, ['položaj', 'položaja', 'položaje', 'položajev'])}`,
		refused: {
			type: 'Izberite slog s predlogami.',
			none: 'Označite vsaj en položaj.'
		},
		descriptions: {
			salsa: {
				salsa: {
					'Abierta (dos manos)': 'Odprta, z obema rokama',
					'Abierta (una mano)': 'Odprta, njegova leva v njeni desni',
					Cerrada: 'Zaprta, osnovna drža',
					Hammerlock: 'Njena desna roka, zapognjena za hrbtom',
					Cuddle: 'Drug ob drugem, ona v njegovem objemu',
					Sombra: 'Senca: on je za njo, v isti smeri'
				},
				son: {
					'Cerrada de son': 'Zaprta in nizka, tesno skupaj',
					Abierta: 'Odprta, z eno roko, ohlapno',
					'Manos cruzadas': 'Obe roki prekrižani, desna zgoraj',
					Paseo: 'Drug ob drugem, v hoji'
				},
				timba: {
					Pegao: 'Zaprta, bok ob boku',
					Caída: 'Z eno roko, njena teža nagnjena nazaj',
					'Sombra de timba': 'Senca, tesno, boki se gibljejo',
					'Abierta de timba': 'Odprta, z eno roko, nizko'
				}
			},
			bachata: {
				dominican: {
					Closed: 'Zaprta, tesno skupaj',
					'Open, two hands': 'Odprta, z obema rokama',
					'Side by side': 'Drug ob drugem, tesno'
				},
				sensual: {
					Closed: 'Zaprta, s stikom teles',
					'Open, one hand': 'Odprta, z eno roko',
					'Cross-hand': 'Obe roki prekrižani, desna zgoraj',
					Hammerlock: 'Njena roka, zapognjena za hrbtom'
				},
				traditional: {
					Closed: 'Zaprta, osnovna drža',
					'Open, two hands': 'Odprta, z obema rokama',
					Shadow: 'On je za njo, v isti smeri'
				}
			}
		}
	},
	page: {
		position: 'Položaj',
		// The group's name after a "·", never declined.
		teamPosition: (team) => `Položaj · ${team}`,
		team: (team) => `Skupina · ${team}`,
		endsIn: (names) => `konča v: ${names}`,
		from: (names) => `iz: ${names}`,
		relations: {
			from: 'Različice od tod',
			into: 'Različice, ki vodijo sem'
		},
		new: 'Nova',
		newFrom: (name) => `Nova različica od tod: ${name}`,
		newInto: (name) => `Nova različica, ki vodi sem: ${name}`,
		relationsLabel: 'Različice in kombinacije skozi ta položaj',
		menu: {
			newFrom: 'Nova različica od tod',
			newInto: 'Nova različica, ki vodi sem',
			map: 'Pokaži na zemljevidu',
			history: 'Zgodovina'
		},
		fromLessonNote: (lesson, team) =>
			`Iz lekcije: ${lesson}. Z njim označite svoje različice, kakršen je; ostane položaj skupine: ${team}.`,
		makeMineNote: 'Uredi naredi vašo kopijo; vaše različice, označene z njim, se preselijo nanjo.',
		archived: {
			title: 'Arhivirano',
			body: 'Različice ga ne kažejo več. Obnovi ga vrne.',
			restore: 'Obnovi'
		},
		// The verb agrees with the count; the position is the page's own, so "tu".
		deadEnd: {
			title: 'Slepa ulica',
			body: (_name, n) =>
				`Tu se ${agree(n, { one: 'konča', two: 'končata', few: 'končajo', other: 'konča' })} ${nouns.figures(n)}, nič, kar poznate, pa ne gre od tod. Kombinacija, ki pride sem, se ustavi.`
		},
		orphan: {
			title: 'Nedosegljiv',
			body: (_name, n) =>
				`Od tod ${agree(n, { one: 'gre', two: 'gresta', few: 'gredo', other: 'gre' })} ${nouns.figures(n)}, nič, kar poznate, pa se ne konča tu.`
		},
		// One pair is two slots (dual), more are plural.
		through: (pairs, list) => `${pairs === 1 ? 'Mesti' : 'Mesta'} ${list}`,
		and: 'in',
		editing: 'Urejanje',
		hold: 'Drža'
	},
	preset: {
		starts: (name) => `Začne v: ${name}`,
		ends: (name) => `Konča v: ${name}`,
		gone: 'Ta položaj tu ne more več označiti različice. Figuro dodajte brez njega.'
	},
	tags: {
		empty: 'Brez položaja · ustreza kjer koli',
		help: 'Na vsaki strani poljubno število. V kombinaciji naslednja različica ustreza, če se začne v katerem koli od teh koncev.',
		figureType: (type) => `${type} · slog te različice`,
		asItIs: (type) => `${type} · označite z njim, kakršen je`,
		clear: { label: 'Brez položaja', meta: 'Ustreza kjer koli · privzeto' },
		picker: {
			starts: 'Začne v',
			ends: 'Konča v',
			search: 'Iskanje položajev',
			create: 'Položaj',
			nothingLeft: 'Še ni položajev.'
		},
		newSub: 'Slog je sprva slog te različice.',
		createFailed: 'Položaja ni bilo mogoče ustvariti. Poskusite znova.',
		none: 'Brez položaja',
		or: 'ali'
	},
	refused: {
		noName: 'Vpišite ime položaja.',
		nameLong: 'Ime ima lahko največ 200 znakov.',
		notesLong: 'Opombe imajo lahko največ 2000 znakov.',
		taken: (name) => `Položaj z imenom »${name}« že imate.`,
		// The group's name after a colon, never declined.
		teamTaken: (team, name) =>
			team
				? `Položaj z imenom »${name}« že obstaja v skupini: ${team}.`
				: `Položaj z imenom »${name}« v tej skupini že obstaja.`
	}
};
