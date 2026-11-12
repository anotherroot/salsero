// A routine's page and its editor: the facts and badges, a slot's lines, the
// seams, the selection and Make routine, the slot picker's own words (its
// context line too), Edit, Duplicate, Archive and the page's refusals. The
// Routines list is `moves`; the shared Picker is `picker`.

import { plural } from './plural';
export const routine = {
	/** A slot's length set in the routine: its chip and the How long? sheet (spec 2026-11-11). */
	length: {
		chip: (n: number): string => `${n} counts`,
		change: (n: number): string => `Length ${n} counts. Change it`,
		title: 'How long?',
		from: (figure: string, start: number): string => `${figure}, from ${start}`,
		/** Under the number on each button. */
		unit: (n: number): string => (n === 1 ? 'count' : 'counts'),
		other: 'Other',
		otherLabel: 'How many counts',
		done: 'Done',
		/** Why some lengths are greyed: the slot's other options go on to this count. */
		why: (next: number): string =>
			`Its alternatives go on to ${next}, so only lengths that land there fit.`
	},
	/** A slot's end chosen in the routine: its chip, its cell and the Where does it end? sheet (spec 2026-11-11, slot end). */
	end: {
		title: 'Where does it end?',
		sub: (figure: string, n: number): string => `${figure} · slot ${n}`,
		/** The chip and the cell while nothing is chosen. */
		ask: 'Ends?',
		clear: 'No choice — any end',
		altNot: (name: string): string => `Alternative ${name} doesn’t end here`,
		belowNot: (n: number): string => `Slot ${n} doesn’t start here`,
		/** The chip's name for a screen reader. */
		change: (name: string): string => `Ends in ${name}. Change it`,
		choose: 'Choose where it ends'
	},
	/** The facts line: "Starts from Open · ends at Closed". */
	facts: {
		from: 'Starts from',
		to: 'ends at',
		endsAt: 'Ends at'
	},
	loops: 'Loops',
	noLoop: 'Doesn’t loop',
	/** Where a slot's options disagree on their ends: "Open → ends differ". */
	endsDiffer: 'ends differ',
	/** A seam's two halves, the count's lower-case (the line is capitalised once joined). */
	seam: {
		hands: (ends: string, next: string): string => `Ends in ${ends}, next starts from ${next}`,
		count: (ready: string, next: string): string => `ready for ${ready}, next starts on ${next}`,
		/** The seam's name for a screen reader. */
		label: (above: number, below: number): string => `Slots ${above} and ${below} do not connect`,
		after: (n: number): string => `After ${n}`,
		before: (n: number): string => `Before ${n}`,
		addAfter: (n: number): string => `Add a slot after ${n}`,
		addBefore: (n: number): string => `Add a slot before ${n}`,
		bridge: 'Bridge',
		bridgeLabel: (above: number, below: number): string => `Bridge slots ${above} and ${below}`
	},
	selection: {
		title: 'Select slots',
		/** The ⋯'s way into selection. */
		item: 'Select slots',
		itemMeta: 'Duplicate, delete or make a routine of several',
		bar: 'Selected slots',
		above: 'Add above',
		below: 'Add below',
		duplicate: 'Duplicate',
		/** The header of selected neighbours, joined into one piece. */
		run: (from: number, to: number): string => `Slots ${from}–${to}`,
		/** Under one selected slot. */
		tip: 'Tap other slots to add them.',
		/** Make routine, in a fifth of the toolbar. */
		make: 'Section',
		/** Why an action is greyed. */
		blocked: {
			embedded: (names: string): string =>
				`This routine is embedded in ${names} — embedding is one level.`,
			none: 'Select the slots to make into a section.',
			slotIsRoutine: (n: number): string => `Slot ${n} is a routine — embedding is one level.`,
			apart: 'Select slots next to each other.',
			first: 'Select slots first.'
		}
	},
	/** Make routine: the bar's action and its sheet. */
	make: {
		action: 'Make routine',
		title: 'Make a routine',
		making: 'Making routine',
		label: 'New routine name',
		placeholder: 'Shine opener',
		caption: (n: number): string =>
			n === 1
				? 'The slot moves into the new routine, and it takes its place here as one slot.'
				: `The ${n} slots move into the new routine, and it takes their place here as one slot.`
	},
	/** A slot's card and the reader's list. */
	// Sections (spec 2026-11-12, routine sections).
	section: {
		unnamed: 'Section',
		open: (name: string): string => `Open ${name || 'the section'} here`,
		close: (name: string): string => `Close ${name || 'the section'}`,
		deeper: (level: number): string => `Level ${level}: opens on its own page`,
		inside: (name: string, n: number): string =>
			n > 1 ? `In ${name} · changes show in ${n} routines` : `In ${name}`,
		more: (n: number): string => `${n} more above`,
		level: (n: number): string => `level ${n}`,
		where: 'Where you are',
		subtitle: (figures: number, eights: number): string =>
			`Section · ${plural(figures, 'figure', 'figures')} · ${plural(eights, 'eight', 'eights')}`,
		inRoutines: (n: number): string => `In ${n} routines:`,
		name: 'Name',
		makeRoutine: 'Make routine',
		makeRoutineMeta: 'Shows up in Routines and can be practised',
		detachHere: 'Detach here',
		detachMeta: (routine: string): string => `${routine} gets its own copy`,
		unpackInto: (routine: string): string => `Unpack into ${routine}`,
		unpackMeta: 'Its slots go back where it was',
		demote: 'Turn into a section',
		demoteMeta: 'Leaves Routines; stays where it is used',
		demoteTitle: (name: string): string => `Turn ${name} into a section?`,
		demoteBody: (routines: string, lessons: string, practised: number): string =>
			[
				`It leaves the Routines list and stays in ${routines}.`,
				lessons ? `The links in ${lessons} go.` : '',
				practised > 0 ? `Practised ${practised} times: it leaves Today, the history stays.` : ''
			]
				.filter(Boolean)
				.join(' '),
		demoteDo: 'Turn into a section',
		sectionOf: (routines: string): string => (routines ? `Section of ${routines}` : 'Section'),
		sectioned: (n: number): string => `Made a section of ${plural(n, 'slot', 'slots')}`,
		unpacked: (name: string): string => `Unpacked ${name || 'the section'}`,
		added: (name: string, n: number): string =>
			n > 1 ? `Added to ${name} · shows in ${n} routines` : `Added to ${name}`,
		copied: (n: number, after: number): string =>
			`${plural(n, 'slot', 'slots')} copied after slot ${after}`
	},
	slot: {
		openCell: 'Open',
		unpack: 'Unpack',
		aFigure: 'a figure',
		aRoutine: 'a routine',
		archived: (name: string): string => `${name} (archived)`,
		empty: 'Empty — nothing to call here',
		move: (n: number): string => `Move slot ${n}. Arrow keys move it.`,
		delete: (n: number): string => `Delete slot ${n}`,
		notePlaceholder: 'Add a note…',
		noteLabel: (n: number): string => `Note for slot ${n}`,
		/** What Unsaved changes calls a half-typed note. */
		noteUnsaved: 'Slot note',
		noteFailed: 'The note did not save.',
		alternatives: (n: number): string => `Alternatives for slot ${n}`,
		/** The open slot's toolbar, by name. */
		toolbar: (n: number): string => `Slot ${n}`,
		alternative: 'Alternative',
		open: (label: string): string => `Open ${label}`,
		remove: (label: string): string => `Remove ${label}`,
		deleted: (n: number): string => `Slot ${n} deleted`,
		manyDeleted: (n: number): string => `${n} slots deleted`,
		removed: (label: string): string => `Removed ${label}`
	},
	slots: {
		title: (n: number): string => `Slots · ${n}`,
		none: 'No slots yet.',
		emptyTitle: 'No slots yet',
		emptyBody: 'The first slot is where the routine starts. Add a figure, then build from it.',
		addFigure: 'Add a figure',
		addSlot: 'Add a slot',
		addSlotAfter: (n: number): string => `Add a slot after slot ${n}`
	},
	/** The slot picker's titles, words and chips. */
	picker: {
		between: (a: number, b: number): string => `Add between slots ${a} and ${b}`,
		after: (n: number): string => `Add after slot ${n}`,
		before: (n: number): string => `Add before slot ${n}`,
		alternative: (label: string): string => `Alternative for ${label}`,
		search: 'Search figures and routines',
		filters: 'Filters',
		count: 'Count',
		hold: 'Hold',
		holdOff: 'Turn off Hold',
		countOff: 'Turn off Count',
		/** After the Turn off button, its leading space included. */
		toSeeRest: ' to see the rest.',
		noAlternative: 'No other figure starts and lands like this one.',
		noMatch: (q: string): string => `Nothing matches “${q}”.`,
		/** `context`: the context line, "Starts on 1 from Closed". */
		nothingFits: (context: string): string =>
			`Nothing you know ${context[0].toLowerCase()}${context.slice(1)}.`,
		noFigures: 'No figures in this dance yet.',
		/** The context line (`anchorText`). */
		startsOnFrom: (n: number, from: string): string => `Starts on ${n} from ${from}`,
		startsOn: (n: number): string => `Starts on ${n}`,
		startsFrom: (from: string): string => `Starts from ${from}`,
		endsOnAt: (counts: string, at: string): string => `Ends on ${counts} at ${at}`,
		endsOn: (counts: string): string => `Ends on ${counts}`,
		endsAt: (at: string): string => `Ends at ${at}`,
		anywhereFrom: 'Anywhere',
		anywhereTo: 'anywhere'
	},
	band: {
		edit: 'Edit routine',
		editTitle: 'Edit routine',
		practiseMeta: 'Count only or with a song'
	},
	/** Edit mode. */
	edit: {
		/** What Unsaved changes calls the edit form. */
		label: 'Routine edits',
		nameHelp: 'Up to 200 characters',
		optional: '(optional)',
		more: 'More',
		duplicate: 'Duplicate routine',
		duplicateMeta: 'Makes a copy and opens it',
		archive: 'Archive routine',
		archiveMeta: 'Its slots and practice history are kept'
	},
	archive: {
		title: (name: string): string => `Archive “${name}”?`,
		body: 'It leaves the Routines list. Its slots and practice history are kept.',
		archiving: 'Archiving…',
		button: 'Archive'
	},
	/** "Archived by Ana": Restore and put it in, or pick another. */
	archived: {
		restoring: 'Restoring…',
		restore: 'Restore',
		pickAnother: 'Pick another'
	},
	more: {
		exercise: 'Exercise',
		exerciseMeta: 'History, how often, active',
		taughtIn: (day: string): string => `Taught in · ${day}`
	},
	saving: 'Saving…',
	/** A duplicate's name, in the language of whoever made it. */
	copyName: (name: string): string => `${name} (copy)`,
	/** The page's refusals, composed in the request. */
	refused: {
		copy: 'Could not copy that routine.',
		readSlot: 'Could not read that slot or figure.',
		notThisRoutine: 'That slot does not belong to this routine.',
		notAlternative:
			'That figure does not start and land like this slot’s figure, so it is not an alternative.',
		/** The How long? sheet's save (spec 2026-11-11). */
		length:
			'That length does not fit this slot: its alternatives go on to another count, or its length is not set in the routine.',
		/** The Where does it end? sheet's save (spec 2026-11-11, slot end). */
		end: 'That end doesn’t fit this slot.',
		holdSomething: 'A slot has to hold something.',
		note: 'Keep the note to 200 characters.',
		readInsert: 'Could not read what to add, or where.',
		embed: 'That routine cannot be embedded here.',
		notThisDance: 'That figure is not part of this dance.',
		move: 'That slot cannot move there.',
		gone: 'Those slots are already gone.',
		putBack: 'Those slots could not be put back.',
		altPutBack: 'That alternative could not be put back.',
		copySlots: 'Those slots could not be copied.',
		newName: 'Give the new routine a name (up to 200 characters).',
		demote: 'Only a routine another routine uses can become a section.',
		unpack: 'That slot holds no section or routine to unpack.',
		detachHere: 'Only a section can be detached here.',
		moveInto:
			'That slot cannot go in there: it would end up inside itself, or it is not part of this routine.',
		extract: 'Those slots cannot become a section: they have to sit next to each other.'
	}
};
