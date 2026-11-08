import type { Catalog } from '../catalog';
import { slCount, slForm, type SlForm } from '../plural';

type Forms = [one: string, two: string, few: string, other: string];

const VNOS: Forms = ['vnos', 'vnosa', 'vnosi', 'vnosov'];
const VIDEO: Forms = ['video', 'videa', 'videi', 'videov'];
/** An 8-count, after "na" (accusative): na 1 osmico, na 2 osmici, na 4 osmice. */
const OSMICA: Forms = ['osmico', 'osmici', 'osmice', 'osmic'];

/** The noun alone in the form `n` takes: 1 vnos, 2 vnosa … (the tile prints the number). */
function formOf(n: number, forms: Forms): string {
	const at: Record<SlForm, number> = { one: 0, two: 1, few: 2, other: 3 };
	return forms[at[slForm(n)]];
}

/** 10000 → "10 000": a thousands space (no-break), as Slovenian writes it. */
const grouped = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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
		remember: 'Kako dobro se je spomnite?',
		howItWent: 'Kako je šlo?'
	},
	log: {
		logSet: 'Shrani vnos',
		done: 'Opravljeno',
		saving: 'Shranjevanje …',
		logged: 'Shranjeno',
		addToDay: 'Shrani vnos za ta dan',
		stopToLog: 'Za vnos ustavite štetje.',
		pickFeel: 'Izberite, kako je šlo',
		next: (name) => `Naslednja: ${name}`,
		range: (max) => `Od 0 do ${grouped(max)}`,
		// Lower case after the colon: "Zadnjič: včeraj".
		lastTime: (when) => `Zadnjič: ${when.charAt(0).toLowerCase()}${when.slice(1)}`,
		firstTime: 'Prvič.',
		minutes: 'Minute',
		reps: 'Ponovitve',
		fromPractice: (clock) => `Izmerjeno: ${clock}`,
		note: 'Opomba',
		optional: '(neobvezno)',
		notePlaceholder: 'Kaj je šlo dobro, kaj popraviti',
		formLabel: 'Vnos vaje',
		didNotSave: 'Shranjevanje ni uspelo.',
		loadError: 'Podrobnosti te vaje ni bilo mogoče naložiti.',
		stillLog: 'Vnos lahko vseeno shranite.',
		skip: 'Preskoči',
		details: 'Podrobnosti',
		detailsLabel: 'Podrobnosti in nastavitve',
		addingTo: (day) => `Vnos za dan: ${day}`,
		setsThatDay: 'Vnosi tistega dne',
		setsToday: 'Današnji vnosi',
		setDeleted: 'Vnos je izbrisan',
		couldNotPutBack: 'Vnosa ni bilo mogoče vrniti.',
		sessionDone: 'Vadba je končana',
		finish: 'Končaj'
	},
	sets: {
		set: 'Vnos',
		deleteFailed: 'Vnosa ni bilo mogoče izbrisati.',
		deleteLabel: (time) => `Izbriši vnos ob ${time}`
	},
	content: {
		description: 'Opis',
		sections: 'Odseki',
		links: 'Povezave',
		linkSection: 'Poveži odsek …',
		unlinkSection: 'Odstrani povezavo z odsekom',
		reference: 'Gradivo',
		hide: 'Skrij',
		show: 'Pokaži',
		recordingMissing: 'Datoteke tega posnetka ni.',
		videoMissing: 'Datoteke tega videa ni.',
		cantPlay: 'Ta brskalnik te datoteke ne more predvajati.',
		figureEmpty: 'Še ni opomb, posnetkov, odsekov ali povezav. Dodate jih na strani različice.',
		editLinks: 'Uredi povezave na strani različice',
		videos: (n) => slCount(n, VIDEO),
		figures: 'Različice',
		practiseInPlayer: 'Vadi v predvajalniku',
		routineNote:
			'Kar vadite v predvajalniku, se shrani samo. Tukaj vnesite vajo, opravljeno brez aplikacije.'
	},
	page: {
		tileSets: (n) => formOf(n, VNOS),
		tilePractised: 'skupaj',
		tileRecently: 'nedavno',
		dayWithYear: (label, year) => `${label} ${year}`,
		ownerFigure: 'Različica',
		ownerLesson: (date) => `Lekcija · ${date}`,
		ownerRoutine: 'Kombinacija',
		// "Shranjen ostane 1 vnos", "Shranjena ostaneta 2 vnosa", "Shranjeni ostanejo 3 vnosi",
		// "Shranjenih ostane 5 vnosov": the verb and participle agree with the count.
		archiveBody: (name, sets) => {
			const head = `${name}: izgine s seznama Danes in iz vseh seznamov.`;
			if (sets === 0) return head;
			const kept: Record<SlForm, string> = {
				one: 'Shranjen ostane',
				two: 'Shranjena ostaneta',
				few: 'Shranjeni ostanejo',
				other: 'Shranjenih ostane'
			};
			return `${head} ${kept[slForm(sets)]} ${slCount(sets, VNOS)}.`;
		},
		logASet: 'Nov vnos',
		// Not "Vadila sem": a past tense would say whether the reader is a man or a woman.
		practised: 'Opravljeno',
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
		nothingYetBody: 'Ko vadite, shranite vnos. Tukaj se pokaže, razvrščen po dnevih.',
		showingLatest: (n) => `Prikazani so le najnovejši vnosi (${n}).`,
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
		summaryClave: (pattern) => `clave ${pattern}`,
		summaryCall: (n) => `napoved na ${slCount(n, OSMICA)}`
	},
	refused: {
		checkValues: 'Preverite vrednosti in poskusite znova.',
		gone: 'Te vaje ni več.',
		setGone: 'Ta vnos je že izbrisan.',
		putBack: 'Vnosa ni bilo mogoče vrniti.',
		archiveHere: 'Tukaj se arhivirajo le lastne vaje. Različico arhivirate na njeni strani.',
		pickSection: 'Izberite odsek.',
		linkGone: 'Ta povezava je že odstranjena.'
	}
};
