/**
 * PURE, client-safe: the pick list's state (option A2). Nothing starts
 * ticked (the teacher decides yes and no); Select all skips songs already
 * added; a song given its own style keeps it when Style for all changes.
 */
import { t } from '$lib/i18n/catalog';
import { clock } from '$lib/format';
import { BRAND } from './song-page';
import type { SongImportKind } from '$lib/labels';
import type { PickItem } from '$lib/types';

export type PickEdit = { title: string; artist: string; style: string | null };
export type PickState = {
	ticked: Set<number>;
	edits: Map<number, PickEdit>;
	styleForAll: string;
	/** The row open as a form, if any: one at a time. */
	open: number | null;
};
/** What the form posts for one ticked song (`readPicks` reads it). */
export type PickOut = { i: number; title: string; artist: string | null; style: string };

export function initial(_items: PickItem[], styles: readonly string[]): PickState {
	return { ticked: new Set(), edits: new Map(), styleForAll: styles[0], open: null };
}

/** All but the already added; when those are all ticked already, none. */
export function selectAll(items: PickItem[], s: PickState): Set<number> {
	return allState(items, s) === 'all'
		? new Set()
		: new Set(items.filter((i) => !i.already).map((i) => i.i));
}

export function allState(items: PickItem[], s: PickState): 'all' | 'some' | 'none' {
	if (s.ticked.size === 0) return 'none';
	return items.every((i) => i.already || s.ticked.has(i.i)) ? 'all' : 'some';
}

export function styleOf(i: number, s: PickState): string {
	return s.edits.get(i)?.style ?? s.styleForAll;
}

const titleOf = (item: PickItem, s: PickState) => s.edits.get(item.i)?.title.trim() || item.title;
const artistOf = (item: PickItem, s: PickState) => {
	const e = s.edits.get(item.i);
	return e ? e.artist.trim() || null : item.artist;
};

/** "Grupo Niche · 5:11", with "· Son" when its style is not Style for all. */
export function rowMeta(item: PickItem, s: PickState, styleLabel: Record<string, string>): string {
	const style = styleOf(item.i, s);
	return [
		artistOf(item, s),
		item.durationS ? clock(item.durationS) : null,
		style !== s.styleForAll ? (styleLabel[style] ?? style) : null
	]
		.filter(Boolean)
		.join(' · ');
}

/** Under an open row: the song as the list named it. */
export function originLine(kind: SongImportKind, item: PickItem): string {
	const where = kind.startsWith('spotify') ? BRAND.spotify : BRAND.youtube;
	const name = [item.title, item.durationS ? clock(item.durationS) : null]
		.filter(Boolean)
		.join(' · ');
	return t().songs.pick.onSource(where, name);
}

/** The ticked songs in list order, as edited. */
export function picksOut(items: PickItem[], s: PickState): PickOut[] {
	return items
		.filter((i) => s.ticked.has(i.i))
		.map((i) => ({ i: i.i, title: titleOf(i, s), artist: artistOf(i, s), style: styleOf(i.i, s) }));
}

/** The ticked set with `i` ticked or not: a new set, so the page's state sees the change. */
export function withTick(ticked: Set<number>, i: number, on: boolean): Set<number> {
	const next = new Set(ticked);
	if (on) next.add(i);
	else next.delete(i);
	return next;
}

/** The edits with `i`'s replaced: a new map, as `withTick`. */
export function withEdit(
	edits: Map<number, PickEdit>,
	i: number,
	e: PickEdit
): Map<number, PickEdit> {
	return new Map(edits).set(i, e);
}
