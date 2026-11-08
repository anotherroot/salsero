import type { Catalog } from '../catalog';
import { slCount } from '../plural';

type Forms = [one: string, two: string, few: string, other: string];

/** An 8-count, after "na" (accusative): na 1 osmico, na 2 osmici, na 4 osmice. */
const OSMICA: Forms = ['osmico', 'osmici', 'osmice', 'osmic'];
/** Comes back's chips: 3 dobri dnevi, 5 dobrih dni. */
const DOBER_DAN: Forms = ['dober dan', 'dobra dneva', 'dobri dnevi', 'dobrih dni'];

/** "0.8" → "0,8". */
const comma = (x: number): string => String(x).replace('.', ',');

// The class's older readers log here: vikanje in sentences, no past tense about the
// reader ("Za vnos ustavite štetje", never "Ste vadili"), a name before a colon.
export const exercise: Catalog['exercise'] = {
	types: {
		lesson: 'Ponavljanje lekcije',
		figure: 'Vaja z različico',
		drill: 'Vaja',
		routine: 'Kombinacija',
		howItWent: 'Kako je šlo?'
	},
	log: {
		done: 'Opravljeno',
		saving: 'Shranjevanje\u00a0…',
		pickFeel: 'Izberite, kako je šlo',
		// Lower case after the colon: "Zadnjič: včeraj".
		lastTime: (when) => `Zadnjič: ${when.charAt(0).toLowerCase()}${when.slice(1)}`,
		firstTime: 'Prvič.',
		note: 'Opomba',
		optional: '(neobvezno)',
		notePlaceholder: 'Kaj je šlo dobro, kaj popraviti',
		didNotSave: 'Shranjevanje ni uspelo.'
	},
	content: {
		description: 'Opis',
		unlink: 'Odstrani povezavo',
		unlinkNamed: (name) => `Odstrani povezavo z odsekom: ${name}`,
		reference: 'Gradivo',
		recordingMissing: 'Datoteke tega posnetka ni.',
		videoMissing: 'Datoteke tega videa ni.',
		cantPlay: 'Ta brskalnik te datoteke ne more predvajati.',
		figureEmpty: 'Še ni opomb, posnetkov, odsekov ali povezav. Dodate jih na strani različice.',
		editLinks: 'Uredi povezave na strani različice',
		figures: 'Različice',
		practiseInPlayer: 'Vadi v predvajalniku',
		routineNote: 'Ko ste vadili, v predvajalniku ali brez aplikacije, pritisnite Opravljeno.',
		recordings: (n) => (n === 0 ? 'Posnetki' : `Posnetki · ${n}`)
	},
	page: {
		// "3 / krat": the number is the tile's value, the word stays.
		times: () => 'krat',
		inAll: 'skupaj',
		dayWithYear: (label, year) => `${label} ${year}`,
		ownerFigure: 'Različica',
		ownerLesson: (date) => `Lekcija · ${date}`,
		ownerRoutine: 'Kombinacija',
		archiveBody: (name, times) => {
			const head = `${name}: izgine s seznama Danes in iz vseh seznamov.`;
			return times === 0 ? head : `${head} Zgodovina ostane shranjena.`;
		},
		fromClass: (day) => `Z lekcije ${day} ›`,
		comments: 'Komentarji k lekciji',
		settings: 'Nastavitve',
		settingsLabel: 'Nastavitve vaje',
		name: 'Ime',
		active: 'Aktivna',
		activeHint: 'Prikaži jo na seznamu vaj',
		description: 'Opis',
		practiceNotes: 'Opombe',
		archive: 'Arhiviraj vajo',
		archiveTitle: 'Želite arhivirati to vajo?',
		archiveButton: 'Arhiviraj',
		notOnToday: 'Ni na vašem seznamu Danes',
		fromLesson: (title) => `Iz lekcije: ${title}`,
		history: 'Zgodovina',
		nothingYet: 'Še ni vnosov',
		nothingYetBody: 'Ko vadite, pritisnite Opravljeno. Tukaj se pokaže, razvrščeno po dnevih.',
		showingLatest: (n) => `Prikazani so le najnovejši vnosi (${n}).`,
		deleteDay: 'Izbriši ta dan',
		// The day after a colon: "Izbrisano: čet, 5. nov.".
		dayDeleted: (label) => `Izbrisano: ${label}`,
		activeNo: 'Ne – ni na seznamu Danes',
		comesBack: 'Jutri bo spet na vrsti',
		stopEditing: 'Končaj urejanje',
		editSettings: 'Uredi nastavitve',
		editDrill: 'Uredi vajo'
	},
	panel: {
		label: 'Vadenje',
		practiseWith: 'Vadi ob',
		play: 'Predvajaj',
		pause: 'Premor',
		resume: 'Nadaljuj',
		stop: 'Ustavi',
		voiceVolume: 'Glasnost glasu',
		banked: (clock) => `Doslej ${clock} · Predvajaj nadaljuje`,
		songGone: 'Njena skladba ni pripravljena',
		songGoneBody: 'Izberite drugo ali uporabite štetje.',
		couldNotStart: 'Štetja ni bilo mogoče začeti.',
		voiceCount: 'Štetje z glasom',
		cue: 'Napoved figure',
		off: 'Brez',
		every: (n) => `Na ${slCount(n, OSMICA)}`,
		speedLabel: 'Hitrost',
		source: 'Vir',
		countOnly: 'Samo štetje',
		aSong: 'Skladba',
		song: 'Skladba',
		tempo: 'Tempo štetja',
		// Not "položaj": that is a dance position.
		position: 'Mesto v skladbi',
		speed: (s) => `${comma(s)}×`,
		summaryCount: (bpm) => `Štetje ${bpm}`,
		summaryNoCount: 'brez štetja',
		summaryClave: (pattern) => `clave ${pattern}`
	},
	// "Comes back" as a plain question; the teacher is "vodja tečaja" (glossary), and no
	// past tense agrees with them ("Nastavitev vodje tečaja", not "Vodja je nastavil").
	comesBack: {
		title: 'Kdaj pride spet na vrsto',
		forClass: 'Kdaj pride spet na vrsto, za tečaj',
		byFaces: 'Glede na to, kako je šlo',
		byFacesNote: 'Obrazi odločijo, kdaj pride spet na vrsto.',
		until: 'Vsak dan, dokler ne gre dobro',
		untilNote: 'Potem odločajo obrazi.',
		goodDaysLabel: 'Dobri dnevi',
		goodDays: (n) => slCount(n, DOBER_DAN),
		goodMeans: (gotit, easy) => `Dobro pomeni »${gotit}« ali »${easy}«.`,
		soFar: (good, of) => `Doslej ${good} od ${of}.`,
		fixed: 'Po stalnem ritmu',
		fixedNote: (done) => `Samo »${done}«, brez obrazov.`,
		howOften: 'Kako pogosto',
		rhythm: (days) =>
			days === 1
				? 'Vsak dan'
				: days === 2
					? 'Vsak drugi dan'
					: days === 3
						? 'Vsak tretji dan'
						: days === 7
							? 'Enkrat na teden'
							: `Vsakih ${days} dni`,
		// "dokler ni 3 dobrih dni": the genitive after "ni" reads for every number.
		untilWords: (good) => `Vsak dan, dokler ni ${good} dobrih dni`,
		learning: (good, of) => `Učenje · ${good} od ${of} dobrih dni`,
		membersCan: 'Člani skupine si to lahko nastavijo po svoje.',
		useTeacher: 'Kot vodja tečaja',
		teacherSet: (words) => `Nastavitev vodje tečaja: ${words}`,
		setByTeacher: 'Nastavitev vodje tečaja'
	},
	warmup: {
		title: 'Ogrevanje',
		note: (daily) => `Naredite jo najprej. Ne šteje v dnevno število (${daily}).`,
		withRhythm: (rhythm) => `Ogrevanje · ${rhythm}`
	},
	done: {
		learnt: 'naučeno',
		learning: 'učenje',
		warmup: 'ogrevanje',
		saved: (back) => `Shranjeno · ${back}`,
		added: (day) => `Dodano za ${day}`,
		doneToday: 'Opravljeno danes',
		tapFace: 'Pritisnite obraz, da ga shranite'
	},
	refused: {
		checkValues: 'Preverite vrednosti in poskusite znova.',
		gone: 'Te vaje ni več.',
		dayGone: 'Ta dan je že izbrisan.',
		dayPutBack: 'Dneva ni bilo mogoče vrniti.',
		archiveHere: 'Tukaj se arhivirajo le lastne vaje. Različico arhivirate na njeni strani.',
		pickSection: 'Izberite odsek.',
		linkGone: 'Ta povezava je že odstranjena.'
	}
};
