/**
 * A member of a family (one thing copied into several places), flattened into
 * a map of field keys, so two members compare key by key (`diff.ts`).
 * PURE and client-safe.
 *
 * Key grammar:
 * - Root fields, one key each: `name`, `notes`, `partner`, `style`, `timing`
 *   (figure); `practice` (drill); `title`, `artist`, `count`, `sample`
 *   (song); `title`, `day` (lesson); `slots` (routine: the whole slot list is
 *   one field, since slots have no identity of their own); `name`, `notes`,
 *   `type`, `hands`, `crossed`, `facing`, `frame` (position).
 * - Set members, one key each, value `'1'`: `link:<url>` (a row's URL links),
 *   `start:<ref>`, `end:<ref>` (a figure's start and end positions),
 *   `fig:<ref>`, `routine:<ref>`, `drill:<ref>`, `pos:<ref>` (a lesson's hand
 *   links).
 * - Pieces: `rec:<g>` and `video:<g>` (presence; the value is the piece's media
 *   kind and size), `rec:<g>:note`, `<piece>:spot:<s>` (value
 *   `start|end|label`), `<piece>:spot:<s>:links` (the section's or point's
 *   links, sorted refs: `fig:`, `drill:`, `pos:`). A piece travels or goes
 *   whole: its parts are compared only while both sides have it.
 * - `<ref>`, `<g>` and `<s>` are the row's gene, or `#<id>` when it has none.
 *   Neither contains a colon. A position is referred to by its family, so each
 *   owner's member of one family reads as the same key.
 */
import { t } from '$lib/i18n/catalog';

/** The root fields, in the order a comparison lists them. */
export const ROOT_KEYS = [
	'name',
	'notes',
	'partner',
	'style',
	'timing',
	'practice',
	'title',
	'day',
	'artist',
	'count',
	'sample',
	'slots',
	'type',
	'hands',
	'crossed',
	'facing',
	'frame'
] as const;

/** A root field's label, read from the catalog when asked (the clash sheet's words where they are the same field). */
const ROOT_LABELS: Record<string, () => string> = {
	name: () => t().groups.clash.field.name,
	notes: () => t().groups.clash.field.notes,
	partner: () => t().groups.clash.field.partner,
	style: () => t().groups.clash.field.style,
	timing: () => t().figure.timing.label,
	practice: () => t().clones.field.practice,
	title: () => t().groups.clash.field.title,
	day: () => t().clones.field.day,
	artist: () => t().clones.field.artist,
	count: () => t().clones.field.count,
	sample: () => t().clones.field.sample,
	slots: () => t().clones.field.slots,
	type: () => t().positions.fields.type,
	hands: () => t().positions.fields.hands,
	crossed: () => t().positions.sheet.crossed,
	facing: () => t().positions.fields.facing,
	frame: () => t().positions.fields.frame
};

/** The set members' prefixes, in the order a comparison lists them. */
export const SET_PREFIXES = [
	'start',
	'end',
	'link',
	'fig',
	'routine',
	'drill',
	'pos',
	'song'
] as const;

const SET_LABELS: Record<string, () => string> = {
	start: () => t().groups.clash.field.startIds,
	end: () => t().groups.clash.field.endIds,
	link: () => t().groups.deleted.kind.link,
	fig: () => t().groups.deleted.kind.variation,
	routine: () => t().groups.deleted.kind.routine,
	drill: () => t().groups.deleted.kind.drill,
	pos: () => t().groups.deleted.kind.position,
	song: () => t().groups.deleted.kind.song
};
const PIECE_LABELS: Record<string, () => string> = {
	rec: () => t().groups.deleted.kind.recording,
	video: () => t().groups.deleted.kind.video
};

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

/** The set prefix of a key (`start`, `end`, `link`, `fig`, `routine`, `drill`, `pos`), else null. */
export function setPrefixOf(key: string): string | null {
	const i = key.indexOf(':');
	if (i < 1) return null;
	const prefix = key.slice(0, i);
	return Object.hasOwn(SET_LABELS, prefix) && key.length > i + 1 ? prefix : null;
}

/** What the Sync sheet calls a field. Throws on a key outside the grammar. */
export function fieldLabel(key: string, show: string): string {
	if (Object.hasOwn(ROOT_LABELS, key)) return ROOT_LABELS[key]();
	const prefix = setPrefixOf(key);
	if (prefix) return `${SET_LABELS[prefix]()} · ${show}`;
	const parts = pieceParts(key);
	if (parts) {
		if (parts.part === 'piece') return `${PIECE_LABELS[parts.kind]()} · ${show}`;
		if (parts.part === 'note') return `${t().clones.field.note} · ${show}`;
		if (parts.part === 'spot') return `${t().groups.deleted.kind.section} · ${show}`;
		return `${t().clones.field.sectionLinks} · ${show}`;
	}
	throw new Error(`Not a clone field key: ${key}`);
}
