// Stran kombinacije in urejevalnik: dejstva in značke, vrstice mesta, šivi,
// izbira in Naredi kombinacijo, besede izbirnika mest (tudi vrstica s kontekstom),
// urejanje, podvajanje, arhiviranje in zavrnitve strani.
// Names people gave (a position, a routine, a figure) go after a colon or a "·",
// or in »…« in a question, never declined. "Loops" is »se sklene«, as in `moves`.
import type { Catalog } from '../catalog';
import { slForm } from '../plural';
import { nouns } from './nouns';

export const routine: Catalog['routine'] = {
	length: {
		chip: (n) => nouns.counts(n),
		change: (n) => `Dolžina ${nouns.counts(n)}. Spremenite jo`,
		title: 'Kako dolgo?',
		from: (figure, start) => `${figure}, od ${start}`,
		unit: (n) => ({ one: 'doba', two: 'dobi', few: 'dobe', other: 'dob' })[slForm(n)],
		other: 'Drugo',
		otherLabel: 'Koliko dob',
		done: 'Končano',
		why: (next) =>
			`Alternative nadaljujejo na ${next}, zato ustrezajo le dolžine, ki pristanejo tam.`
	},
	end: {
		title: 'Kje konča?',
		sub: (figure, n) => `${figure} · mesto ${n}`,
		ask: 'Konča?',
		clear: 'Ne izberem — katerikoli konec',
		altNot: (name) => `Alternativa ${name} ne konča tu`,
		belowNot: (n) => `Mesto ${n} ne začne tu`,
		change: (name) => `Konča v: ${name}. Spremenite`,
		choose: 'Izberite, kje konča'
	},
	facts: {
		from: 'Začetek:',
		to: 'konec:',
		endsAt: 'Konec:'
	},
	loops: 'Se sklene',
	noLoop: 'Se ne sklene',
	endsDiffer: 'različni konci',
	seam: {
		hands: (ends, next) => `konec: ${ends}, začetek naslednjega: ${next}`,
		count: (ready, next) => `pripravljeno na ${ready}, naslednje začne na ${next}`,
		label: (above, below) => `Mesti ${above} in ${below} se ne povežeta`,
		after: (n) => `Za ${n}`,
		before: (n) => `Pred ${n}`,
		addAfter: (n) => `Dodaj mesto za mestom ${n}`,
		addBefore: (n) => `Dodaj mesto pred mestom ${n}`,
		bridge: 'Premosti',
		bridgeLabel: (above, below) => `Premosti mesti ${above} in ${below}`
	},
	selection: {
		title: 'Izberite mesta',
		item: 'Izberi mesta',
		itemMeta: 'Za podvajanje, brisanje ali novo kombinacijo iz več mest',
		bar: 'Izbrana mesta',
		above: 'Dodaj zgoraj',
		below: 'Dodaj spodaj',
		duplicate: 'Podvoji',
		run: (from, to) => `${to - from === 1 ? 'Mesti' : 'Mesta'} ${from}–${to}`,
		tip: 'Tapnite še druga mesta, da jih dodate.',
		make: 'Sklop',
		blocked: {
			embedded: (names) =>
				`Ta kombinacija je že vstavljena drugam: ${names}. Vstavljanje gre le eno raven globoko.`,
			none: 'Izberite mesta, iz katerih naj nastane sklop.',
			slotIsRoutine: (n) => `Mesto ${n} je kombinacija — vstavljanje gre le eno raven globoko.`,
			apart: 'Izberite sosednja mesta.',
			first: 'Najprej izberite mesta.'
		}
	},
	make: {
		action: 'Naredi kombinacijo',
		title: 'Naredi kombinacijo',
		making: 'Ustvarjanje kombinacije',
		label: 'Ime nove kombinacije',
		placeholder: 'Uvodni shine',
		// The verb and the pronoun agree with the count: 1 (101) mesto, 2 mesti, 3 mesta, 5 mest.
		caption: (n) => {
			const tail = 'v novo kombinacijo, ta pa';
			const end = 'tukaj nadomesti kot eno mesto.';
			switch (slForm(n)) {
				case 'one':
					return n === 1
						? `Mesto se premakne ${tail} ga ${end}`
						: `${n} mesto se premakne ${tail} ga ${end}`;
				case 'two':
					return `${n} mesti se premakneta ${tail} ju ${end}`;
				case 'few':
					return `${n} mesta se premaknejo ${tail} jih ${end}`;
				default:
					return `${n} mest se premakne ${tail} jih ${end}`;
			}
		}
	},
	section: {
		unnamed: 'Sklop',
		open: (name) => `Odpri ${name || 'sklop'} tukaj`,
		close: (name) => `Zapri ${name || 'sklop'}`,
		deeper: (level) => `Raven ${level}: odpre se na svoji strani`,
		inside: (name, n) =>
			n > 1 ? `V sklopu ${name} · spremembe se pokažejo v ${n} kombinacijah` : `V sklopu ${name}`,
		more: (n) => `še ${n} više`,
		level: (n) => `raven ${n}`,
		where: 'Kje ste',
		sectioned: (n) => `Sklop iz ${nouns.slots(n)}`,
		unpacked: (name) => `Razpakirano: ${name || 'sklop'}`,
		copied: (n, after) => `Kopirano za mestom ${after}: ${nouns.slots(n)}`
	},
	slot: {
		openCell: 'Odpri',
		unpack: 'Razpakiraj',
		aFigure: 'figura',
		aRoutine: 'kombinacija',
		archived: (name) => `${name} (arhivirana)`,
		empty: 'Prazno — tu ni česa napovedati',
		move: (n) => `Premik mesta ${n}. Premaknete ga s puščičnima tipkama.`,
		delete: (n) => `Izbriši mesto ${n}`,
		notePlaceholder: 'Dodajte opombo\u00a0…',
		noteLabel: (n) => `Opomba za mesto ${n}`,
		noteUnsaved: 'Opomba mesta',
		noteFailed: 'Opomba ni bila shranjena.',
		alternatives: (n) => `Alternative za mesto ${n}`,
		toolbar: (n) => `Mesto ${n}`,
		alternative: 'Alternativa',
		open: (label) => `Odpri: ${label}`,
		remove: (label) => `Odstrani: ${label}`,
		deleted: (n) => `Mesto ${n} je izbrisano`,
		manyDeleted: (n) => `Izbrisano: ${nouns.slots(n)}`,
		removed: (label) => `Odstranjeno: ${label}`
	},
	slots: {
		title: (n) => `Mesta · ${n}`,
		none: 'Še ni mest.',
		emptyTitle: 'Še ni mest',
		emptyBody: 'Prvo mesto je začetek kombinacije. Dodajte figuro in gradite naprej od nje.',
		addFigure: 'Dodaj figuro',
		addSlot: 'Dodaj mesto',
		addSlotAfter: (n) => `Dodaj mesto za mestom ${n}`
	},
	picker: {
		between: (a, b) => `Dodaj med mesti ${a} in ${b}`,
		after: (n) => `Dodaj za mestom ${n}`,
		before: (n) => `Dodaj pred mestom ${n}`,
		alternative: (label) => `Alternativa · ${label}`,
		search: 'Iskanje figur in kombinacij',
		filters: 'Filtri',
		count: 'Štetje',
		hold: 'Drža',
		holdOff: 'Izklopi držo',
		countOff: 'Izklopi štetje',
		toSeeRest: ', da vidite ostale.',
		noAlternative: 'Nobena druga figura se ne začne in konča tako kot ta.',
		noMatch: (q) => `Nič ne ustreza »${q}«.`,
		// The context line after a colon, as it reads on its own: "Nič, kar poznate, ne ustreza:
		// začne na 1 · konča na 8." (a "ne" before the first verb would not reach the second).
		nothingFits: (context) =>
			`Nič, kar poznate, ne ustreza: ${context[0].toLowerCase()}${context.slice(1)}.`,
		noFigures: 'V tem plesu še ni figur.',
		startsOnFrom: (n, from) => `Začne na ${n}, v položaju: ${from}`,
		startsOn: (n) => `Začne na ${n}`,
		startsFrom: (from) => `Začne v položaju: ${from}`,
		endsOnAt: (counts, at) => `Konča na ${counts}, v položaju: ${at}`,
		endsOn: (counts) => `Konča na ${counts}`,
		endsAt: (at) => `Konča v položaju: ${at}`,
		anywhereFrom: 'Kjerkoli',
		anywhereTo: 'kjerkoli'
	},
	band: {
		edit: 'Uredi kombinacijo',
		editTitle: 'Urejanje kombinacije',
		practiseMeta: 'Samo štetje ali s skladbo'
	},
	edit: {
		label: 'Spremembe kombinacije',
		nameHelp: 'Do 200 znakov',
		optional: '(neobvezno)',
		more: 'Več',
		duplicate: 'Podvoji kombinacijo',
		duplicateMeta: 'Naredi kopijo in jo odpre',
		archive: 'Arhiviraj kombinacijo',
		archiveMeta: 'Njena mesta in zgodovina vadenja se ohranijo'
	},
	archive: {
		title: (name) => `Želite arhivirati »${name}«?`,
		body: 'Odstrani se s seznama kombinacij. Njena mesta in zgodovina vadenja se ohranijo.',
		archiving: 'Arhiviranje\u00a0…',
		button: 'Arhiviraj'
	},
	archived: {
		restoring: 'Obnavljanje\u00a0…',
		restore: 'Obnovi',
		pickAnother: 'Izberi drugo'
	},
	more: {
		exercise: 'Vaja',
		exerciseMeta: 'Zgodovina, pogostost, ali je dejavna',
		taughtIn: (day) => `Na lekciji · ${day}`
	},
	saving: 'Shranjevanje\u00a0…',
	copyName: (name) => `${name} (kopija)`,
	refused: {
		copy: 'Te kombinacije ni bilo mogoče kopirati.',
		readSlot: 'Mesta ali figure ni bilo mogoče prebrati.',
		notThisRoutine: 'To mesto ni del te kombinacije.',
		notAlternative:
			'Ta figura se ne začne in konča tako kot figura na tem mestu, zato ni alternativa.',
		length:
			'Ta dolžina ne ustreza temu mestu: alternative nadaljujejo na drugi dobi ali pa dolžina figure ni določena v kombinaciji.',
		end: 'Ta konec ne ustreza temu mestu.',
		holdSomething: 'Mesto ne sme biti prazno.',
		note: 'Opomba ima lahko največ 200 znakov.',
		readInsert: 'Ni bilo mogoče prebrati, kaj dodati in kam.',
		embed: 'Te kombinacije ni mogoče vstaviti sem.',
		notThisDance: 'Ta figura ni del tega plesa.',
		move: 'Tega mesta ni mogoče premakniti tja.',
		gone: 'Teh mest ni več.',
		putBack: 'Teh mest ni bilo mogoče vrniti.',
		altPutBack: 'Te alternative ni bilo mogoče vrniti.',
		copySlots: 'Teh mest ni bilo mogoče kopirati.',
		newName: 'Vpišite ime nove kombinacije (do 200 znakov).',
		demote: 'V sklop lahko spremenite le kombinacijo, ki jo uporablja druga kombinacija.',
		unpack: 'To mesto nima sklopa ali kombinacije, ki bi jo lahko razpakirali.',
		detachHere: 'Tu lahko ločite le sklop.',
		extract: 'Iz teh mest ni mogoče narediti sklopa: biti morajo sosednja.'
	}
};
