/**
 * Keeping copies in step, as words (spec 2026-11-07, "The look"): the notice
 * under the version row (2A), the Sync sheet and a reader's Update mine (3A),
 * and Keep in step under the Versions list (4A, 4b A). PURE, client-safe.
 */
import type { MergeRow, StepLine, SyncSettings, SyncView } from '$lib/types';
import { plural } from '$lib/format';

const YOURS = 'Yours';

/** The notice's title, and its button. */
export const NOTICE_TITLE = 'Your copies don’t agree';
export const SYNC = 'Sync';
/** The ⋯ menu's item and the Versions list's footer. */
export const SYNC_MENU = 'Sync…';

/** The reader's sheet's button. */
export const UPDATE_MINE = 'Update mine';
export const SYNC_TO = 'Sync to';
/** Opened while nothing differs any more. */
export const NOTHING_DIFFERS = 'Your copies agree. Nothing to sync.';
export const SYNC_LOAD_FAILED = 'Sync could not be loaded. Try again.';
export const SYNC_SEND_FAILED = 'That could not be synced. Try again.';
/** A stale sheet's way out: the sheet is loaded again. */
export const LOAD_AGAIN = 'Load again';
/** The pick tiles of a row still open, under them. */
export const PICK_ONE = 'Pick one';
export const SHOW_ALL = 'Show all';
export const SHOW_LESS = 'Show less';

/** Keep in step: the level's title, its switch's meta, and the four options. */
export const KEEP_TITLE = 'Keep in step';
export const KEEP_SUB = 'Your edits go to the clubs, theirs come here';
/** Under a switch the person may not change (a club's copy they only read). */
export const KEEP_READ_ONLY = 'Only the club’s editors change this.';
export const KEEP_FAILED = 'That could not be saved. Try again.';

export type KeepOption = {
	key: 'names' | 'small' | 'sections' | 'media';
	label: string;
	meta: string | null;
};

export const KEEP_OPTIONS: readonly KeepOption[] = [
	{ key: 'names', label: 'Names', meta: null },
	{ key: 'small', label: 'Small removals', meta: 'Links, positions, songs' },
	{ key: 'sections', label: 'Sections and points', meta: 'Adding or removing them' },
	{ key: 'media', label: 'Recordings and videos', meta: 'A removal from yours can’t be undone' }
];

/** "Notes", "1 recording" → "notes", "1 recording"; with `article`, "1 recording" → "a recording". */
function fieldWords(fields: string[], article = false): string {
	return fields
		.map((f) => {
			if (article && /^1 /.test(f)) return `a ${f.slice(2)}`;
			return /^\d/.test(f) ? f : f.toLowerCase();
		})
		.join(', ');
}

/** "a", "a and b", "a, b and c"; "Yours" as "yours". */
function places(labels: string[]): string {
	const named = labels.map((l) => (l === YOURS ? 'yours' : l));
	if (named.length <= 1) return named.join('');
	return `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
}

/**
 * One line of the notice, for a copy (`StepLine`): "Intenziuci poletje 2026
 * changed timing", "Sreda 17:30 is behind yours: notes, 1 recording", "You
 * and Sreda 17:30 both changed notes", "Sreda 17:30 removed a recording".
 * `pageMine` false: the page is a club's copy, so it is "this one", and the
 * person's own copy is "your copy".
 */
export function noticeLine(line: StepLine, pageMine = true): string {
	const own = line.place === YOURS;
	const who = own ? 'Your copy' : line.place;
	switch (line.state) {
		case 'behind':
			return `${who} is behind ${pageMine ? 'yours' : 'this one'}: ${fieldWords(line.fields)}`;
		case 'changed':
			return `${who} changed ${fieldWords(line.fields)}`;
		case 'both': {
			const pair = pageMine
				? `You and ${line.place}`
				: `This copy and ${own ? 'yours' : line.place}`;
			return `${pair} both changed ${fieldWords(line.fields)}`;
		}
		case 'held':
			return `${who} ${line.how ?? 'changed'} ${fieldWords(line.fields, true)}`;
	}
}

/** Under the Versions list: "Keeps in step · names, small removals", or "Not kept in step". */
export function keepLine(s: SyncSettings): string {
	if (!s.on) return 'Not kept in step';
	const on = KEEP_OPTIONS.filter((o) => s[o.key]).map((o) => o.label.toLowerCase());
	return on.length > 0 ? `Keeps in step · ${on.join(', ')}` : 'Keeps in step';
}

/** The sheet's button: "Sync 3 copies". */
export function syncButton(n: number): string {
	return `Sync ${plural(n, 'copy', 'copies')}`;
}

/** The sheet's subtitle: "3 differences across 3 copies". */
export function syncSub(differences: number, copies: number): string {
	return `${plural(differences, 'difference', 'differences')} across ${plural(copies, 'copy', 'copies')}`;
}

/** Above a tile's value, the copies holding it: "Yours · Sreda 17:30". */
export function holdersLine(labels: string[]): string {
	return labels.join(' · ');
}

/**
 * Beside a row's label, who moved it: "Intenziuci poletje 2026 changed it",
 * "you added it", "you and Sreda 17:30 both changed it"; null when no copy is
 * known to have (copies never in step).
 */
export function changedBy(labels: string[], kind: 'field' | 'add' | 'remove'): string | null {
	if (labels.length === 0) return null;
	const verb = kind === 'add' ? 'added' : kind === 'remove' ? 'removed' : 'changed';
	const named = labels.map((l) => (l === YOURS ? 'you' : l));
	if (named.length === 1) return `${named[0]} ${verb} it`;
	const who = `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
	return `${who} ${named.length === 2 ? 'both ' : ''}${verb} it`;
}

