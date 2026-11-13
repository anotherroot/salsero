// Copies of a group's things: Make it mine, Keep in step and Sync, Drop my copy,
// Detach, Copy to…, Move to…, twins and Versions. Part 2 Task 9 started it with
// the one word Groups needs; Task 11 added Make it mine, the sources, Sync, Keep
// in step, Drop and Detach; Task 12 Copy to…, Move to…, twins, Versions and the ⋯ menu.
import type { CloneKind } from '$lib/types';
import { possessive } from './figure';
import { plural } from './plural';

/** A kind's word in a sentence ("Just the drill", "Search your routines"). */
const KIND_WORD: Record<CloneKind, string> = {
	figure: 'figure',
	routine: 'routine',
	drill: 'drill',
	song: 'song',
	lesson: 'lesson',
	position: 'position'
};

/** A kind's word at the start of a name ("Position menu"). */
const KIND_NAME: Record<CloneKind, string> = {
	figure: 'Figure',
	position: 'Position',
	routine: 'Routine',
	drill: 'Drill',
	song: 'Song',
	lesson: 'Lesson'
};

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "A", "A and B", "A, B and C". */
const listed = (names: string[]): string =>
	names.length > 1
		? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
		: (names[0] ?? '');

/** What Make it mine's note is told: the person's rows that move onto the copy. */
export type SwitchParts = {
	/** A position's: the person's figures tagged with it, by label. */
	figures: string[];
	routines: string[];
	lessons: string[];
	sections: number;
	practised: boolean;
};

