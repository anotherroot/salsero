/**
 * What the connector's tools take, checked at the boundary. PURE.
 *
 * Every refusal is one line for the AI to correct itself: it names the valid
 * values, or the tool that finds ids. Unknown keys are refused (the schemas say
 * `additionalProperties: false` too). Numbers must be JSON numbers: "5" is
 * refused, never coerced. Machines read these: English, no `t()`.
 */

export type Parsed<T> = { ok: true; args: T } | { ok: false; message: string };

export const QUERY_MAX = 100;
export const FIND_IDS = 'Ids come from search or list.';

export const refuse = (message: string): { ok: false; message: string } => ({
	ok: false,
	message
});

/** A refusal for the first key `a` has that `tool` does not take (`takes`: how it reads). */
export function unknownKey(
	a: Record<string, unknown>,
	keys: readonly string[],
	tool: string,
	takes: string
): string | null {
	const extra = Object.keys(a).find((k) => !keys.includes(k));
	return extra === undefined ? null : `Unknown argument "${extra}": ${tool} takes ${takes}.`;
}

/** A JSON integer from `min` to `max`; anything else (a string, a fraction, NaN) is refused. */
export function wholeNumber(v: unknown, min: number, max: number): number | null {
	return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

const bool = (v: unknown): boolean | null =>
	v === undefined ? false : typeof v === 'boolean' ? v : null;

/** `{ id }`: one positive integer id. */
export function parseId(a: Record<string, unknown>, tool: string): Parsed<{ id: number }> {
	const extra = unknownKey(a, ['id'], tool, 'id');
	if (extra) return refuse(extra);
	const id = wholeNumber(a.id, 1, Number.MAX_SAFE_INTEGER);
	if (id === null) return refuse(`id must be a whole number. ${FIND_IDS}`);
	return { ok: true, args: { id } };
}

/** No arguments at all. */
export function parseNone(a: Record<string, unknown>, tool: string): Parsed<object> {
	const extra = unknownKey(a, [], tool, 'no arguments');
	return extra ? refuse(extra) : { ok: true, args: {} };
}

/** What search and list find. */
export const KINDS = [
	'move',
	'figure',
	'routine',
	'drill',
	'lesson',
	'position',
	'section'
] as const;
export type Kind = (typeof KINDS)[number];
/** What list lists: every kind but a section (a section belongs to its video). */
export const LIST_KINDS = KINDS.filter((k) => k !== 'section');
const isKind = (v: unknown): v is Kind => (KINDS as readonly unknown[]).includes(v);

export function parseSearch(
	a: Record<string, unknown>
): Parsed<{ query: string; kinds: Kind[]; includeArchived: boolean }> {
	const extra = unknownKey(
		a,
		['query', 'kinds', 'include_archived'],
		'search',
		'query, kinds and include_archived'
	);
	if (extra) return refuse(extra);
	const query = typeof a.query === 'string' ? a.query.trim() : '';
	if (!query || query.length > QUERY_MAX)
		return refuse(`query must be text of 1 to ${QUERY_MAX} characters: a word or two of a name.`);
	const kinds = a.kinds === undefined ? [...KINDS] : a.kinds;
	if (!Array.isArray(kinds) || kinds.length === 0 || !kinds.every(isKind))
		return refuse(`kinds must be a list of: ${KINDS.join(', ')}.`);
	const includeArchived = bool(a.include_archived);
	if (includeArchived === null) return refuse('include_archived must be true or false.');
	return { ok: true, args: { query, kinds, includeArchived } };
}

export function parseList(
	a: Record<string, unknown>
): Parsed<{ kind: Kind; groupId: number | null; includeArchived: boolean }> {
	const extra = unknownKey(
		a,
		['kind', 'group_id', 'include_archived'],
		'list',
		'kind, group_id and include_archived'
	);
	if (extra) return refuse(extra);
	if (!isKind(a.kind) || a.kind === 'section')
		return refuse(`kind must be one of: ${LIST_KINDS.join(', ')}.`);
	const groupId =
		a.group_id === undefined ? null : wholeNumber(a.group_id, 1, Number.MAX_SAFE_INTEGER);
	if (groupId === null && a.group_id !== undefined)
		return refuse('group_id must be a whole number. Groups come from list_groups.');
	const includeArchived = bool(a.include_archived);
	if (includeArchived === null) return refuse('include_archived must be true or false.');
	return { ok: true, args: { kind: a.kind, groupId, includeArchived } };
}
