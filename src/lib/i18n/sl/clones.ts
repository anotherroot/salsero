// Copies: Make it mine, the sources, Sync, Samodejno usklajevanje (Keep in step),
// Drop, Detach, Copy to…, Move to…, twins, Versions and the ⋯ menu. A place (a
// group, "Sreda 17:30") is a name: it stands before a "·" or after a colon, never
// inside a phrase that would decline it, and no past tense agrees with it
// ("Sreda 17:30 · spremenjeno: opombe"). The person's own copy is »vaša kopija«;
// Sync is »Uskladi«. "Version" (a member of a family) is »kopija«, never
// »različica« (only the app has one) or »figura« (a figure). No possessive of a name: "Salsa Tuesdays’"
// is »Skupina: Salsa Tuesdays« or »· Salsa Tuesdays«.
import type { Catalog } from '../catalog';
import type { CloneKind } from '$lib/types';
import { slCount, slForm } from '../plural';
import { nouns } from './nouns';

/** "a", "a in b", "a, b in c". */
const listed = (names: string[]): string =>
	names.length > 1
		? `${names.slice(0, -1).join(', ')} in ${names[names.length - 1]}`
		: (names[0] ?? '');

/** A kind's noun, as a subtitle or "ostane … skupine" says it. */
const KIND: Record<CloneKind, string> = {
	figure: 'figura',
	routine: 'kombinacija',
	drill: 'vaja',
	song: 'skladba',
	lesson: 'lekcija',
	position: 'položaj'
};
// A family counted as its own kind (the twins subtitle).
const TWIN_NOUN: Record<CloneKind, (n: number) => string> = {
	figure: (n) => nouns.figures(n),
	routine: (n) => nouns.routines(n),
	drill: (n) => nouns.drills(n),
	song: (n) => nouns.songs(n),
	lesson: (n) => nouns.lessons(n),
	position: (n) => nouns.positions(n)
};

const capital = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

/** "Twins show as one …": a kind, one of it, in the nominative. */
const ONE: Record<CloneKind, string> = {
	figure: 'ena figura',
	routine: 'ena kombinacija',
	drill: 'ena vaja',
	song: 'ena skladba',
	lesson: 'ena lekcija',
	position: 'en položaj'
};

/** "Iščite med svojimi …": a kind's plural in the instrumental. */
const AMONG: Record<CloneKind, string> = {
	figure: 'figurami',
	routine: 'kombinacijami',
	drill: 'vajami',
	song: 'skladbami',
	lesson: 'lekcijami',
	position: 'položaji'
};

/** "No other … match.": the subject agrees with its kind. */
const NONE_OTHER: Record<CloneKind, string> = {
	figure: 'Nobena druga figura ne ustreza.',
	routine: 'Nobena druga kombinacija ne ustreza.',
	drill: 'Nobena druga vaja ne ustreza.',
	song: 'Nobena druga skladba ne ustreza.',
	lesson: 'Nobena druga lekcija ne ustreza.',
	position: 'Noben drug položaj ne ustreza.'
};

/** "Meni …": a kind in the genitive. */
const OF_KIND: Record<CloneKind, string> = {
	figure: 'figure',
	routine: 'kombinacije',
	drill: 'vaje',
	song: 'skladbe',
	lesson: 'lekcije',
	position: 'položaja'
};

/** A verb before a count agrees with it: 1 uporablja, 2 uporabljata, 3–4 uporabljajo, 5+ uporablja. */
const uses = (n: number): string =>
	({ one: 'Uporablja', two: 'Uporabljata', few: 'Uporabljajo', other: 'Uporablja' })[slForm(n)];

/** A noun without a number, by how many names follow it: kombinacija, kombinaciji, kombinacije. */
const named = (n: number, forms: [one: string, two: string, many: string]) =>
	n === 1 ? forms[0] : n === 2 ? forms[1] : forms[2];