export const clones = {
	/** The button that makes a class's thing the person's own (ruling 12: Make my own copy too). */
	makeMine: 'Make it mine',
	/** A group's row in a person's own list: "Salsa Tuesdays’ · used as it is". */
	usedAsIs: (team: string): string => `${possessive(team)} · used as it is`,
	/** The note at the top of a group's figure page: where the member got it, and what that means. */
	fromLessonNote: (lesson: string, team: string): string =>
		`From ${lesson}. Use it in your routines as it is; it stays ${possessive(team)}.`,
	/** The note under a person's own slots when some of them are a group's figures. */
	groupSlotNote: (figures: string[], team: string): string => {
		const verb = figures.length === 1 ? 'is' : 'are';
		return `${listed(figures)} ${verb} ${possessive(team)}. If you leave the group, you keep a copy and this routine keeps working.`;
	},
	mine: {
		/** The sheet's title: "Make Setenta · Básico yours?". */
		title: (label: string): string => `Make ${label} yours?`,
		sub: 'Editing makes your own copy. The class’s stays as it is.',
		/** The sheet's line when the person's own copy is archived: Make it mine brings it back. */
		restore: 'You had your own copy. Restore it?',
		/** Make it mine on a class song whose copy the person archived: a person's song has no restore. */
		archivedSong:
			'Your copy of this song is archived. Delete it in Settings → What uses space to make it yours again.',
		youGet: 'YOU GET',
		/** What the copy gives the person, per kind. */
		gets: {
			// Ruling 3: no sections, they sit on recordings, which stay the group's.
			figure: 'Its name, timing, positions and notes, to change as you like.',
			routine: 'Its name, notes and slots, to change as you like.',
			drill: 'Its name, notes and practice, to change as you like.',
			song: 'Its title, artist and count, to change as you like.',
			lesson:
				'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.',
			// Not its video links: those travel with their videos, and stay the group's.
			position: 'Its name, type, hold and notes, to change as you like.'
		},
		/** What stays the group's: its title, and the body per kind. */
		staysTitle: (team: string): string => `STAYS ${possessive(team).toUpperCase()}`,
		staysPosition: (team: string): string =>
			`The lessons and videos it was linked from. You see them in ${possessive(team)} tab.`,
		staysFigure:
			'Its recordings and their sections. You still see them inside yours, and can take one (it then counts against your space).',
		/** "Uses 380 MB of your space"; `size` is written already. */
		size: (size: string): string => `Uses ${size} of your space`,
		/**
		 * The note before Make it mine: which of the person's own rows move onto the
		 * copy. "Your routine Week 4 loop and your practice of it switch to your
		 * copy."; a position's figures first: "Your Setenta · Con giro, tagged with
		 * it, switches to your copy.", "Your 3 figures tagged with it switch to your
		 * copy." Null when nothing of theirs uses it.
		 */
		switchNote: (r: SwitchParts): string | null => {
			const parts: { text: string; many: boolean }[] = [];
			if (r.figures.length === 1)
				parts.push({ text: `your ${r.figures[0]}, tagged with it,`, many: false });
			else if (r.figures.length > 1)
				parts.push({ text: `your ${r.figures.length} figures tagged with it`, many: true });
			const names = (one: string, many: string, list: string[]) => {
				if (list.length > 0)
					parts.push({
						text: `your ${list.length === 1 ? one : many} ${listed(list)}`,
						many: list.length > 1
					});
			};
			names('routine', 'routines', r.routines);
			names('lesson', 'lessons', r.lessons);
			if (r.sections === 1) parts.push({ text: 'your section', many: false });
			else if (r.sections > 1) parts.push({ text: `${r.sections} of your sections`, many: true });
			if (r.practised) parts.push({ text: 'your practice of it', many: false });
			if (parts.length === 0) return null;

			const texts = parts.map((p) => p.text);
			const last = texts[texts.length - 1];
			// A part ending in its own comma ("…, tagged with it,") is followed by a space alone.
			const join = (list: string[], sep: string) =>
				list.reduce(
					(out, t, i) => (i === 0 ? t : `${out}${out.endsWith(',') ? ' ' : sep}${t}`),
					''
				);
			let body: string;
			if (texts.length === 1) body = last;
			else if (texts.some((t) => t.includes(' and ')))
				// "Your routines A and B, and your practice of it, switch…"
				body = `${join(texts.slice(0, -1), ', ')}${texts.at(-2)!.endsWith(',') ? '' : ','} and ${last},`;
			else body = `${join(texts.slice(0, -1), ', ')} and ${last}`;
			const verb = parts.length === 1 && !parts[0].many ? 'switches' : 'switch';
			return `${body[0].toUpperCase()}${body.slice(1)} ${verb} to your copy.`;
		},
		/** A refusal that came without its words, and a request that failed. */
		refused: 'That copy could not be made.',
		failed: 'That copy could not be made. Try again.',
		/** The button's name while the copy is being made. */
		busy: 'Making it yours'
	},
	/** The band's subtitle and the source tabs (Take a recording). */
	sources: {
		/** "Salsa Tuesdays’ figure": `kind` is the row's kind. */
		team: (team: string, kind: CloneKind): string => `${possessive(team)} ${kind}`,
		copyFrom: (place: string): string => `Your copy · from ${place}`,
		inGroups: (n: number): string => `Yours · in ${plural(n, 'group', 'groups')}`,
		/** `n` is every version, this one included. */
		// `kind` is for languages whose word for "versions" is the kind's own (Slovenian).
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		twins: (n: number, kind: CloneKind): string => `Twins · ${n} versions`,
		/** The note on a source's tab, opened from the person's copy (board C2 p2b). */
		note: (place: string): string =>
			`${possessive(place)} version, read-only. Take what you want into yours.`,
		/** A source's recording, under its day; `size` is written already. */
		held: (size: string): string => `${size} · already in yours`,
		new: (size: string): string => `New · ${size}`,
		/** The button that copies one of a source's recordings into the person's own figure. */
		take: 'Take',
		/** Take refused: the person's copy holds that recording already. */
		alreadyInYours: 'It is already in yours.',
		/** Take refused: the recording went while the page was open. */
		recordingGone: 'That recording is gone.',
		/** A refused Take's banner title, in the recording's card. */
		notTaken: 'Not taken'
	},
	/** What `changedLabels` counts rather than names (the rest are nouns' words). */
	counted: {
		starts: (n: number): string => plural(n, 'start position', 'start positions'),
		ends: (n: number): string => plural(n, 'end position', 'end positions')
	},
	/** What the Sync sheet calls a field the other areas have no word for. */
	field: {
		practice: 'Practice',
		day: 'Day',
		artist: 'Artist',
		count: 'Count',
		sample: 'Sample',
		sections: 'Sections',
		musicStart: 'Music start',
		audio: 'Audio',
		slots: 'Slots',
		note: 'Note',
		sectionLinks: 'Section links'
	},
	/** What a field holds, as the Sync sheet shows it (`trees.ts`; never compared). */
	value: {
		countAt: (bpm: string): string => `Count · ${bpm} BPM`,
		toASong: 'To a song',
		noPractice: 'None',
		taps: (n: number): string => plural(n, 'tap', 'taps'),
		automatic: 'Automatic',
		from: (at: string): string => `From ${at}`,
		noSections: 'None',
		sections: (n: number): string => plural(n, 'section', 'sections'),
		asFound: 'As found',
		startsAt: (at: string): string => `Starts at ${at}`
	},
	/** The refusals of a landing (Sync, Take). */
	refusal: {
		/**
		 * A landing refused: the receiving copy changed since it was read. Not shown
		 * by itself: the flow tells nobody, and Sync says `syncStale` instead.
		 */
		stale: 'Changed meanwhile; check it again.',
		/** A landing refused: a field both sides changed has no pick. */
		pickBoth: 'Pick yours or theirs where both changed.',
		/** A name that would clash in the receiving move: "Doble is taken in Enchufla; rename one first." */
		nameTaken: (name: string, move: string): string =>
			`${name} is taken in ${move}; rename one first.`,
		/** A sheet whose data did not come (Copy to…'s plan, Move to…'s preview). */
		loadFailed: 'That could not be loaded. Try again.'
	},
	/** Drop my copy (board C5). */
	drop: {
		title: 'Drop your copy?',
		/** Under the title, by the one version's access; `pick` when there are several. */
		subRead: 'You go back to the class’s version, read-only. Your copy is archived.',
		subEdit: 'You go back to the group’s version, which you edit. Your copy is archived.',
		subPick: 'You go back to the version you pick. Your copy is archived.',
		/** "Your routines and practice will use Salsa Tuesdays’ Setenta · Básico." */
		one: (place: string, label: string, follows: boolean): string =>
			`Your ${follows ? 'routines and practice' : 'routines'} will use ${possessive(place)} ${label}.`,
		/** A radio's title: the version's place. */
		place: (place: string): string => possessive(place),
		/** "Only in yours: your notes and 1 recording." `fields` is lowercased already. */
		onlyInYours: (fields: string[], counted: string[]): string =>
			`Only in yours: ${fields.length > 0 ? 'your ' : ''}${listed([...fields, ...counted])}.`,
		goesWithCopy: 'They go with your copy.',
		youEdit: (place: string): string => `You edit ${place}.`,
		/** Over the radios when there are several versions. */
		useInstead: 'Use instead',
		/** The version the person's copy was made from. */
		copiedHere: 'You copied it from here',
		/** A lesson's or song's version that is a draft: nothing can add it. */
		draft: 'Not published yet: your practice stays with your copy.',
		/** A figure's, routine's or drill's version no lesson the person added holds (R8). */
		cantFollow: 'Not in a lesson you added: your practice can’t follow',
		/** The box under that version: ticked, Drop adds the lesson and practice follows. */
		addToo: (lesson: string): string => `Add ${lesson} too`,
		button: 'Drop my copy',
		/** Sync from the copy before it goes, onto the version it goes back to. */
		syncFirst: 'Sync first',
		/** On the version's page once the copy is dropped. */
		toast: (place: string): string => `Back on ${possessive(place)}. Your copy is archived.`,
		/** A drop that failed without a refusal's words. */
		failed: 'That could not be dropped. Try again.',
		/** The version picked is no longer one the person can go back to. */
		gone: 'That version can’t be used any more. Reload and pick again.',
		busy: 'Dropping your copy'
	},
	/** Detach (board C8). */
	detach: {
		button: 'Detach',
		/** "Stop following Salsa Tuesdays?" for your own copy. */
		title: (place: string): string => `Stop following ${place}?`,
		/** A group's row follows nobody (the others are its copies). */
		titleGroup: 'Detach from its copies?',
		mine: 'Your copy stays yours, as it is, on its own. To still show it with theirs, use Same as…',
		noMore: 'No more “updated since”, and no Take theirs to hit by mistake.',
		/** Under the title: what Detach is in a group, in the kind's noun. */
		group: (kind: CloneKind): string =>
			`In a group, Detach just makes it an ordinary group ${kind}.`,
		failed: 'That could not be detached. Try again.',
		busy: 'Detaching'
	},
	/** Keeping copies in step: the notice, the Sync sheet and Update mine (spec 2026-11-07). */
	sync: {
		/** The person's own copy, where the server labels it 'Yours'. */
		yours: 'Yours',
		/** The notice's title, and its button. */
		noticeTitle: 'Your copies don’t agree',
		/** The version row while Keep in step's changes are on their way, over its "Also: …". */
		sending: (n: number): string => `Sending to ${n === 1 ? '1 copy' : `${n} copies`}…`,
		/** Then, for a moment, once they went and the copies agree. */
		sent: (n: number): string => (n === 1 ? 'Copy updated' : 'Copies updated'),
		sync: 'Sync',
		/** The ⋯ menu's item and the Versions list's footer. */
		menu: 'Sync…',
		/** The reader's sheet's button. */
		updateMine: 'Update mine',
		syncTo: 'Sync to',
		/** Opened while nothing differs any more. */
		nothingDiffers: 'Your copies agree. Nothing to sync.',
		loadFailed: 'Sync could not be loaded. Try again.',
		sendFailed: 'That could not be synced. Try again.',
		/** A stale sheet's way out: the sheet is loaded again. */
		loadAgain: 'Load again',
		/** The pick tiles of a row still open, under them. */
		pickOne: 'Pick one',
		showAll: 'Show all',
		showLess: 'Show less',
		/** The sheet's title: "Sync Enchufla · Doble". */
		title: (label: string): string => `Sync ${label}`,
		/** A reader's sheet: "Update from Salsa Tuesdays". */
		updateTitle: (place: string): string => `Update from ${place}`,
		/** A copy that changed while the Sync sheet was open. */
		stale: 'Changed while you were syncing; check it again.',
		/** A Sync sent with a row still open. */
		pick: 'Pick a value where copies differ.',
		/** A copy a Sync could not land on for a reason of its own (a missing file). */
		failed: 'That copy could not be synced. Try again.',
		/** A ticked copy the person can no longer edit (their role changed during the Sync). */
		noAccess: 'You can no longer edit that copy.',
		/** "Sync to": the page's own copy, and the person's role in a copy's group. */
		thisOne: 'this one',
		role: { owner: 'owner', editor: 'editor', member: 'member' },
		/** The sheet's button: "Sync 3 copies". */
		button: (n: number): string => `Sync ${plural(n, 'copy', 'copies')}`,
		/** The sheet's subtitle: "3 differences across 3 copies". */
		sub: (differences: number, copies: number): string =>
			`${plural(differences, 'difference', 'differences')} across ${plural(copies, 'copy', 'copies')}`,
		/** Above a tile's value, the copies holding it: "Yours · Sreda 17:30". */
		holders: (labels: string[]): string => labels.join(' · '),
		/** The person's own copy in a list of places, and who moved a row. */
		placeYours: 'yours',
		you: 'you',
		/** "a", "a and b", "a, b and c". */
		places: (labels: string[]): string => listed(labels),
		/** Beside a row's label: "Intenziuci poletje 2026 changed it", "you and Sreda 17:30 both changed it". */
		changedBy: (names: string[], kind: 'field' | 'add' | 'remove'): string => {
			const verb = kind === 'add' ? 'added' : kind === 'remove' ? 'removed' : 'changed';
			if (names.length === 1) return `${names[0]} ${verb} it`;
			return `${listed(names)} ${names.length === 2 ? 'both ' : ''}${verb} it`;
		},
		/** A tile for "absent": picking it removes the piece from the copies holding it. */
		removeChoice: (places: string): string => `Remove from ${places}`,
		/** An add row's box, and a remove row's. */
		addBox: (places: string): string => `Add to ${places} too`,
		removeBox: (places: string): string => `Remove from ${places} too`,
		/** Update mine's change: "removed", "added “Lead with the frame.”". */
		removed: 'removed',
		added: (quoted: string): string => `added ${quoted}`,
		quote: (text: string): string => `“${text}”`,
		/** Update mine's subtitle: "The club changed 2 things since you took it". */
		updateSub: (n: number): string =>
			`The club changed ${plural(n, 'thing', 'things')} since you took it`,
		/** "Your own change to the partner stays."; `fields` as the sheet labels them. */
		stays: (fields: string[]): string => {
			const words = fields.map((f) => (/^\d/.test(f) ? f : `the ${f.toLowerCase()}`));
			return words.length === 1
				? `Your own change to ${listed(words)} stays.`
				: `Your own changes to ${listed(words)} stay.`;
		},
		/** Update mine when the club has nothing the reader's copy lacks: "Nothing new from Sreda 17:30". */
		nothingNew: (place: string): string => `Nothing new from ${place}`
	},
	/**
	 * The notice's lines (`noticeLine`): "Intenziuci poletje 2026 changed timing",
	 * "Sreda 17:30 is behind yours: notes, 1 recording". `fields` is written
	 * already ("notes, 1 recording"); `pageMine` false: the page is a club's copy.
	 */
	notice: {
		yourCopy: 'Your copy',
		behind: (who: string, pageMine: boolean, fields: string): string =>
			`${who} is behind ${pageMine ? 'yours' : 'this one'}: ${fields}`,
		changed: (who: string, fields: string): string => `${who} changed ${fields}`,
		/** `place` as the line has it; `own` when it is the person's own copy. */
		both: (place: string, own: boolean, pageMine: boolean, fields: string): string =>
			`${pageMine ? `You and ${place}` : `This copy and ${own ? 'yours' : place}`} both changed ${fields}`,
		held: (who: string, how: 'added' | 'removed' | null, fields: string): string =>
			`${who} ${how ?? 'changed'} ${fields}`,
		/** A held line names one piece without its count: "1 recording" → "a recording". */
		one: (noun: string): string => `a ${noun}`
	},
	/** Keep in step: the level's title, its switch's meta, the four options and the Versions line. */
	keep: {
		title: 'Keep in step',
		sub: 'Your edits go to the clubs, theirs come here',
		/** Under a switch the person may not change (a club's copy they only read). */
		readOnly: 'Only the club’s editors change this.',
		failed: 'That could not be saved. Try again.',
		options: {
			names: { label: 'Names' },
			small: { label: 'Small removals', meta: 'Links, positions, songs' },
			sections: { label: 'Sections and points', meta: 'Adding or removing them' },
			media: { label: 'Recordings and videos', meta: 'A removal from yours can’t be undone' }
		},
		/** Under the Versions list: "Keeps in step · names, small removals", or "Not kept in step". */
		off: 'Not kept in step',
		on: 'Keeps in step',
		onWith: (options: string): string => `Keeps in step · ${options}`
	},
	/** Whose version (spec 2026-11-06): the row at the top of a family page and the Versions list. */
	versions: {
		title: 'Versions',
		/** Before the row's count, for screen readers. */
		count: 'Versions:',
		/** The person's own copy, where the server labels it 'Yours' ("Yours 2" for a second one). */
		yours: 'Yours',
		/** The family list's heading. */
		familyTitle: 'Copies you can see',
		/** The page's own row in the family list. */
		thisOne: 'This one',
		/** The row's title: "Your version", "Sreda 17:30’s version". */
		yourVersion: 'Your version',
		placeVersion: (place: string): string => `${possessive(place)} version`,
		/** Who else has it: "Also: Sreda 17:30, Yours"; `others` is joined already. */
		also: (others: string): string => `Also: ${others}`,
		twin: 'Marked the same',
		/** A copy's chip against the page's row. */
		chip: { behind: 'Behind', newer: 'Newer', differs: 'Differs' },
		/** A role in a group, as the Versions list and Copy to… show it. */
		role: { owner: 'Owner', editor: 'Editor', member: 'Member' },
		/** Where a copy stands against the page's row; `what` is ": notes, 1 recording" or empty. */
		behind: (pageMine: boolean, what: string): string =>
			`behind ${pageMine ? 'yours' : 'this one'}${what}`,
		newer: (pageMine: boolean, what: string): string =>
			`newer than ${pageMine ? 'yours' : 'this one'}${what}`,
		differs: 'differs both ways',
		same: 'in step',
		/** The page's own row: "This one · you changed notes, +1 recording"; `changed` is lowercased already. */
		selfChanged: (changed: string): string => `This one · you changed ${changed}`
	},
	/** Copy to… (board C4). */
	/** Link from other places: the Copy and link card over a group's picker. */
	copyHere: {
		title: (label: string, into: string): string => `Copy ${label} into ${into}?`,
		/** `from` null: the person's own app. */
		lead: (from: string | null): string =>
			`It comes in as a clone of ${from === null ? 'yours' : `the one in ${from}`}, so the two can be kept in step. Then it is linked here.`,
		comes: 'Comes along',
		behind: 'Stays behind',
		/** What links to the source from lesson videos, never copied. */
		sections: (n: number): string =>
			n === 1 ? '1 section from a lesson video' : `${n} sections from lesson videos`,
		sectionsOrPoints: (n: number): string =>
			n === 1
				? '1 section or point from a lesson video'
				: `${n} sections or points from lesson videos`,
		sameName: (into: string, label: string, from: string | null): string =>
			`${into} has its own ${label}, not a copy of ${from === null ? 'yours' : `the one in ${from}`}.`,
		/** The family's member here is archived. */
		archived: 'It was here before and is archived. Restore it and link it.',
		copyAndLink: 'Copy and link',
		restoreAndLink: 'Restore and link',
		linkGroups: "Link the group's one",
		copyAnyway: 'Copy anyway',
		done: 'Copied and linked',
		failed: 'It could not be copied here and linked. Nothing was copied.',
		/** Copy and use: a group's field pickers (a figure's positions, a routine's slots). */
		leadUse: (from: string | null): string =>
			`It comes in as a clone of ${from === null ? 'yours' : `the one in ${from}`}, so the two can be kept in step. Then it is used here.`,
		archivedUse: 'It was here before and is archived. Restore it and use it.',
		copyAndUse: 'Copy and use',
		restoreAndUse: 'Restore and use',
		useGroups: "Use the group's one",
		doneUse: 'Copied',
		failedUse: 'It could not be copied here. Nothing was copied.'
	},
	copy: {
		/** The ⋯ menu's item. */
		menu: 'Copy to…',
		/** The sheet's title: "Copy Week 3 to…". */
		title: (name: string): string => `Copy ${name} to…`,
		/** Under the title: what the place gets, then whether the page's row is the person's. */
		sub: (gets: 'mine' | 'draft' | 'copy', fromMine: boolean): string => {
			const stays = fromMine ? 'You keep yours.' : 'This one stays as it is.';
			if (gets === 'mine') return `You get your own copy. ${stays}`;
			return `The group gets ${gets === 'draft' ? 'a draft' : 'a copy'}. ${stays}`;
		},
		/** A radio's name for the person's own app. */
		yourApp: 'Your app',
		/** A radio's line: "Owner · 412 MB of 1 GB used"; the role and sizes written already. */
		placeMeta: (role: string | null, used: string, limit: string | null): string => {
			const space = limit === null ? `${used} used` : `${used} of ${limit} used`;
			return role ? `${role} · ${space}` : space;
		},
		whatGoes: 'WHAT GOES',
		alreadyThere: 'ALREADY THERE',
		/** What goes besides the counted copies. */
		audio: 'the audio',
		notes: 'notes',
		/** After the files' part: " (420 MB, charged to the group)"; `size` written already. */
		charged: (size: string, team: boolean): string =>
			` (${size}, charged to ${team ? 'the group' : 'you'})`,
		/** Nothing goes but the row: "Just the drill". */
		just: (kind: CloneKind): string => `Just the ${KIND_WORD[kind]}`,
		/**
		 * Something the copy uses that the place has already: "Enchufla · Doble:
		 * Salsa Tuesdays has your copy from 3 Oct. It’s reused, not doubled."
		 * `place` null: the person's own app; `when` written already.
		 */
		already: (label: string, place: string | null, when: string, yours: boolean): string => {
			const has =
				place === null
					? `you have it already, from ${when}`
					: yours
						? `${place} has your copy from ${when}`
						: `${place} has it already, from ${when}`;
			return `${label}: ${has}. It’s reused, not doubled.`;
		},
		button: 'Copy',
		/** A lesson or song into a group. */
		buttonDraft: 'Copy as a draft',
		/** The place holds a member already (`place` null: the person's own app). */
		existing: (place: string | null, archived: boolean): string => {
			const who = place !== null ? `${place} has` : 'You have';
			return archived
				? `${who} an archived copy. Restore it, then sync.`
				: `${who} it already. Sync the two copies.`;
		},
		restore: 'Restore',
		/** Once the copy has landed (`place` null: the person's own app). */
		toast: (place: string | null, draft: boolean): string =>
			place === null ? 'Copied to your app.' : `Copied to ${place}${draft ? ' as a draft' : ''}.`,
		failed: 'That could not be copied. Try again.',
		/** The copied toast's action: the copy's page. */
		open: 'Open'
	},
	/** The chip on a row that has clones (copies of it, in your app or a group's), as Twins marks a twin. */
	cloneChip: 'Clone',
	/** Twins: Copy to…'s and Move to…'s question, Same as…, the chip and a picker's meta (board C7). */
	twins: {
		/** The chip on a row that stands for its twins. */
		chip: 'Twins',
		/** Which twin goes (board C4 p4): "Which Enchufla · Doble?" */
		whichTitle: (label: string): string => `Which ${label}?`,
		/** "You see two versions of this figure. Which one goes to Salsa Tuesdays?" */
		whichSub: (kind: CloneKind, versions: number, place: string): string => {
			const n = NUMBER_WORDS[versions] || String(versions);
			return `You see ${n} versions of this ${KIND_WORD[kind]}. Which one goes to ${place}?`;
		},
		/** A twin's place: "Yours", "Rueda club’s". */
		mine: 'Yours',
		team: (team: string): string => possessive(team),
		/** A twin's line: "Last changed 30 Oct"; the day written already. */
		changed: (day: string): string => `Last changed ${day}`,
		oneGoes: 'They’re twins in your app. Only one goes; the group never gets twins.',
		continue: 'Continue',
		/** A twin behind a picker row, by its place: "Salsa Tuesdays’ Básica", "your Setenta · Basic". */
		named: (what: string, team: string | null): string =>
			team === null ? `your ${what}` : `${possessive(team)} ${what}`,
		/**
		 * A twinned picker row's meta: "Yours, twin of Salsa Tuesdays’ Básica · yours
		 * is used"; without the person's own member, `theirs[0]` is the used row's
		 * group: "Salsa Tuesdays’, twin of Rueda club’s Doble · Salsa Tuesdays’ is used".
		 */
		useMeta: (theirs: string[], mine: boolean): string => {
			if (mine) return `Yours, twin of ${theirs.join(', ')} · yours is used`;
			const [used, ...rest] = theirs;
			const whose = possessive(used);
			return `${whose}, twin of ${rest.join(', ')} · ${whose} is used`;
		},
		/** The ⋯ menu's item. */
		sameAs: 'Same as…',
		/** The sheet's title: "Enchufla · Doble is the same as…" */
		sameAsTitle: (label: string): string => `${label} is the same as…`,
		/** The note under the list: what twins are and are not. */
		note: (kind: CloneKind): string =>
			`Twins show as one ${KIND_WORD[kind]}. They never sync, and only you see the grouping.`,
		markSame: 'Mark as the same',
		separate: 'Not the same? Separate',
		/** The sheet's search placeholder: "Search your routines". */
		search: (kind: CloneKind): string => `Search your ${KIND_WORD[kind]}s`,
		/** The sheet's empty line: "No other routines match." */
		empty: (kind: CloneKind): string => `No other ${KIND_WORD[kind]}s match.`,
		failed: 'That could not be saved. Try again.'
	},
	/** Move to… (board C4 p3). */
	move: {
		/** The ⋯ menu's item, on the person's own lesson. */
		menu: 'Move to…',
		/** The sheet's title: "Move Week 3 to Salsa Tuesdays". */
		title: (lesson: string, place: string): string => `Move ${lesson} to ${place}`,
		sub: 'The lesson lives in the group and leaves your lessons. What it brings:',
		keepMine: 'Keep mine as well',
		useGroups: 'Use the group’s',
		note: '“Use the group’s”: your copy is dropped, and your other lessons and routines use the group’s.',
		/** Under the note, when something dropped is practised (ruling 11: a draft can't be added). */
		practiceStays: 'Your practice of what you drop stays with your archived copy.',
		button: 'Move as a draft',
		/** Why a thing the lesson brings is kept by default. */
		onlyThisLesson: 'Only this lesson',
		youPractise: 'You practise it',
		usedByLessons: (n: number): string => `Used by ${plural(n, 'other lesson', 'other lessons')}`,
		usedByRoutine: (routine: string): string => `Used by ${routine}`,
		usedByRoutines: (n: number): string => `Used by ${plural(n, 'routine', 'routines')}`,
		/** Once the move has landed, on the group's lesson. */
		toast: (place: string): string => `Moved to ${place} as a draft.`,
		failed: 'That could not be moved. Try again.',
		/** The lesson changed since the Move sheet opened: what it offered is gone. */
		gone: 'What the lesson brings has changed. Reload and choose again.'
	},
	/** The ⋯ button's name: "Position menu". */
	menuLabel: (kind: CloneKind): string => `${KIND_NAME[kind]} menu`,
	/** A picker's section of a group's rows the person may use: "Salsa Tuesdays’". */
	groupRows: (team: string): string => possessive(team)
};
