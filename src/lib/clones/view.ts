/**
 * The words of the clone and twin screens. PURE and client-safe: every
 * sentence a screen prints comes from here, so a spec can pin it.
 */
import type { CloneKind, FieldDiff, PlaceRef, Source, SwitchReport, TwinKind } from '$lib/types';
import { byteSize, dayMonth, plural } from '$lib/format';
import { localDay } from '$lib/day/day';
import { pieceParts, ROOT_KEYS, setPrefixOf } from './flat';
import { t } from '$lib/i18n/catalog';

/** "Salsa Tuesdays" → "Salsa Tuesdays’"; "Rueda club" → "Rueda club’s"; "CLASS" → "CLASS’". Trimmed. */
export function possessive(name: string): string {
	const n = name.trim();
	return /s$/i.test(n) ? `${n}’` : `${n}’s`;
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
export const makeMine = (): string => t().clones.makeMine;

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
		'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.',
	// Not its video links: those travel with their videos, and stay the group's.
	position: 'Its name, type, hold and notes, to change as you like.'
};

/** What the copy gives the person, per kind. */
export function youGet(kind: CloneKind): string {
	return GETS[kind];
}

/**
 * What stays the group's: a figure's recordings (ruling 5: Edit brings none);
 * a position's links from the group's lessons and videos. Null for the rest.
 */