export const clones: Catalog['clones'] = {
	// What it does, said plainly: the class's own stays as it is.
	makeMine: 'Naredi svojo kopijo',
	usedAsIs: (team) => `${team} · uporabljeno, kakršno je`,
	fromLessonNote: (lesson, team) =>
		`Iz lekcije: ${lesson}. V kombinacijah jo uporabljajte, kakršna je; ostane v skupini: ${team}.`,
	groupSlotNote: (figures, team) =>
		`${listed(figures)} · iz skupine: ${team}. Če skupino zapustite, obdržite kopijo in ta kombinacija deluje naprej.`,
	mine: {
		title: (label) => `Želite narediti svojo kopijo: ${label}?`,
		sub: 'Ko urejate, nastane vaša kopija. Tista iz tečaja ostane nespremenjena.',
		restore: 'Svojo kopijo ste že imeli. Jo želite obnoviti?',
		archivedSong:
			'Vaša kopija te skladbe je arhivirana. Da bo spet vaša, jo izbrišite v razdelku Nastavitve → Kaj zaseda prostor.',
		youGet: 'DOBITE',
		gets: {
			figure: 'Ime, začetek in dolžino, položaje in opombe. Spreminjate jih lahko po svoje.',
			routine: 'Ime, opombe in mesta. Spreminjate jih lahko po svoje.',
			drill: 'Ime, opombe in vadenje. Spreminjate jih lahko po svoje.',
			song: 'Naslov, izvajalca in štetje. Spreminjate jih lahko po svoje.',
			lesson:
				'Naslov, opombe, povezave, videe in odseke. Spreminjate jih lahko po svoje. Videi zasedajo vaš prostor.',
			position: 'Ime, slog, držo in opombe. Spreminjate jih lahko po svoje.'
		},
		staysTitle: (team) => `OSTANE V SKUPINI · ${team.toUpperCase()}`,
		staysPosition: (team) =>
			`Lekcije in videi, ki so nanj povezani. Vidite jih na zavihku skupine: ${team}.`,
		staysFigure:
			'Posnetki in njihovi odseki. Še vedno jih vidite v svoji kopiji in lahko kakšnega prevzamete (takrat zaseda vaš prostor).',
		// Said before the copy is made: the perfective present is its future ("it will take").
		size: (size) => `Zasede ${size} vašega prostora`,
		// A list after the colon, each in the nominative: nothing agrees with it.
		switchNote: (r) => {
			const parts: string[] = [];
			if (r.figures.length === 1) parts.push(`figura ${r.figures[0]} (s tem položajem)`);
			else if (r.figures.length > 1)
				parts.push(`${nouns.figures(r.figures.length)} s tem položajem`);
			if (r.routines.length > 0)
				parts.push(
					`${named(r.routines.length, ['kombinacija', 'kombinaciji', 'kombinacije'])} ${listed(r.routines)}`
				);
			if (r.lessons.length > 0)
				parts.push(
					`${named(r.lessons.length, ['lekcija', 'lekciji', 'lekcije'])} ${listed(r.lessons)}`
				);
			if (r.sections === 1) parts.push('odsek');
			else if (r.sections > 1) parts.push(nouns.sections(r.sections));
			if (r.practised) parts.push('vadenje');
			if (parts.length === 0) return null;
			return `Na vašo kopijo preide: ${listed(parts)}.`;
		},
		refused: 'Kopije ni bilo mogoče narediti.',
		failed: 'Kopije ni bilo mogoče narediti. Poskusite znova.',
		busy: 'Izdelava kopije'
	},
	sources: {
		team: (team, kind) => `${capital(KIND[kind])} · ${team}`,
		copyFrom: (place) => `Vaša kopija · vir: ${place}`,
		inGroups: (n) => `Vaše · v ${slCount(n, ['skupini', 'skupinah', 'skupinah', 'skupinah'])}`,
		// Counted as the kind itself: »Dvojčki · 3 kombinacije«, not »figure« (a figure).
		// »Dvojček« whatever the count, as the chip says it.
		twins: (n, kind) => `Dvojček · ${TWIN_NOUN[kind](n)}`,
		note: (place) => `Kopija · ${place}, samo za branje. Kar želite, prevzemite v svojo.`,
		held: (size) => `${size} · že v vaši kopiji`,
		new: (size) => `Nov · ${size}`,
		take: 'Prevzemi',
		alreadyInYours: 'Ta posnetek je že v vaši kopiji.',
		recordingGone: 'Tega posnetka ni več.',
		notTaken: 'Ni prevzeto'
	},
	counted: {
		starts: (n) =>
			slCount(n, ['začetni položaj', 'začetna položaja', 'začetni položaji', 'začetnih položajev']),
		ends: (n) =>
			slCount(n, ['končni položaj', 'končna položaja', 'končni položaji', 'končnih položajev'])
	},
	field: {
		practice: 'Vadenje',
		day: 'Datum',
		artist: 'Izvajalec',
		count: 'Štetje',
		sample: 'Odlomek',
		sections: 'Deli',
		musicStart: 'Začetek glasbe',
		audio: 'Zvok',
		slots: 'Mesta',
		note: 'Opomba',
		sectionLinks: 'Povezave odseka'
	},
	value: {
		countAt: (bpm) => `Štetje · ${bpm} BPM`,
		toASong: 'Ob skladbi',
		noPractice: 'Brez vadenja',
		taps: (n) => slCount(n, ['pritisk', 'pritiska', 'pritiski', 'pritiskov']),
		automatic: 'Samodejno',
		from: (at) => `Od ${at}`,
		noSections: 'Brez delov',
		sections: (n) => slCount(n, ['del', 'dela', 'deli', 'delov']),
		asFound: 'Najdeni začetek',
		startsAt: (at) => `Začne se pri ${at}`
	},
	refusal: {
		stale: 'Medtem se je spremenilo; preverite znova.',
		pickBoth: 'Kjer sta se spremenili obe, izberite svojo ali njihovo.',
		nameTaken: (name, move) =>
			`Figura s tem imenom že obstaja: ${move} · ${name}. Najprej eno preimenujte.`,
		loadFailed: 'Tega ni bilo mogoče naložiti. Poskusite znova.'
	},
	drop: {
		title: 'Želite opustiti svojo kopijo?',
		subRead: 'Vrnete se h kopiji tečaja, ki jo lahko le berete. Vaša kopija se arhivira.',
		subEdit: 'Vrnete se h kopiji skupine, ki jo urejate. Vaša kopija se arhivira.',
		subPick: 'Vrnete se h kopiji, ki jo izberete. Vaša kopija se arhivira.',
		one: (place, label, follows) =>
			follows
				? `Vaše kombinacije in vadenje bodo uporabljali: ${label} · ${place}.`
				: `Vaše kombinacije bodo uporabljale: ${label} · ${place}.`,
		place: (place) => place,
		onlyInYours: (fields, counted) => `Samo v vaši kopiji: ${listed([...fields, ...counted])}.`,
		goesWithCopy: 'To gre v arhiv z vašo kopijo.',
		youEdit: (place) => `To kopijo lahko urejate: ${place}.`,
		useInstead: 'Namesto nje uporabite',
		copiedHere: 'Vaša kopija je narejena od tod',
		draft: 'Še ni objavljena: vaše vadenje ostane pri vaši kopiji.',
		cantFollow: 'Ni v nobeni lekciji, ki ste jo dodali, zato vadenje ne more slediti',
		addToo: (lesson) => `Dodajte tudi lekcijo: ${lesson}`,
		button: 'Opusti svojo kopijo',
		syncFirst: 'Najprej uskladi',
		toast: (place) => `Nazaj na kopiji · ${place}. Vaša kopija je arhivirana.`,
		failed: 'Kopije ni bilo mogoče opustiti. Poskusite znova.',
		gone: 'Te kopije ni več mogoče uporabiti. Naložite znova in izberite še enkrat.',
		busy: 'Opuščanje kopije'
	},
	detach: {
		button: 'Odklopi',
		title: (place) => `Želite nehati slediti: ${place}?`,
		titleGroup: 'Želite odklopiti od kopij?',
		mine: 'Vaša kopija ostane vaša, kakršna je. Še naprej je prikazana skupaj z njihovo, kot dvojčka.',
		noMore: 'Brez obvestil o razlikah in brez nehotenega usklajevanja.',
		group: (kind) =>
			`V skupini »Odklopi« le prekine povezavo s kopijami: ostane ${KIND[kind]} skupine.`,
		failed: 'Odklop ni uspel. Poskusite znova.',
		busy: 'Odklapljanje'
	},
	sync: {
		yours: 'Vaša',
		noticeTitle: 'Vaše kopije se razlikujejo',
		sending: (n) => `Pošiljanje v ${slCount(n, ['kopijo', 'kopiji', 'kopije', 'kopij'])} …`,
		sent: (n) =>
			({
				one: 'Kopija posodobljena',
				two: 'Kopiji posodobljeni',
				few: 'Kopije posodobljene',
				other: 'Kopije posodobljene'
			})[slForm(n)],
		sync: 'Uskladi',
		menu: 'Uskladi …',
		updateMine: 'Posodobi svojo',
		syncTo: 'Kopije za uskladitev',
		nothingDiffers: 'Vaše kopije se ujemajo. Ni česa uskladiti.',
		loadFailed: 'Usklajevanja ni bilo mogoče naložiti. Poskusite znova.',
		sendFailed: 'Uskladitev ni uspela. Poskusite znova.',
		loadAgain: 'Naloži znova',
		pickOne: 'Izberite eno',
		showAll: 'Pokaži vse',
		showLess: 'Pokaži manj',
		title: (label) => `Uskladi: ${label}`,
		updateTitle: (place) => `Posodobi iz: ${place}`,
		stale: 'Med usklajevanjem se je spremenilo; preverite znova.',
		pick: 'Kjer se kopije razlikujejo, izberite vrednost.',
		failed: 'Te kopije ni bilo mogoče uskladiti. Poskusite znova.',
		noAccess: 'Te kopije ne morete več urejati.',
		thisOne: 'ta kopija',
		role: { owner: 'vodja', editor: 'lahko ureja', member: 'lahko bere' },
		// The button names what it does to them: accusative.
		button: (n) => `Uskladi ${slCount(n, ['kopijo', 'kopiji', 'kopije', 'kopij'])}`,
		// "v" takes the locative: 1 kopiji, 2/3/5 kopijah.
		sub: (differences, copies) =>
			`${nouns.differences(differences)} v ${slCount(copies, ['kopiji', 'kopijah', 'kopijah', 'kopijah'])}`,
		holders: (labels) => listed(labels),
		placeYours: 'vaša kopija',
		you: 'vaša kopija',
		places: (labels) => listed(labels),
		// A neuter participle first, the copies after the colon: nothing agrees with a name.
		changedBy: (names, kind) =>
			`${kind === 'add' ? 'dodano' : kind === 'remove' ? 'odstranjeno' : 'spremenjeno'}: ${listed(names)}`,
		removeChoice: (places) => `Odstranitev iz: ${places}`,
		addBox: (places) => `Dodajte tudi v: ${places}`,
		removeBox: (places) => `Odstranite tudi iz: ${places}`,
		removed: 'odstranjeno',
		added: (quoted) => `dodano ${quoted}`,
		quote: (text) => `»${text}«`,
		updateSub: (n) =>
			`Skupina je od vašega prevzema naredila ${slCount(n, ['spremembo', 'spremembi', 'spremembe', 'sprememb'])}`,
		stays: (fields) => {
			const words = listed(fields.map((f) => (/^\d/.test(f) ? f : f.toLowerCase())));
			if (fields.length === 1) return `Vaša sprememba ostane: ${words}.`;
			if (fields.length === 2) return `Vaši spremembi ostaneta: ${words}.`;
			return `Vaše spremembe ostanejo: ${words}.`;
		},
		nothingNew: (place) => `Nič novega · ${place}`
	},
	notice: {
		yourCopy: 'Vaša kopija',
		behind: (who, pageMine, fields) =>
			`${who} · zaostaja za ${pageMine ? 'vašo kopijo' : 'to kopijo'}: ${fields}`,
		changed: (who, fields) => `${who} · spremenjeno: ${fields}`,
		both: (place, own, pageMine, fields) =>
			pageMine
				? `${place} · spremenjeno tudi v vaši kopiji: ${fields}`
				: `${own ? 'Vaša kopija' : place} · spremenjeno tudi v tej kopiji: ${fields}`,
		held: (who, how, fields) =>
			`${who} · ${how === 'added' ? 'dodano' : how === 'removed' ? 'odstranjeno' : 'spremenjeno'}: ${fields}`,
		// "Odstranjeno: posnetek": one piece needs no number.
		one: (noun) => noun
	},
	keep: {
		title: 'Samodejno usklajevanje',
		sub: 'Vaše spremembe gredo v skupine, njihove pridejo sem',
		readOnly: 'To spreminjajo le tisti, ki skupino urejajo.',
		failed: 'Tega ni bilo mogoče shraniti. Poskusite znova.',
		options: {
			names: { label: 'Imena' },
			small: { label: 'Manjše odstranitve', meta: 'Povezave, položaji, skladbe' },
			sections: { label: 'Odseki in točke', meta: 'Dodajanje ali odstranjevanje' },
			media: {
				label: 'Posnetki in videi',
				meta: 'Odstranitve iz vaše kopije ni mogoče razveljaviti'
			}
		},
		off: 'Brez samodejnega usklajevanja',
		on: 'Samodejno usklajevanje',
		onWith: (options) => `Samodejno usklajevanje · ${options}`
	},
	versions: {
		title: 'Kopije',
		count: 'Kopije:',
		yours: 'Vaša kopija',
		familyTitle: 'Kopije, ki jih vidite',
		thisOne: 'Ta kopija',
		yourVersion: 'Vaša kopija',
		placeVersion: (place) => `Kopija · ${place}`,
		also: (others) => `Tudi: ${others}`,
		twin: 'Označeno kot enako',
		// The chips speak of the copy (»kopija«): feminine.
		chip: { behind: 'Zaostaja', newer: 'Novejša', differs: 'Razlikuje se' },
		role: { owner: 'Vodja', editor: 'Lahko ureja', member: 'Lahko bere' },
		behind: (pageMine, what) => `zaostaja za ${pageMine ? 'vašo kopijo' : 'to kopijo'}${what}`,
		newer: (pageMine, what) => `novejša od ${pageMine ? 'vaše kopije' : 'te kopije'}${what}`,
		differs: 'razlikuje se v obe smeri',
		same: 'usklajena',
		selfChanged: (changed) => `Ta kopija · vaše spremembe: ${changed}`
	},
	copyHere: {
		title: (label, into) => `Kopirati ${label} v ${into}?`,
		lead: (from) =>
			`Pride kot klon ${from === null ? 'vašega' : `tistega iz skupine ${from}`}, zato ju lahko usklajujete. Nato se poveže sem.`,
		comes: 'Pride zraven',
		behind: 'Ostane',
		sections: (n) => `Odseki iz videov lekcij: ${n}`,
		sectionsOrPoints: (n) => `Odseki in točke iz videov lekcij: ${n}`,
		sameName: (into, label, from) =>
			`Skupina ${into} že ima svojega: ${label}. Ni kopija ${from === null ? 'vašega' : `tistega iz skupine ${from}`}.`,
		archived: 'Tu je že bil in je arhiviran. Obnovite ga in povežite.',
		copyAndLink: 'Kopiraj in poveži',
		restoreAndLink: 'Obnovi in poveži',
		linkGroups: 'Poveži skupinskega',
		copyAnyway: 'Vseeno kopiraj',
		done: 'Kopirano in povezano',
		failed: 'Kopiranje in povezovanje ni uspelo. Nič ni bilo kopirano.'
	},
	copy: {
		menu: 'Kopiraj v …',
		title: (name) => `Kam želite kopirati: ${name}?`,
		// »Izvirnik« (masculine) whatever the kind: »ta« would have to agree with it.
		sub: (gets, fromMine) => {
			const stays = fromMine ? 'Svojo obdržite.' : 'Izvirnik ostane, kakršen je.';
			if (gets === 'mine') return `Dobite svojo kopijo. ${stays}`;
			return `Skupina dobi ${gets === 'draft' ? 'osnutek' : 'kopijo'}. ${stays}`;
		},
		yourApp: 'Vaša aplikacija',
		placeMeta: (role, used, limit) => {
			const space = limit === null ? `zasedeno: ${used}` : `zasedeno: ${used} od ${limit}`;
			return role ? `${role} · ${space}` : capital(space);
		},
		whatGoes: 'KAJ SE KOPIRA',
		alreadyThere: 'ŽE TAM',
		audio: 'zvok',
		notes: 'opombe',
		charged: (size, team) => ` (${size}, ${team ? 'na račun skupine' : 'na vaš račun'})`,
		just: (kind) => `Samo ${KIND[kind]}`,
		// The group after a "·": nothing declines it.
		already: (label, place, when, yours) => {
			const reused = 'Uporabi se obstoječe, nič se ne podvoji.';
			if (place === null) return `${label}: to že imate (od ${when}). ${reused}`;
			return yours
				? `${label}: skupina ima vašo kopijo od ${when} · ${place}. ${reused}`
				: `${label}: skupina to že ima, od ${when} · ${place}. ${reused}`;
		},
		button: 'Kopiraj',
		buttonDraft: 'Kopiraj kot osnutek',
		existing: (place, archived) => {
			if (place === null)
				return archived
					? 'Imate arhivirano kopijo. Obnovite jo, nato uskladite.'
					: 'To že imate. Uskladite kopiji.';
			return archived
				? `Skupina ima arhivirano kopijo · ${place}. Obnovite jo, nato uskladite.`
				: `Skupina to že ima · ${place}. Uskladite kopiji.`;
		},
		restore: 'Obnovi',
		toast: (place, draft) =>
			place === null
				? 'Kopirano v vašo aplikacijo.'
				: `Kopirano${draft ? ' kot osnutek' : ''} v: ${place}.`,
		failed: 'Kopiranje ni uspelo. Poskusite znova.',
		open: 'Odpri'
	},
	cloneChip: 'Klon',
	twins: {
		// The chip says what the row is, however many there are.
		chip: 'Dvojček',
		whichTitle: (label) => `Kateri dvojček: ${label}?`,
		// The accusative of »dvojček«: vidite 2 dvojčka, 3 dvojčke, 5 dvojčkov.
		whichSub: (_kind, versions, place) =>
			`Vidite ${slCount(versions, ['dvojčka', 'dvojčka', 'dvojčke', 'dvojčkov'])}. Kateri naj gre v: ${place}?`,
		// Neuter, as »Vaše · v 2 skupinah«: it fits every kind.
		mine: 'Vaše',
		team: (team) => `Skupina: ${team}`,
		changed: (day) => `Nazadnje spremenjeno: ${day}`,
		oneGoes: 'V vaši aplikaciji so dvojčki. Gre samo eden; skupina nikoli ne dobi dvojčkov.',
		continue: 'Naprej',
		// A picker's twins are figures and routines: »figura«, »kombinacija«, feminine.
		named: (what, team) => (team === null ? `${what} (vaša)` : `${what} (skupina: ${team})`),
		useMeta: (theirs, mine) => {
			if (mine) return `Vaša · enaka kot: ${theirs.join(', ')} · uporablja se vaša`;
			const [used, ...rest] = theirs;
			return `Skupina: ${used} · enaka kot: ${rest.join(', ')} · uporablja se ta`;
		},
		sameAs: 'Enako kot …',
		sameAsTitle: (label) => `${label} · enako kot\u00a0…`,
		note: (kind) =>
			`Dvojčki so prikazani kot ${ONE[kind]}. Nikoli se ne usklajujejo in to združitev vidite samo vi.`,
		markSame: 'Označi kot enako',
		separate: 'Ni enako? Loči',
		search: (kind) => `Iščite med svojimi ${AMONG[kind]}`,
		empty: (kind) => NONE_OTHER[kind],
		failed: 'Tega ni bilo mogoče shraniti. Poskusite znova.'
	},
	move: {
		menu: 'Premakni v …',
		title: (lesson, place) => `Premakni lekcijo: ${lesson} → ${place}`,
		sub: 'Lekcija bo v skupini in ne več med vašimi lekcijami. Kaj prinese s sabo:',
		// What the lesson brings is a figure, a routine or a drill: all feminine.
		keepMine: 'Obdrži tudi svojo',
		useGroups: 'Uporabi skupinsko',
		note: '»Uporabi skupinsko«: vaša kopija se opusti, vaše druge lekcije in kombinacije pa uporabijo skupinsko.',
		practiceStays: 'Vadenje tega, kar opustite, ostane pri vaši arhivirani kopiji.',
		button: 'Premakni kot osnutek',
		onlyThisLesson: 'Samo v tej lekciji',
		youPractise: 'To vadite',
		usedByLessons: (n) =>
			`${uses(n)} še ${slCount(n, ['lekcija', 'lekciji', 'lekcije', 'lekcij'])}`,
		usedByRoutine: (routine) => `V kombinaciji: ${routine}`,
		usedByRoutines: (n) =>
			`${uses(n)} ${slCount(n, ['kombinacija', 'kombinaciji', 'kombinacije', 'kombinacij'])}`,
		toast: (place) => `Premaknjeno kot osnutek v: ${place}.`,
		failed: 'Premik ni uspel. Poskusite znova.',
		gone: 'Kar lekcija prinese, se je spremenilo. Naložite znova in izberite še enkrat.'
	},
	menuLabel: (kind) => `Meni ${OF_KIND[kind]}`,
	groupRows: (team) => `Skupina: ${team}`
};
