import type { Catalog } from '../catalog';
import { slCount, slForm } from '../plural';

type Forms = [one: string, two: string, few: string, other: string];

/** The noun alone, in the form `n` takes: the count is drawn apart. */
const form = (n: number, [one, two, few, other]: Forms) => ({ one, two, few, other })[slForm(n)];

// A class's day is a "lekcija" (as the exercise page's "Z lekcije tor, 3. nov.");
// the group behind it is a "tečaj".
export const lesson: Catalog['lesson'] = {
	bandLine: (day) => `Lekcija · ${day}`,
	onToday: (day) => `Na vrsti ${day}`,
	// `whenWords` already says a weekday as a time: "v nedeljo".
	onTodayOn: (when) => `Na vrsti ${when}`,
	onTodayNextWeek: 'Na vrsti naslednji teden',
	paused: 'Na premoru',
	goOver: 'Ponovite to lekcijo',
	deleting: (name, day) => `${name} · izbris ${day}`,
	page: {
		notes: 'Opombe',
		videos: 'Videi',
		links: 'Povezave',
		practising: 'Kaj vadite',
		noVideos: 'Videov še ni.',
		addVideos: 'Dodaj videe',
		video: (n) => `Video ${n}`,
		deleteVideo: (n) => `Izbriši video ${n}`,
		missingTitle: 'Datoteke ni',
		missingBody: 'Na strežniku ni datoteke za ta video.',
		unplayableTitle: 'Tu se ne predvaja',
		unplayableBody:
			'Ta brskalnik te datoteke ne more predvajati. Prenesite jo ali jo odprite na telefonu.',
		download: 'Prenesi',
		cantDelete: 'Tega videa ni mogoče izbrisati',
		notInPractice: 'Še ni med vašimi vajami',
		adding: 'Dodajanje\u00a0…',
		added: 'Dodano na seznam Danes',
		couldNotAdd: 'Dodajanje ni uspelo.',
		couldNotUndo: 'Razveljavitev ni uspela.',
		notNow: 'Ne zdaj',
		menu: 'Meni lekcije',
		edit: 'Uredi lekcijo'
	},
	list: {
		empty: 'Še ni lekcij',
		emptyGroup:
			'Dodajte jo po naslednji uri tečaja: videe in opombe. Vidijo jo vsi v tečaju, ko jo objavite.',
		emptyOwn:
			'Dodajte jo po naslednji uri tečaja: videe, opombe in nekaj na seznamu Danes, da jo boste ponovili.',
		newLesson: 'Nova lekcija',
		drafts: 'Osnutki',
		draft: 'Osnutek',
		isNew: 'Nova',
		videos: (n) => slCount(n, ['video', 'videa', 'videi', 'videov']),
		sections: (n) => form(n, ['odsek', 'odseka', 'odseki', 'odsekov']),
		routines: (n) => form(n, ['kombinacija', 'kombinaciji', 'kombinacije', 'kombinacij']),
		figures: (n) => form(n, ['različica', 'različici', 'različice', 'različic']),
		onDisk: (size) => `Videi na disku: ${size}`,
		groupVideos: (used, limit) => `Videi skupine: ${used} od ${limit}`,
		pick: {
			title: 'Izberite lekcijo',
			body: 'Tu, ob seznamu, se odprejo njene opombe, videi in kar uči.'
		}
	},

	// --- Part 2: the full lesson page, New lesson, the share target.

	full: {
		editing: 'Urejanje',
		stopEditing: 'Končaj urejanje',
		edits: 'Spremembe lekcije',
		notInLessons: 'Še ni med vašimi lekcijami',
		notesHelp: 'Povezave v opombah se odprejo, ko jih pritisnete.',
		archiveLesson: 'Arhiviraj lekcijo',
		figures: 'Različice',
		routines: 'Kombinacije',
		exercises: 'Vaje',
		positions: 'Položaji',
		unlinkOf: (name) => `Odstrani povezavo: ${name}`,
		saving: 'Shranjevanje …',
		history: 'Zgodovina',
		removeItem: 'Odstrani iz mojih lekcij',
		deleteVideo: {
			title: 'Želite izbrisati ta video?',
			busy: 'Brisanje …',
			failed: 'Videa ni bilo mogoče izbrisati.'
		},
		remove: {
			title: 'Želite lekcijo odstraniti iz svojih lekcij?',
			body: 'Vaje, ki jih je dodala na Danes, izginejo, razen če so tudi v kateri drugi vaši lekciji. Vaši vnosi ostanejo.',
			busy: 'Odstranjevanje …'
		},
		archive: {
			title: 'Želite arhivirati to lekcijo?',
			team: 'Videi in povezave ostanejo.',
			own: 'Z njo gre tudi njena vaja za ponovitev. Videi, povezave in zgodovina ostanejo.',
			button: 'Arhiviraj',
			busy: 'Arhiviranje …',
			failed: 'Lekcije ni bilo mogoče arhivirati.'
		}
	},

	pickers: {
		figure: {
			title: 'Poveži različico',
			search: 'Iskanje različic',
			group: 'Različice',
			none: 'Različic še ni.',
			figure: 'Različica'
		},
		routine: {
			title: 'Poveži kombinacijo',
			search: 'Iskanje kombinacij',
			group: 'Kombinacije',
			none: 'Kombinacij še ni.',
			create: 'Kombinacija'
		},
		exercise: {
			title: 'Poveži vajo',
			search: 'Iskanje vaj',
			none: 'Ni več ničesar, kar bi lahko povezali. Vaja različice ali kombinacije je na njeni strani.',
			create: 'Vaja'
		},
		position: {
			title: 'Poveži položaj',
			search: 'Iskanje položajev',
			none: 'Položajev še ni.',
			create: 'Položaj'
		}
	},

	create: {
		figure: {
			title: 'Nova različica',
			inLesson: 'V tej lekciji',
			moves: 'Figure',
			first: 'Figure iz te lekcije so na vrhu',
			busy: 'Dodajanje',
			add: 'Dodaj različico'
		},
		routine: {
			title: 'Nova kombinacija iz te lekcije',
			sub: 'Poveže se s to lekcijo, nato se odpre, da sestavite njena mesta',
			label: 'Nova kombinacija',
			busy: 'Dodajanje kombinacije',
			add: 'Dodaj in sestavi kombinacijo'
		},
		exercise: {
			title: 'Nova vaja iz te lekcije',
			label: 'Nova vaja',
			busy: 'Dodajanje vaje',
			add: 'Dodaj vajo'
		},
		name: 'Ime',
		notes: 'Opombe',
		optional: '(neobvezno)'
	},

	fields: {
		day: 'Datum lekcije',
		title: 'Naslov',
		titlePlaceholder: 'Rueda v sredo: enchufla in njene različice',
		notes: 'Opombe',
		optional: '(neobvezno)',
		notesPlaceholder: 'Kar ste slišali na tečaju, kaj popraviti, kaj vam ni šlo …'
	},

	newSheet: {
		create: 'Ustvari lekcijo',
		busy: 'Ustvarjanje lekcije',
		where: 'Kam',
		searchGroups: 'Iskanje skupin',
		places: 'Kam',
		nowhere: 'Drugih možnosti ni.',
		draftNote: 'Lekcija skupine se začne kot osnutek'
	},

	// After »prek« the genitive (1 odseka, 2+ odsekov; 1 točke, 2+ točk); after »z/s« the
	// instrumental, a bare noun in the singular, the dual or the plural. A name goes in »…«.
	via: {
		badge: (sections, points) => {
			const s = (n: number) =>
				n === 1 ? 'odseka' : `${n} ${slForm(n) === 'one' ? 'odseka' : 'odsekov'}`;
			const p = (n: number) =>
				n === 1 ? 'točke' : `${n} ${slForm(n) === 'one' ? 'točke' : 'točk'}`;
			if (points === 0) return `prek ${s(sections)}`;
			if (sections === 0) return `prek ${p(points)}`;
			return `prek ${s(sections)} in ${p(points)}`;
		},
		title: (label, lesson) =>
			lesson
				? `Želite odstraniti »${label}« z lekcije »${lesson}«?`
				: `Želite odstraniti »${label}« z lekcije?`,
		body: (label, lesson, sections, points, ranges) => {
			const by = (n: number, [one, two, many]: [string, string, string]) =>
				n === 1 ? one : n === 2 ? two : many;
			const genS = sections === 1 ? 'odseka' : 'odsekov';
			const genP = points === 1 ? 'točke' : 'točk';
			const insS = by(sections, ['z odsekom', 'z odsekoma', 'z odseki']);
			const insP = by(points, ['s točko', 's točkama', 's točkami']);
			const gen = points === 0 ? genS : sections === 0 ? genP : `${genS} in ${genP}`;
			const with_ =
				points === 0 ? `in ${insS}` : sections === 0 ? `in ${insP}` : `ter ${insS} in ${insP}`;
			const where = lesson ? `na lekciji »${lesson}«` : 'na tej lekciji';
			return `»${label}« je ${where} prek ${gen} ${ranges}. Želite odstraniti povezavo z lekcijo ${with_}?`;
		},
		unlink: 'Odstrani povezavo',
		busy: 'Odstranjevanje povezave'
	},

	sections: {
		heading: (n) => `Odseki · ${n}`,
		noneEdit: 'Še nobenega. Odprite video čez cel zaslon in pritisnite »Odsek«, da ga označite.',
		none: 'Še nobenega.',
		play: (label) => `Predvajaj: ${label}`,
		unlinkFrom: (section, target) => `Odstrani povezavo: ${section} → ${target}`,
		// The row's button, as on the figure page: short, the label says it all.
		unlink: 'Odveži',
		link: (label) => `Poveži: ${label}`
	},

	meta: {
		yours: 'Vaše',
		yoursWith: (meta) => `Vaše · ${meta}`,
		inactive: 'na premoru',
		review: 'vaja za ponovitev'
	},

	// The verb agrees with the count: gre, gresta, gredo.
	deleteVideoBody: (sections) => {
		const tail = 'Za videe lekcij ni varnostne kopije, zato izbrisa ne boste mogli razveljaviti.';
		if (sections === 0) return tail;
		const goes = {
			one: `Z njim gre tudi ${sections} odsek.`,
			two: `Z njim gresta tudi ${sections} odseka.`,
			few: `Z njim gredo tudi ${sections} odseki.`,
			other: `Z njim gre tudi ${sections} odsekov.`
		}[slForm(sections)];
		return `${goes} ${tail}`;
	},
	positionLink: (name) => `Položaj · ${name}`,

	addLabel: {
		figure: 'Dodaj različico',
		routine: 'Dodaj kombinacijo',
		exercise: 'Dodaj vajo',
		position: 'Dodaj položaj',
		link: 'Dodaj povezavo'
	},

	// A lekcija is feminine: »je« (genitive after a negation), »jo«.
	draft: {
		title: 'Osnutek',
		line: 'Člani je še ne vidijo',
		publish: 'Objavi',
		publishMeta: (team) => `Videli jo bodo člani skupine: ${team}`
	},

	share: {
		title: 'Dodaj v lekcijo',
		recent: 'Nedavne lekcije',
		newMeta: 'Ustvarite jo za ta video',
		opening: 'Odpiranje aplikacije',
		submit: 'Ustvari in dodaj video',
		pickPlace: 'Izberite, kam naj gre.'
	},

	refused: {
		title: 'Vpišite naslov (do 200 znakov).',
		day: 'Izberite datum lekcije.',
		future: 'Ta dan je v prihodnosti.',
		gone: 'Te lekcije ni več.',
		published: 'Lekcija je že objavljena.',
		archived: 'Lekcija je že arhivirana.',
		pickMove: 'Izberite figuro.',
		figureLink: 'Različice ni bilo mogoče povezati.',
		figureUnlinked: 'Povezava z različico je že odstranjena.',
		routineLink: 'Kombinacije ni bilo mogoče povezati.',
		routineUnlinked: 'Povezava s kombinacijo je že odstranjena.',
		positionLink: 'Položaja ni bilo mogoče povezati.',
		positionUnlinked: 'Povezava s položajem je že odstranjena.',
		exerciseLink:
			'Vaje ni bilo mogoče povezati. Vaja različice ali kombinacije je na njeni strani.',
		exerciseUnlinked: 'Povezava z vajo je že odstranjena.',
		videoGone: 'Ta video je bil že odstranjen.'
	},

	upload: {
		noLesson: 'Te lekcije ni.',
		notVideo: 'V lekcijo lahko dodate le videe.',
		tooLarge: (limit) => `Video je večji od ${limit}.`,
		empty: 'Naložena datoteka je prazna.',
		notSaved: 'Videa ni bilo mogoče shraniti.'
	}
};
