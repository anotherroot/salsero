/**
 * A group's History, as words: one line per change ("Ana · changed the
 * notes", "Ana · moved 'Enchufla doble' 1.2 s"), and which lines offer
 * Restore. PURE and client-safe; the rows come from `server/changes.ts`.
 *
 * A row's `subject` is the thing a change was to (`section`, `link`, …) or,
 * for a change of one field, that field (`notes`); a change of several fields
 * at once names the thing (`lesson`, `variation`).
 */
import type { ChangeValues, HistoryRow } from '$lib/types';

/** "a section": what an add or a remove of a thing reads as. */
const A_THING: Record<string, string> = {
	video: 'a video',
	section: 'a section',
	point: 'a point',
	link: 'a link',
	recording: 'a recording',
	slot: 'a slot',
	option: 'an alternative',
	'section-link': 'a section link'
};

/** "the notes": what a change of one field reads as, by its key. */
const FIELD: Record<string, string> = {
	title: 'title',
	lessonDay: 'day',
	notes: 'notes',
	name: 'name',
	figureName: 'figure’s name',
	partner: 'partner',
	style: 'style',
	startIds: 'start positions',
	endId: 'end position',
	startCount: 'start count',
	lengthCounts: 'length',
	note: 'slot’s note'
};

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

/** "1.2", "2": seconds from milliseconds, to one decimal, no trailing ".0". */
function seconds(ms: number): string {
	return (Math.round(Math.abs(ms) / 100) / 10).toString();
}

/** A section's or a point's change: moved, its end moved, or renamed. */
function spotChange(row: HistoryRow): string {
	const b = row.before ?? {};
	const a = row.after ?? {};
	const label = text(a.label) ?? text(b.label);
	const it = label === null ? `a ${row.subject}` : `'${label}'`;
	const moved = (key: 'startMs' | 'endMs') =>
		typeof a[key] === 'number' && typeof b[key] === 'number' && a[key] !== b[key]
			? (a[key] as number) - (b[key] as number)
			: null;
	const start = moved('startMs');
	if (start !== null) return `moved ${it} ${seconds(start)} s`;
	const end = moved('endMs');
	if (end !== null) return `moved the end of ${it} ${seconds(end)} s`;
	return label === null
		? `cleared the name of a ${row.subject}`
		: `named a ${row.subject} '${label}'`;
}

function what(row: HistoryRow): string {
	const { verb, subject, before, after, rootKind } = row;
	const name = quoted(after?.name ?? before?.name);
	switch (verb) {
		case 'add':
			if (subject === rootKind) return `made the ${subject}`;
			if (subject === 'variation' && text(after?.from) !== null) {
				return `moved${name} here from '${text(after?.from)}'`;
			}
			if (subject === 'extract') return `made the routine${name} from its slots`;
			if (subject === 'slot' && count(after) > 1) return `added ${count(after)} slots`;
			if (subject === 'section-link')
				return name ? `linked a section to${name}` : 'linked a section';
			if (subject in A_THING) return `added ${A_THING[subject]}`;
			return `added the ${subject}${name}`;
		case 'remove':
			if (subject === 'slot' && count(before) > 1) return `removed ${count(before)} slots`;
			if (subject === 'section-link')
				return name ? `unlinked a section from${name}` : 'unlinked a section';
			if (subject in A_THING) return `removed ${A_THING[subject]}`;
			return `removed the ${subject}${name}`;
		case 'archive':
			return subject === rootKind ? `archived the ${subject}` : `archived the ${subject}${name}`;
		case 'publish':
			return `published the ${subject}`;
		case 'restore':
			if ((subject === 'section' || subject === 'point') && before !== null) {
				const label = text(after?.label) ?? text(before.label);
				return label === null ? `put a ${subject} back` : `put '${label}' back`;
			}
			if (subject === 'slot')
				return count(after) > 1 ? `put back ${count(after)} slots` : 'put back a slot';
			if (subject in FIELD) return `restored the ${FIELD[subject]}`;
			if (subject in A_THING) return `restored ${A_THING[subject]}`;
			return `restored the ${subject}${name}`;
		case 'change':
			if (subject === 'section' || subject === 'point') return spotChange(row);
			if (subject === 'order') return 'moved a slot';
			if (subject in FIELD) return `changed the ${FIELD[subject]}`;
			return `changed the ${subject}${subject === rootKind ? '' : name}`;
	}
}

/**
 * One History line: who, then what. `names` is the group's short names
 * (`shortNames`); someone missing from it reads as "Someone".
 */
export function historyLine(row: HistoryRow, names: ReadonlyMap<string, string>): string {
	return `${names.get(row.actorId) ?? 'Someone'} · ${what(row)}`;
}

/** Whether History offers Restore: a change to text or times only, with what it was before. */
export function canRestore(row: HistoryRow): boolean {
	if (row.verb !== 'change' || row.before === null || row.subject === 'order') return false;
	const keys = Object.keys(row.before);
	return keys.length > 0 && keys.every((k) => RESTORABLE.has(k));
}

/** "Edited by Ana · 10 min ago". */
export function editedByLine(first: string, ago: string): string {
	return `Edited by ${first} · ${ago}`;
}

/** The refusal for a link to something archived since the picker opened. */
export function archivedByLine(first: string): string {
	return `Archived by ${first}`;
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
	return was.length === 0 ? '(empty)' : was.join(' · ');
}
