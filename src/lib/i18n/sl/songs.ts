import type { Catalog } from '../catalog';
import { slCount } from '../plural';

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
	// A song's section is a del (a video's stays odsek). Chips the person picks are stored as shown.
	page: {
		section: {
			unnamed: 'Del',
			chips: () => ['Uvod', 'Kitica', 'Coro', 'Montuno', 'Mambo', 'Break', 'Zaključek']
		},
		// čez + accusative: 1 osmico, 2 osmici, 3 osmice, 5 osmic; 1 dobo, 2 dobi, 3 dobe, 5 dob.
		ahead: {
			eights: (name, n) => `${name} čez ${slCount(n, ['osmico', 'osmici', 'osmice', 'osmic'])}`,
			last: (name) => `${name} po tej osmici`,
			beats: (name, n) => `${name} čez ${slCount(n, ['dobo', 'dobi', 'dobe', 'dob'])}`
		}
	}
};
