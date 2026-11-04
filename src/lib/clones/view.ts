/**
 * The words of the clone and twin screens. PURE and client-safe: every
 * sentence a screen prints comes from here, so a spec can pin it.
 */
import type { CloneKind, FieldDiff, PlaceRef, SwitchReport } from '$lib/types';
import { byteSize, plural } from '$lib/format';
import { pieceParts, setPrefixOf } from './flat';

/** "Salsa Tuesdays" → "Salsa Tuesdays’"; "Rueda club" → "Rueda club’s". */
export function possessive(name: string): string {
	return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

/** A group's row in a person's own list: "Salsa Tuesdays’ · used as it is". */
export function usedAsIs(team: string): string {
	return `${possessive(team)} · used as it is`;
}

/** A group's move beside the person's own of the same name: "Enchufla · Salsa Tuesdays". */
export function moveHeading(move: string, team?: { name: string }): string {
	return team ? `${move} · ${team.name}` : move;
}

/** The note at the top of a group's figure page: where the member got it, and what that means. */
export function fromLessonNote(lesson: string, team: string): string {
	return `From ${lesson}. Use it in your routines as it is; it stays ${possessive(team)}.`;
}

/** The note under a person's own slots when some of them are a group's figures. */
export function groupSlotNote(figures: string[], team: string): string {
	const names =
		figures.length > 2
			? `${figures.slice(0, -1).join(', ')} and ${figures[figures.length - 1]}`
			: figures.join(' and ');
	const verb = figures.length === 1 ? 'is' : 'are';
	return `${names} ${verb} ${possessive(team)}. If you leave the group, you keep a copy and this routine keeps working.`;
}

/** One `groupSlotNote` per group whose figures the slots use, in slot order. */
export function groupSlotNotes(
	groupFigures: Record<number, { team: string; name: string }>,
	slotFigureIds: number[][]
): string[] {
	const byTeam = new Map<string, string[]>();
	for (const id of slotFigureIds.flat()) {
		const g = groupFigures[id];
		if (!g) continue;
		const names = byTeam.get(g.team) ?? [];
		if (!names.includes(g.name)) names.push(g.name);
		byTeam.set(g.team, names);
	}
	return [...byTeam].map(([team, names]) => groupSlotNote(names, team));
}

/* ── Make it mine ───────────────────────────────────────────────────────── */

/** The button that makes a class's thing the person's own (ruling 12: Make my own copy too). */
export const MAKE_MINE = 'Make it mine';

/** The sheet's title: "Make Setenta · Básico yours?". */
export function makeMineTitle(label: string): string {
	return `Make ${label} yours?`;
}

export const MAKE_MINE_SUB = 'Editing makes your own copy. The class’s stays as it is.';

/** The sheet's line when the person's own copy is archived: Make it mine brings it back. */
export const restoreLine = 'You had your own copy. Restore it?';

/** Make it mine on a class song whose copy the person archived: a person's song has no restore. */
export const ARCHIVED_SONG_COPY =
	'Your copy of this song is archived. Delete it in Settings → What uses space to make it yours again.';

export const YOU_GET = 'YOU GET';

const GETS: Record<CloneKind, string> = {
	// Ruling 3: no sections, they sit on recordings, which stay the group's.
	figure: 'Its name, timing, positions and notes, to change as you like.',
	routine: 'Its name, notes and slots, to change as you like.',
	drill: 'Its name, notes and practice, to change as you like.',
	song: 'Its title, artist and count, to change as you like.',
	lesson:
		'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.'
};

/** What the copy gives the person, per kind. */
export function youGet(kind: CloneKind): string {
	return GETS[kind];
}

/** What stays the group's: a figure's recordings (ruling 5: Edit brings none). Null for the rest. */
export function staysTheirs(kind: CloneKind, team: string): { title: string; body: string } | null {
	if (kind !== 'figure') return null;
	return {
		title: `STAYS ${possessive(team).toUpperCase()}`,
		body: 'Its recordings and their sections. You still see them inside yours, and can take one (it then counts against your space).'
	};
}

/** "A", "A and B", "A, B and C". */
function listed(names: string[]): string {
	return names.length > 1
		? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
		: (names[0] ?? '');
}

/**
 * The note before Make it mine: which of the person's own rows move onto the
 * copy. "Your routine Week 4 loop and your practice of it switch to your
 * copy." Null when nothing of theirs uses it.
 */
export function switchNote(r: SwitchReport, practised: boolean): string | null {
	const parts: { text: string; many: boolean }[] = [];
	const names = (one: string, many: string, list: string[]) => {
		if (list.length > 0)
			parts.push({
				text: `your ${list.length === 1 ? one : many} ${listed(list)}`,
				many: list.length > 1
			});
	};
	names(
		'routine',
		'routines',
		r.routines.map((x) => x.name)
	);
	names(
		'lesson',
		'lessons',
		r.lessons.map((x) => x.title)
	);
	if (r.sections === 1) parts.push({ text: 'your section', many: false });
	else if (r.sections > 1) parts.push({ text: `${r.sections} of your sections`, many: true });
	if (practised) parts.push({ text: 'your practice of it', many: false });
	if (parts.length === 0) return null;

	const texts = parts.map((p) => p.text);
	const last = texts[texts.length - 1];
	let body: string;
	if (texts.length === 1) body = last;
	else if (texts.some((t) => t.includes(' and ')))
		// "Your routines A and B, and your practice of it, switch…"
		body = `${texts.slice(0, -1).join(', ')}, and ${last},`;
	else body = `${texts.slice(0, -1).join(', ')} and ${last}`;
	const verb = parts.length === 1 && !parts[0].many ? 'switches' : 'switch';
	return `${body[0].toUpperCase()}${body.slice(1)} ${verb} to your copy.`;
}

/* ── Sources ────────────────────────────────────────────────────────────── */

const KIND_WORD: Record<CloneKind, string> = {
	figure: 'figure',
	routine: 'routine',
	drill: 'drill',
	song: 'song',
	lesson: 'lesson'
};

/**
 * The band's subtitle for a member of a family (boards C2, C3, C7): "Your
 * copy · from Salsa Tuesdays", "Salsa Tuesdays’ figure", "Yours · in 2
 * groups", "Twins · 3 versions"; null for the page's usual one. `clonedFrom`
 * is the place the row was copied from, when the person sees it; `groups`
 * how many groups they see a member in; `twins` how many other rows they
 * marked the same.
 */
export function cloneSubtitle(s: {
	self: PlaceRef;
	clonedFrom: string | null;
	groups: number;
	twins: number;
	kind: CloneKind;
}): string | null {
	if (s.self.kind === 'team') return `${possessive(s.self.name)} ${KIND_WORD[s.kind]}`;
	if (s.clonedFrom !== null) return `Your copy · from ${s.clonedFrom}`;
	if (s.groups > 0) return `Yours · in ${plural(s.groups, 'group', 'groups')}`;
	if (s.twins > 0) return `Twins · ${s.twins + 1} versions`;
	return null;
}

/** Which recording, video or section a key is about (a note is its recording's; links their section's). */
function pieceCounted(key: string, as: 'rec' | 'video' | 'spot'): string | null {
	const p = pieceParts(key);
	if (!p) return null;
	if (as === 'spot') {
		if (p.part === 'spot') return key;
		return p.part === 'links' ? key.slice(0, -':links'.length) : null;
	}
	return p.kind === as && (p.part === 'piece' || p.part === 'note') ? p.piece : null;
}

/** What `changedLabels` counts rather than names, in the order it lists them. */
const COUNTED: { of: (key: string) => string | null; one: string; many: string }[] = [
	{ of: (k) => pieceCounted(k, 'rec'), one: 'recording', many: 'recordings' },
	{ of: (k) => pieceCounted(k, 'video'), one: 'video', many: 'videos' },
	{ of: (k) => pieceCounted(k, 'spot'), one: 'section', many: 'sections' },
	{ of: (k) => (setPrefixOf(k) === 'link' ? k : null), one: 'link', many: 'links' },
	{ of: (k) => (setPrefixOf(k) === 'fig' ? k : null), one: 'figure', many: 'figures' },
	{ of: (k) => (setPrefixOf(k) === 'routine' ? k : null), one: 'routine', many: 'routines' },
	{ of: (k) => (setPrefixOf(k) === 'drill' ? k : null), one: 'drill', many: 'drills' }
];

/**
 * What differs, for the banner: root fields by their label ("Timing"), then
 * pieces and set members counted ("1 recording", "2 sections"). A
 * recording's note counts as its recording; a section's links as its section.
 */
export function changedLabels(diffs: { key: string; label: string }[]): string[] {
	const fields: string[] = [];
	const counts = COUNTED.map(() => new Set<string>());
	for (const d of diffs) {
		const at = COUNTED.findIndex((c) => c.of(d.key) !== null);
		if (at >= 0) counts[at].add(COUNTED[at].of(d.key)!);
		else if (!fields.includes(d.label)) fields.push(d.label);
	}
	return [
		...fields,
		...COUNTED.flatMap((c, i) =>
			counts[i].size > 0 ? [plural(counts[i].size, c.one, c.many)] : []
		)
	];
}

/** The note on a source's tab, opened from the person's copy (board C2 p2b). */
export function sourceNote(place: string): string {
	return `${possessive(place)} version, read-only. Take what you want into yours.`;
}

/** A source's recording, under its day: "12 MB · already in yours" or "New · 12 MB". */
export function recordingMeta(held: boolean, size: string): string {
	return held ? `${size} · already in yours` : `New · ${size}`;
}

/** The button that copies one of a source's recordings into the person's own figure. */
export const TAKE = 'Take';

/** Make it mine's line about room, when the copy brings files: "Uses 380 MB of your space". */
export function makeMineSize(bytes: number): string | null {
	return bytes > 0 ? `Uses ${byteSize(bytes)} of your space` : null;
}

/** Take refused: the person's copy holds that recording already. */
export const ALREADY_IN_YOURS = 'It is already in yours.';

/** Take refused: the recording went while the page was open. */
export const RECORDING_GONE = 'That recording is gone.';

/** A refused Take's banner title, in the recording's card. */
export const NOT_TAKEN = 'Not taken';

/** The tab switcher's name, for screen readers. */
export const VERSIONS = 'Versions';

/* ── Compare and Take theirs ────────────────────────────────────────────── */

/** The button on the banner that opens the comparison. */
export const COMPARE = 'Compare';

/**
 * The banner over your copy when its source changed since you took it
 * (board C2 p2): "Salsa Tuesdays changed it since you took it: timing, 1
 * recording". Names the place, not the person (ruling 10).
 */
export function changedLine(place: string, changed: string[]): string {
	return `${place} changed it since you took it: ${changed.map((c) => c.toLowerCase()).join(', ')}`;
}

/** The compare sheet's title: "Compare with Salsa Tuesdays’" ("Compare with yours" for your own). */
export function compareTitle(place: string): string {
	return place === 'Yours' ? 'Compare with yours' : `Compare with ${possessive(place)}`;
}

/** Under the title: since the pair's snapshot, or never in step (every difference a pick). */
export function compareSub(synced: boolean): string {
	return synced
		? 'Since you last took from it. Pick where both of you changed something.'
		: 'You were never in step with this one. Pick each difference.';
}

/** A difference's chip: who changed it since the two were in step, and how. */
export function diffTag(d: FieldDiff): string {
	if (d.side === 'both') return 'Both changed: pick';
	if (d.side === 'mine') return 'Only yours changed';
	if (d.mine === null) return 'New on theirs';
	if (d.theirs === null) return 'Gone from theirs';
	return 'Only theirs changed';
}

/** An option whose side lacks the thing (a recording only theirs has). */
export function absentLine(side: 'mine' | 'theirs'): string {
	return side === 'mine' ? 'Not in yours' : 'Not in theirs';
}

/** The compare sheet's button. */
export const TAKE_BUTTON = 'Take what’s picked';

/** A Take or Send refused: the receiving member changed since the sheet was opened. */
export const STALE = 'Changed since you opened this. Compare again.';

/** A Take or Send refused: a field both sides changed has no pick. */
export const PICK_BOTH = 'Pick yours or theirs where both changed.';

/** A name that would clash in the receiving move: "Doble is taken in Enchufla; rename one first." */
export function nameTaken(name: string, move: string): string {
	return `${name} is taken in ${move}; rename one first.`;
}

/** Closes a clone sheet without doing anything. */
export const CANCEL = 'Cancel';

/** A compare card's two options. */
export const YOURS = 'Yours';
export const THEIRS = 'Theirs';

/** What an option shows: the field's words, "(empty)" for nothing, or that its side lacks it. */
export function optionShow(field: { show: string } | null, side: 'mine' | 'theirs'): string {
	if (field === null) return absentLine(side);
	return field.show === '' ? '(empty)' : field.show;
}

/** The compare sheet when the two are in step after all (someone took or sent meanwhile). */
export const IN_STEP = 'Nothing differs any more.';

/** The compare sheet when its data did not come. */
export const COMPARE_FAILED = 'That comparison could not be loaded. Try again.';

/** A Take that failed without a refusal's words. */
export const TAKE_FAILED = 'That could not be taken. Try again.';
