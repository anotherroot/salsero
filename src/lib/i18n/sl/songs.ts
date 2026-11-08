import type { Catalog } from '../catalog';
import { slCount, slForm } from '../plural';
import { nouns } from './nouns';

export const songs: Catalog['songs'] = {
	picker: {
		title: 'Izberite skladbo',
		search: 'Iskanje skladb',
		hint: 'poslušajte 15 s · za izbiro pritisnite skladbo',
		count: (n, searching) =>
			searching
				? slCount(n, ['zadetek', 'zadetka', 'zadetki', 'zadetkov'])
				: slCount(n, ['skladba', 'skladbi', 'skladbe', 'skladb']),
		noMatch: (query) => `Nobena skladba se ne ujema z »${query}«`,
		noMatchBody: 'Ko bo dodana in pripravljena, se pokaže tukaj.',
		addInMusic: 'Dodajte jo v Glasbi',
		recent: 'Nedavne',
		yours: 'Vaše skladbe',
		all: 'Vse skladbe A–Ž'
	},
	// Skladba is feminine: Nova.
	row: { draft: 'Osnutek', isNew: 'Nova' },
	sample: {
		from: (clock) => `Odlomek od ${clock}`,
		play: 'Predvajaj odlomek',
		playOf: (name) => `Predvajaj odlomek: ${name}`,
		stop: 'Ustavi odlomek'
	},
	music: {
		heading: 'Glasba',
		add: 'Dodaj skladbo',
		noteLabel: 'Opomba',
		notePlaceholder: 'Kaj vaditi ob njej',
		noteHelp: 'Vsi v skupini jo vidijo pod skladbo.',
		addButton: 'Dodaj v Glasbo',
		save: 'Shrani',
		practise: 'Vadi ob tej skladbi',
		edit: 'Uredi opombo',
		remove: 'Odstrani',
		notShared: 'Ni deljena',
		notSharedLine: 'Ni deljena: drugi v skupini je ne vidijo, dokler je spet ne delite.',
		pick: 'Izberite skladbo',
		optional: '(neobvezno)',
		unsavedLabel: 'Opomba',
		saveFailed: 'Shranjevanje ni uspelo.'
	},
	list: {
		untitled: 'Skladba brez naslova',
		searchHeading: (n) =>
			`${slCount(n, ['zadetek', 'zadetka', 'zadetki', 'zadetkov'])} · naslov ali izvajalec`,
		beingAdded: (n) => `Dodajanje · ${n}`,
		allAZ: (n) => `Vse skladbe A–Ž · ${n}`,
		drafts: (n) => `Osnutki · ${n}`,
		sharedWithClass: (n) => `Deljeno s tečajem · ${n}`,
		// After a colon: no verb to agree with the count.
		usedBy: (n) => `v uporabi: ${n}`,
		waitingDownload: 'Čaka na prenos',
		findingBeat: 'Iskanje ritma',
		failed: 'Ni uspelo',
		failedWith: (error) => `Ni uspelo: ${error}`,
		countOnly: 'Samo štetje',
		countOnlyClave: 'Štetje in clave, brez skladbe',
		countOnlyPlain: 'Štetje, brez skladbe',
		practice: 'Vadenje',
		retry: 'Poskusi znova',
		retryOf: (name) => `Poskusi znova: ${name}`,
		retryFailed: 'Ponovni poskus ni uspel.',
		workerTitle: 'Teče na prenosniku doma',
		workerBody: 'Prenosi in iskanje ritma potekajo približno enkrat na minuto, ko je prižgan.',
		noMatchBody: 'Dodajte jo s + zgoraj.',
		emptyClassTitle: 'Skladb tečaja še ni',
		emptyClassBody:
			'Dodajte jo z YouTuba ali naložite zvočno datoteko. Dokler je ne delite s tečajem, ostane osnutek, ki ga vidijo le tisti, ki lahko urejajo skupino.',
		emptyTitle: 'Skladb še ni',
		emptyBody:
			'Dodajte jo z YouTuba ali naložite zvočno datoteko. Prenosnik doma jo prenese in poišče ritem.',
		paneBody: 'Njeno štetje, enke, ki ste jih označili, in odlomek se odprejo tukaj, ob seznamu.',
		paneCountOnly: 'Vadi samo s štetjem'
	},
	add: {
		youtubeLink: 'Povezava do YouTuba',
		title: 'Naslov',
		titlePlaceholder: 'Naslov skladbe',
		style: 'Slog',
		submit: 'Dodaj skladbo',
		adding: 'Dodajanje skladbe',
		or: 'ali',
		uploadFile: 'Naloži zvočno datoteko',
		oneAtATime: 'Naenkrat se nalaga le ena datoteka. Počakajte, da se naloži ta, ki se že nalaga.',
		upTo: (limit) => `Največ ${limit}. Dobi slog, izbran zgoraj.`,
		tooLarge: (mb, limit) => `Datoteka ima ${mb} MB; največ je ${limit}.`,
		audioOnly: 'Dodate lahko le zvočne datoteke.',
		progress: (loaded, total) => `Nalaganje · ${loaded} od ${total} MB · pustite aplikacijo odprto`,
		percent: (n) => `${n}\u00a0%`,
		failed: (reason) => `Nalaganje ni uspelo: ${reason}`,
		badUrl: 'Prilepite celotno povezavo, ki se začne s https://',
		longTitle: 'Naslov naj ima največ 200 znakov.',
		onlyFailed: 'Znova lahko poskusite le pri skladbi, ki ni uspela.'
	},
	share: {
		// The group's name after a colon, never declined.
		classSongNote: (group) => `Skladba tečaja: ${group}. Štetje nastavi vodja tečaja.`,
		// The verb agrees with the count: uporablja, uporabljata, uporabljajo, uporablja.
		usedIn: (n) => {
			const verb = { one: 'uporablja', two: 'uporabljata', few: 'uporabljajo', other: 'uporablja' }[
				slForm(n)
			];
			return `Pri vadenju jo ${verb} ${nouns.people(n)}.`;
		},
		untilShared: 'Dokler je spet ne delite, bo namesto nje le štetje.',
		untilRestored: 'Dokler je ne obnovite, bo namesto nje le štetje.',
		stopTitle: (name) => `Želite prenehati deliti »${name}«?`,
		deleteTitle: (name) => `Želite izbrisati »${name}«?`,
		stopLead: 'Člani je ne bodo več videli in spet bo osnutek.',
		deleteLead: 'Za 30 dni gre v »Nedavno izbrisano«.'
	}
};
