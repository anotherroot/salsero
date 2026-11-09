// The Suggestions page: the AI's queue of actions the person runs or drops
// (docs/superpowers/plans/2026-11-09-ai-connector-2-queue.md), its row on You,
// and the words the server builds each card from (never the AI's own words alone).

export const suggestions = {
	title: 'Suggestions',
	/** The band's line: who suggests, and how many wait. */
	subtitle: (who: string, n: number): string => `${who} · ${n} waiting`,
	/** When no AI app is named. */
	theAi: 'Your AI',
	/** The row at the top of You. */
	youRow: 'AI suggestions',
	/** The You tab's name for a screen reader while suggestions wait. */
	tabLabel: (label: string): string => `${label}, AI suggestions waiting`,
	waiting: (n: number): string => `${n} waiting`,
	run: 'Run',
	runN: (n: number): string => `Run ${n}`,
	upToHere: 'Up to here',
	runGroup: 'Run group',
	runAll: (n: number): string => `Run all · ${n}`,
	drop: 'Drop',
	dropAll: 'Drop all',
	alsoDrop: (n: number): string =>
		n === 1 ? '1 more needs it. Drop it too?' : `${n} more need it. Drop them too?`,
	dropThemToo: 'Drop them too',
	cancel: 'Cancel',
	leftOut: 'left out',
	leaveOut: (what: string): string => `Leave out ${what}`,
	/** Someone (the AI) changed a card: `when` as agoText writes it. */
	changedBy: (who: string, when: string): string => `${who} changed this ${when}`,
	earlier: 'Earlier',
	doneToday: (n: number): string => `Done · ${n}`,
	undo: 'Undo',
	undone: 'Undone',
	ran: (n: number): string => (n === 1 ? '1 change made' : `${n} changes made`),
	waitsFor: (n: number): string => `Waits for ${n}`,
	needs: (n: number): string => `Needs ${n}`,
	publishWarning: "Can't be undone: the group sees it at once, and its drills go to their Today.",
	groupSees: (name: string): string => `${name} will see this`,
	empty: 'Nothing waiting. Ask your AI app to suggest something.',
	playSection: 'Play the section',
	/** A thing the queue makes, before it exists: "the section from 3". */
	madeBy: (n: number): string => `the new one from ${n}`,
	fields: {
		name: 'Name',
		notes: 'Notes',
		title: 'Title',
		label: 'Name',
		start_ms: 'Start',
		end_ms: 'End',
		slots: 'Slots',
		day: 'Day'
	},
	things: {
		move: 'move',
		figure: 'figure',
		routine: 'routine',
		drill: 'drill',
		lesson: 'lesson',
		position: 'position',
		section: 'section'
	},
	heading: {
		rename_move: (name: string): string => `Move ${name}`,
		edit_figure: (name: string): string => `Figure ${name}`,
		edit_routine: (name: string): string => `Routine ${name}`,
		edit_drill: (name: string): string => `Drill ${name}`,
		edit_lesson: (name: string): string => `Lesson ${name}`,
		edit_position: (name: string): string => `Position ${name}`,
		edit_section: (name: string): string => `Section ${name}`,
		add_section: (from: string, to: string, video: string): string =>
			`New section ${from}–${to} on ${video}`,
		link_section: (section: string, target: string): string => `Link ${section} to ${target}`,
		link_lesson: (thing: string, name: string, lesson: string): string =>
			`Add the ${thing} ${name} to ${lesson}`,
		publish_lesson: (name: string): string => `Publish ${name}`,
		create_figure: (name: string): string => `New figure ${name}`,
		create_drill: (name: string): string => `New drill ${name}`,
		create_routine: (name: string): string => `New routine ${name}`,
		create_position: (name: string): string => `New position ${name}`,
		create_lesson: (name: string): string => `New lesson ${name}`,
		archive: (thing: string, name: string): string => `Archive the ${thing} ${name}`,
		restore: (thing: string, name: string): string => `Restore the ${thing} ${name}`,
		unknown: 'A change this app does not know'
	},
	refusals: {
		changed: (fields: string): string =>
			`Changed since it was suggested (${fields}). Ask for a new suggestion.`,
		gone: 'It is no longer there, or no longer yours to change.',
		nameTaken: (name: string): string => (name ? `${name} is taken.` : 'That name is taken.'),
		notCustom: 'This drill takes its name from its lesson, figure or routine.',
		badSpan: "The section's times do not fit.",
		linked: 'The section is linked: undo the link first.',
		notGroup: "Only a group's lesson is published.",
		badSlot: 'A slot is not a figure you can use here.',
		notArchived: 'It is not archived.',
		cannotLink: 'These two cannot be linked.',
		waits: (n: number): string => `Waits for ${n}: run that first.`,
		dependsOn: (n: number): string => `Needs ${n}, which was dropped or refused.`,
		claudeChanged: 'This was changed while you were looking at it. Have a look again.',
		noUndo: 'This cannot be undone.',
		tooLate: 'Too late to undo.',
		failed: 'Something went wrong. Try again.'
	}
};
