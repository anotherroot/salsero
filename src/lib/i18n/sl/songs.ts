import type { Catalog } from '../catalog';
import { slCount } from '../plural';

export const songs: Catalog['songs'] = {
	source: {
		from: 'Iz',
		fromSpotify: 'S Spotifyja',
		findOnYouTube: 'Poišči na YouTubu',
		fromVideo: 'Iz videa, ki ga najde',
		findingIt: 'Iskanje na YouTubu',
		youtubeAudio: 'YouTube · zvok',
		audioFrom: 'Zvok iz',
		useAnother: 'Uporabi drugo povezavo YouTube',
		useLink: 'Uporabi povezavo YouTube',
		anotherLabel: 'Druga povezava YouTube',
		swapHelp:
			'Skladba se znova prenese in njen utrip se znova poišče. Enice, ki ste jih označili, se izbrišejo.',
		downloadThis: 'Prenesi to',
		cancel: 'Prekliči',
		askTitle: 'Znova prenesem zvok?',
		askCopies: (n) =>
			`Ta skladba dobi zvok z nove povezave, prav tako ${slCount(n, ['kopija', 'kopiji', 'kopije', 'kopij'])}, ki ${n === 1 ? 'je usklajena' : n === 2 ? 'sta usklajeni' : 'so usklajene'} z njo.`,
		askSelf: 'Ta skladba dobi zvok z nove povezave.',
		askBody:
			'Utrip se znova poišče, enice za štetje pa se izbrišejo, zato jih bo treba znova označiti.',
		download: 'Prenesi'
	},
	add: {
		label: 'Povezava YouTube ali Spotify',
		helpOne: 'Ena skladba z YouTuba ali Spotifyja.',
		help: 'Skladba, seznam predvajanja ali album. S seznama izberete, katere skladbe dodate.',
		notSong: 'Prilepite skladbo, seznam predvajanja ali album',
		listsSoon:
			'Seznami predvajanja pridejo v naslednji posodobitvi. Zdaj prilepite povezavo do ene skladbe.',
		shortFailed: 'Prilepite celotno povezavo open.spotify.com'
	},
	audio: {
		notYouTube: 'Prilepite povezavo do videa na YouTubu',
		busy: 'Počakajte, da se skladba prenese do konca.',
		upload: 'Naložena skladba nima povezave, ki bi jo lahko zamenjali.'
	},
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
	}
};
