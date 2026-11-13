import type { Flat } from '$lib/types';

/**
 * A member of a family (one thing copied into several places), flattened into
 * a map of field keys, so two members compare key by key (`diff.ts`).
 * PURE and client-safe.
 *
 * Key grammar:
 * - Root fields, one key each: `name`, `notes`, `partner`, `style`, `timing`
 *   (figure); `practice` (drill); `title`, `artist`, `audio`, `count`, `sample`
 *   (song: `audio` is `<source_url>|<audio_url>`, the person's choice of audio); `title`, `day` (lesson); `slots` (routine: the whole slot list is
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
	'comesBack',
	'hearing',
	'title',
	'day',
	'artist',
	'audio',
	'count',
	'sample',
	'sections',
	'musicStart',
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
	comesBack: () => t().groups.clash.field.comesBack,
	hearing: () => t().groups.clash.field.hearing,
	title: () => t().groups.clash.field.title,
	day: () => t().clones.field.day,
	artist: () => t().clones.field.artist,
	audio: () => t().clones.field.audio,
	count: () => t().clones.field.count,
	sample: () => t().clones.field.sample,
	sections: () => t().clones.field.sections,
	musicStart: () => t().clones.field.musicStart,
	slots: () => t().clones.field.slots,
	type: () => t().positions.fields.type,
	hands: () => t().positions.fields.hands,
	crossed: () => t().positions.sheet.crossed,
	facing: () => t().positions.fields.facing,
	frame: () => t().positions.fields.frame
};

/**
 * A root key's value in a pair snapshot written before the key existed. Such a
 * snapshot has no hash for it, and it reads as this value's, so a member that
 * holds the default is not "changed" by the key's arrival.
 */
export const BASE_DEFAULTS: Readonly<Record<string, string>> = {
	comesBack: 'faces',
	// A song with no sections, and one that plays from the worker's start.
	sections: '',
	musicStart: ''
};

/**
 * A snapshot's value for `key` when it has none, from a member's `value`: the
 * constant default, or for a song's `audio` (added 2026-11-08) the song's own
 * link with no audio link of its own, which every copy held before then.
 * Null: no default.
 */
export function baseDefault(key: string, value: string): string | null {
	if (Object.hasOwn(BASE_DEFAULTS, key)) return BASE_DEFAULTS[key];
	if (key === 'audio') return value.slice(0, value.indexOf('|') + 1);
	return null;
}

/** The keys that index one audio: a song's 1s, its sample start, its sections and its music start. */
const AUDIO_BOUND: ReadonlySet<string> = new Set(['count', 'sample', 'sections', 'musicStart']);

/**
 * The count and the sample index one audio: across copies whose `audio`
 * differs they do not compare (the 1s point at beats of another recording).
 */
export function boundToAudio(key: string, a: Flat, b: Flat): boolean {
	return AUDIO_BOUND.has(key) && (a.audio?.value ?? '') !== (b.audio?.value ?? '');
}

/** `boundToAudio` over any number of copies: true when their audio is not one. */
export function boundAcross(key: string, flats: Flat[]): boolean {
	if (!AUDIO_BOUND.has(key)) return false;
	return new Set(flats.map((f) => f.audio?.value ?? '')).size > 1;
}

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
