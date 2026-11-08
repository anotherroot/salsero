// Positions: the list, No position, New position and Edit (the sheet), the hold,
// Templates, a position's page and the figure's tags. The map, How positions work
// and the links to sections and lessons are added beside these.
import { possessive } from './figure';
import { nouns } from './nouns';
import { plural } from './plural';

/** "Two", "Nine", "12": a count that opens a sentence. */
const NUMBER_WORDS = [
	'Zero',
	'One',
	'Two',
	'Three',
	'Four',
	'Five',
	'Six',
	'Seven',
	'Eight',
	'Nine'
];
const capNumber = (n: number): string => NUMBER_WORDS[n] ?? String(n);

export const positions = {
	/** A position's figures, counted: "17 in", "12 out" (the list's row, the page's subtitle). */
	counts: {
		ins: (n: number): string => `${n} in`,
		outs: (n: number): string => `${n} out`
	},
	/** The gap words a row or a banner names. */
	gaps: {
		deadEnd: 'dead end',
		orphan: 'orphan',
		island: 'island'
	},
	list: {
		tagged: (done: number, total: number): string => `${done} of ${total} figures have positions.`,
		optional: 'Positions are optional: a figure without one fits anywhere in a routine.',
		unused: 'unused',
		/** A group's row: "Salsa · from Week 6". */
		fromLesson: (type: string, lesson: string): string => `${type} · from ${lesson}`,
		/** The label over the person's own: "Yours · 15". */
		yours: (n: number): string => `Yours · ${n}`,
		mapRow: 'The map',
		noMatch: 'No positions match',
		noneOwn: 'No positions of your own yet.',
		groupNote: 'The group’s own positions. Its figures can only be tagged with these.',
		templates: 'Templates',
		search: 'Search positions',
		filter: 'Filter positions',
		chips: { all: 'All', gaps: 'Gaps' }
	},
	empty: {
		title: 'No positions yet',
		body: 'Start from a template’s rough positions, or make your own.',
		/** The first-run (wide) body, which counts the figures. */
		firstRun: (figures: number): string =>
			`Your ${figures} figures have none, and that is fine: they fit anywhere. Add positions when you want routines checked for what can follow what.`,
		actions: {
			templates: 'Start from a template',
			create: 'New position',
			how: 'How positions work'
		}
	},
	/** The No position row and page. */
	none: {
		title: 'No position',
		rowMeta: (n: number): string => `${nouns.figures(n)} · they fit anywhere`,
		head: (total: number, none: number, partial: number): string =>
			`${nouns.figures(total)} · ${none} with none, ${partial} with only a start or an end`,
		fits: {
			title: 'Fits anywhere',
			body: 'A figure with no position can follow anything and lead into anything: the routine editor offers it everywhere and never marks a break for it.'
		},
		groups: {
			none: 'No start and no end',
			onlyEnd: 'Only an end',
			onlyStart: 'Only a start'
		},
		/** A half-tagged row's tag: "ends in A, B". */
		endsIn: (names: string): string => `ends in ${names}`,
		startsIn: (names: string): string => `starts in ${names}`,
		startsOn: (n: number): string => `starts on ${n}`,
		empty: 'Every figure has a position on both sides.',
		/** A row's button into the figure's edit. */
		edit: 'Positions'
	},
	/** New position and Edit. */
	sheet: {
		newTitle: 'New position',
		newSub: 'Type starts as your “New figures” type (Settings)',
		add: 'Add position',
		save: 'Save',
		typeHelp: 'One, the same list as a figure’s type.',
		crossed: 'Right hands on top',
		archive: 'Archive position',
		archiveBody:
			'Archived like a figure: Restore brings it back. Its figures lose it and, with no other, have no position.',
		picture: 'Picture',
		change: 'Change',
		pictureLegend: 'Its points'
	},
	fields: {
		name: 'Name',
		namePlaceholder: 'e.g. Cerrada, Manos cruzadas',
		type: 'Type',
		hands: 'Hands',
		crossed: 'Crossed',
		facing: 'Facing',
		frame: 'Frame',
		notes: 'Notes',
		notesPlaceholder: 'How the hands meet, where the weight is…'
	},
	failed: {
		save: 'That did not save. Try again.',
		archive: 'That did not archive. Try again.',
		templates: 'Those were not added. Try again.'
	},
	busy: {
		adding: 'Adding position',
		addingMany: 'Adding positions',
		saving: 'Saving',
		archiving: 'Archiving position'
	},
	editTitle: (name: string): string => `Edit ${name}`,
	/** A recording's video, as the picture line names it. */
	recording: (figure: string): string => `Recording · ${figure}`,
	/** "From Week 6 at 1:12". */
	pictureLine: (video: string, time: string): string => `From ${video} at ${time}`,
	/** The hold's words. */
	hold: {
		hands: { two: 'Two hands', one: 'One hand', none: 'No hands' },
		/** The form's Hands choices: short, under a field that says Hands. */
		handsShort: { two: 'Two', one: 'One', none: 'None' },
		facing: {
			face: 'Face to face',
			side: 'Side by side',
			shadow: 'Shadow',
			back: 'Back to back'
		},
		frame: { open: 'Open', closed: 'Closed' },
		crossed: 'Crossed, right on top',
		/** A hold known not to be crossed: shown only where two holds are compared. */
		notCrossed: 'Not crossed'
	},
	templates: {
		title: 'Start from a template',
		/** Templates' type switch, for a screen reader. */
		pick: 'Template',
		youHaveIt: 'You have it',
		note: (type: string): string =>
			`Rough positions to start from: rename, change or remove them later. They get the type ${type}. What you already have by name is skipped.`,
		add: (n: number): string => `Add ${plural(n, 'position', 'positions')}`,
		refused: {
			type: 'Pick a type with templates.',
			none: 'Tick at least one position.'
		},
		/**
		 * Each template's description, by dance, type and name (the name is a dance
		 * term and stays as it is). It becomes the new position's notes.
		 */
		descriptions: {
			salsa: {
				salsa: {
					'Abierta (dos manos)': 'Open, both hands',
					'Abierta (una mano)': 'Open, his left in her right',
					Cerrada: 'Closed, the basic frame',
					Hammerlock: 'Her right arm folded behind her back',
					Cuddle: 'Side by side, her wrapped in his arms',
					Sombra: 'Shadow: he is behind her, same direction'
				},
				son: {
					'Cerrada de son': 'Closed and low, close together',
					Abierta: 'Open, one hand, loose',
					'Manos cruzadas': 'Both hands crossed, right on top',
					Paseo: 'Side by side, walking'
				},
				timba: {
					Pegao: 'Closed, hip to hip',
					Caída: 'One hand, her weight dropped back',
					'Sombra de timba': 'Shadow, close, hips moving',
					'Abierta de timba': 'Open, one hand, low'
				}
			},
			bachata: {
				dominican: {
					Closed: 'Closed, close together',
					'Open, two hands': 'Open, both hands',
					'Side by side': 'Side by side, close'
				},
				sensual: {
					Closed: 'Closed, body contact',
					'Open, one hand': 'Open, one hand',
					'Cross-hand': 'Both hands crossed, right on top',
					Hammerlock: 'Her arm folded behind her back'
				},
				traditional: {
					Closed: 'Closed, the basic frame',
					'Open, two hands': 'Open, both hands',
					Shadow: 'He is behind her, same direction'
				}
			}
		} as Record<string, Record<string, Record<string, string>>>
	},
	/** A position's page. */
	page: {
		position: 'Position',
		/** "Salsa Tuesdays’ position". */
		teamPosition: (team: string): string => `${possessive(team)} position`,
		/** A group's figure in a person's app, before its line: "Salsa Tuesdays’". */
		team: (team: string): string => possessive(team),
		/** "ends in Cerrada or Abierta, Son" (the names joined with `or`). */
		endsIn: (names: string): string => `ends in ${names}`,
		from: (names: string): string => `from ${names}`,
		relations: {
			from: 'Figures from here',
			into: 'Figures into here'
		},
		/** The sheet's New, and its name for a screen reader. */
		new: 'New',
		newFrom: (name: string): string => `New figure from ${name}`,
		newInto: (name: string): string => `New figure into ${name}`,
		relationsLabel: 'Figures and routines through this position',
		menu: {
			newFrom: 'New figure from here',
			newInto: 'New figure into here',
			map: 'Show on the map',
			history: 'History'
		},
		fromLessonNote: (lesson: string, team: string): string =>
			`From ${lesson}. Tag your figures with it as it is; it stays ${possessive(team)}.`,
		makeMineNote: 'Edit makes it yours (Make it mine); your figures tagged with it move over.',
		archived: {
			title: 'Archived',
			body: 'Its figures no longer show it. Restore brings it back.',
			restore: 'Restore'
		},
		deadEnd: {
			title: 'Dead end',
			body: (name: string, n: number): string =>
				`${capNumber(n)} ${n === 1 ? 'figure ends' : 'figures end'} in ${name} and nothing you know leaves it. A routine that gets here stops.`
		},
		orphan: {
			title: 'Orphan',
			body: (name: string, n: number): string =>
				`${capNumber(n)} ${n === 1 ? 'figure leaves' : 'figures leave'} ${name} and nothing you know ends in it.`
		},
		/** "Slots 2 → 3", "Slots 5 → 6 and 9 → 10": `pairs` is how many. */
		through: (pairs: number, list: string): string => `Slots ${list}`,
		and: 'and',
		editing: 'Editing',
		hold: 'Hold'
	},
	/** New move from a position: the line in the sheet that says which tag it gets. */
	preset: {
		starts: (name: string): string => `Starts in ${name}`,
		ends: (name: string): string => `Ends in ${name}`,
		gone: 'That position can no longer tag a figure here. Add the move without it.'
	},
	/** A figure's Starts in and Ends in. */
	tags: {
		empty: 'No position · fits anywhere',
		help: 'Any number of each. In a routine, the next figure fits when it starts in any of these ends.',
		/** The picker's group of the figure's own type: "Salsa · this figure’s type". */
		figureType: (type: string): string => `${type} · this figure’s type`,
		/** A group's position in a person's picker: "Salsa · tag with it as it is". */
		asItIs: (type: string): string => `${type} · tag with it as it is`,
		clear: { label: 'No position', meta: 'Fits anywhere · the default' },
		picker: {
			starts: 'Starts in',
			ends: 'Ends in',
			search: 'Search positions',
			create: 'Position',
			nothingLeft: 'No positions yet.'
		},
		newSub: 'Its type starts as this figure’s.',
		createFailed: 'That could not be created. Try it again.',
		/** A side with no position, on the figure page. */
		none: 'No position',
		or: 'or'
	},
	refused: {
		noName: 'Give it a name.',
		nameLong: 'A name is up to 200 characters.',
		notesLong: 'Notes are up to 2000 characters.',
		taken: (name: string): string => `You already have a position called ${name}.`,
		/** A group's: its name, or "This group" when it is gone. */
		teamTaken: (team: string | null, name: string): string =>
			`${team ?? 'This group'} already has a position called ${name}.`
	}
};
