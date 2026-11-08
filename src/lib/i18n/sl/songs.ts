import type { Catalog } from '../catalog';
import { slCount } from '../plural';

export const songs: Catalog['songs'] = {
	pick: {
		styleForAll: 'Slog za vse',
		selectAll: 'Izberi vse',
		picked: (n, m) => `izbranih ${n} od ${m}`,
		already: 'Že dodana',
		onSource: (where, name) => `Na ${where === 'Spotify' ? 'Spotifyju' : 'YouTubu'}: ${name}`,
		add: (n) => `Dodaj ${slCount(n, ['skladbo', 'skladbi', 'skladbe', 'skladb'])}`,
		dismiss: 'Opusti',
		dismissTitle: 'Opustim ta seznam?',
		dismissBody: 'Z njega se ne prenese nič.',
		cancel: 'Prekliči',
		edit: (title) => `Uredi: ${title}`,
		done: 'Končano',
		open: (where) => `Odpri na ${where === 'Spotify' ? 'Spotifyju' : 'YouTubu'}`,
		titleField: 'Naslov',
		artistField: 'Izvajalec',
		styleOfSong: 'Slog',
		unsaved: 'Izbira s seznama',
		firstN: (n) => `Prebranih je le prvih ${n} skladb seznama.`,
		refused: 'Izberite vsaj eno skladbo.',
		badPicks: 'Pri izbiri je šlo nekaj narobe. Znova naložite stran in poskusite še enkrat.'
	},
	imports: {
		toPick: 'Za izbiro',
		reading: 'Branje seznama …',
		readingMeta: (where) => `${where} · domači računalnik ga prebere v minuti ali dveh`,
		pickSongs: 'Izberite skladbe',
		cancel: 'Prekliči',
		retry: 'Poskusi znova',
		dismiss: 'Opusti',
		failed: (error) => (error ? `Ni uspelo: ${error}` : 'Ni uspelo'),
		kinds: {
			'spotify-playlist': 'Seznam na Spotifyju',
			'spotify-album': 'Album na Spotifyju',
			'youtube-playlist': 'Seznam na YouTubu'
		},
		songs: (n) => slCount(n, ['skladba', 'skladbi', 'skladbe', 'skladb']),
		firstN: (n) => `prvih ${n}`,
		actionOf: (action, name) => `${action}: ${name}`,
		retryRefused: 'Znova je mogoče prebrati le seznam, ki ni uspel.',
		gone: 'Ta seznam je bil že dodan ali opuščen.'
	},
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
		readList: 'Preberi seznam',
		label: 'Povezava YouTube ali Spotify',
		help: 'Skladba, seznam predvajanja ali album. S seznama izberete, katere skladbe dodate.',
		notSong: 'Prilepite skladbo, seznam predvajanja ali album',
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
