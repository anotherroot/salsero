/**
 * The clash check's pure half: what a save saw, what changed since, a
 * routine's fingerprint, and the clash sheet's words. Client-safe.
 *
 * A save carries the VALUES its editor saw (`Seen`), never a version number:
 * the player's 0.1 s nudges would clash with their own previous nudge
 * whenever a response is slow (risk 11). The server compares what was seen
 * with what is stored now; a field that differs was changed by someone else
 * (or by the same person on another device), and the save is refused rather
 * than silently writing over it.
 *
 * The keys of a form's `Seen` are the form's own field names, so the clash
 * sheet can put a value back into the field it came from.
 */

export type SeenValue = string | number | null;
export type Seen = Record<string, SeenValue>;

/**
 * What the server answers a refused save with: a clash (someone else saved
 * this since; `current` is their version), or gone (deleted or archived
 * since). `by` and `at` say who and when, once History knows; null until then.
 */
export type ClashInfo = { changed: string[]; current: Seen; by: string | null; at: number | null };
export type GoneInfo = { by: string | null; at: number | null };

/** null and '' are both "empty"; a number and its digits are the same value. */
function same(a: SeenValue | undefined, b: SeenValue | undefined): boolean {
	const text = (v: SeenValue | undefined) => (v === null || v === undefined ? '' : String(v));
	return text(a) === text(b);
}

/** The fields of `seen` whose value is not what `current` holds now, in `seen`'s order. */
export function changedFields(seen: Seen, current: Seen): string[] {
	return Object.keys(seen).filter((k) => !same(seen[k], current[k]));
}

/** A value read back from JSON, if it is one a `Seen` may hold. */
export function isSeenValue(v: unknown): v is SeenValue {
	return v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
}

/** A parsed `seen`, or null when it is not an object of plain values. */
export function asSeen(raw: unknown): Seen | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const out: Seen = {};
	for (const [k, v] of Object.entries(raw)) {
		if (!isSeenValue(v)) return null;
		out[k] = v;
	}
	return out;
}

/** cyrb53: a 53-bit string hash, plenty to tell two routine states apart. */
function hash(text: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 2654435761);
		h2 = Math.imul(h2 ^ c, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * A routine's slots as one short string: their order, what each holds (its
 * embedded routine or its figures, main first) and its note. Any slot action
 * changes it, so a slot action carrying an older one was aimed at a routine
 * that is no longer on anyone's screen.
 */
export function routineFingerprint(
	slots: {
		position: number;
		childRoutineId: number | null;
		figureIds: number[];
		note?: string | null;
	}[]
): string {
	const canonical = [...slots]
		.sort((a, b) => a.position - b.position)
		.map((s) => `${s.childRoutineId ?? ''}:${s.figureIds.join(',')}:${s.note ?? ''}`)
		.join('|');
	return hash(`${slots.length}|${canonical}`);
}

/** "5 min ago", from two epoch-ms instants. */
export function agoText(at: number, now: number): string {
	const min = Math.floor(Math.max(0, now - at) / 60_000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min ago`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h} h ago`;
	const d = Math.floor(h / 24);
	return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** The clash sheet's title: who changed it and when, once that is known. */
export function clashTitle(info: { by: string | null; at: number | null }, now: number): string {
	if (info.by === null) return 'This changed since you opened it';
	return info.at === null
		? `${info.by} changed this`
		: `${info.by} changed this · ${agoText(info.at, now)}`;
}

/** A save on something deleted or archived since: who did it, once that is known. */
export function goneTitle(info: { by: string | null; at: number | null }, now: number): string {
	if (info.by === null) return 'This was deleted since you opened it';
	return info.at === null
		? `${info.by} deleted this`
		: `${info.by} deleted this · ${agoText(info.at, now)}`;
}

/** A slot action aimed at a routine that changed since: "Ana changed this routine". */
export function staleRoutine(by: string | null): string {
	return by === null ? 'This routine changed since you opened it' : `${by} changed this routine`;
}

/** What the clash sheet calls a field, by its form name. */
const FIELD_LABELS: Record<string, string> = {
	title: 'Title',
	lessonDay: 'Day of the class',
	notes: 'Notes',
	name: 'Name',
	figureName: 'Figure name',
	partner: 'Partner',
	style: 'Style',
	startIds: 'Starts from',
	endId: 'Ends in',
	startCount: 'Starts on count',
	lengthCounts: 'Length',
	everyDays: 'How often',
	active: 'Active',
	label: 'Name',
	startMs: 'Start',
	endMs: 'End'
};

export function fieldLabel(key: string): string {
	return FIELD_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * How a field is shown in the clash sheet. Text (one line or many) and dates
 * get the editable box; times show both sides as times; anything else (a
 * choice, a list of positions) is only named, and Save mine keeps yours.
 */
export type FieldKind = 'text' | 'multiline' | 'date' | 'time' | 'other';

export interface ClashField {
	key: string;
	label: string;
	kind: Exclude<FieldKind, 'other'>;
	theirs: string;
	/**
	 * What the "Yours" box starts with: what you typed — or theirs, when you
	 * left this field as you found it, so Save mine never undoes a change you
	 * did not make.
	 */
	mine: string;
}

export interface ClashView {
	fields: ClashField[];
	/** The labels of changed fields the sheet cannot show side by side. */
	others: string[];
}

const shown = (v: SeenValue | undefined) => (v === null || v === undefined ? '' : String(v));

/**
 * The clash sheet's rows: each changed field, theirs and yours. `sent` is
 * what the refused save carried, `seen` what it saw (null when it sent none).
 * `format` turns a time into words; other values show as they are.
 */
export function clashView(
	info: Pick<ClashInfo, 'changed' | 'current'>,
	sent: Seen,
	seen: Seen | null,
	kindOf: (key: string) => FieldKind,
	format: (key: string, v: SeenValue) => string = (_, v) => shown(v)
): ClashView {
	const fields: ClashField[] = [];
	const others: string[] = [];
	for (const key of info.changed) {
		const kind = kindOf(key);
		if (kind === 'other') {
			others.push(fieldLabel(key));
			continue;
		}
		const theirs = info.current[key] ?? null;
		const edited = seen === null || !same(sent[key], seen[key]);
		const mine = edited ? (sent[key] ?? null) : theirs;
		const text = (v: SeenValue) => (kind === 'time' ? format(key, v) : shown(v));
		fields.push({ key, label: fieldLabel(key), kind, theirs: text(theirs), mine: text(mine) });
	}
	return { fields, others };
}

/** Whether a refused save's data is the clash sheet's (a clash or gone), not the form's own message. */
export function isClash(data: unknown): boolean {
	return typeof data === 'object' && data !== null && ('clash' in data || 'gone' in data);
}
