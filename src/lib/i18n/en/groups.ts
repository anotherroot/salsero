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
		handOverFirst: 'Hand the group over before you leave it.'
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
		removeBody: 'They leave the group and keep copies of what they had.'
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
	}
};
