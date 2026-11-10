// Povezave: okno Poveži (povezave odseka ali točke, izbirnik in koraki za ustvarjanje),
// urejevalnik povezav in Dodaj povezavo, kartica YouTube, Poveži odsek in zavrnitve.
// A preposition that would depend on the next word (s/z before a name or a range) is
// avoided, or fixed by its own noun ("z odsekom", "s točko", "z lekcijo: …").
import type { Catalog } from '../catalog';

export const links: Catalog['links'] = {
	pointOf: (label) => `${label} · točka`,
	point: 'Točka',
	linkedTo: {
		section: (range) => `Povezano z odsekom ${range}`,
		point: (range) => `Povezano s točko ${range}`,
		sectionAndLesson: (range, title) => `Povezano z odsekom ${range} in z lekcijo: ${title}`,
		pointAndLesson: (range, title) => `Povezano s točko ${range} in z lekcijo: ${title}`
	},
	createRow: {
		variation: 'Figura',
		drill: 'Vaja',
		position: 'Položaj'
	},
	opener: {
		any: 'Poveži …',
		point: 'Poveži s položajem …',
		section: 'Poveži z figuro, vajo ali položajem …'
	},
	search: {
		any: 'Iskanje',
		point: 'Iskanje položajev',
		section: 'Iskanje figur, vaj in položajev'
	},
	titles: {
		links: (range) => `Poveži ${range}`,
		pick: (range) => `S čim povezati ${range}?`,
		linksOf: { any: 'Poveži', point: 'Poveži točko', section: 'Poveži odsek' },
		pickOf: {
			any: 'S čim povezati?',
			point: 'S čim povezati točko?',
			section: 'S čim povezati odsek?'
		}
	},
	loadFailed: {
		any: 'Povezav ni bilo mogoče naložiti.',
		point: 'Povezav te točke ni bilo mogoče naložiti.',
		section: 'Povezav tega odseka ni bilo mogoče naložiti.',
		body: 'Zaprite in znova tapnite gumb za povezave.'
	},
	moment: 'Ta trenutek uporabi kot točko',

	popup: {
		linked: 'Povezano',
		none: 'Še ni povezano z ničimer.',
		drill: 'Vaja',
		position: 'Položaj',
		archived: 'Arhivirano',
		unlinkOf: (label) => `Odstrani povezavo: ${label}`,
		nothingLeft: 'Ni več ničesar, kar bi lahko povezali.',
		saveFailed: 'Shranjevanje ni uspelo. Poskusite znova.',
		unlinkTitle: (label) => `Želite odstraniti povezavo »${label}«?`,
		alsoLesson: 'Povezano je tudi s to lekcijo.',
		onlySection: 'Samo iz tega odseka',
		sectionAndLesson: 'Iz odseka in lekcije'
	},
	create: {
		titles: {
			variation: 'Nova figura',
			drill: 'Nova vaja',
			position: 'Nov položaj'
		},
		move: 'Gib',
		chooseMove: 'Izberite gib …',
		chooseMoveTitle: 'Izberite gib',
		searchMoves: 'Iskanje gibov',
		noMoves: 'Gibov še ni.',
		moves: 'Gibi',
		pickMove: 'Izberite gib.',
		figureName: 'Ime figure',
		// As the figure fields' example: the Spanish name dancers use.
		name: 'Ime',
		positionPlaceholder: 'npr. Cerrada, Manos cruzadas',
		// A position's type is its style, as in the position sheet.
		type: 'Slog',
		submit: 'Ustvari in poveži'
	},

	add: {
		title: 'Dodaj povezavo',
		label: 'Povezava',
		link: 'Povezava',
		placeholder: 'Prilepite povezavo do YouTuba ali spletne strani',
		titleField: 'Naslov',
		optional: '(neobvezno)',
		adding: 'Dodajanje …',
		submit: 'Dodaj povezavo',
		many: 'Dodaj povezave',
		manyPlaceholder: 'Prilepite povezave do YouTuba ali drugih strani, vsako v svojo vrstico',
		titlePlaceholder: 'Za eno samo povezavo'
	},
	found: {
		youtube: 'Video na YouTubu',
		youtubeLine: 'Ko dodate povezavo, lahko video shranite v 480p',
		web: 'Spletna stran'
	},
	save: {
		saving: 'Shranjevanje v 480p na domačem strežniku',
		failed: (error) => `Shranjevanje ni uspelo: ${error}`,
		unknown: 'neznana napaka',
		retry: 'Poskusi znova',
		save: 'Shrani video',
		removeOf: (title) => `Odstrani: ${title}`
	},
	youtube: {
		play: (title) => `Predvajaj: ${title}`,
		playVideo: 'Predvajaj video',
		from: (time) => ` · od ${time}`,
		open: 'Odpri v YouTubu',
		frame: 'Video na YouTubu'
	},
	sections: {
		title: 'Poveži odsek',
		search: 'Iskanje odsekov',
		near: 'V tej lekciji',
		none: 'Ni odsekov za povezavo. Odprite video lekcije čez cel zaslon in tapnite Odsek, da ga označite.'
	},

	refused: {
		noFigure: 'Te figure ni.',
		noExercise: 'Te vaje ni.',
		drillOnly: 'Lastne odseke ima lahko le vaja.',
		noSection: 'Tega odseka ni.',
		sectionOnly: 'Povezati je mogoče le odsek, ne točke.',
		otherDance: 'Ta odsek je iz drugega plesa.',
		already: 'Že povezano.',
		copyLink: 'Kopiranje in povezovanje ni uspelo. Nič ni bilo kopirano.',
		pointPositions: 'Točko lahko povežete le s položaji.',
		noName: 'Vpišite ime.',
		typeDance: 'Ta slog ne spada k temu plesu.',
		styleDance: 'Ta slog ne spada k temu plesu.',
		noMove: 'Tega giba ni.',
		variationTaken: (move, name) => `Figura s tem imenom že obstaja: ${move} · ${name}.`,
		moveTaken: (name) => `Gib s tem imenom že obstaja: ${name}.`,
		figureNotMade: 'Figure ni bilo mogoče ustvariti.',
		moveNotMade: 'Giba ni bilo mogoče ustvariti.',
		notWeb: (lines) => `To ni spletna povezava: ${lines}`,
		pasteFirst: 'Najprej prilepite povezavo.',
		tooLong: 'Ta povezava je predolga.',
		titleLong: 'Naslov ima lahko največ 200 znakov.',
		drillLinks: 'Povezave so na figuri ali lekciji, h kateri spada ta vaja.',
		gone: 'Ta povezava je bila že odstranjena.',
		youtubeOnly: 'Kot video je mogoče shraniti le povezavo do YouTuba.',
		nothingToRestore: 'Tega ni več mogoče obnoviti.'
	},
	near: {
		lesson: 'V tej lekciji',
		recording: 'Ta figura'
	}
};
