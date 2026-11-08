import type { Catalog } from '../catalog';
import { slCount } from '../plural';

// A group's or a person's name is never declined: it stands after a colon or in
// »…« (a user's label, as the video player's delete asks). The roles are said
// without a gendered noun: "vodja" (as in "vodja tečaja") is both, and an editor
// and a member are what they do.
export const groups: Catalog['groups'] = {
	tabNew: 'Skupine, novo v vaših skupinah',
	newPill: (n) => slCount(n, ['nov', 'nova', 'novi', 'novih']),
	role: { owner: 'Vodja', editor: 'Ureja', member: 'Sodeluje' },
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
			figure: 'Različica',
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
		handOverFirst: 'Preden skupino zapustite, jo predajte drugemu.'
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
		removeBody: 'Oseba zapusti skupino in obdrži kopije svojih stvari.'
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
	}
};
