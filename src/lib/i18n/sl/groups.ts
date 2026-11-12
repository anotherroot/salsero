import type { Catalog } from '../catalog';
import { slCount } from '../plural';

/** A section or a point in History: nominative, and after "konec" (genitive). */
const SPOT = { section: 'odsek', point: 'točka' } as const;
const SPOT_OF = { section: 'odseka', point: 'točke' } as const;
/** "3 mesta", after a colon (nominative). */
const slots = (n: number) => slCount(n, ['mesto', 'mesti', 'mesta', 'mest']);

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
		add: 'Dodaj v skupino',
		addMenu: {
			lesson: 'Lekcija',
			music: 'Glasba',
			figure: 'Figura',
			routine: 'Kombinacija',
			position: 'Položaj',
			drill: 'Vaja'
		},
		newDrill: {
			title: 'Nova vaja',
			name: 'Ime',
			notes: 'Opombe',
			hint: 'Člani jo vidijo, ko jo povežete v objavljeni lekciji.',
			create: 'Ustvari vajo',
			noName: 'Vnesite ime (do 200 znakov).',
			longNotes: 'Opombe so lahko dolge do 2000 znakov.'
		},
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
		sub: 'Po izstopu iz skupine ne boste videli ničesar več. Obdržite kopije tistega, kar izberete.',
		reconnect:
			'Kar obdržite, postane vaša kopija. Če se pozneje spet pridružite, se kopije znova povežejo.',
		copyChip: 'Kopija',
		copyMeta: (group) => `Vaša kopija · vir: ${group}`,
		choose: (n) => `Zapusti in obdrži ${n}`,
		lessons: (n) => slCount(n, ['lekcija', 'lekciji', 'lekcije', 'lekcij']),
		figures: (n) => slCount(n, ['figura', 'figuri', 'figure', 'figur']),
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
			const who = { routine: 'vaša kombinacija', lesson: 'vaša lekcija', figure: 'vaša figura' }[
				by
			];
			return meta ? `${meta} · v uporabi: ${who}` : `V uporabi: ${who}`;
		},
		sections: {
			lessons: 'Lekcije',
			routines: 'Kombinacije',
			figures: 'Figure',
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
		alsoFigures: 'Vadi tudi figure',
		figuresCaption:
			'Neoznačene figure so še vedno v zavihku Figure, pod skupino. Ne zasedajo vašega prostora.',
		// The adjective agrees with the count.
		newRoutines: (n) =>
			slCount(n, ['nova kombinacija', 'novi kombinaciji', 'nove kombinacije', 'novih kombinacij']),
		newDrills: (n) => slCount(n, ['nova vaja', 'novi vaji', 'nove vaje', 'novih vaj']),
		kind: {
			lesson: 'Ponavljanje lekcije',
			routine: 'Kombinacija',
			figure: 'Figura',
			drill: 'Vaja'
		},
		label: (title) => `Dodaj: ${title}`,
		refused: 'Te lekcije ni več mogoče dodati.',
		adding: 'Dodajanje'
	},
	// A History line says what happened first, as a neuter past participle
	// ("Dodano: odsek"), so nothing agrees with the person, who stands before
	// the "·". The thing follows the colon in the nominative; a name stays in
	// its quotes as typed, after its noun or alone.
	history: {
		title: 'Zgodovina',
		head: (title) => `Zgodovina · ${title}`,
		quote: (name) => `»${name}«`,
		someone: 'Nekdo',
		thing: {
			video: 'video',
			section: 'odsek',
			point: 'točka',
			link: 'povezava',
			recording: 'posnetek',
			slot: 'mesto',
			option: 'alternativa',
			'section-link': 'povezava odseka'
		},
		field: {
			title: 'naslov',
			lessonDay: 'datum',
			notes: 'opombe',
			name: 'ime',
			figureName: 'ime giba',
			partner: 'v paru ali solo',
			style: 'slog',
			startIds: 'začetni položaji',
			endIds: 'končni položaji',
			endId: 'končni položaj',
			// A position's type is its »Slog«, as on its page.
			styleTag: 'slog',
			hands: 'roke',
			crossed: 'prekrižani roki',
			facing: 'postavitev',
			frame: 'okvir',
			pictureSpotId: 'slika',
			startCount: 'začetna doba',
			startCounts: 'začetne dobe',
			lengthFree: 'dolžina v kombinaciji',
			lengthCounts: 'dolžina',
			note: 'opomba mesta',
			artist: 'izvajalec',
			anchors: 'štetje',
			tempoFactor: 'tempo',
			sampleStartS: 'začetek odlomka',
			sectionsJson: 'deli',
			startS: 'začetek glasbe',
			audio: 'zvok',
			audioUrl: 'povezava do zvoka',
			practiceMode: 'vadenje',
			countBpm: 'tempo vadenja',
			comesBack: 'kdaj pride spet na vrsto',
			hearing: 'nastavitve sluha',
			slots: 'mesta'
		},
		subject: {
			lesson: 'lekcija',
			move: 'gib',
			figure: 'figura',
			routine: 'kombinacija',
			drill: 'vaja',
			song: 'skladba',
			position: 'položaj',
			video: 'video',
			section: 'odsek',
			point: 'točka',
			link: 'povezava',
			recording: 'posnetek',
			slot: 'mesto',
			option: 'alternativa',
			team: 'skupina'
		},
		addedSong: (name) => `Dodano: skladba${name}`,
		made: (shown) => `Ustvarjeno: ${shown}`,
		// The move it came from after "prej:", a name never declined.
		movedHere: (name, from) => `Premaknjeno sem${name ? `:${name}` : ''} · prej: »${from}«`,
		extracted: (name) => `Ustvarjeno iz mest: kombinacija${name}`,
		addedSlots: (n) => `Dodano: ${slots(n)}`,
		linked: (spot, name) => `Povezano: ${SPOT[spot]}${name ? ` ·${name}` : ''}`,
		unlinked: (spot, name) => `Povezava odstranjena: ${SPOT[spot]}${name ? ` ·${name}` : ''}`,
		added: (thing) => `Dodano: ${thing}`,
		addedThe: (shown, name) => `Dodano: ${shown}${name}`,
		removedSlots: (n) => `Odstranjeno: ${slots(n)}`,
		removed: (thing) => `Odstranjeno: ${thing}`,
		removedThe: (shown, name) => `Odstranjeno: ${shown}${name}`,
		archived: (shown, name) => `Arhivirano: ${shown}${name}`,
		published: (shown) => `Objavljeno: ${shown}`,
		shared: (shown, name) => `Deljeno s tečajem: ${shown}${name}`,
		unshared: (shown, name) => `Ni več deljeno s tečajem: ${shown}${name}`,
		deleted: (shown, name) => `Izbrisano: ${shown}${name}`,
		changed: (what) => `Spremenjeno: ${what}`,
		movedSlot: 'Premaknjeno: mesto',
		putBack: (spot, label) => `Vrnjeno: ${label === null ? SPOT[spot] : `»${label}«`}`,
		putBackSlots: (n) => `Vrnjeno: ${n > 1 ? slots(n) : 'mesto'}`,
		restored: (what) => `Obnovljeno: ${what}`,
		restoredThing: (thing) => `Obnovljeno: ${thing}`,
		moved: (spot, label, seconds) =>
			`Premaknjeno: ${label === null ? SPOT[spot] : `»${label}«`} za ${seconds} s`,
		// "konec odseka" (genitive), then the name in its quotes.
		movedEnd: (spot, label, seconds) =>
			`Premaknjeno: konec ${SPOT_OF[spot]}${label === null ? '' : ` »${label}«`} za ${seconds} s`,
		clearedName: (spot) => `Ime izbrisano: ${SPOT[spot]}`,
		named: (spot, label) => `Poimenovano: ${SPOT[spot]} »${label}«`,
		was: (value) => `Prej: ${value}`,
		empty: '(prazno)',
		editedBy: (first, ago) => `Zadnja sprememba: ${first} · ${ago}`,
		archivedBy: (first) => `Arhivirano · ${first}`,
		archivedSince: 'Odkar ste to odprli, je bilo arhivirano.',
		emptyTitle: 'Še ni sprememb',
		emptyBody: 'Tu je vidno, kdo v skupini kaj spremeni.',
		listLabel: 'Spremembe, najnovejše najprej',
		inDeleted: 'V »Nedavno izbrisano«',
		untitled: {
			lesson: 'Lekcija',
			figure: 'Gib',
			routine: 'Kombinacija',
			drill: 'Vaja',
			song: 'Skladba',
			position: 'Položaj'
		},
		noHistory: 'Te zgodovine ni',
		noChange: 'Te spremembe ni',
		restoreClash: (title) => `${title}. Obnovitev bi razveljavila tudi to, zato ni bila izvedena.`,
		nameTaken: 'To ime je zdaj zasedeno. Najprej preimenujte tisto z istim imenom.'
	},
	deleted: {
		head: (team) => `Nedavno izbrisano · ${team}`,
		kind: {
			video: 'Video lekcije',
			section: 'Odsek',
			link: 'Povezava',
			'spot-link': 'Povezava odseka',
			recording: 'Posnetek',
			lesson: 'Lekcija',
			variation: 'Figura',
			routine: 'Kombinacija',
			drill: 'Vaja',
			song: 'Skladba',
			position: 'Položaj',
			'position-link': 'Povezava s položajem'
		},
		by: (who, ago) => `Izbrisano · ${who} · ${ago}`,
		purge: (date) => `Trajni izbris: ${date}`,
		taken: (name) => `Ime je že zasedeno: ${name}. Najprej preimenujte tisto.`,
		emptyTitle: 'Nič izbrisanega',
		emptyBody:
			'Kar izbrišejo ali arhivirajo tisti, ki urejajo skupino, počaka tu. Videi, odseki, povezave in posnetki ostanejo 30 dni.',
		listLabel: 'Izbrisano, najnovejše najprej',
		restoreLabel: (kind, label) => `Obnovi: ${kind} · ${label}`,
		noLongerHere: 'Tega ni več.',
		untitledSong: 'Skladba brez naslova',
		couldNotRestore: 'Tega ni bilo mogoče obnoviti.',
		refused: {
			parentFirst: {
				section: 'Najprej obnovite video',
				'spot-link': 'Najprej obnovite odsek',
				'position-link': 'Najprej obnovite odsek ali točko'
			},
			parentGone: 'Tistega, v čemer je bilo, ni več',
			purged: 'To je bilo dokončno izbrisano.',
			restored: 'To je že obnovljeno.',
			spotLinkAgain: 'Ista povezava odseka je bila medtem narejena znova.',
			positionLinkAgain: 'Povezava s tem položajem je bila medtem narejena znova.',
			family: 'Kopija tega je že tu.',
			notFound: 'Tega ni več mogoče obnoviti.'
		}
	},
	// The person after a "·", as History writes them: nothing agrees with them.
	clash: {
		changedSince: 'Odkar ste to odprli, se je spremenilo',
		changedBy: (who) => `Spremenjeno · ${who}`,
		changedByAgo: (who, ago) => `Spremenjeno · ${who} · ${ago}`,
		deletedSince: 'Odkar ste to odprli, je bilo izbrisano',
		deletedBy: (who) => `Izbrisano · ${who}`,
		deletedByAgo: (who, ago) => `Izbrisano · ${who} · ${ago}`,
		staleRoutine: 'Kombinacija se je spremenila. Zdaj je prikazano najnovejše stanje.',
		staleRoutineBy: (who) => `Sprememba kombinacije · ${who}. Zdaj je prikazano najnovejše stanje.`,
		missingSeen: 'Ta stran je zastarela. Naložite jo znova in poskusite še enkrat.',
		field: {
			title: 'Naslov',
			lessonDay: 'Datum lekcije',
			notes: 'Opombe',
			name: 'Ime',
			figureName: 'Ime giba',
			partner: 'V paru ali solo',
			style: 'Slog',
			startIds: 'Začne v',
			endIds: 'Konča v',
			endId: 'Konča v',
			startCount: 'Začne na',
			startCounts: 'Lahko začne na',
			lengthFree: 'Dolžina v kombinaciji',
			lengthCounts: 'Dolžina',
			comesBack: 'Kdaj pride spet na vrsto',
			hearing: 'Nastavitve sluha',
			active: 'Aktivna',
			label: 'Ime',
			startMs: 'Začetek',
			endMs: 'Konec'
		}
	},
	storage: {
		head: (team) => `Kaj zaseda prostor · ${team}`,
		askIntro: 'Skrbnik vidi, koliko prostora porabi skupina. Opomba ni obvezna.',
		waits:
			'Izbrisan video ali posnetek počaka 30 dni v »Nedavno izbrisano« in do takrat še zaseda prostor.'
	},
	mode: {
		mineMeta: 'Vaše lastne stvari'
	}
};