/** A tile for "absent" in a field row: picking it removes the piece from the copies holding it. */
export function removeChoice(holding: string[]): string {
	return `Remove from ${places(holding)}`;
}

/** An add row's box: what a copy added goes to the copies without it. */
export function addBox(without: string[]): string {
	return `Add to ${places(without)} too`;
}

/** A remove row's box: what a copy removed goes from the copies still holding it. */
export function removeBox(holding: string[]): string {
	return `Remove from ${places(holding)} too`;
}

const MAX = 40;
const clip = (s: string, n = MAX) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const quoted = (s: string) => `“${clip(s.trim(), 60)}”`;

/**
 * Update mine's change, from what the person's copy holds to what lands:
 * "8 → 16 counts" (the parts and words both share left out), "added “Lead
 * with the frame.”" (text added at the end), "removed".
 */
export function changeText(from: string | null, to: string | null): string {
	if (to === null) return 'removed';
	if (from === null || from.trim() === '') return `added ${quoted(to)}`;
	if (to.startsWith(from) && to.length > from.length)
		return `added ${quoted(to.slice(from.length))}`;
	let a = from.split(' · ');
	let b = to.split(' · ');
	while (a.length > 1 && b.length > 1 && a[0] === b[0]) [a, b] = [a.slice(1), b.slice(1)];
	while (a.length > 1 && b.length > 1 && a.at(-1) === b.at(-1))
		[a, b] = [a.slice(0, -1), b.slice(0, -1)];
	let x = a.join(' · ').split(' ');
	let y = b.join(' · ').split(' ');
	const tail: string[] = [];
	while (x.length > 1 && y.length > 1 && x.at(-1) === y.at(-1)) {
		tail.unshift(x.at(-1)!);
		[x, y] = [x.slice(0, -1), y.slice(0, -1)];
	}
	const end = tail.length > 0 ? ` ${tail.join(' ')}` : '';
	return `${clip(x.join(' '))} → ${clip(y.join(' '))}${end}`;
}

/** Update mine's subtitle: "The club changed 2 things since you took it". */
export function updateSub(n: number): string {
	return `The club changed ${plural(n, 'thing', 'things')} since you took it`;
}

/** Under Update mine's changes, what of the person's own stays: "Your own change to the partner stays." */
export function staysLine(fields: string[]): string {
	const words = fields.map((f) => (/^\d/.test(f) ? f : `the ${f.toLowerCase()}`));
	const list =
		words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
	return words.length === 1
		? `Your own change to ${list} stays.`
		: `Your own changes to ${list} stay.`;
}

/** A copy a Sync could not land on: "Sreda 17:30: <why>". */
export function notSynced(place: string, message: string): string {
	return `${place}: ${message}`;
}

/**
 * One value of a field row, as its tile: the copies holding it, and what it
 * reads (`text`, from where long values part; `full`, the whole).
 */
export type SheetTile = {
	hash: string | null;
	who: string;
	text: string;
	full: string;
	absent: boolean;
};

/** A shared start shorter than this is shown whole. */
const SHARED = 60;

/**
 * Where long values that share their start part: the start of the line they
 * part in, else a word some way before it; 0 when they part early (or there
 * is one value), so they show whole.
 */
