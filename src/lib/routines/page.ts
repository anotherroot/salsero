/**
 * What the routine page derives from the routine: the band's size and facts,
 * a slot's meta line, a seam's wording, and where a refusal is shown. PURE and
 * client-safe.
 */
import { isClash } from '$lib/clash/clash';
import { t } from '$lib/i18n/catalog';
import type { RowEdges } from './routines';
import { anchorAlternative, type Anchor, type Candidate } from './fit';

/** Between the positions of one side: " or ", read at call time. */
const or = () => ` ${t().figure.or} `;

/** A long name, or one long word, gets the slim band's smaller type. */
export function bandCompact(name: string): boolean {
	return name.length > 18 || name.split(/\s+/).some((w) => w.length > 10);
}

/**
 * Whether the routine has anything to dance, so Practise is offered: a row
 * with a start count. Never its positions: `starts: []` means "anywhere".
 */
export function danceable(edges: RowEdges[]): boolean {
	return edges.some((e) => e.startCounts.length > 0);
}

/**
 * "Starts from Open or Closed, ends in Closed": the two halves. A side with no
 * position has no fact (null); with neither, there is nothing to say.
 */
export function factsOf(
	starts: string[],
	ends: string[]
): { from: string | null; to: string | null } | null {
	if (starts.length === 0 && ends.length === 0) return null;
	return {
		from: starts.length > 0 ? starts.join(or()) : null,
		to: ends.length > 0 ? ends.join(or()) : null
	};
}

export type FactBadge = { tone: 'done' | 'warn' | 'danger'; text: string; loop: boolean };

export function factBadges(r: {
	slots: number;
	breaks: number;
	timingBreaks: number;
	loops: boolean;
}): FactBadge[] {
	if (r.slots === 0) return [];
	const w = t();
	const out: FactBadge[] = [
		r.loops
			? { tone: 'done', text: w.routine.loops, loop: true }
			: { tone: 'warn', text: w.routine.noLoop, loop: true }
	];
	if (r.breaks > 0) out.push({ tone: 'danger', text: w.nouns.breaks(r.breaks), loop: false });
	if (r.timingBreaks > 0)
		out.push({ tone: 'danger', text: w.nouns.timingBreaks(r.timingBreaks), loop: false });
	return out;
}

/**
 * Where the hands start and end, each side joined " or " as the figure page's
 * Handholds are: "Open or Closed → Hammerlock". A side with no position (or
 * only names `name` does not know) shows nothing ("Open →", "→ Closed"); with
 * neither, the empty string. The slot cards and the picker's rows share it.
 */
export function handsLine(starts: number[], ends: number[], name: (id: number) => string): string {
	const side = (ids: number[]) => ids.map(name).filter(Boolean).join(or());
	const from = side(starts);
	const to = side(ends);
	return from === '' && to === '' ? '' : [from, '→', to].filter((p) => p !== '').join(' ');
}

/**
 * A slot card's second line: "1→1 · Open → Closed", led by "Routine · 3 slots"
 * for a routine. A side with no position shows nothing ("1→1 · Open →"): it
 * fits anywhere. Ends the options disagree on (`ends` null) say so ("Open →
 * ends differ"), so they never read as "anything follows"; never a "?" for a hold.
 *
 * A row that knows its end (`endState`, spec 2026-11-11, slot end) leaves it
 * to the card, which draws it as a chip or a word, and names no start: the
 * start is where the slot above ended. Only the routine's `first` row says
 * where it starts ("1→1 · Open →").
 */
