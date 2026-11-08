// The video: the inline video's controls, the full-screen player's screens (top bar, transport,
// marking, the section view, the editor, the list, the sheets, the toasts, the keys) and what
// the spots API says when it refuses. Times and lengths are built in `video/spots.ts`.

const RATE_CHIP: Record<number, string> = { 0.25: '¼×', 0.5: '½×', 0.75: '¾×' };

export const video = {
	/** A speed: "0.5×". */
	rate: (r: number): string => `${r}×`,
	/** The inline video's narrow speed chips: "¼×". */
	rateChip: (r: number): string => RATE_CHIP[r] ?? `${r}×`,
	speed: 'Speed',
	/** A speed button's name: "Speed 0.5×". */
	speedOf: (r: number): string => `Speed ${r}×`,
	mirror: 'Mirror',
	/** The corner badge while the picture is mirrored. */
	mirrored: 'Mirrored',
	mute: 'Mute',
	repeat: 'Repeat',
	play: 'Play',
	pause: 'Pause',
	fullScreen: 'Full screen',
	fromYouTube: 'from YouTube ↗',
	/** The full-screen player's own name, for a screen reader. */
	player: 'Video',
	/** The top bar's title when the page names none. */
	untitled: 'Video',
	/** The top bar's subtitle: what kind of video. */
	recording: 'Recording',
	audio: 'Audio',
	lessonVideo: 'Lesson video',
	/** A lesson's videos, numbered from one: "Video 1". */
	videoNo: (n: number): string => `Video ${n}`,
	/** Where a section is from: "Recording · Enchufla". */
	recordingOf: (figure: string): string => `Recording · ${figure}`,
	closePlayer: 'Close player',
	fullVideo: 'Full video',
	looping: 'Looping',
	loop: 'Loop',
	/** The landscape pill that opens the list: "Sections (4)". */
	sectionsCount: (n: number): string => `Sections (${n})`,
	/** The timeline, for a screen reader. */
	timeline: 'Position',
	showControls: 'Show controls',
	loadingVideo: 'Loading video',
	/** The pinch zoom's pill: "Zoom 1.5×". */
	zoom: (x: number): string => `Zoom ${x}×`,
	resetZoom: 'Reset',
	show: 'Show',
	hide: 'Hide',
	/** Seconds, for a step or a key: "0.1 s". */
	secs: (s: number): string => `${s} s`,
	/** A step back: "−0.1 s". */
	minus: (s: number): string => `−${s} s`,
	/** A step on: "+0.1 s". */
	plus: (s: number): string => `+${s} s`,
	/** The step buttons' names: "−0.1 s, back". */
	backBy: (s: number): string => `−${s} s, back`,
	forwardBy: (s: number): string => `+${s} s, forward`,

	markPoint: 'Mark point',
	mark: 'Mark',
	section: 'Section',
	startSection: 'Start section',
	endSection: 'End section',
	/** The narrow section button while one is being marked: "End · 3.2 s". */
	endShort: (length: string): string => `End · ${length}`,
	/** The wide one: "End section · 3.2 s". */
	endSectionAt: (length: string): string => `End section · ${length}`,

	/** A point's line: "Point at 1:38.50". */
	pointAt: (time: string): string => `Point at ${time}`,
	/** The list's second line for a point. */
	point: 'point',
	notLinked: 'Not linked',
	/** "Linked to Enchufla · Doble, Count drill". */
	linkedTo: (labels: string): string => `Linked to ${labels}`,
	/** "Links: A, B", the link entry's name. */
	links: (labels: string): string => `Links: ${labels}`,
	/** After an archived link's name. */
	archived: '(archived)',
	/** The list's short mark after a linked spot's line. */
	linked: 'linked',
	link: 'Link',
	linkPoint: 'Link this point',
	linkSection: 'Link this section',
	linkToPosition: 'Link to a position',
	linkToAny: 'Link to a figure, drill or position',

	spots: 'Sections and points',
	/** The list's header: "Sections and points · 4". */
	spotsCount: (n: number): string => `Sections and points · ${n}`,
	all: 'All',
	closeList: 'Close list',
	loadFailed: "Couldn't load spots",
	/** Nothing marked: "Nothing marked yet. Mark point saves this moment; Start section …" */
	empty: {
		lead: 'Nothing marked yet.',
		mark: 'saves this moment;',
		section: 'saves a stretch to loop.'
	},
	/** "Edit Enchufla doble", the list's Edit for a screen reader. */
	editOf: (label: string): string => `Edit ${label}`,

	editor: {
		renameOf: (label: string): string => `Rename ${label}`,
		rename: 'Rename',
		start: 'Start',
		end: 'End',
		moveStart: 'Move the start',
		moveEnd: 'Move the end',
		movePoint: 'Move the point',
		now: 'Now',
		/** "Whole section · 7.2 s". */
		whole: (length: string): string => `Whole section · ${length}`,
		earlier: '‹ Earlier',
		shorter: 'Shorter',
		longer: 'Longer',
		later: 'Later ›',
		edges: 'Section edges: drag a handle, tap to seek',
		edgesHint: 'drag a handle · tap to seek'
	},

	sheet: {
		name: 'Name',
		nameHelp: 'Leave it empty to show the times.',
		/** The delete question: "Delete “Enchufla doble”?". */
		deleteTitle: (label: string): string => `Delete “${label}”?`,
		deletePoint: 'The point goes from this video. You can undo it for a few seconds.',
		deleteSection: 'The section goes from this video. You can undo it for a few seconds.',
		unlinkFirst: 'Unlink it there first; until then this section stays.',
		keep: 'Keep it'
	},

	/** The keys sheet: what each key does (the keys themselves stay as printed on them). */
	keys: {
		title: 'Keys',
		toggle: 'play / pause',
		second: '1 s back / on',
		tenth: '0.1 s back / on',
		mark: 'mark a point (full video)',
		section: 'start / end a section (full video)',
		edges: 'set the start / end to now (editor)',
		jump: 'jump to the start / the last 2 s',
		loop: 'pause / resume the loop (editor)',
		back: 'back one level',
		help: 'these keys'
	},
	/** The desktop's short key legend. */
	legend: {
		play: 'play',
		edges: 'start / end here',
		jump: 'jump to start / end',
		mark: 'mark',
		section: 'section',
		loop: 'loop',
		all: 'all keys'
	},

	toast: {
		pointSaved: (time: string): string => `Point saved at ${time}`,
		sectionSaved: (length: string): string => `Section saved · ${length}`,
		playOn: 'Play on a little, then end the section',
		/** "Start set to 1:04.23". */
		edgeSet: (edge: 'start' | 'end', time: string): string =>
			`${edge === 'start' ? 'Start' : 'End'} set to ${time}`,
		deleted: (label: string): string => `Deleted ${label}`,
		saveFailed: "Couldn't save",
		restoreFailed: "Couldn't restore",
		pointFailed: 'Couldn’t save the point. Try it again.'
	},

	/** The spots API's refusals, read by the player. */
	refusal: {
		noVideo: 'No such video',
		noSpot: 'No such spot',
		noSection: 'No such section',
		noLink: 'No such link',
		labelText: 'A label must be text.',
		labelLong: (max: number): string => `A label can be at most ${max} characters.`,
		noStart: 'A spot needs a start time.',
		endAfterStart: 'A section has to end after it starts.',
		pointNoEnd: 'A point has no end.',
		sectionNeedsEnd: 'A section needs an end.',
		/** Deleting a linked section: "Linked to Setenta · Basic — unlink it first." */
		linked: (labels: string): string => `Linked to ${labels} — unlink it first.`,
		/** A refusal with nothing in its body. */
		failed: (status: number): string => `video-spots: ${status}`
	}
};
