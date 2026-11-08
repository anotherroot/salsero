/**
 * A group's History, as words: one line per change ("Ana · changed the
 * notes", "Ana · moved 'Enchufla doble' 1.2 s"), and which lines offer
 * Restore. PURE and client-safe; the rows come from `server/changes.ts`.
 *
 * A row's `subject` is the thing a change was to (`section`, `link`, …) or,
 * for a change of one field, that field (`notes`); a change of several fields
 * at once names the thing (`lesson`, `variation`).
 *
 * The words are composed when a line is READ, in the reader's language
 * (`t().groups.history`), from the stored verb, subject and values: nothing
 * stored is words, so one row reads English to one editor and Slovenian to
 * another.
 */
import { t } from '$lib/i18n/catalog';
import type { ChangeRootKind, ChangeValues, HistoryRow } from '$lib/types';

/**
 * The fields History can put back: text and times. A change to anything else
 * (a partner, positions, the order of slots) shows without Restore.
 */
const RESTORABLE = new Set([
	'title',
	'lessonDay',
	'notes',
	'name',
	'figureName',
	'label',
	'startMs',
	'endMs',
	'note'
]);

const text = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
const quoted = (v: unknown) => (text(v) === null ? '' : ` '${text(v)}'`);
const count = (v: ChangeValues | null) => (typeof v?.count === 'number' ? v.count : 1);

/** A spot link's row marks a point (a spot with no end) with `point: 1`; older rows are sections. */
const linkedSpot = (v: ChangeValues | null): Spot => (v?.point ? 'point' : 'section');

type Spot = 'section' | 'point';
const spotOf = (subject: string): Spot => (subject === 'point' ? 'point' : 'section');

/** A word of one of History's tables, by a stored key; undefined for a key it does not have. */
function wordOf(table: Record<string, string>, key: string): string | undefined {
	return Object.hasOwn(table, key) ? table[key] : undefined;
}

/** "1.2", "2": seconds from milliseconds, to one decimal, no trailing ".0" (a comma in Slovenian). */
function seconds(ms: number): string {
	const s = Math.round(Math.abs(ms) / 100) / 10;
	return Number.isInteger(s) ? String(s) : t().common.decimal(s, 1);
}

/** A section's or a point's change: moved, its end moved, or renamed. */
function spotChange(row: HistoryRow): string {
	const w = t().groups.history;
	const b = row.before ?? {};
	const a = row.after ?? {};
	const label = text(a.label) ?? text(b.label);
	const spot = spotOf(row.subject);
	const moved = (key: 'startMs' | 'endMs') =>
		typeof a[key] === 'number' && typeof b[key] === 'number' && a[key] !== b[key]
			? (a[key] as number) - (b[key] as number)
			: null;
	const start = moved('startMs');
	if (start !== null) return w.moved(spot, label, seconds(start));
	const end = moved('endMs');
	if (end !== null) return w.movedEnd(spot, label, seconds(end));
	return label === null ? w.clearedName(spot) : w.named(spot, label);
}

/**
 * The word a subject is shown as, in the reader's language. Stored subjects
 * stay as written: a group's own figure_groups row is `figure` (shown
 * "move"), a figures row `variation` (shown "figure"); under any other root
 * `figure` is already a figure. A subject History has no word for shows as stored.
 */
export function historySubject(rootKind: ChangeRootKind, subject: string): string {
	const key =
		subject === 'variation'
			? 'figure'
			: subject === 'figure' && rootKind === 'figure'
				? 'move'
				: subject;
	return wordOf(t().groups.history.subject, key) ?? key;
}

function what(row: HistoryRow): string {
	const w = t().groups.history;
	const { verb, subject, before, after, rootKind } = row;
	const name = quoted(after?.name ?? before?.name);
	const shown = historySubject(rootKind, subject);
	const thing = wordOf(w.thing, subject);
	const field = wordOf(w.field, subject);
	switch (verb) {
		case 'add':
			if (subject === 'song') return w.addedSong(name);
			if (subject === rootKind) return w.made(shown);
			if (subject === 'variation' && text(after?.from) !== null) {
				return w.movedHere(name, text(after?.from)!);
			}
			if (subject === 'extract') return w.extracted(name);
			if (subject === 'slot' && count(after) > 1) return w.addedSlots(count(after));
			if (subject === 'section-link') return w.linked(linkedSpot(after), name);
			if (thing !== undefined) return w.added(thing);
			return w.addedThe(shown, name);
		case 'remove':
			if (subject === 'slot' && count(before) > 1) return w.removedSlots(count(before));
			if (subject === 'section-link') return w.unlinked(linkedSpot(before), name);
			if (thing !== undefined) return w.removed(thing);
			return w.removedThe(shown, name);
		case 'archive':
			return w.archived(shown, subject === rootKind ? '' : name);
		case 'publish':
			return w.published(shown);
		case 'share':
			return w.shared(shown, name);
		case 'unshare':
			return w.unshared(shown, name);
		case 'delete':
			return w.deleted(shown, name);
		case 'edit':
			return w.changed(field ?? shown);
		case 'restore':
			if ((subject === 'section' || subject === 'point') && before !== null) {
				return w.putBack(spotOf(subject), text(after?.label) ?? text(before.label));
			}
			if (subject === 'slot') return w.putBackSlots(count(after));
			if (field !== undefined) return w.restored(field);
			if (thing !== undefined) return w.restoredThing(thing);
			return w.restored(`${shown}${name}`);
		case 'change':
			if (subject === 'section' || subject === 'point') return spotChange(row);
			if (subject === 'order') return w.movedSlot;
			if (field !== undefined) return w.changed(field);
			return w.changed(`${shown}${subject === rootKind ? '' : name}`);
	}
}

/**
 * One History line: who, then what. `names` is the group's short names
 * (`shortNames`); someone missing from it reads as "Someone".
 */
export function historyLine(row: HistoryRow, names: ReadonlyMap<string, string>): string {
	return `${names.get(row.actorId) ?? t().groups.history.someone} · ${what(row)}`;
}

/** Whether History offers Restore: a change to text or times only, with what it was before. */
export function canRestore(row: HistoryRow): boolean {
	if (row.verb !== 'change' || row.before === null || row.subject === 'order') return false;
	const keys = Object.keys(row.before);
	return keys.length > 0 && keys.every((k) => RESTORABLE.has(k));
}

/** "Edited by Ana · 10 min ago". */
export function editedByLine(first: string, ago: string): string {
	return t().groups.history.editedBy(first, ago);
}

/** The refusal for a link to something archived since the picker opened. */
export function archivedByLine(first: string): string {
	return t().groups.history.archivedBy(first);
}

/**
 * What a change to text replaced, to show under its line beside Restore
 * ("Was: Bring water"). Null for anything else: a move already says how far.
 */
export function previousValue(row: HistoryRow): string | null {
	if (!canRestore(row) || row.subject === 'section' || row.subject === 'point') return null;
	const was = Object.values(row.before ?? {})
		.map((v) => (v === null ? '' : String(v)))
		.filter((v) => v !== '');
	return was.length === 0 ? t().groups.history.empty : was.join(' · ');
}
