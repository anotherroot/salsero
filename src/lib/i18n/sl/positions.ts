// Položaji: seznam, Brez položaja, Nov položaj in urejanje, drža, predloge, stran
// položaja, oznake različice, Kako delujejo položaji, zemljevid ter povezave z odseki,
// točkami in lekcijami. Position names are people's own (or dance terms):
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
		makeMineNote: (label) =>
			`Uredi naredi vašo kopijo (${label}); vaše različice, označene s tem položajem, se preselijo nanjo.`,
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
	},
	how: {
		exampleLabel: 'Položaj, različica, naslednji položaj',
		paneSubtitle: 'Neobvezno: preberite enkrat, nato se odločite',
		// Salsa, Son, Timba are the styles' own names, the same in both.
		sections: [
			{
				title: 'Kaj je položaj?',
				body: 'Kako se partnerja držita med različicami: odprto z obema rokama, zaprto, s prekrižanimi rokami, v hammerlocku, drug ob drugem.'
			},
			{
				title: 'Zakaj z njimi označevati različice?',
				body: 'Vsaka različica se začne v nekem položaju in konča v nekem položaju. Tako aplikacija ve, kaj lahko sledi čemu: urejevalnik kombinacij ponudi le, kar ustreza, zemljevid pa pokaže, kje se zataknete.'
			},
			{
				title: 'Slogi',
				body: 'Vsakemu položaju dajte slog, tako kot različici: Salsa, Son, Timba. Ko označujete različico, so najprej ponujeni položaji njenega sloga; različica pa lahko vseeno gre iz enega sloga v drugega.'
			},
			{
				title: 'Neobvezno',
				body: 'Različica nima položaja, dokler ji ga ne daste, in do takrat ustreza kjer koli: urejevalnik kombinacij pri njej ne preverja ničesar. Položaje uporabljajte, če vam pomagajo; če ne, jih izpustite.'
			},
			{
				title: 'Kje začeti',
				body: 'Dodajte grobe položaje iz predloge in jih sproti preimenujte ali spremenite, ali pa naredite svoje. Skupine imajo svoje, tako kot različice, in lahko jih kopirate.'
			}
		],
		done: 'Razumem'
	},
	links: {
		lessons: 'Lekcije',
		lessonsCount: (n) => `Lekcije · ${n}`,
		addSpot: { label: 'Dodaj', aria: 'Dodaj odsek ali točko med posnetke' },
		linkLesson: { label: 'Poveži', aria: 'Poveži lekcijo' },
		refused: {
			pickSpot: 'Izberite odsek ali točko.',
			pickLesson: 'Izberite lekcijo.',
			linkGone: 'Ta povezava je že odstranjena.',
			lessonArchived: 'Ta lekcija je arhivirana.',
			already: 'Že povezano.',
			lessonGone: 'Povezava s to lekcijo je že odstranjena.'
		},
		// The lesson's title after a colon, never declined.
		notLinked: (lesson) => `Lekcije ni bilo mogoče povezati: ${lesson}.`,
		noSection: 'Tega odseka ni.',
		noPosition: 'Tega položaja ni.',
		archived: 'Ta položaj je arhiviran. Obnovite ga, če želite spremeniti njegove povezave.',
		aSpot: 'Odsek ali točka',
		spotsTitle: (name) => `Poveži s položajem: ${name}`,
		spotsSub: (team) =>
			team
				? `Odseki in točke iz lekcij in posnetkov skupine: ${team}`
				: 'Odseki in točke iz vaših lekcij in posnetkov',
		spots: {
			search: 'Iskanje lekcij, posnetkov, odsekov',
			note: 'Odsek se ponavlja; točka je en trenutek in je lahko slika.',
			none: 'Še ni odsekov ali točk. Video lekcije ali posnetek odprite čez cel zaslon in označite odsek ali točko.'
		},
		lessonVideo: (title, n) => `${title} · ${n}. video`,
		recordingOn: (figure, day) => `${figure} · posnetek ${day}`,
		pointAt: (time) => `Točka pri ${time}`,
		point: 'Točka',
		section: (range) => `Odsek · ${range}`,
		sectionNoName: 'Odsek brez imena',
		playFrom: (time) => `Predvajaj od ${time}`,
		picture: (video) => `${video} · slika`,
		lessonsTitle: (name) => `Lekcije s položajem: ${name}`,
		lessonPick: {
			sub: 'Lekcija, povezana tu, pokaže položaj tudi na svoji strani',
			search: 'Iskanje lekcij',
			none: 'Še ni lekcij. Dodajte jih v zavihku Lekcije.'
		},
		throughSection: 'prek odseka',
		problem: {
			missing: { title: 'Datoteke ni', body: 'Na strežniku ni datoteke za ta video.' },
			unplayable: {
				title: 'Tu se ne predvaja',
				body: 'Ta brskalnik te datoteke ne more predvajati. Odprite jo na telefonu.'
			}
		}
	}
};
