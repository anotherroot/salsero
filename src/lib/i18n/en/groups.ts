// A group's page (My class at Follow my class), its People, the Leave sheet and
// Keep's lines, and the Groups tab's name. Part 2 adds the rest of Groups.
import { plural } from './plural';

export const groups = {
	/** The Groups tab's accessible name when something is new. */
	tabNew: 'Groups, new in your groups',
	/** The pill on a group in the list: how many of its lessons and songs are new. */
	newPill: (n: number): string => `${n} new`,
	role: { owner: 'Owner', editor: 'Editor', member: 'Member' },
	/** The band's line under a group's people count. */
	you: { owner: 'you own it', editor: 'you edit it', member: 'you are a member' },
	page: {
		menu: 'Group menu',
		deleted: 'Deleted',
		restore: 'Restore',
		autoAdd: 'Add new lessons to Today automatically',
		couldNotSave: 'Could not save.',
		couldNotAdd: 'Could not add.',
		couldNotUndo: 'Could not undo.',
		/** The toast after a one-tap Add in My class; its action is Undo. */
		addedToToday: 'Added to Today',
		lessons: 'Lessons',
		newLesson: 'New lesson',
		noLessons: 'No lessons yet',
		added: 'Added',
		people: 'People',
		recentlyDeleted: 'Recently deleted',
		showCode: 'Show code',
		rename: 'Rename',
		leaveClass: 'Leave class',
		leaveGroup: 'Leave group',
		deleteGroup: 'Delete group',
		renameGroup: 'Rename group',
		name: 'Name',
		deleteQuestion: (name: string): string => `Delete ${name}?`,
		deleteBody: 'Everyone loses its lessons. You can restore it for 30 days.',
		/** The actions' refusals a member can meet. */
		noLesson: 'No such lesson',
		noGroup: 'No such group',
		chooseKeep: 'Choose what to keep.',
		keepFailed: 'Could not keep your copies. Try again.',
		handOverFirst: 'Hand the group over before you leave it.',
		/** The storage line: "Uses 120 MB of 600 MB". */
		uses: (used: string, limit: string): string => `Uses ${used} of ${limit}`,
		/** Restore, when a live group already has the name. */
		nameTaken: 'You already have a group with this name. Rename that one first.'
	},
	people: {
		title: 'People',
		actionsFor: (name: string): string => `Actions for ${name}`,
		makeMember: 'Make member',
		makeEditor: 'Make editor',
		handOverGroup: 'Hand over the group',
		handOverQuestion: (name: string): string => `Hand over to ${name}?`,
		handOverBody: 'They become the owner and you become an editor. Only they can take it back.',
		handOver: 'Hand over',
		removeQuestion: (name: string): string => `Remove ${name}?`,
		removeBody: 'They leave the group and keep copies of what they had.',
		/** The People page's refusals. */
		noPerson: 'No such person',
		pickRole: 'Pick a role.',
		ownerKeeps: 'The owner keeps the group. Hand it over to change that.',
		ownsEnough: 'That person already owns as many groups as they may make.',
		pickSomeone: 'Pick someone else in the group.',
		keepFailed: 'Could not keep their copies. Try again.',
		ownerStays: 'The owner cannot be removed. Hand the group over first.'
	},
	leave: {
		title: (team: string): string => `Leave ${team}?`,
		sub: 'After leaving you see nothing of the group. You keep copies of what you choose.',
		reconnect: 'What you keep becomes your copies. Rejoin later and they reconnect.',
		copyChip: 'Copy',
		/** A kept copy's meta in the Lessons tab. */
		copyMeta: (group: string): string => `Your copy · from ${group}`,
		choose: (n: number): string => `Leave and keep ${n}`,
		lessons: (n: number): string => plural(n, 'lesson', 'lessons'),
		figures: (n: number): string => plural(n, 'figure', 'figures'),
		routines: (n: number): string => plural(n, 'routine', 'routines'),
		songs: (n: number): string => plural(n, 'song', 'songs'),
		nothing: 'Nothing to keep',
		/** Keep everything's meta: "2 lessons, 3 figures · 1 GB counted to you". */
		everything: (counts: string[], size: string): string =>
			`${counts.join(', ')} · ${size} counted to you`,
		usedNone: 'Nothing of yours uses it. Everything goes',
		/** Keep only what my routines use: the figures, and the routine that uses them. */
		used: (names: string[], routine: string | null): string =>
			`${names.join(' and ')}, which ${routine ? `${routine} uses` : 'your routines use'}. Everything else goes`,
		overLimit: (size: string): string =>
			`That takes you over your ${size}. You can still practise; new uploads wait until you’re under.`,
		/** A locked row in Choose: what it is, and who needs it. */
		locked: (meta: string, by: 'routine' | 'lesson' | 'figure'): string =>
			meta ? `${meta} · used by your ${by}` : `Used by your ${by}`,
		sections: { lessons: 'Lessons', routines: 'Routines', figures: 'Figures', songs: 'Songs' },
		keepAll: 'Keep everything',
		chooseWhat: 'Choose what to keep',
		keepUsed: 'Keep only what my routines use',
		whatToKeep: 'What to keep',
		failed: 'Could not leave. Try again.',
		loadFailed: 'Could not load what you would keep. Close this and try again.',
		leave: 'Leave',
		leaving: 'Leaving',
		/** Keep's item metas (server): a figure's recordings, a routine's slots. */
		recordings: (n: number): string => plural(n, 'recording', 'recordings'),
		slots: (n: number): string => plural(n, 'slot', 'slots')
	},
	/** The Groups list, New group and Join with a code. */
	list: {
		/** The desktop band's line under Groups. */
		subtitle: 'Share lessons with a class',
		yourGroups: 'Your groups',
		restoreName: (name: string): string => `Restore ${name}`,
		restoreFailed: 'That group could not be restored.',
		emptyTitle: 'No groups yet',
		emptyBody:
			'Make a group for your class, then share its code. Everyone in it sees the lessons you publish.',
		/** The empty list where there is no New group: the code field below it. */
		emptyClassBody: 'Your teacher has the code, or open the link they sent.',
		joinWithCode: 'Join with a code',
		newGroup: 'New group',
		createGroup: 'Create group',
		creatingGroup: 'Creating group',
		/** An example group name, in Slovenian in both languages. */
		namePlaceholder: 'Salsa nadaljevalna',
		/** "You can make 2 groups": a count after "make". */
		limit: (n: number): string =>
			`You can make ${plural(n, 'group', 'groups')}. Ask the admin for more.`,
		nameRefusal: 'Give it a name of up to 60 characters that none of your groups has.',
		/** The desktop's empty pane beside the list, with no group open. */
		pick: { title: 'Pick a group', body: 'Its lessons, class songs and people open here.' }
	},
	/** The group code sheet. */
	code: {
		title: 'Group code',
		qr: (name: string): string => `QR code for joining ${name}`,
		/** The share sheet's title. */
		shareTitle: (name: string): string => `Join ${name}`,
		copyLink: 'Copy link',
		copied: 'Copied',
		share: 'Share',
		copyFailed: 'Could not copy. The link above is selected: copy it from there.',
		accountsOnly: 'Only people who already have an account can join with it.',
		remake: 'Make a new code',
		remakeNote: 'The old link and QR stop working. People already in the group stay.'
	},
	/** The Add sheet, and "1 new drill · Add". */
	add: {
		nothing: 'Nothing in it yet',
		onToday: 'On Today',
		alsoFigures: 'Also practise figures',
		figuresCaption:
			'Unticked figures still show in your Moves, under the group. Costs none of your space.',
		/** "1 new routine": what came into an added lesson. */
		newRoutines: (n: number): string => plural(n, 'new routine', 'new routines'),
		newDrills: (n: number): string => plural(n, 'new drill', 'new drills'),
		/** What a row's kind is called, under its name. */
		kind: { lesson: 'Lesson review', routine: 'Routine', figure: 'Figure', drill: 'Drill' },
		/** The form's name for Unsaved changes. */
		label: (title: string): string => `Add ${title}`,
		refused: 'That lesson can no longer be added.',
		adding: 'Adding'
	},
	/** Group mode: the band's line and the Work in sheet. */
	mode: {
		label: (name: string): string => `${name} · group`,
		/** Mine's line in the Work in sheet. */
		mineMeta: 'Your own space'
	}
};
