/**
 * A member of a family (one thing copied into several places), flattened into
 * a map of field keys, so two members compare key by key (`diff.ts`).
 * PURE and client-safe.
 *
 * Key grammar:
 * - Root fields, one key each: `name`, `notes`, `partner`, `style`, `timing`,
 *   `positions` (figure); `practice` (drill); `title`, `artist`, `count`,
 *   `sample` (song); `title`, `day` (lesson); `slots` (routine: the whole slot
 *   list is one field, since slots have no identity of their own).
 * - Set members, one key each, value `'1'`: `link:<url>` (a row's URL links),
 *   `fig:<ref>`, `routine:<ref>`, `drill:<ref>` (a lesson's hand links).
 * - Pieces: `rec:<g>` and `video:<g>` (presence; the value is the piece's media
 *   kind and size), `rec:<g>:note`, `<piece>:spot:<s>` (value
 *   `start|end|label`), `<piece>:spot:<s>:links` (the section's links, sorted
 *   refs). A piece travels or goes whole: its parts are compared only while
 *   both sides have it.
 * - `<ref>`, `<g>` and `<s>` are the row's gene, or `#<id>` when it has none.
 *   Neither contains a colon.
 */

/** The root fields, in the order a comparison lists them. */
export const ROOT_KEYS = [
	'name',
	'notes',
	'partner',
	'style',
	'timing',
	'positions',
	'practice',
	'title',
	'day',
	'artist',
	'count',
	'sample',
	'slots'
] as const;

const ROOT_LABELS: Record<string, string> = {
	name: 'Name',
	notes: 'Notes',
	partner: 'Partner',
	style: 'Style',
	timing: 'Timing',
	positions: 'Positions',
	practice: 'Practice',
	title: 'Title',
	day: 'Day',
	artist: 'Artist',
	count: 'Count',
	sample: 'Sample',
	slots: 'Slots'
};

/** The set members' prefixes, in the order a comparison lists them. */
export const SET_PREFIXES = ['link', 'fig', 'routine', 'drill'] as const;

const SET_LABELS: Record<string, string> = {
	link: 'Link',
	fig: 'Figure',
	routine: 'Routine',
	drill: 'Drill'
};

const PIECE_LABELS: Record<string, string> = { rec: 'Recording', video: 'Video' };

const PIECE = /^((rec|video):[^:]+)(?::(.*))?$/;
const SPOT = /^spot:[^:]+$/;
const SPOT_LINKS = /^spot:[^:]+:links$/;

/** What part of a piece a key is, or null when the key is no piece's. */
export function pieceParts(
	key: string
): { piece: string; kind: string; part: 'piece' | 'note' | 'spot' | 'links' } | null {
	const m = PIECE.exec(key);
	if (!m) return null;
	const [, piece, kind, rest] = m;
	if (rest === undefined) return { piece, kind, part: 'piece' };
	if (rest === 'note' && kind === 'rec') return { piece, kind, part: 'note' };
	if (SPOT.test(rest)) return { piece, kind, part: 'spot' };
	if (SPOT_LINKS.test(rest)) return { piece, kind, part: 'links' };
	return null;
}

/** The `rec:<g>` / `video:<g>` a key belongs to, else null. */
export function pieceOf(key: string): string | null {
	return pieceParts(key)?.piece ?? null;
}

/** The set prefix of a key (`link`, `fig`, `routine`, `drill`), else null. */
export function setPrefixOf(key: string): string | null {
	const i = key.indexOf(':');
	if (i < 1) return null;
	const prefix = key.slice(0, i);
	return Object.hasOwn(SET_LABELS, prefix) && key.length > i + 1 ? prefix : null;
}

/** What the compare sheet calls a field. Throws on a key outside the grammar. */
export function fieldLabel(key: string, show: string): string {
	if (Object.hasOwn(ROOT_LABELS, key)) return ROOT_LABELS[key];
	const prefix = setPrefixOf(key);
	if (prefix) return `${SET_LABELS[prefix]} · ${show}`;
	const parts = pieceParts(key);
	if (parts) {
		if (parts.part === 'piece') return `${PIECE_LABELS[parts.kind]} · ${show}`;
		if (parts.part === 'note') return `Note · ${show}`;
		if (parts.part === 'spot') return `Section · ${show}`;
		return `Section links · ${show}`;
	}
	throw new Error(`Not a clone field key: ${key}`);
}
