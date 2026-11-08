/**
 * A group's History, as words: one line per change ("Ana · changed the
 * notes", "Ana · moved 'Enchufla doble' 1.2 s"), and which lines offer
 * Restore. PURE and client-safe; the rows come from `server/changes.ts`.
 *
 * A row's `subject` is the thing a change was to (`section`, `link`, …) or,
 * for a change of one field, that field (`notes`); a change of several fields
 * at once names the thing (`lesson`, `variation`).
 */
import type { ChangeRootKind, ChangeValues, HistoryRow } from '$lib/types';

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
	lengthCounts: 'length',
	note: 'slot’s note',
	artist: 'artist',
	anchors: 'count',
	tempoFactor: 'tempo',
	sampleStartS: 'sample start',
	practiceMode: 'practice',
	countBpm: 'practice tempo',
	comesBack: 'comes back',
	slots: 'slots'
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

/** A spot link's row marks a point (a spot with no end) with `point: 1`; older rows are sections. */
const linkedSpot = (v: ChangeValues | null) => (v?.point ? 'a point' : 'a section');

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

/**
 * The word a subject is shown as. Stored subjects stay as written: a group's
 * own figure_groups row is `figure` (shown "move"), a figures row `variation`
 * (shown "figure"); under any other root `figure` is already a figure.
 */
export function historySubject(rootKind: ChangeRootKind, subject: string): string {
	if (subject === 'variation') return 'figure';
	if (subject === 'figure' && rootKind === 'figure') return 'move';
	return subject;
}

function what(row: HistoryRow): string {
	const { verb, subject, before, after, rootKind } = row;
	const name = quoted(after?.name ?? before?.name);
	const shown = historySubject(rootKind, subject);
	switch (verb) {
		case 'add':
			if (subject === 'song') return `added the song${name}`;
			if (subject === rootKind) return `made the ${shown}`;
			if (subject === 'variation' && text(after?.from) !== null) {
				return `moved${name} here from '${text(after?.from)}'`;
			}
			if (subject === 'extract') return `made the routine${name} from its slots`;
			if (subject === 'slot' && count(after) > 1) return `added ${count(after)} slots`;
			if (subject === 'section-link') {
				const it = linkedSpot(after);
				return name ? `linked ${it} to${name}` : `linked ${it}`;
			}
			if (subject in A_THING) return `added ${A_THING[subject]}`;
			return `added the ${shown}${name}`;
		case 'remove':
			if (subject === 'slot' && count(before) > 1) return `removed ${count(before)} slots`;
			if (subject === 'section-link') {
				const it = linkedSpot(before);
				return name ? `unlinked ${it} from${name}` : `unlinked ${it}`;
			}
			if (subject in A_THING) return `removed ${A_THING[subject]}`;
			return `removed the ${shown}${name}`;
		case 'archive':
			return subject === rootKind ? `archived the ${shown}` : `archived the ${shown}${name}`;
		case 'publish':
			return `published the ${shown}`;
		case 'share':
			return `shared the ${shown}${name} with the class`;
		case 'unshare':
			return `stopped sharing the ${shown}${name}`;
		case 'delete':
			return `deleted the ${shown}${name}`;
		case 'edit':
			if (subject in FIELD) return `changed the ${FIELD[subject]}`;
			return `changed the ${shown}`;
		case 'restore':
			if ((subject === 'section' || subject === 'point') && before !== null) {
				const label = text(after?.label) ?? text(before.label);
				return label === null ? `put a ${shown} back` : `put '${label}' back`;
			}
			if (subject === 'slot')
				return count(after) > 1 ? `put back ${count(after)} slots` : 'put back a slot';
			if (subject in FIELD) return `restored the ${FIELD[subject]}`;
			if (subject in A_THING) return `restored ${A_THING[subject]}`;
			return `restored the ${shown}${name}`;
		case 'change':
			if (subject === 'section' || subject === 'point') return spotChange(row);
			if (subject === 'order') return 'moved a slot';
			if (subject in FIELD) return `changed the ${FIELD[subject]}`;
			return `changed the ${shown}${subject === rootKind ? '' : name}`;
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
