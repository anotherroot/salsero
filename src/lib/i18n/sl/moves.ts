// Figure (the tab): the three lists, a move's page, Pokritost, the band's switch and
// the empty pane. A move is a figura, a figure (its version) a različica.
import type { Catalog } from '../catalog';
import { slCount } from '../plural';
import { nouns } from './nouns';

export const moves: Catalog['moves'] = {
	segments: { figures: 'Figure', routines: 'Kombinacije', positions: 'Položaji' },
	newFigure: 'Nova različica',
	newRoutine: 'Nova kombinacija',
	newPosition: 'Nov položaj',
	row: {
		startsOn: (n) => `Začne na ${n}`,
		noSection: 'Brez odseka',
		noLesson: 'Brez lekcije',
		differ: (n) =>
			slCount(n, [
				'kopija se razlikuje',
				'kopiji se razlikujeta',
				'kopije se razlikujejo',
				'kopij se razlikuje'
			])
	},
	heading: {
		group: 'Skupina',
		yours: 'Vaše',
		matching: (n) =>
			slCount(n, [
				'različica ustreza',
				'različici ustrezata',
				'različice ustrezajo',
				'različic ustreza'
			]),
		unlinked: (n) => `Brez odseka ali lekcije: ${n}`,
		// Group names are people's own: after a colon, never declined.
		alsoIn: (figures, groups) =>
			`${figures} · tudi v ${groups.length === 1 ? 'skupini' : 'skupinah'}: ${groups.join(', ')}`
	},
	chips: {
		all: 'Vse',
		unlinked: 'Nepovezane',
		partner: 'V paru',
		solo: 'Solo'
	},
	styles: {
		other: 'Drugo',
		dominican: 'Dominikanska',
		sensual: 'Senzualna',
		traditional: 'Tradicionalna'
	},
	tile: {
		unrouted: (n) => `Brez kombinacije: ${n}`,
		allRouted: 'Vse so v kombinacijah'
	},
	members: {
		hidden: 'Člani tega še ne vidijo',
		note: 'Kar ni v objavljeni lekciji, vidijo le tisti, ki lahko urejajo. Ko to povežete z lekcijo, to dobijo tudi člani.'
	},
	sync: {
		// The count after a colon: the adjective would have to agree with it.
		title: (counted) => `Ni usklajeno: ${counted}`,
		meta: 'Vaše kopije in kopije skupin se ne ujemajo',
		allInStep: 'Vse je usklajeno',
		allInStepMeta: 'Nič se ne razlikuje. Pritisnite za prikaz vseh',
		emptyTitle: 'Vse kopije se ujemajo',
		emptyBody: 'Nič ni več neusklajeno.'
	},
	pane: {
		figures: {
			title: 'Izberite različico',
			body: 'Njen začetek in dolžina, posnetki in kombinacije se odprejo tukaj, ob seznamu. Ime figure odpre figuro.',
			group: 'Različice skupine se odprejo tukaj.'
		},
		routines: {
			title: 'Izberite kombinacijo',
			body: 'Njena mesta, kje se prekine in ali se sklene, se odprejo tukaj, ob seznamu.',
			group:
				'Kombinacijo najprej zasnujte, z lekcijo jo povežite pozneje. Urejevalnik je enak kot za vaše.'
		}
	},
	figures: {
		coverage: 'Pokritost',
		empty: 'Še ni figur',
		emptyBody: 'Dodajte prvo, ki ste se jo naučili.',
		search: 'Iskanje figur',
		filter: 'Filtri figur',
		allLinked: 'Vse je povezano',
		allLinkedBody: 'Vsaka različica ima odsek in lekcijo.',
		noMatch: 'Nobena različica ne ustreza',
		noneOwn: 'Še nimate svojih figur.',
		adding: 'Dodajanje različice',
		add: 'Dodaj različico',
		recordingsNext: 'Posnetke lahko dodate v naslednjem koraku.'
	},
	routines: {
		empty: 'Še ni kombinacij',
		emptyBody: 'Nanizajte nekaj različic in jih napovejte kot celoto.',
		badLoop: 'se ne sklene',
		fromClass: (label) => `Z lekcije ${label}`,
		name: 'Ime',
		namePlaceholder: 'Osnovna kombinacija',
		notes: 'Opombe',
		notesPlaceholder: 'Čemu je namenjena, kdaj jo uporabiti …',
		creating: 'Ustvarjanje kombinacije',
		create: 'Ustvari kombinacijo'
	},
	move: {
		subtitle: (figures) => `Figura · ${figures}`,
		routine: 'Kombinacija',
		lesson: 'Lekcija',
		and: (names) =>
			names.length <= 1
				? names.join('')
				: `${names.slice(0, -1).join(', ')} in ${names[names.length - 1]}`,
		rename: 'Preimenuj figuro',
		renameItem: 'Preimenuj',
		more: 'Več',
		newFigure: 'Nova različica',
		figures: 'Različice',
		usedIn: 'Uporabljeno v',
		moveName: 'Ime figure',
		figureName: 'Ime različice',
		figurePlaceholder: 'npr. Doble',
		startsAs: (move) => `Začne na 1 in traja 8 dob, v slogu figure: ${move}.`,
		addFigure: 'Dodaj različico'
	},
	coverage: {
		title: 'Pokritost',
		subtitle: 'Različice po tem, v koliko kombinacijah so',
		selected: (n) => `Izbrano: ${n}`,
		stopSelecting: 'Končaj izbiranje',
		select: 'Izberi',
		tapInOrder: 'Pritiskajte v vrstnem redu, v katerem naj jih kombinacija napove.',
		empty: 'Še ni različic',
		isSelected: 'Izbrano,',
		notSelected: 'Ni izbrano,',
		picked: 'Izbrane različice',
		pickedLine: (n) =>
			`Izbrano: ${nouns.figures(n)}, v vrstnem redu izbire. Vrstni red uredite na strani kombinacije.`,
		none: 'V nobeni kombinaciji',
		one: 'V 1 kombinaciji',
		many: 'V 2+ kombinacijah'
	},
	refused: {
		moveName: 'Vpišite ime figure (do 200 znakov).',
		figureName: 'Vpišite ime različice (do 200 znakov).',
		routineName: 'Vpišite ime kombinacije (do 200 znakov).',
		notes: 'Opombe imajo lahko največ 2000 znakov.',
		partnerStyle: 'Izberite, kako se pleše, in slog.',
		pickMove: 'Izberite figuro.',
		moveTaken: (name) => `Figura s tem imenom že obstaja: ${name}.`,
		figureTaken: (move, name) =>
			`Različica s tem imenom že obstaja: ${move} · ${name}. Najprej eno preimenujte.`,
		pickOne: 'Izberite vsaj eno različico.'
	}
};