export function staysTheirs(kind: CloneKind, team: string): { title: string; body: string } | null {
	const title = `STAYS ${possessive(team).toUpperCase()}`;
	if (kind === 'position')
		return {
			title,
			body: `The lessons and videos it was linked from. You see them in ${possessive(team)} tab.`
		};
	if (kind !== 'figure') return null;
	return {
		title,
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
 * copy."; a position's figures first: "Your Setenta · Con giro, tagged with
 * it, switches to your copy.", "Your 3 figures tagged with it switch to your
 * copy." Null when nothing of theirs uses it.
 */
export function switchNote(r: SwitchReport, practised: boolean): string | null {
	const parts: { text: string; many: boolean }[] = [];
	if (r.figures.length === 1)
		parts.push({ text: `your ${r.figures[0].label}, tagged with it,`, many: false });
	else if (r.figures.length > 1)
		parts.push({ text: `your ${r.figures.length} figures tagged with it`, many: true });
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
	// A part ending in its own comma ("…, tagged with it,") is followed by a space alone.
	const join = (list: string[], sep: string) =>
		list.reduce((out, t, i) => (i === 0 ? t : `${out}${out.endsWith(',') ? ' ' : sep}${t}`), '');
	let body: string;
	if (texts.length === 1) body = last;
	else if (texts.some((t) => t.includes(' and ')))
		// "Your routines A and B, and your practice of it, switch…"
		body = `${join(texts.slice(0, -1), ', ')}${texts.at(-2)!.endsWith(',') ? '' : ','} and ${last},`;
	else body = `${join(texts.slice(0, -1), ', ')} and ${last}`;
	const verb = parts.length === 1 && !parts[0].many ? 'switches' : 'switch';
	return `${body[0].toUpperCase()}${body.slice(1)} ${verb} to your copy.`;
}

/* ── Sources ────────────────────────────────────────────────────────────── */

const KIND_WORD: Record<CloneKind, string> = {
	figure: 'figure',
	routine: 'routine',
	drill: 'drill',
	song: 'song',
	lesson: 'lesson',
	position: 'position'
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
	{
		of: (k) => (setPrefixOf(k) === 'start' ? k : null),
		one: 'start position',
		many: 'start positions'
	},
	{ of: (k) => (setPrefixOf(k) === 'end' ? k : null), one: 'end position', many: 'end positions' },
	{ of: (k) => (setPrefixOf(k) === 'link' ? k : null), one: 'link', many: 'links' },
	{ of: (k) => (setPrefixOf(k) === 'fig' ? k : null), one: 'figure', many: 'figures' },
	{ of: (k) => (setPrefixOf(k) === 'routine' ? k : null), one: 'routine', many: 'routines' },
	{ of: (k) => (setPrefixOf(k) === 'drill' ? k : null), one: 'drill', many: 'drills' },
	{ of: (k) => (setPrefixOf(k) === 'pos' ? k : null), one: 'position', many: 'positions' }
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

/**
 * A landing refused: the receiving copy changed since it was read. Not shown
 * by itself: the flow tells nobody, and Sync says `SYNC_STALE` instead.
 */
export const STALE = 'Changed meanwhile; check it again.';

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

/** A sheet whose data did not come (Copy to…'s plan, Move to…'s preview). */
export const LOAD_FAILED = 'That could not be loaded. Try again.';

/* ── Copies you can see, and Send mine (board C3) ───────────────────────── */

/** The family list's heading. */
export const FAMILY_TITLE = 'Copies you can see';

/** The page's own row in the family list. */
export const THIS_ONE = 'This one';

/** A copy's chip against the page's row; none when in step (or for the page itself). */
export function statusChip(
	s: Source['status']
): { text: string; tone: 'neutral' | 'accent' | 'warn' } | null {
	switch (s) {
		case 'behind':
			return { text: 'Behind', tone: 'neutral' };
		case 'newer':
			return { text: 'Newer', tone: 'accent' };
		case 'differs':
			return { text: 'Differs', tone: 'warn' };
		default:
			return null;
	}
}

const ROLE_WORD = { owner: 'Owner', editor: 'Editor', member: 'Member' } as const;

const lower = (labels: string[]) => labels.map((l) => l.toLowerCase());

/**
 * A copy's line in the family list: the person's role in its group, then
 * where it stands against the page's row ("Owner · behind yours: notes, 1
 * recording", "Editor · differs both ways"). `page` is what the page's row
 * is called: "yours", or "this one" when the page is a group's.
 */
export function memberMeta(
	role: 'owner' | 'editor' | 'member' | null,
	status: Source['status'],
	changed: string[],
	page: 'yours' | 'this one' = 'yours'
): string {
	const parts: string[] = role ? [ROLE_WORD[role]] : [];
	const what = changed.length > 0 ? `: ${lower(changed).join(', ')}` : '';
	if (status === 'behind') parts.push(`behind ${page}${what}`);
	else if (status === 'newer') parts.push(`newer than ${page}${what}`);
	else if (status === 'differs') parts.push('differs both ways');
	else if (status === 'same') parts.push('in step');
	const line = parts.join(' · ');
	// The line's first word starts with a capital ("Behind this one: notes").
	return line === '' ? line : `${line[0].toUpperCase()}${line.slice(1)}`;
}

/** The page's own row: "This one · you changed notes, +1 recording". */
export function selfMeta(changed: string[]): string {
	return changed.length > 0 ? `${THIS_ONE} · you changed ${lower(changed).join(', ')}` : THIS_ONE;
}

const counted = (label: string) => /^\d/.test(label);

/**
 * What the page's row changed that a copy lacks (diffs from the page's side,
 * `mine` the page): root fields by label, then pieces and set members it
 * added ("+1 recording"), took away ("−1 recording"), or changed inside.
 */
export function ownChanges(diffs: FieldDiff[]): string[] {
	const isRoot = (d: FieldDiff) => (ROOT_KEYS as readonly string[]).includes(d.key);
	const added = diffs.filter((d) => !isRoot(d) && d.theirs === null && d.mine !== null);
	const gone = diffs.filter((d) => !isRoot(d) && d.mine === null);
	const rest = changedLabels(diffs.filter((d) => !added.includes(d) && !gone.includes(d)));
	return [
		...rest.filter((l) => !counted(l)),
		...changedLabels(added).map((l) => `+${l}`),
		...changedLabels(gone).map((l) => `−${l}`),
		...rest.filter(counted)
	];
}

/* ── Drop my copy (board C5) ────────────────────────────────────────────── */

export const DROP_TITLE = 'Drop your copy?';

/**
 * Under the title: where the person goes back to. `access` is the one
 * version's ('read': the class's, read-only); null when they pick among several.
 */
export function dropSub(access: 'read' | 'edit' | null): string {
	if (access === 'read')
		return 'You go back to the class’s version, read-only. Your copy is archived.';
	if (access === 'edit')
		return 'You go back to the group’s version, which you edit. Your copy is archived.';
	return 'You go back to the version you pick. Your copy is archived.';
}

/**
 * One version to go back to, named: "Your routines and practice will use
 * Salsa Tuesdays’ Setenta · Básico." Without practice when it cannot follow (R8).
 */
export function dropOne(place: string, label: string, follows = true): string {
	return `Your ${follows ? 'routines and practice' : 'routines'} will use ${possessive(place)} ${label}.`;
}

/**
 * What only the person's copy has (`changedLabels`): "Only in yours: your
 * notes and 1 recording. They go with your copy." When they edit the place
 * they go back to, it says so instead, beside Sync first. Null for nothing.
 */
export function onlyInYours(labels: string[], sendable: string | null = null): string | null {
	if (labels.length === 0) return null;
	const fields = lower(labels.filter((l) => !counted(l)));
	const what = listed([...fields, ...labels.filter(counted)]);
	const tail = sendable === null ? 'They go with your copy.' : `You edit ${sendable}.`;
	return `Only in yours: ${fields.length > 0 ? 'your ' : ''}${what}. ${tail}`;
}

/** Over the radios when there are several versions. */
export const USE_INSTEAD = 'Use instead';

/** The version the person's copy was made from. */
export const copiedHere = 'You copied it from here';

/**
 * A version the practice cannot follow onto: for a figure, routine or drill,
 * no lesson the person added holds it (R8), with the lesson Drop can add; for
 * a lesson or a song, it is a draft, which nothing can add.
 */
export function cantFollow(lesson: string | null, kind: CloneKind = 'figure'): string {
	if (kind === 'lesson' || kind === 'song')
		return 'Not published yet: your practice stays with your copy.';
	const line = 'Not in a lesson you added: your practice can’t follow';
	return lesson === null ? line : `${line} · ${addToo(lesson)}`;
}

/** The box under that version: ticked, Drop adds the lesson and practice follows. */
export function addToo(lesson: string): string {
	return `Add ${lesson} too`;
}

/**
 * A radio's line: copied from here, and whether practice can follow. With
 * the Add box showing under it (`boxShown`), the box names the lesson.
 */
export function dropChoiceMeta(
	c: { clonedFrom: boolean; practiceFollows: boolean; addLesson: { title: string } | null },
	boxShown: boolean,
	kind: CloneKind = 'figure'
): string | null {
	const parts: string[] = [];
	if (c.clonedFrom) parts.push(copiedHere);
	if (!c.practiceFollows)
		parts.push(cantFollow(boxShown ? null : (c.addLesson?.title ?? null), kind));
	return parts.length === 0 ? null : parts.join(' · ');
}

export const DROP_BUTTON = 'Drop my copy';
/** Sync from the copy before it goes, onto the version it goes back to (the Sync sheet, that one ticked). */
export const SYNC_FIRST = 'Sync first';

/** On the version's page once the copy is dropped. */
export function droppedToast(place: string): string {
	return `Back on ${possessive(place)}. Your copy is archived.`;
}

/** A drop that failed without a refusal's words. */
export const DROP_FAILED = 'That could not be dropped. Try again.';

/** The version picked is no longer one the person can go back to. */
export const DROP_GONE = 'That version can’t be used any more. Reload and pick again.';

/* ── Detach, and reconnecting (board C8) ────────────────────────────────── */

export const DETACH_BUTTON = 'Detach';

/**
 * The sheet's title: "Stop following Salsa Tuesdays?" for your own copy; a
 * group's row follows nobody (the others are its copies), so it is neutral.
 */
export function detachTitle(place: string, group = false): string {
	return group ? 'Detach from its copies?' : `Stop following ${place}?`;
}

/** What Detach does to your own copy. */
export const DETACH_MINE =
	'Your copy stays yours, as it is. It stays shown together with theirs, as twins.';

/** What it ends. */
export const DETACH_NO_MORE = 'No more “updated since”, and no Take theirs to hit by mistake.';

/** Under the title: what Detach is in a group, in the kind's noun. */
export function detachGroup(kind: CloneKind): string {
	return `In a group, Detach just makes it an ordinary group ${kind}.`;
}

/** A detach that failed. */
export const DETACH_FAILED = 'That could not be detached. Try again.';

/* ── Copy to… (board C4) ────────────────────────────────────────────────── */

/** The trigger under the tabs. */
export const COPY_TO = 'Copy to…';

/** The sheet's title: "Copy Week 3 to…". */
export function copyTitle(name: string): string {
	return `Copy ${name} to…`;
}

/** A lesson or song into a group, from your own: it lands as a draft. */
export const COPY_SUB_GROUP = 'The group gets a draft. You keep yours.';

/** Lands as a draft: a lesson or a song into a group. */
const asDraft = (kind: CloneKind, into: PlaceRef) =>
	into.kind === 'team' && (kind === 'lesson' || kind === 'song');

/**
 * Under the title, for the place picked: what the place gets, and that the
 * page's row stays (`fromMine`: it is yours).
 */
export function copySub(kind: CloneKind, into: PlaceRef, fromMine: boolean): string {
	const stays = fromMine ? 'You keep yours.' : 'This one stays as it is.';
	if (into.kind === 'mine') return `You get your own copy. ${stays}`;
	return `The group gets ${asDraft(kind, into) ? 'a draft' : 'a copy'}. ${stays}`;
}

/** A radio's name: the group's, or "Your app". */
export function placeLabel(place: PlaceRef): string {
	return place.kind === 'team' ? place.name : 'Your app';
}

/** "1 GB", not "1.0 GB" (or "1,0 GB" in Slovenian): a limit is a round number. */
const size = (bytes: number) => byteSize(bytes).replace(/[.,]0 GB$/, ' GB');

/** A radio's line: "Owner · 412 MB of 1 GB used"; your app has no role. */
export function placeMeta(
	role: 'owner' | 'editor' | null,
	used: number,
	limit: number | null
): string {
	const space = limit === null ? `${size(used)} used` : `${size(used)} of ${size(limit)} used`;
	return role ? `${ROLE_WORD[role]} · ${space}` : space;
}

export const WHAT_GOES = 'WHAT GOES';
export const ALREADY_THERE = 'ALREADY THERE';

/** What a copy brings, counted: the copies it makes, the files and their charge. */
export type GoesCounts = {
	kind: CloneKind;
	figures: number;
	positions: number;
	routines: number;
	drills: number;
	recordings: number;
	videos: number;
	/** A song's audio. */
	audio: boolean;
	bytes: number;
	/** The copied row has notes. */
	notes: boolean;
	into: PlaceRef;
};

/**
 * The grey card's line: "3 figures · 2 videos (420 MB, charged to the group)
 * · notes". The files' size rides on the last part that has files.
 */
export function whatGoes(g: GoesCounts): string {
	const parts: string[] = [];
	const count = (n: number, one: string, many: string) => {
		if (n > 0) parts.push(plural(n, one, many));
	};
	count(g.figures, 'figure', 'figures');
	count(g.positions, 'position', 'positions');
	count(g.routines, 'routine', 'routines');
	count(g.drills, 'drill', 'drills');
	count(g.recordings, 'recording', 'recordings');
	count(g.videos, 'video', 'videos');
	if (g.audio) parts.push('the audio');
	if (g.bytes > 0 && (g.recordings > 0 || g.videos > 0 || g.audio)) {
		const charge = g.into.kind === 'team' ? 'the group' : 'you';
		parts[parts.length - 1] += ` (${byteSize(g.bytes)}, charged to ${charge})`;
	}
	if (g.notes) parts.push('notes');
	if (parts.length === 0) return `Just the ${KIND_WORD[g.kind]}`;
	const line = parts.join(' · ');
	return `${line[0].toUpperCase()}${line.slice(1)}`;
}

/**
 * Something the copy uses that the place has already (`day` is when that
 * member was made, in the person's zone): "Enchufla · Doble: Salsa Tuesdays
 * has your copy from 3 Oct. It’s reused, not doubled." `yours` when the
 * person made that copy.
 */
export function alreadyLine(label: string, place: PlaceRef, day: string, yours: boolean): string {
	const when = dayMonth(day);
	const has =
		place.kind === 'mine'
			? `you have it already, from ${when}`
			: yours
				? `${place.name} has your copy from ${when}`
				: `${place.name} has it already, from ${when}`;
	return `${label}: ${has}. It’s reused, not doubled.`;
}

/** The sheet's button: "Copy as a draft" for a lesson or song into a group. */
export function copyButton(kind: CloneKind, into: PlaceRef): string {
	return asDraft(kind, into) ? 'Copy as a draft' : 'Copy';
}

/**
 * The place picked holds a member of the family already (spec point 9): it
 * stays as it is and the comparison opens; an archived one is restored first.
 */
export function existingNote(place: PlaceRef, archived: boolean): string {
	const who = place.kind === 'team' ? `${place.name} has` : 'You have';
	return archived
		? `${who} an archived copy. Restore it, then sync.`
		: `${who} it already. Sync the two copies.`;
}

export const RESTORE = 'Restore';

/** Once the copy has landed. */
export function copiedToast(into: PlaceRef, draft: boolean): string {
	if (into.kind === 'mine') return 'Copied to your app.';
	return `Copied to ${into.name}${draft ? ' as a draft' : ''}.`;
}

/** A copy that failed without a refusal's words. */
export const COPY_FAILED = 'That could not be copied. Try again.';

/** Which twin goes (board C4 p4): "Which Enchufla · Doble?" */
export function whichTitle(label: string): string {
	return `Which ${label}?`;
}

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "You see two versions of this figure. Which one goes to Salsa Tuesdays?" */
export function whichSub(kind: CloneKind, versions: number, place: string): string {
	const n = NUMBER_WORDS[versions] || String(versions);
	return `You see ${n} versions of this ${KIND_WORD[kind]}. Which one goes to ${place}?`;
}

/** A twin's radio: "Yours", "Rueda club’s". */
export function twinChoiceLabel(place: PlaceRef): string {
	return place.kind === 'team' ? possessive(place.name) : 'Yours';
}

/** A twin's line: "Last changed 30 Oct", the day in the person's zone. */
export function twinChoiceMeta(changedAt: number, tz: string): string {
	return `Last changed ${dayMonth(localDay(changedAt, tz))}`;
}

export const TWINS_ONE_GOES =
	'They’re twins in your app. Only one goes; the group never gets twins.';

export const CONTINUE = 'Continue';

/** The copied toast's action: the copy's page. */
export const OPEN = 'Open';

/* ── Move to… (board C4 p3) ─────────────────────────────────────────────── */

/** The trigger beside Copy to…, on the person's own lesson. */
export const MOVE_TO = 'Move to…';

/** The sheet's title: "Move Week 3 to Salsa Tuesdays". */
export function moveTitle(lesson: string, place: PlaceRef): string {
	return `Move ${lesson} to ${placeLabel(place)}`;
}

export const MOVE_SUB = 'The lesson lives in the group and leaves your lessons. What it brings:';
export const KEEP_MINE = 'Keep mine as well';
export const USE_GROUPS = 'Use the group’s';
export const MOVE_NOTE =
	'“Use the group’s”: your copy is dropped, and your other lessons and routines use the group’s.';
/** Under the note, when something dropped is practised (ruling 11: a draft can't be added). */
export const PRACTICE_STAYS = 'Your practice of what you drop stays with your archived copy.';
export const MOVE_BUTTON = 'Move as a draft';
export const ONLY_THIS_LESSON = 'Only this lesson';
export const YOU_PRACTISE = 'You practise it';

/**
 * Why a thing the lesson brings is kept by default, the first that applies:
 * "Used by 2 other lessons", "Used by Week 4 loop" (or "Used by 2 routines"),
 * "You practise it", else "Only this lesson".
 */
export function moveWhy(u: { lessons: number; routines: string[]; practised: boolean }): string {
	if (u.lessons > 0) return `Used by ${plural(u.lessons, 'other lesson', 'other lessons')}`;
	if (u.routines.length === 1) return `Used by ${u.routines[0]}`;
	if (u.routines.length > 1) return `Used by ${plural(u.routines.length, 'routine', 'routines')}`;
	return u.practised ? YOU_PRACTISE : ONLY_THIS_LESSON;
}

/** Once the move has landed, on the group's lesson. */
export function movedToast(place: string): string {
	return `Moved to ${place} as a draft.`;
}

/** A move that failed without a refusal's words. */
export const MOVE_FAILED = 'That could not be moved. Try again.';

/** The lesson changed since the Move sheet opened: what it offered is gone. */
export const MOVE_GONE = 'What the lesson brings has changed. Reload and choose again.';

/* ── Same as… (board C7 p1, p2) ─────────────────────────────────────────── */

export const SAME_AS = 'Same as…';

/** The sheet's title: "Enchufla · Doble is the same as…" */
export function sameAsTitle(label: string): string {
	return `${label} is the same as…`;
}

/** The note under the list: what twins are and are not. */
export function twinsNote(kind: TwinKind): string {
	return `Twins show as one ${KIND_WORD[kind]}. They never sync, and only you see the grouping.`;
}

export const TWINS_NOTE = twinsNote('figure');
export const MARK_SAME = 'Mark as the same';
export const SEPARATE = 'Not the same? Separate';

/** The sheet's search placeholder: "Search your routines". */
export function sameAsSearch(kind: TwinKind): string {
	return `Search your ${KIND_WORD[kind]}s`;
}

/** The sheet's empty line: "No other routines match." */
export function sameAsEmpty(kind: TwinKind): string {
	return `No other ${KIND_WORD[kind]}s match.`;
}

export const SAME_AS_SEARCH = sameAsSearch('figure');
export const SAME_AS_EMPTY = sameAsEmpty('figure');
export const SAME_AS_FAILED = 'That could not be saved. Try again.';

/** The Sync sheet's title: "Sync Enchufla · Doble". */
export function syncTitle(label: string): string {
	return `Sync ${label}`;
}

/** A reader's sheet: "Update from Salsa Tuesdays". */
export function updateTitle(place: string): string {
	return `Update from ${place}`;
}

/** A copy that changed while the Sync sheet was open: it is left as it is, and the sheet loads again. */
export const SYNC_STALE = 'Changed while you were syncing; check it again.';

/** A Sync sent with a row still open. */
export const SYNC_PICK = 'Pick a value where copies differ.';

/** A copy a Sync could not land on for a reason of its own (a missing file). */
export const SYNC_FAILED = 'That copy could not be synced. Try again.';

/** A ticked copy the person can no longer edit (their role changed during the Sync). */
export const SYNC_NO_ACCESS = 'You can no longer edit that copy.';

/** "Sync to": the page's own copy. */
export const SYNC_THIS_ONE = 'this one';
