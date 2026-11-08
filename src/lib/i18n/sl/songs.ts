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
		}
	}
};
