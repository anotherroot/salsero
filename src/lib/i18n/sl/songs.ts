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
		saveFailed: 'Shranjevanje ni uspelo.',
		noteTooLong: 'Opomba ima lahko največ 500 znakov.',
		pickSong: 'Izberite skladbo.',
		gone: 'Ta skladba je bila že odstranjena.',
		notYours: 'Tega ne morete spreminjati.',
		cannotGo: 'Te skladbe ni mogoče dodati sem.',
		already: 'Že v Glasbi'
	},
	page: {
		section: {
			unnamed: 'Del',
			added: 'Del dodan',
			title: 'Del',
			saving: 'shranjuje sproti',
			name: 'Ime',
			other: 'Drugo …',
			otherLabel: 'Vaše ime',
			starts: 'Začetek',
			onOne: (at) => `${at} · na 1`,
			earlier: 'Osmico prej',
			later: 'Osmico pozneje',
			count: 'Štetje',
			on: 'Vklopljeno',
			off: 'Izklopljeno',
			offHelp: 'Izklopljeno: v tem delu ni štetja. Za premore in prehode.',
			remove: 'Odstrani del',
			removed: (name) => `Odstranjeno: ${name}`,
			saved: 'Shranjeno',
			unsavedLabel: 'Ime dela',
			chips: () => ['Uvod', 'Kitica', 'Coro', 'Montuno', 'Mambo', 'Break', 'Zaključek']
		},
		// čez + accusative: 1 osmico, 2 osmici, 3 osmice, 5 osmic; 1 dobo, 2 dobi, 3 dobe, 5 dob.
		ahead: {
			eights: (name, n) => `${name} čez ${slCount(n, ['osmico', 'osmici', 'osmice', 'osmic'])}`,
			last: (name) => `${name} po tej osmici`,
			beats: (name, n) => `${name} čez ${slCount(n, ['dobo', 'dobi', 'dobe', 'dob'])}`
		},
		listen: {
			starts: (at) => `Začne se pri ${at}, kjer se začne glasba.`,
			hint: 'Kje je 1, je le ugibanje po ritmu. Nastavite ga in dodajte dele v urejanju ✎.',
			sections: 'Deli',
			tapToJump: 'pritisnite za skok',
			countOff: 'Brez štetja',
			playing: 'Zdaj',
			next: 'Naslednji',
			sample: 'Odlomek',
			sampleFrom: (at) => `Od ${at}`,
			sampleMeta: '15 sekund',
			jumpTo: (name, at) => `Skok na ${name}, ${at}`,
			play: 'Predvajaj skladbo',
			pause: 'Ustavi skladbo',
			position: 'Mesto v skladbi'
		},
		edit: {
			open: 'Uredi skladbo',
			subtitle: 'Urejanje · shranjuje sproti',
			leave: 'Zapri urejanje',
			tabs: 'Urejanje',
			grid: 'Mreža',
			song: 'Skladba',
			speed: {
				title: 'Hitrost štetja',
				help: 'Če štetje teče za pol ali dvakrat hitreje od vaših korakov, ga preklopite.',
				askTitle: 'Spremenim hitrost štetja?',
				ask: (n, factor) =>
					`Štetje ${factor} izbriše ${n === 1 ? 'vašo 1' : `vaše 1 (${n})`}. Deli ostanejo, vsak na najbližji 1.`,
				change: 'Spremeni',
				done: (factor) => `Štetje ${factor}`
			},
			sample: {
				title: 'Odlomek',
				from: (at) => `Od ${at}`,
				automatic: 'Samodejno',
				yours: 'Vaš',
				autoMeta: 'Tretjina skladbe, na 1',
				yoursMeta: 'Nastavili ste ga vi',
				here: 'Odlomek začni tukaj',
				hereMeta: (at) => `Pri ${at}, na 1 pred trenutnim mestom`,
				back: 'Nazaj na samodejno',
				doneHere: (at) => `Odlomek se začne blizu ${at}`,
				doneBack: 'Odlomek je spet samodejen'
			},
			start: {
				title: 'Začetek glasbe',
				at: (at) => `Pri ${at}`,
				found: 'Našel domači računalnik',
				yours: 'Vaš',
				unmeasured: 'Še ni izmerjeno',
				fromZero: 'Predvaja se od 0:00',
				here: 'Začni tukaj',
				hereMeta: (at) => `Pri ${at}, na trenutnem mestu`,
				zero: 'Od 0:00',
				zeroMeta: 'Predvajaj celo datoteko',
				back: 'Nazaj na najdeni začetek',
				doneHere: (at) => `Skladba se začne pri ${at}`,
				doneZero: 'Skladba se predvaja od 0:00',
				doneBack: 'Spet tam, kjer se začne glasba'
			},
			details: 'Podatki o skladbi',
			detailsMeta: 'Naslov, izvajalec in slog',
			clear: {
				ones: 'Izbriši vse 1',
				onesMeta: (n) => `Nastavljenih: ${n}`,
				sections: 'Izbriši vse dele',
				sectionsMeta: (n) => slCount(n, ['del', 'dela', 'deli', 'delov']),
				doneOnes: 'Vse 1 izbrisane',
				doneSections: 'Vsi deli izbrisani'
			}
		},
		grid: {
			label: 'Štetje skladbe, vrstica na osmico',
			beat: (at, n, section) =>
				section ? `${at}, doba ${n} v delu ${section}` : `${at}, doba ${n}`,
			off: (at, section) => `${at}: ${section}`,
			yours: 'vaša 1',
			short: (n) => `+${slCount(n, ['doba', 'dobi', 'dobe', 'dob'])}`,
			countOff: 'Brez štetja',
			editSection: (name) => `Uredi del: ${name}`,
			before: (from, to, eights) =>
				`Pred glasbo · ${from}–${to} · ${slCount(eights, ['osmica', 'osmici', 'osmice', 'osmic'])}`,
			musicStarts: (at) => `Glasba se začne · ${at}`,
			moveStart: 'Premakni začetek glasbe',
			hint: 'Predvajajte in pritisnite na vsako 1. Pritisnite dobo za skok tja, pridržite za več.'
		},
		tap: {
			button: 'Pritisnite na 1',
			got: 'Zabeleženo',
			playFirst: 'Najprej predvajajte skladbo.',
			playFirstBody: 'Pritisk označi dobo, ki se predvaja.',
			toast: (at, shift) =>
				shift === 0
					? `1 pri ${at}. Štetje se od tu ni spremenilo.`
					: `1 pri ${at}. Štetje se je od tu premaknilo za ${slCount(shift, ['dobo', 'dobi', 'dobe', 'dob'])}.`,
			before: 'Prej'
		},
		menu: {
			beat: (n, section) => (section ? `doba ${n} v delu ${section}` : `doba ${n}`),
			one: 'Naj bo to 1',
			section: 'Tu začni del',
			remove: 'Odstrani to 1',
			start: 'Tu začni skladbo',
			removed: (at) => `1 pri ${at} je odstranjena`,
			close: 'Zapri meni'
		},
		suggest: {
			line: (at, n, later) =>
				`Ritem kaže, da je 1 tukaj od ${at}, ${slCount(n, ['dobo', 'dobi', 'dobe', 'dob'])} ${later ? 'pozneje' : 'prej'}. Ne loči 1 od 5.`,
			use: 'Uporabi',
			notNow: 'Ne zdaj'
		},
		plusSection: 'Del',
		plusSectionLabel: 'Začni del pri tej osmici',
		refused: {
			taken: 'Tam se že začne drug del',
			ends: 'To je čez konec skladbe',
			missing: 'Tega dela ni več. Znova naložite stran.',
			badValue: 'Shranjevanje ni uspelo.',
			start: 'Izberite čas znotraj skladbe.',
			beat: 'Te dobe ni v skladbi.'
		},
		untitled: 'Skladba',
		details: 'Podatki o skladbi',
		editSong: 'Uredi skladbo',
		history: 'Zgodovina',
		stopSharing: 'Prenehaj deliti',
		practise: 'Vadi ob tej skladbi',
		audioMissing: 'Zvočna datoteka skladbe manjka.',
		audioUnplayable: 'Ta brskalnik ne more predvajati zvoka skladbe.',
		wouldNotPlay: 'Skladbe ni bilo mogoče predvajati.',
		playFirst: 'Najprej predvajajte skladbo.',
		// Odlomek is masculine: Vaš, Samodejni.
		sampleYours: 'Vaš',
		sampleSetByYou: 'Nastavili ste ga sami',
		sampleAutomatic: 'Samodejni',
		sampleAutomaticMeta: 'Po tretjini skladbe, na enki',
		progress: 'Napredek',
		laptopNote:
			'Teče na prenosniku približno enkrat na minuto, ko je prižgan. Stran se posodablja sama.',
		failedTitle: 'Skladba ni uspela',
		unknownError: 'Neznana napaka',
		uploadInstead: 'Raje naloži datoteko',
		from: (url) => `Vir: ${url}`,
		editorsOnly: 'Vidijo jo le tisti, ki lahko urejajo skupino',
		shareWithClass: 'Deli s tečajem',
		archiveTitle: 'Želite arhivirati to skladbo?',
		// The song's name after a colon, never declined.
		archiveBody: (name) =>
			`Skladba ne bo več v Glasbi in med skladbami za izbiro: ${name}. Vaša zgodovina z njo ostane.`,
		archive: 'Arhiviraj',
		archiveSong: 'Arhiviraj skladbo',
		saving: 'Shranjevanje',
		artist: 'Izvajalec',
		// Skladba is feminine: Dodana, Naložena, Prenesena.
		steps: {
			added: 'Dodana',
			uploaded: 'Naložena',
			fromYouTube: 'Z YouTuba',
			download: 'Prenos',
			waitingFetcher: 'Čaka na prenos doma',
			findBeat: 'Iskanje ritma',
			onLaptop: 'Analiza ritma na prenosniku',
			downloaded: 'Prenesena',
			waitingAnalysis: 'Čaka na analizo ritma'
		},
		noBeats: 'V skladbi ni dob, na katere bi se pritisk poravnal.',
		badTempo: 'Neveljavna hitrost štetja.',
		noTitle: 'Vnesite naslov skladbe (največ 200 znakov).',
		longArtist: 'Izvajalec naj ima največ 200 znakov.',
		pickStyle: 'Izberite slog.',
		onlyReady: 'Deliti je mogoče le pripravljeno skladbo.'
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
		tooLarge: (mb, limit) => `Datoteka meri ${mb} MB, dovoljeno pa je največ ${limit}.`,
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
