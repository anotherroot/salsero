// Links: the Link popup (a section's or point's links, its picker and create steps), the
// links editor and Add a link (web and YouTube links on a figure, lesson or drill), the
// YouTube card, "Link a section", and what their server side says when it refuses.
// A section's range and length are built in `video/spots.ts`.

export const links = {
	/** The Link popup's heading under a point's moment: "Hand change · point", "Point". */
	pointOf: (label: string): string => `${label} · point`,
	point: 'Point',
	/** A create step's subtitle: where what it makes is linked. A point's says the same in English. */
	linkedTo: {
		section: (range: string): string => `Linked to ${range}`,
		point: (range: string): string => `Linked to ${range}`,
		sectionAndLesson: (range: string, title: string): string =>
			`Linked to ${range} and to ${title}`,
		pointAndLesson: (range: string, title: string): string => `Linked to ${range} and to ${title}`
	},
	/** The picker's create row, bare nouns (the picker draws the +). */
	createRow: {
		variation: 'Figure',
		drill: 'Drill',
		position: 'Position'
	},
	/** The links level's opener and the picker's search: a section's, a point's, or not known yet. */
	opener: {
		any: 'Link…',
		point: 'Link a position…',
		section: 'Link a figure, drill or position…'
	},
	search: {
		any: 'Search',
		point: 'Search positions',
		section: 'Search figures, drills and positions'
	},
	/** The levels' titles once the range is known: "Link 1:12", "Link 1:12 to…". */
	titles: {
		links: (range: string): string => `Link ${range}`,
		pick: (range: string): string => `Link ${range} to…`,
		/** Before it is: by what the spot is, or neither. */
		linksOf: { any: 'Link', point: 'Link a point', section: 'Link a section' },
		pickOf: { any: 'Link to…', point: 'Link a point to…', section: 'Link a section to…' }
	},
	/** The options did not load. */
	loadFailed: {
		any: 'Couldn’t load these links.',
		point: 'Couldn’t load this point’s links.',
		section: 'Couldn’t load this section’s links.',
		body: 'Close and tap the link button again.'
	},
	/** The full-screen player's button under a section's popup. */
	moment: 'Use this moment as a point',

	/** The popup itself. */
	popup: {
		linked: 'Linked',
		none: 'Not linked to anything yet.',
		drill: 'Drill',
		position: 'Position',
		archived: 'Archived',
		/** A linked row's ×. */
		unlinkOf: (label: string): string => `Unlink ${label}`,
		nothingLeft: 'Nothing else to link.',
		saveFailed: 'Couldn’t save. Try it again.',
		/** The "Unlink …?" question when the lesson links it by hand too. */
		unlinkTitle: (label: string): string => `Unlink ${label}?`,
		alsoLesson: 'It’s also linked to this lesson.',
		onlySection: 'Only from this section',
		sectionAndLesson: 'From the section and the lesson'
	},
	/** The create steps. */
	create: {
		titles: {
			variation: 'New figure',
			drill: 'New drill',
			position: 'New position'
		},
		/** The move picker of New figure. */
		move: 'Move',
		chooseMove: 'Choose a move…',
		chooseMoveTitle: 'Choose a move',
		searchMoves: 'Search moves',
		noMoves: 'There are no moves yet.',
		moves: 'Moves',
		pickMove: 'Pick a move.',
		figureName: 'Figure name',
		name: 'Name',
		positionPlaceholder: 'e.g. Cerrada, Manos cruzadas',
		type: 'Type',
		submit: 'Create and link'
	},

	/** Add a link (the lesson page's sheet) and the links editor. */
	add: {
		title: 'Add a link',
		/** What Unsaved changes calls the form. */
		label: 'A link',
		link: 'Link',
		placeholder: 'Paste a YouTube or web link',
		titleField: 'Title',
		optional: '(optional)',
		adding: 'Adding…',
		submit: 'Add link',
		/** The editor's own box. */
		many: 'Add links',
		manyPlaceholder: 'Paste YouTube or other links, one per line',
		titlePlaceholder: 'For a single link'
	},
	/** What Add a link says it found in what was pasted. */
	found: {
		youtube: 'YouTube video',
		youtubeLine: 'You can save it at 480p after adding',
		web: 'Web page'
	},
	/** A YouTube link's footer row in the editor. */
	save: {
		saving: 'Saving at 480p on the home worker',
		/** A save that failed: what the worker said, or that it said nothing. */
		failed: (error: string): string => `Couldn't save: ${error}`,
		unknown: 'unknown error',
		retry: 'Retry',
		save: 'Save video',
		removeOf: (title: string): string => `Remove ${title}`
	},
	/** The YouTube card. */
	youtube: {
		/** Its play button: "Play Cubana basics", or the video. */
		play: (title: string): string => `Play ${title}`,
		playVideo: 'Play the video',
		/** After youtube.com: " · from 1:30". */
		from: (time: string): string => ` · from ${time}`,
		open: 'Open on YouTube',
		frame: 'YouTube video'
	},
	/** "Link a section": the lesson page's picker over every section of the dance. */
	sections: {
		title: 'Link a section',
		search: 'Search sections',
		near: 'In this lesson',
		none: 'No sections to link. Open a lesson video full screen and tap Section to mark one.'
	},

	/** Composed in the request when a link, a create or a restore is refused. */
	refused: {
		noFigure: 'No such figure.',
		noExercise: 'No such exercise.',
		drillOnly: 'Only a drill can have sections of its own.',
		noSection: 'No such section.',
		sectionOnly: 'Only a section can be linked, not a point.',
		otherDance: 'That section is from the other dance.',
		already: 'Already linked.',
		pointPositions: 'A point links positions only.',
		noName: 'Give it a name.',
		typeDance: 'That type does not belong to this dance.',
		styleDance: 'That style does not belong to this dance.',
		noMove: 'No such move.',
		variationTaken: (move: string, name: string): string => `${move} already has a ${name}.`,
		moveTaken: (name: string): string => `There's already a move called ${name}.`,
		figureNotMade: 'That figure could not be made.',
		moveNotMade: 'That move could not be made.',
		/** The links editor's. */
		notWeb: (lines: string): string => `Not a web link: ${lines}`,
		pasteFirst: 'Paste a link first.',
		tooLong: 'That link is too long.',
		titleLong: 'Keep the title under 200 characters.',
		drillLinks: 'Links live on the figure or lesson this exercise belongs to.',
		gone: 'That link was already removed.',
		youtubeOnly: 'Only a YouTube link can be saved as a video.',
		/** A picker's Restore of something no longer there (or not the person's to restore). */
		nothingToRestore: 'No such thing to restore'
	},
	/** The near group of the popup: where the section is. */
	near: {
		lesson: 'In this lesson',
		recording: 'This figure'
	}
};
