// A lesson: the simple lesson page and the Lessons list (part 1); the full lesson page,
// New lesson and the share target (part 2).
import { plural } from './plural';

const word = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const lesson = {
	/** The simple page's line over the title: "Class · Tue 3 Nov". */
	bandLine: (day: string): string => `Class · ${day}`,
	/** When an entry is next on Today: "On Today today", "On Today tomorrow". */
	onToday: (day: string): string => `On Today ${day}`,
	/** `when` from `whenWords`: "On Today on Sunday", "On Today on 19 Nov". */
	onTodayOn: (when: string): string => `On Today on ${when}`,
	onTodayNextWeek: 'On Today next week',
	paused: 'Paused',
	/** The lesson's own entry in "What you're practising". */
	goOver: 'Go over this lesson',
	/** The banner while its group is being deleted: "Salsa Tuesdays is being deleted on 2 Dec". */
	deleting: (name: string, day: string): string => `${name} is being deleted on ${day}`,
	page: {
		notes: 'Notes',
		videos: 'Videos',
		links: 'Links',
		practising: "What you're practising",
		noVideos: 'No videos yet.',
		addVideos: 'Add videos',
		/** A video's caption and its place: "Video 2". */
		video: (n: number): string => `Video ${n}`,
		deleteVideo: (n: number): string => `Delete video ${n}`,
		missingTitle: 'This file is missing',
		missingBody: 'The server has no file for this video.',
		unplayableTitle: 'Can’t play here',
		unplayableBody: 'This browser can’t play this file. Download it or open it on your phone.',
		download: 'Download',
		cantDelete: 'Can’t delete this video',
		/** The band under the title of a class not added yet. */
		notInPractice: 'Not in your practice yet',
		adding: 'Adding…',
		added: 'Added to Today',
		couldNotAdd: 'Could not add.',
		couldNotUndo: 'Could not undo.',
		notNow: 'Not now',
		menu: 'Lesson menu',
		edit: 'Edit lesson'
	},
	list: {
		empty: 'No lessons yet',
		emptyGroup:
			'Add one after your next class — the videos and the notes. Members see it once you publish it.',
		emptyOwn:
			'Add one after your next class — the videos, the notes, and something on Today to make you go back over it.',
		newLesson: 'New lesson',
		drafts: 'Drafts',
		draft: 'Draft',
		/** The badge on a lesson the person has not opened. */
		isNew: 'New',
		videos: (n: number): string => plural(n, 'video', 'videos'),
		/** The three counts' words, the number drawn apart: "sections". */
		sections: (n: number): string => word(n, 'section', 'sections'),
		routines: (n: number): string => word(n, 'routine', 'routines'),
		figures: (n: number): string => word(n, 'figure', 'figures'),
		onDisk: (size: string): string => `Videos on disk: ${size}`,
		groupVideos: (used: string, limit: string): string => `Group videos: ${used} of ${limit}`,
		pick: {
			title: 'Pick a lesson',
			body: 'Its notes, videos and what it teaches open here, beside the list.'
		}
	},

	// --- Part 2: the full lesson page (Practise and Everything), New lesson, the share target.

	/** The full page's band, edit mode, the lists' headings and the dialogs. */
	full: {
		/** The band's subtitle while editing. */
		editing: 'Editing',
		stopEditing: 'Stop editing',
		/** What Unsaved changes calls the edit form. */
		edits: 'Lesson edits',
		/** A published group lesson not yet added: the band's line beside Add. */
		notInLessons: 'Not in your lessons yet',
		notesHelp: 'Links in notes open when tapped.',
		archiveLesson: 'Archive lesson',
		/** The lists' headings: "Figures · 3". */
		figures: 'Figures',
		routines: 'Routines',
		exercises: 'Exercises',
		positions: 'Positions',
		/** A row's unlink button: "Unlink Enchufla · Doble". */
		unlinkOf: (name: string): string => `Unlink ${name}`,
		saving: 'Saving…',
		history: 'History',
		removeItem: 'Remove from my lessons',
		deleteVideo: {
			title: 'Delete this video?',
			busy: 'Deleting…',
			failed: 'That video could not be deleted.'
		},
		remove: {
			title: 'Remove from your lessons?',
			body: 'What it put on Today goes, unless another lesson you have holds it. Your logs are kept.',
			busy: 'Removing…'
		},
		archive: {
			title: 'Archive this lesson?',
			team: 'The videos and links are kept.',
			own: 'Its review exercise goes too. The videos, links and history are kept.',
			button: 'Archive',
			busy: 'Archiving…',
			failed: 'That lesson could not be archived.'
		}
	},

	/** What the page hands its four "Link an existing …" pickers. */
	pickers: {
		figure: {
			title: 'Link a figure',
			search: 'Search figures',
			group: 'Figures',
			none: 'There are no figures yet.',
			/** The create row's two choices. */
			move: 'Move',
			figure: 'Figure'
		},
		routine: {
			title: 'Link a routine',
			search: 'Search routines',
			group: 'Routines',
			none: 'There are no routines yet.',
			create: 'Routine'
		},
		exercise: {
			title: 'Link an exercise',
			search: 'Search exercises',
			none: 'Nothing left to link. A figure’s or routine’s exercise lives under it.',
			create: 'Exercise'
		},
		position: {
			title: 'Link a position',
			search: 'Search positions',
			none: 'There are no positions yet.',
			create: 'Position'
		}
	},

	/** The three "from this lesson" sheets. */
	create: {
		figure: {
			title: 'New figure',
			/** The switch: a move of its own, or a figure of one. */
			make: 'Make',
			newMove: 'New move',
			inMove: 'New figure in a move',
			noMoves: 'There are no moves yet.',
			move: 'Move',
			choose: 'Choose a move…',
			chooseTitle: 'Choose a move',
			search: 'Search moves',
			/** The move picker's two groups. */
			inLesson: 'In this lesson',
			moves: 'Moves',
			first: 'Moves in this lesson come first',
			busy: 'Adding',
			add: 'Add figure'
		},
		routine: {
			title: 'New routine from this lesson',
			sub: 'Linked here, then opened to build its slots',
			label: 'New routine',
			busy: 'Adding routine',
			add: 'Add routine and build it'
		},
		exercise: {
			title: 'New exercise from this lesson',
			label: 'New exercise',
			busy: 'Adding exercise',
			add: 'Add exercise'
		},
		name: 'Name',
		notes: 'Notes',
		optional: '(optional)'
	},

	/** A lesson's fields: the New lesson sheet's and the page's edit mode. */
	fields: {
		day: 'Day of the class',
		title: 'Title',
		titlePlaceholder: 'Wednesday rueda — enchufla figures',
		notes: 'Notes',
		optional: '(optional)',
		notesPlaceholder: 'What the teacher said, what to fix, what you kept getting wrong…'
	},

	/** The New lesson sheet. */
	newSheet: {
		create: 'Create lesson',
		busy: 'Creating lesson',
		/** Where it goes (the share page): Mine or a group the person edits. */
		where: 'Where',
		searchGroups: 'Search groups',
		places: 'Places',
		nowhere: 'Nowhere else.',
		draftNote: "A group's lesson starts as a draft"
	},

	/** A row there through sections or points of the lesson's videos. */
	via: {
		/** "via section", "via 2 points", "via a section and 2 points". */
		badge: (sections: number, points: number): string => {
			const one = (n: number, word: string) => (n === 1 ? `a ${word}` : `${n} ${word}s`);
			if (points === 0) return sections === 1 ? 'via section' : `via ${sections} sections`;
			if (sections === 0) return points === 1 ? 'via point' : `via ${points} points`;
			return `via ${one(sections, 'section')} and ${one(points, 'point')}`;
		},
		/** "Unlink Manos cruzadas?", or "… from Week 6?" asked from elsewhere. */
		title: (label: string, lesson: string | null): string =>
			lesson ? `Unlink ${label} from ${lesson}?` : `Unlink ${label}?`,
		/** What goes with it: the sections and points, then their times. */
		body: (
			label: string,
			lesson: string | null,
			sections: number,
			points: number,
			ranges: string
		): string => {
			const s = sections === 1 ? 'section' : 'sections';
			const p = points === 1 ? 'point' : 'points';
			const noun = points === 0 ? s : sections === 0 ? p : `${s} and ${p}`;
			return `${label} is on ${lesson ?? 'this lesson'} through ${noun} ${ranges}. Unlink it from the lesson and the ${noun}?`;
		},
		unlink: 'Unlink',
		busy: 'Unlinking'
	},

	/** A video's sections under it (the lesson page; the figure page draws its own). */
	sections: {
		heading: (n: number): string => `Sections · ${n}`,
		noneEdit: 'None yet. Open the video full screen and tap Section to mark one.',
		none: 'None yet.',
		play: (label: string): string => `Play ${label}`,
		/** "Unlink 1:12.0–1:30.4 from Enchufla · Doble". */
		unlinkFrom: (section: string, target: string): string => `Unlink ${section} from ${target}`,
		unlink: 'Unlink',
		link: (label: string): string => `Link ${label}`
	},

	/** The rows' second lines. */
	meta: {
		/** A link card that opens the person's own copy. */
		yours: 'Yours',
		yoursWith: (meta: string): string => `Yours · ${meta}`,
		inactive: 'inactive',
		review: 'review exercise'
	},

	/** "Its 3 sections go with it. Lesson videos aren’t backed up, …". */
	deleteVideoBody: (sections: number): string => {
		const tail = 'Lesson videos aren’t backed up, so this can’t be undone.';
		if (sections === 0) return tail;
		return `Its ${sections} ${sections === 1 ? 'section goes' : 'sections go'} with it. ${tail}`;
	},
	/** What a spot linked to a position is blocked by: "Position · Cerrada". */
	positionLink: (name: string): string => `Position · ${name}`,

	/** The aria-label of each list's "+ Add". */
	addLabel: {
		figure: 'Add a figure',
		routine: 'Add a routine',
		exercise: 'Add an exercise',
		position: 'Add a position',
		link: 'Add a link'
	},

	/** A group's draft: the band's strip and the ⋯ item. */
	draft: {
		title: 'Draft',
		line: "Members don't see it yet",
		publish: 'Publish',
		/** "Members of Salsa Tuesdays see it". */
		publishMeta: (team: string): string => `Members of ${team} see it`
	},

	/** The share target: a video shared to the Android app, asking which lesson. */
	share: {
		title: 'Add to a lesson',
		recent: 'Recent lessons',
		newMeta: 'Make one for this video',
		opening: 'Opening the app',
		submit: 'Make it and add the video',
		pickPlace: 'Pick where it goes.'
	},

	/** The page's and the New lesson sheet's refusals, composed in the request. */
	refused: {
		title: 'Give it a title (up to 200 characters).',
		day: 'Pick the day of the class.',
		future: 'That day is in the future.',
		gone: 'That lesson no longer exists.',
		published: 'That lesson is already published.',
		archived: 'That lesson is already archived.',
		pickMove: 'Pick a move.',
		figureLink: 'That figure could not be linked.',
		figureUnlinked: 'That figure was already unlinked.',
		routineLink: 'That routine could not be linked.',
		routineUnlinked: 'That routine was already unlinked.',
		positionLink: 'That position could not be linked.',
		positionUnlinked: 'That position was already unlinked.',
		exerciseLink:
			'That exercise could not be linked. A figure’s or routine’s exercise lives under it.',
		exerciseUnlinked: 'That exercise was already unlinked.',
		videoGone: 'That video was already removed.'
	},

	/** What the chunked upload of a lesson video refuses, shown by the upload card. */
	upload: {
		noLesson: 'No such lesson.',
		notVideo: 'Only video files can be added to a lesson.',
		tooLarge: (limit: string): string => `That video is bigger than the ${limit} limit.`,
		empty: 'That upload was empty.',
		notSaved: 'That video could not be saved.'
	}
};