export function slotMeta(
	e: RowEdges,
	name: (id: number) => string,
	childSlots: number | null,
	first = false
): string {
	const from = handsLine(e.starts, [], name);
	if (childSlots === null && e.endState !== undefined) {
		if (e.startCounts.length === 0) return '';
		const counts = `${e.start ?? e.startCounts.join('/')}→${e.next ?? '?'}`;
		return first && from !== '' ? `${counts} · ${from}` : counts;
	}
	const differ = t().routine.endsDiffer;
	const hands =
		e.ends !== null
			? handsLine(e.starts, e.ends, name)
			: from === ''
				? differ
				: `${from} ${differ}`;
	const core =
		e.startCounts.length === 0
			? ''
			: [`${e.start ?? e.startCounts.join('/')}→${e.next ?? '?'}`, hands]
					.filter((p) => p !== '')
					.join(' · ');
	if (childSlots === null) return core;
	const w = t();
	return [w.moves.move.routine, w.nouns.slots(childSlots), core]
		.filter((p) => p !== '')
		.join(' · ');
}

/** The text on a seam: how the hands and the count meet the next slot. */
export function seamLabel(
	hands: { ends: string[]; next: string[] } | null,
	count: { ready: number | null; next: number[] } | null
): string {
	const w = t().routine.seam;
	const parts: string[] = [];
	if (hands) parts.push(w.hands(hands.ends.join(or()), hands.next.join(or())));
	if (count) parts.push(w.count(String(count.ready ?? '?'), count.next.join(or())));
	const s = parts.join(' · ');
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function selectionTitle(n: number): string {
	return n === 0 ? t().routine.selection.title : t().moves.coverage.selected(n);
}

export function makeRoutineCaption(n: number): string {
	return t().routine.make.caption(n);
}

export type FailurePlace =
	| { where: 'slot'; stepId: number; message: string }
	| { where: 'edit'; field: 'name' | 'notes'; message: string }
	| { where: 'extract'; field: 'name' | null; message: string }
	| { where: 'banner'; message: string };

/**
 * Where a form refusal belongs: on its slot, its field, or a banner. A clash
 * on the Edit form (someone else saved it, or it went) is the clash sheet's,
 * so it has no place here.
 */
export function failurePlace(form: unknown, slotIds: number[]): FailurePlace | null {
	if (typeof form !== 'object' || form === null || isClash(form)) return null;
	const f = form as Record<string, unknown>;
	if (typeof f.message !== 'string') return null;
	const message = f.message;
	if (f.action === 'rename')
		return { where: 'edit', field: f.field === 'notes' ? 'notes' : 'name', message };
	if (f.action === 'extract')
		return { where: 'extract', field: f.field === 'name' ? 'name' : null, message };
	if (typeof f.stepId === 'number' && slotIds.includes(f.stepId))
		return { where: 'slot', stepId: f.stepId, message };
	return { where: 'banner', message };
}

/** One of this page's own slot actions: the fingerprint it sent, and the one it got back (null: refused). */
export type OwnSend = { sent: string | null; after: string | null };

/**
 * The fingerprint a queued slot action sends. It was aimed at `aimed`, the
 * routine as the page showed it when tapped; the page's own actions queued
 * ahead of it have changed the routine since, each turning the fingerprint it
 * sent into the one it got back. Walk them in order from `aimed`: what is left
 * is the routine this action would have seen. A refused one changed nothing.
 */
export function fingerprintToSend(aimed: string, ahead: OwnSend[]): string {
	let fp = aimed;
	for (const r of ahead) if (r.sent === fp && r.after !== null) fp = r.after;
	return fp;
}

/**
 * The picker's anchor for a slot's + Alternative: the main figure as the routine
 * walks the slot (spec 2026-11-11) — starting where the slot is entered, going
 * on where the slot does — so the picker offers what `addOption` takes. Null
 * when the slot is gone or its main figure is archived.
 */
export function alternativeAnchor(
	stepId: number,
	slots: { id: number; figureIds: number[] }[],
	edges: RowEdges[],
	figures: ReadonlyMap<number, Candidate>
): Anchor | null {
	const i = slots.findIndex((s) => s.id === stepId);
	if (i === -1) return null;
	const slot = slots[i];
	return anchorAlternative(figures.get(slot.figureIds[0]), slot.figureIds, edges[i]);
}
