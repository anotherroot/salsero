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
		/** The band's +: add to this group (a lesson, music, a figure …). */
		add: 'Add to the group',
		/** Add to the group's rows, in `ADD_KINDS` order. */
		addMenu: {
			lesson: 'Lesson',
			music: 'Music',
			figure: 'Figure',
			routine: 'Routine',
			position: 'Position',
			drill: 'Drill'
		},
		/** Add to the group → Drill: a drill of the group's, linked in a lesson later. */
		newDrill: {
			title: 'New drill',
			name: 'Name',
			notes: 'Notes',
			hint: 'Members see it once you link it in a published lesson.',
			create: 'Make drill',
			noName: 'Give it a name (up to 200 characters).',
			longNotes: 'Notes are up to 2000 characters.'
		},
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
	/**
	 * History: one line per change, composed when it is READ, in the reader's
	 * language, from the row's stored verb, subject and values (`teams/history.ts`).
	 * Nothing stored is words. A `name` argument is a quoted name with its
	 * leading space (" 'Doble'"), or ''.
	 */
	history: {
		title: 'History',
		/** The tab's title: "History · Week 6". */
		head: (title: string): string => `History · ${title}`,
		/** A name in a line: "added the figure 'Doble'". */
		quote: (name: string): string => `'${name}'`,
		/** Someone no longer in the group's names. */
		someone: 'Someone',
		/** "a section": what an add or a remove of a thing reads as. */
		thing: {
			video: 'a video',
			section: 'a section',
			point: 'a point',
			link: 'a link',
			recording: 'a recording',
			slot: 'a slot',
			option: 'an alternative',
			'section-link': 'a section link'
		},
		/** "the notes": what a change of one field reads as, by its key. */
		field: {
			title: 'title',
			lessonDay: 'day',
			notes: 'notes',
			name: 'name',
			figureName: 'move’s name',
			partner: 'partner',
			style: 'style',
			startIds: 'start positions',
			endIds: 'end positions',
			// Older History rows wrote a single end.
			endId: 'end position',
			// A position's hold and type.
			styleTag: 'type',
			hands: 'hands',
			crossed: 'crossed',
			facing: 'facing',
			frame: 'frame',
			pictureSpotId: 'picture',
			startCount: 'start count',
			startCounts: 'start counts',
			lengthFree: 'length set in the routine',
			lengthCounts: 'length',
			note: 'slot’s note',
			artist: 'artist',
			anchors: 'count',
			tempoFactor: 'tempo',
			sampleStartS: 'sample start',
			sectionsJson: 'sections',
			startS: 'music start',
			audio: 'audio',
			audioUrl: 'audio link',
			practiceMode: 'practice',
			countBpm: 'practice tempo',
			comesBack: 'comes back',
			slots: 'slots'
		},
		/**
		 * The word a subject is shown as, by `historySubject`'s key (`move` is a
		 * group's figure_groups row, `figure` a figures row). Any other subject
		 * shows as it is stored.
		 */
		subject: {
			lesson: 'lesson',
			move: 'move',
			figure: 'figure',
			routine: 'routine',
			drill: 'drill',
			song: 'song',
			position: 'position',
			video: 'video',
			section: 'section',
			point: 'point',
			link: 'link',
			recording: 'recording',
			slot: 'slot',
			option: 'option',
			team: 'team'
		},
		addedSong: (name: string): string => `added the song${name}`,
		made: (shown: string): string => `made the ${shown}`,
		/** A figure moved into this move; `from` is the move it came from. */
		movedHere: (name: string, from: string): string => `moved${name} here from '${from}'`,
		extracted: (name: string): string => `made the routine${name} from its slots`,
		addedSlots: (n: number): string => `added ${n} slots`,
		/** A section or a point linked to a thing; `name` is the thing's. */
		linked: (spot: 'section' | 'point', name: string): string =>
			name ? `linked a ${spot} to${name}` : `linked a ${spot}`,
		unlinked: (spot: 'section' | 'point', name: string): string =>
			name ? `unlinked a ${spot} from${name}` : `unlinked a ${spot}`,
		/** `thing` is one of `thing`'s words. */
		added: (thing: string): string => `added ${thing}`,
		addedThe: (shown: string, name: string): string => `added the ${shown}${name}`,
		removedSlots: (n: number): string => `removed ${n} slots`,
		removed: (thing: string): string => `removed ${thing}`,
		removedThe: (shown: string, name: string): string => `removed the ${shown}${name}`,
		archived: (shown: string, name: string): string => `archived the ${shown}${name}`,
		published: (shown: string): string => `published the ${shown}`,
		shared: (shown: string, name: string): string => `shared the ${shown}${name} with the class`,
		unshared: (shown: string, name: string): string => `stopped sharing the ${shown}${name}`,
		deleted: (shown: string, name: string): string => `deleted the ${shown}${name}`,
		/** A field's word, or a subject's with its name. */
		changed: (what: string): string => `changed the ${what}`,
		movedSlot: 'moved a slot',
		/** A section or a point put back; `label` is its name, null for none. */
		putBack: (spot: 'section' | 'point', label: string | null): string =>
			label === null ? `put a ${spot} back` : `put '${label}' back`,
		putBackSlots: (n: number): string => (n > 1 ? `put back ${n} slots` : 'put back a slot'),
		/** A field's word, or a subject's with its name. */
		restored: (what: string): string => `restored the ${what}`,
		restoredThing: (thing: string): string => `restored ${thing}`,
		/** `seconds` is written already ("1.2"). */
		moved: (spot: 'section' | 'point', label: string | null, seconds: string): string =>
			`moved ${label === null ? `a ${spot}` : `'${label}'`} ${seconds} s`,
		movedEnd: (spot: 'section' | 'point', label: string | null, seconds: string): string =>
			`moved the end of ${label === null ? `a ${spot}` : `'${label}'`} ${seconds} s`,
		clearedName: (spot: 'section' | 'point'): string => `cleared the name of a ${spot}`,
		named: (spot: 'section' | 'point', label: string): string => `named a ${spot} '${label}'`,
		/** What a change to text replaced, under its line. */
		was: (value: string): string => `Was: ${value}`,
		empty: '(empty)',
		/** "Edited by Ana · 10 min ago": a lesson's last change. */
		editedBy: (first: string, ago: string): string => `Edited by ${first} · ${ago}`,
		/** A link to something archived since the picker opened. */
		archivedBy: (first: string): string => `Archived by ${first}`,
		archivedSince: 'That was archived since you opened this.',
		emptyTitle: 'No changes yet',
		emptyBody: 'Who changes what in the group shows here.',
		listLabel: 'Changes, newest first',
		inDeleted: 'In Recently deleted',
		/** The band's title when the thing has no name to show. */
		untitled: {
			lesson: 'Lesson',
			figure: 'Move',
			routine: 'Routine',
			drill: 'Drill',
			song: 'Song',
			position: 'Position'
		},
		noHistory: 'No such history',
		noChange: 'No such change',
		/** `title` is the clash sheet's title ("Ana changed this · 5 min ago"). */
		restoreClash: (title: string): string =>
			`${title}. Restore would undo that too, so it was not done.`,
		nameTaken: 'That name is taken now. Rename the other one first.'
	},
	/** Recently deleted: its rows' lines, and why a Restore was refused. */
	deleted: {
		head: (team: string): string => `Recently deleted · ${team}`,
		/** What each kind is called on its row. */
		kind: {
			video: 'Video',
			section: 'Section',
			link: 'Link',
			'spot-link': 'Section link',
			recording: 'Recording',
			lesson: 'Lesson',
			variation: 'Figure',
			routine: 'Routine',
			drill: 'Drill',
			song: 'Song',
			position: 'Position',
			'position-link': 'Position link'
		},
		/** "Ana · 5 min ago": who deleted it, and when. */
		by: (who: string, ago: string): string => `${who} · ${ago}`,
		/** `date` as `dayMonth` writes it. */
		purge: (date: string): string => `deleted for good on ${date}`,
		/** A restore refused because the name is now another's. */
		taken: (name: string): string => `${name} is taken; rename that one first`,
		emptyTitle: 'Nothing deleted',
		emptyBody:
			"What the group's editors delete or archive waits here. Videos, sections, links and recordings stay 30 days.",
		listLabel: 'Deleted, newest first',
		/** `kind` is one of `kind`'s words. */
		restoreLabel: (kind: string, label: string): string => `Restore ${kind} ${label}`,
		noLongerHere: 'That is no longer here.',
		untitledSong: 'Untitled song',
		couldNotRestore: 'That could not be restored.',
		/** Why a trash entry did not come back. */
		refused: {
			/** By the kind whose parent must come back first. */
			parentFirst: {
				section: 'Restore the video first',
				'spot-link': 'Restore the section first',
				'position-link': 'Restore the section or point first'
			},
			parentGone: 'What it was in is gone',
			purged: 'This was deleted for good.',
			restored: 'This is back already.',
			spotLinkAgain: 'That section was linked to it again since.',
			positionLinkAgain: 'It was linked to that position again since.',
			family: 'A copy of this is here already.',
			notFound: 'That is no longer there to restore.'
		}
	},
	/** The clash check's words: the clash sheet's title and its fields' names. */
	clash: {
		changedSince: 'This changed since you opened it',
		changedBy: (who: string): string => `${who} changed this`,
		changedByAgo: (who: string, ago: string): string => `${who} changed this · ${ago}`,
		deletedSince: 'This was deleted since you opened it',
		deletedBy: (who: string): string => `${who} deleted this`,
		deletedByAgo: (who: string, ago: string): string => `${who} deleted this · ${ago}`,
		staleRoutine: 'This routine changed; it now shows the latest',
		staleRoutineBy: (who: string): string => `${who} changed this routine; it now shows the latest`,
		/** A save that had to say what it saw, and did not. */
		missingSeen: 'This page is out of date. Reload it and try again.',
		/** What the clash sheet calls a field, by its form name. */
		field: {
			title: 'Title',
			lessonDay: 'Day of the class',
			notes: 'Notes',
			name: 'Name',
			figureName: 'Move name',
			partner: 'Partner',
			style: 'Style',
			startIds: 'Starts in',
			endIds: 'Ends in',
			// An older clash or History row's single end.
			endId: 'Ends in',
			startCount: 'Starts on count',
			startCounts: 'Can start on',
			lengthFree: 'Length set in the routine',
			lengthCounts: 'Length',
			comesBack: 'Comes back',
			active: 'Active',
			label: 'Name',
			startMs: 'Start',
			endMs: 'End'
		}
	},
	/** A group's What uses space (the list's words are `settings.storage`'s). */
	storage: {
		head: (team: string): string => `What uses space · ${team}`,
		askIntro: 'The admin sees how much the group uses. A note is optional.',
		waits:
			'A deleted video or recording waits 30 days in Recently deleted and still uses space until then.'
	},
	/** Group mode: the band's line and the Work in sheet. */
	mode: {
		/** Mine's line in the Work in sheet. */
		mineMeta: 'Your own space'
	}
};
