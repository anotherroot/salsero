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

import { agoText } from '$lib/format';
import { t } from '$lib/i18n/catalog';

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
		/** Each option's length (spec 2026-11-11); only a slot that has any adds to the string. */
		lengths?: Record<number, number>;
	}[]
): string {
	const lengthsOf = (l: Record<number, number> | undefined) => {
		const pairs = Object.entries(l ?? {}).sort(([a], [b]) => Number(a) - Number(b));
		return pairs.length === 0 ? '' : `:${pairs.map(([id, n]) => `${id}=${n}`).join(',')}`;
	};
	const canonical = [...slots]
		.sort((a, b) => a.position - b.position)
		.map(
			(s) =>
				`${s.childRoutineId ?? ''}:${s.figureIds.join(',')}:${s.note ?? ''}${lengthsOf(s.lengths)}`
		)
		.join('|');
	return hash(`${slots.length}|${canonical}`);
}

/** "5 min ago": `format.ts`'s, shared with "Edited by" and History. */
export { agoText };

/**
 * The clash sheet's title: who changed it and when, once that is known.
 * Composed in the reader's language when the refusal is made (`t().groups.clash`).
 */
export function clashTitle(info: { by: string | null; at: number | null }, now: number): string {
	const w = t().groups.clash;
	if (info.by === null) return w.changedSince;
	return info.at === null ? w.changedBy(info.by) : w.changedByAgo(info.by, agoText(info.at, now));
}

/** A save on something deleted or archived since: who did it, once that is known. */
export function goneTitle(info: { by: string | null; at: number | null }, now: number): string {
	const w = t().groups.clash;
	if (info.by === null) return w.deletedSince;
	return info.at === null ? w.deletedBy(info.by) : w.deletedByAgo(info.by, agoText(info.at, now));
}

/**
 * A slot action aimed at a routine that changed since. The page has already
 * reloaded by the time this shows, so it says so.
 */
export function staleRoutine(by: string | null): string {
	const w = t().groups.clash;
	return by === null ? w.staleRoutine : w.staleRoutineBy(by);
}

/** What the clash sheet calls a field, by its form name; another key, capitalised. */
export function fieldLabel(key: string): string {
	const labels: Record<string, string> = t().groups.clash.field;
	return Object.hasOwn(labels, key) ? labels[key] : key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * How a field is shown in the clash sheet. Text (one line or many) and dates
 * get the editable box; times show both sides as times; anything else (a
 * choice, a list of positions) is only named, and Save mine keeps yours.
 */
export type FieldKind = 'text' | 'multiline' | 'date' | 'time' | 'other';

/**
 * A form field as the clash check sees it: the control under one name. `many`
 * is several controls under one name that are not one choice (a hidden input
 * per start position); `none`, no control at all.
 */
export type FieldShape =
	| { tag: 'input'; type: string }
	| { tag: 'textarea' }
	| { tag: 'select' }
	| { tag: 'radios' }
	| { tag: 'many' }
	| { tag: 'none' };

/** How the clash sheet shows a field of this shape. */
export function kindOfShape(shape: FieldShape): FieldKind {
	if (shape.tag === 'textarea') return 'multiline';
	if (shape.tag === 'input' && (shape.type === 'text' || shape.type === 'search')) return 'text';
	if (shape.tag === 'input' && shape.type === 'date') return 'date';
	return 'other';
}

/**
 * Whether a value from the server can be put back into a field of this shape.
 * Never a hidden input: one may be a single item of a list (a variation's one
 * start position), and writing "1,2" into it would save no list at all. Those
 * stay as they are, and the sheet names them.
 */
export function canPutBack(shape: FieldShape): boolean {
	if (shape.tag === 'input') return shape.type !== 'hidden' && shape.type !== 'file';
	return shape.tag === 'textarea' || shape.tag === 'select' || shape.tag === 'radios';
}

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
	/**
	 * The labels of changed fields the sheet cannot show side by side whose
	 * value Save mine keeps as yours: ones you edited, and ones that cannot be
	 * put back (a list of positions).
	 */
	others: string[];
	/**
	 * Changed fields you left as you found them, whose value is not in a box:
	 * Save mine puts theirs there first, so it never undoes their change.
	 */
	adopt: string[];
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
	format: (key: string, v: SeenValue) => string = (_, v) => shown(v),
	settable: (key: string) => boolean = () => true
): ClashView {
	const fields: ClashField[] = [];
	const others: string[] = [];
	const adopt: string[] = [];
	for (const key of info.changed) {
		const kind = kindOf(key);
		const edited = seen === null || !same(sent[key], seen[key]);
		if (kind === 'other') {
			if (!edited && settable(key)) adopt.push(key);
			else others.push(fieldLabel(key));
			continue;
		}
		const theirs = info.current[key] ?? null;
		const mine = edited ? (sent[key] ?? null) : theirs;
		const text = (v: SeenValue) => (kind === 'time' ? format(key, v) : shown(v));
		fields.push({ key, label: fieldLabel(key), kind, theirs: text(theirs), mine: text(mine) });
	}
	return { fields, others, adopt };
}

/**
 * What a save that went through leaves "seen" for the next one: the fields it
 * wrote, as the server answered them, and every other field as it was — the
 * screen still shows those, so the next save must not claim to have seen a
 * value it never showed.
 */
export function seenAfterSave(before: Seen, wrote: string[], answer: Seen): Seen {
	const out = { ...before };
	for (const key of wrote) out[key] = answer[key] ?? null;
	return out;
}

/**
 * Save mine on a record edited field by field (a section in the player): the
 * changed fields are sent with yours (a box's value where the sheet had one,
 * else what the screen shows), and so are `held`: your own edits queued
 * behind the clash. Everything else shows theirs. Keep theirs is the same
 * with no changed fields: only the held edits go.
 */
export function mineOverTheirs(
	info: Pick<ClashInfo, 'changed' | 'current'>,
	screen: Seen,
	boxes: Record<string, string>,
	held: string[] = []
): { send: Seen; show: Seen } {
	const send: Seen = {};
	for (const key of info.changed) send[key] = key in boxes ? boxes[key] : (screen[key] ?? null);
	// Your own edits that waited behind the clash, to fields that did not clash.
	for (const key of held) if (!(key in send)) send[key] = screen[key] ?? null;
	return { send, show: { ...info.current, ...send } };
}

/** Whether a refused save's data is the clash sheet's (a clash or gone), not the form's own message. */
export function isClash(data: unknown): boolean {
	return typeof data === 'object' && data !== null && ('clash' in data || 'gone' in data);
}