export function partFrom(texts: string[]): number {
	if (texts.length < 2) return 0;
	const first = texts[0];
	const min = Math.min(...texts.map((t) => t.length));
	let n = 0;
	while (n < min && texts.every((t) => t[n] === first[n])) n++;
	if (n < SHARED) return 0;
	const line = first.lastIndexOf('\n', n - 1) + 1;
	if (line > 0 && n - line <= SHARED) return line;
	return first.lastIndexOf(' ', n - 30) + 1;
}

/** A value from where it parts from the others: "…4 line up to them". */
export function shortText(text: string, at: number): string {
	return at > 0 ? `…${text.slice(at)}` : text;
}

/**
 * A row of the Sync sheet as it is drawn: `pick`, a tile per value (open
 * until one is picked); `box`, a piece one copy added or removed, ticked
 * landing `on` and unticked `off`; and, in Update mine, `change` (what lands
 * on the person's copy) and `stays` (their own change, kept).
 */
export type SheetRow =
	| { kind: 'pick'; key: string; label: string; by: string | null; tiles: SheetTile[] }
	| {
			kind: 'box';
			key: string;
			label: string;
			by: string | null;
			text: string;
			on: string | null;
			off: string | null;
	  }
	| { kind: 'change'; key: string; label: string; text: string }
	| { kind: 'stays'; key: string; label: string };

/** The sheet's rows from `syncView`'s, in order. Update mine reads them against the one target. */
export function sheetRows(view: SyncView): SheetRow[] {
	const names = new Map(view.members.map((m) => [m.id, m.label]));
	const labels = (ids: number[]) => ids.map((id) => names.get(id) ?? '');
	const own = view.mode === 'update' ? (view.targets[0]?.id ?? null) : null;
	const out: SheetRow[] = [];
	for (const r of view.rows) {
		const by = changedBy(
			labels(r.values.filter((v) => v.changed).flatMap((v) => v.holders)),
			r.kind
		);
		if (r.kind !== 'field') {
			const present = r.values.find((v) => v.hash !== null);
			const absent = r.values.find((v) => v.hash === null);
			const add = r.kind === 'add';
			out.push({
				kind: 'box',
				key: r.key,
				label: r.label,
				by,
				text: add
					? addBox(labels(absent?.holders ?? []))
					: removeBox(labels(present?.holders ?? [])),
				on: add ? (present?.hash ?? null) : null,
				off: add ? null : (present?.hash ?? null)
			});
			continue;
		}
		if (own !== null && r.pick !== undefined) {
			const mine = r.values.find((v) => v.holders.includes(own));
			const lands = r.values.find((v) => v.hash === r.pick);
			if (mine && lands && mine !== lands) {
				const text = changeText(mine.field?.show ?? null, lands.field?.show ?? null);
				out.push({ kind: 'change', key: r.key, label: r.label, text });
				continue;
			}
			if (mine && mine === lands) {
				if (mine.changed) out.push({ kind: 'stays', key: r.key, label: r.label });
				continue;
			}
		}
		const holding = r.values.filter((v) => v.hash !== null).flatMap((v) => v.holders);
		const at = partFrom(r.values.flatMap((v) => (v.field ? [v.field.show] : [])));
		out.push({
			kind: 'pick',
			key: r.key,
			label: r.label,
			by,
			tiles: r.values.map((v) => ({
				hash: v.hash,
				who: holdersLine(labels(v.holders)),
				text: v.field ? shortText(v.field.show, at) : removeChoice(labels(holding)),
				full: v.field ? v.field.show : removeChoice(labels(holding)),
				absent: v.field === null
			}))
		});
	}
	return out;
}

/** The person's choice per row: theirs, else the preselection; undefined while open. */
function choiceOf(r: MergeRow, picks: Record<string, string | null>): string | null | undefined {
	return Object.hasOwn(picks, r.key) ? picks[r.key] : r.pick;
}

/** The rows still open: the button waits for them. */
export function openKeys(rows: MergeRow[], picks: Record<string, string | null>): string[] {
	return rows.filter((r) => choiceOf(r, picks) === undefined).map((r) => r.key);
}

/** What the sheet posts: a pick for every row, so nothing lands that the person did not see. */
export function postPicks(
	rows: MergeRow[],
	picks: Record<string, string | null>
): Record<string, string | null> {
	const out: Record<string, string | null> = {};
	for (const r of rows) {
		const c = choiceOf(r, picks);
		if (c !== undefined) out[r.key] = c;
	}
	return out;
}
