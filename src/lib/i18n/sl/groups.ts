import type { Catalog } from '../catalog';
import { slCount } from '../plural';

// A group's or a person's name is never declined: it stands after a colon or in
// »…« (a user's label, as the video player's delete asks). The roles are said
// without a gendered noun: "vodja" (as in "vodja tečaja") is both, and an editor
// and a member are what they may do (the glossary).
export const groups: Catalog['groups'] = {
	tabNew: 'Skupine, novo v vaših skupinah',
	newPill: (n) => slCount(n, ['nov', 'nova', 'novi', 'novih']),
	role: { owner: 'Vodja', editor: 'Lahko ureja', member: 'Lahko bere' },
	// "jo": the group (skupina).
	you: { owner: 'vodite jo', editor: 'urejate jo', member: 'sodelujete' },
	page: {
		menu: 'Meni skupine',
		deleted: 'Izbrisana',
		restore: 'Obnovi',
		autoAdd: 'Nove lekcije samodejno dodaj v Danes',
		couldNotSave: 'Ni bilo mogoče shraniti.',
		couldNotAdd: 'Ni bilo mogoče dodati.',
		couldNotUndo: 'Ni bilo mogoče razveljaviti.',
		addedToToday: 'Dodano v Danes',
		lessons: 'Lekcije',
		newLesson: 'Nova lekcija',
		noLessons: 'Še ni lekcij',
		added: 'Dodano',
		people: 'Ljudje',
		recentlyDeleted: 'Nedavno izbrisano',
		showCode: 'Pokaži kodo',
		rename: 'Preimenuj',
		leaveClass: 'Zapusti tečaj',
		leaveGroup: 'Zapusti skupino',
		deleteGroup: 'Izbriši skupino',
		renameGroup: 'Preimenuj skupino',
		name: 'Ime',
		deleteQuestion: (name) => `Želite izbrisati »${name}«?`,
		deleteBody: 'Vsi izgubijo njene lekcije. Obnovite jo lahko v 30 dneh.',
		noLesson: 'Te lekcije ni',
		noGroup: 'Te skupine ni',
		chooseKeep: 'Izberite, kaj želite obdržati.',
		keepFailed: 'Kopij ni bilo mogoče shraniti. Poskusite znova.',
		handOverFirst: 'Preden skupino zapustite, jo predajte drugemu.',
		uses: (used, limit) => `Porabljeno ${used} od ${limit}`,
		nameTaken: 'Skupino s tem imenom že imate. Najprej preimenujte tisto.'
	},
	people: {
		title: 'Ljudje',
		actionsFor: (name) => `Dejanja: ${name}`,
		makeMember: 'Odvzemi urejanje',
		makeEditor: 'Dovoli urejanje',
		handOverGroup: 'Predaj skupino',
		handOverQuestion: (name) => `Želite predati skupino: ${name}?`,
		handOverBody:
			'Ta oseba postane vodja, vi pa skupino še naprej urejate. Nazaj jo lahko preda le ona.',
		handOver: 'Predaj',
		removeQuestion: (name) => `Želite odstraniti: ${name}?`,
		removeBody: 'Oseba zapusti skupino in obdrži kopije svojih stvari.',
		noPerson: 'Te osebe ni',
		pickRole: 'Izberite vlogo.',
		ownerKeeps: 'Vodja obdrži skupino. Če želite to spremeniti, jo predajte drugemu.',
		ownsEnough: 'Ta oseba že vodi toliko skupin, kot jih lahko ustvari.',
		pickSomeone: 'Izberite nekoga drugega iz skupine.',
		keepFailed: 'Kopij te osebe ni bilo mogoče shraniti. Poskusite znova.',
		ownerStays: 'Vodje ni mogoče odstraniti. Najprej predajte skupino.'
	},
	leave: {
		title: (team) => `Želite zapustiti »${team}«?`,
		sub: 'Po izstopu iz skupine ne vidite ničesar več. Obdržite kopije tistega, kar izberete.',
		reconnect:
			'Kar obdržite, postane vaša kopija. Če se pozneje spet pridružite, se kopije znova povežejo.',
		copyChip: 'Kopija',
		copyMeta: (group) => `Vaša kopija · vir: ${group}`,
		choose: (n) => `Zapusti in obdrži ${n}`,
		lessons: (n) => slCount(n, ['lekcija', 'lekciji', 'lekcije', 'lekcij']),
		figures: (n) => slCount(n, ['različica', 'različici', 'različice', 'različic']),
		routines: (n) => slCount(n, ['kombinacija', 'kombinaciji', 'kombinacije', 'kombinacij']),
		songs: (n) => slCount(n, ['skladba', 'skladbi', 'skladbe', 'skladb']),
		nothing: 'Ni česa obdržati',
		everything: (counts, size) => `${counts.join(', ')} · ${size} v vašem prostoru`,
		usedNone: 'Vaše kombinacije ne uporabljajo ničesar iz skupine. Vse izgine',
		// The routine's name after a colon.
		used: (names, routine) =>
			routine
				? `${names.join(' in ')} · uporablja: ${routine}. Vse drugo izgine`
				: `${names.join(' in ')} · uporabljajo vaše kombinacije. Vse drugo izgine`,
		overLimit: (size) =>
			`S tem presežete svoj prostor (${size}). Vadite lahko še naprej, nova nalaganja pa počakajo, dokler ne boste spet pod mejo.`,
		locked: (meta, by) => {
			const who = { routine: 'vaša kombinacija', lesson: 'vaša lekcija', figure: 'vaša različica' }[
				by
			];
			return meta ? `${meta} · v uporabi: ${who}` : `V uporabi: ${who}`;
		},
		sections: {
			lessons: 'Lekcije',
			routines: 'Kombinacije',
			figures: 'Različice',
			songs: 'Skladbe'
		},
		keepAll: 'Obdrži vse',
		chooseWhat: 'Izberi, kaj obdržati',
		keepUsed: 'Obdrži le, kar uporabljajo moje kombinacije',
		whatToKeep: 'Kaj obdržati',
		failed: 'Izstop ni uspel. Poskusite znova.',
		loadFailed: 'Ni bilo mogoče naložiti, kaj bi obdržali. Zaprite to okno in poskusite znova.',
		leave: 'Zapusti',
		leaving: 'Izstop poteka',
		recordings: (n) => slCount(n, ['posnetek', 'posnetka', 'posnetki', 'posnetkov']),
		slots: (n) => slCount(n, ['mesto', 'mesti', 'mesta', 'mest'])
	},
	list: {
		subtitle: 'Delite lekcije s tečajem',
		yourGroups: 'Vaše skupine',
		restoreName: (name) => `Obnovi: ${name}`,
		restoreFailed: 'Te skupine ni bilo mogoče obnoviti.',
		emptyTitle: 'Še ni skupin',
		emptyBody:
			'Ustvarite skupino za svoj tečaj in delite njeno kodo. Vsi v njej vidijo lekcije, ki jih objavite.',
		// No past tense: it would agree with the teacher, a woman or a man.
		emptyClassBody: 'Kodo ima vodja tečaja. Lahko pa odprete prejeto povezavo.',
		joinWithCode: 'Pridruži se s kodo',
		newGroup: 'Nova skupina',
		createGroup: 'Ustvari skupino',
		creatingGroup: 'Ustvarjanje skupine',
		namePlaceholder: 'Salsa nadaljevalna',
		// After "ustvarite" the accusative: 1 skupino, 2 skupini, 3 skupine, 5 skupin.
		limit: (n) =>
			`Ustvarite lahko ${slCount(n, ['skupino', 'skupini', 'skupine', 'skupin'])}. Za več vprašajte skrbnika.`,
		nameRefusal: 'Vnesite ime z največ 60 znaki, ki ga nima nobena vaša skupina.',
		pick: {
			title: 'Izberite skupino',
			body: 'Tu se odprejo njene lekcije, skladbe s tečaja in ljudje.'
		}
	},
	code: {
		title: 'Koda skupine',
		qr: (name) => `Koda QR za pridružitev · ${name}`,
		shareTitle: (name) => `Pridružite se: ${name}`,
		copyLink: 'Kopiraj povezavo',
		copied: 'Kopirano',
		share: 'Deli',
		copyFailed: 'Kopiranje ni uspelo. Povezava zgoraj je označena: kopirajte jo od tam.',
		accountsOnly: 'Z njo se lahko pridružijo le tisti, ki že imajo račun.',
		remake: 'Ustvari novo kodo',
		remakeNote: 'Stara povezava in koda QR prenehata delovati. Kdor je že v skupini, ostane.'
	},
	add: {
		// "V njej": the lesson (lekcija).
		nothing: 'V njej še ni ničesar',
		onToday: 'V Danes',
		alsoFigures: 'Vadi tudi različice',
		figuresCaption:
			'Neoznačene različice so še vedno v zavihku Figure, pod skupino. Ne porabijo nič vašega prostora.',
		// The adjective agrees with the count.
		newRoutines: (n) =>
			slCount(n, ['nova kombinacija', 'novi kombinaciji', 'nove kombinacije', 'novih kombinacij']),
		newDrills: (n) => slCount(n, ['nova vaja', 'novi vaji', 'nove vaje', 'novih vaj']),
		kind: {
			lesson: 'Ponavljanje lekcije',
			routine: 'Kombinacija',
			figure: 'Različica',
			drill: 'Vaja'
		},
		label: (title) => `Dodaj: ${title}`,
		refused: 'Te lekcije ni več mogoče dodati.',
		adding: 'Dodajanje'
	},
	mode: {
		label: (name) => `${name} · skupina`,
		mineMeta: 'Vaše lastne stvari'
	}
};
