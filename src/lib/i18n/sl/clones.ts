// Copies: Make it mine, the sources, Sync, Samodejno usklajevanje (Keep in step),
// Drop and Detach. A place (a group, "Sreda 17:30") is a name: it stands before
// a "·" or after a colon, never inside a phrase that would decline it, and no
// past tense agrees with it ("Sreda 17:30 · spremenjeno: opombe"). The person's
// own copy is »vaša kopija«; Sync is »Uskladi«.
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
	figure: 'različica',
	routine: 'kombinacija',
	drill: 'vaja',
	song: 'skladba',
	lesson: 'lekcija',
	position: 'položaj'
};
const capital = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

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
		title: (label) => `Želite svojo kopijo: ${label}?`,
		sub: 'Ko urejate, nastane vaša kopija. Tista iz tečaja ostane nespremenjena.',
		restore: 'Svojo kopijo ste že imeli. Jo želite obnoviti?',
		archivedSong:
			'Vaša kopija te skladbe je arhivirana. Da bo spet vaša, jo izbrišite v Nastavitve → Kaj zaseda prostor.',
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
		size: (size) => `Zasede ${size} vašega prostora`,
		// A list after the colon, each in the nominative: nothing agrees with it.
		switchNote: (r) => {
			const parts: string[] = [];
			if (r.figures.length === 1) parts.push(`različica ${r.figures[0]} (s tem položajem)`);
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
		twins: (n) => `${slForm(n) === 'two' ? 'Dvojčka' : 'Dvojčki'} · ${nouns.figures(n)}`,
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
		slots: 'Mesta',
		note: 'Opomba',
		sectionLinks: 'Povezave odseka'
	},
	refusal: {
		stale: 'Medtem se je spremenilo; preverite znova.',
		pickBoth: 'Kjer sta se spremenili obe, izberite svojo ali njihovo.',
		nameTaken: (name, move) =>
			`Različica s tem imenom že obstaja: ${move} · ${name}. Najprej eno preimenujte.`,
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
		useInstead: 'Namesto nje uporabi',
		copiedHere: 'Od tod ste jo kopirali',
		draft: 'Še ni objavljena: vaše vadenje ostane pri vaši kopiji.',
		cantFollow: 'Ni v lekciji, ki ste jo dodali: vadenje ne more slediti',
		addToo: (lesson) => `Dodaj tudi lekcijo: ${lesson}`,
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
		noMore: 'Nič več obvestil o razlikah in nobenega usklajevanja, ki bi ga sprožili pomotoma.',
		group: (kind) =>
			`V skupini »Odklopi« le prekine povezavo s kopijami: ostane ${KIND[kind]} skupine.`,
		failed: 'Odklop ni uspel. Poskusite znova.',
		busy: 'Odklapljanje'
	},
	sync: {
		yours: 'Vaša',
		noticeTitle: 'Vaše kopije se razlikujejo',
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
		removeChoice: (places) => `Odstrani iz: ${places}`,
		addBox: (places) => `Dodaj tudi v: ${places}`,
		removeBox: (places) => `Odstrani tudi iz: ${places}`,
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
	}
};
