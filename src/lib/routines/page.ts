/**
 * What the routine page derives from the routine: the band's size and facts,
 * a slot's meta line, a seam's wording, and where a refusal is shown. PURE and
 * client-safe.
 */
import { plural } from '$lib/moves/plural';
import type { RowEdges } from './routines';

/** A long name, or one long word, gets the slim band's smaller type. */
export function bandCompact(name: string): boolean {
	return name.length > 18 || name.split(/\s+/).some((w) => w.length > 10);
}

/** "Starts from Open or Closed, ends in Closed": the two halves, or null with no start. */
export function factsOf(
	starts: string[],
	end: string | null
): { from: string; to: string | null } | null {
	if (starts.length === 0) return null;
	return { from: starts.join(' or '), to: end };
}

export type FactBadge = { tone: 'done' | 'warn' | 'danger'; text: string; loop: boolean };

export function factBadges(r: {
	slots: number;
	breaks: number;
	timingBreaks: number;
	loops: boolean;
}): FactBadge[] {
	if (r.slots === 0) return [];
	const out: FactBadge[] = [
		r.loops
			? { tone: 'done', text: 'Loops', loop: true }
			: { tone: 'warn', text: 'Doesn’t loop', loop: true }
	];
	if (r.breaks > 0)
		out.push({ tone: 'danger', text: plural(r.breaks, 'break', 'breaks'), loop: false });
	if (r.timingBreaks > 0)
		out.push({
			tone: 'danger',
			text: plural(r.timingBreaks, 'timing break', 'timing breaks'),
			loop: false
		});
	return out;
}

/** A slot card's second line: "1→1 · Open → Closed", led by "Routine · 3 slots" for a routine. */
export function slotMeta(
	e: RowEdges,
	name: (id: number) => string,
	childSlots: number | null
): string {
	const core =
		e.starts.length === 0
			? ''
			: `${e.startCounts.join('/')}→${e.next ?? '?'} · ${e.starts.map(name).join(' / ')} → ${
					e.end === null ? '?' : name(e.end)
				}`;
	if (childSlots === null) return core;
	return ['Routine', plural(childSlots, 'slot', 'slots'), core].filter((p) => p !== '').join(' · ');
}

/** The text on a seam: how the hands and the count meet the next slot. */
export function seamLabel(
	hands: { end: string; next: string[] } | null,
	count: { ready: number | null; next: number[] } | null
): string {
	const parts: string[] = [];
	if (hands) parts.push(`Ends in ${hands.end}, next starts from ${hands.next.join(' or ')}`);
	if (count)
		parts.push(`ready for ${count.ready ?? '?'}, next starts on ${count.next.join(' or ')}`);
	const s = parts.join(' · ');
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function selectionTitle(n: number): string {
	return n === 0 ? 'Select slots' : `${n} selected`;
}

export function makeRoutineCaption(n: number): string {
	return n === 1
		? 'The slot moves into the new routine, and it takes its place here as one slot.'
		: `The ${n} slots move into the new routine, and it takes their place here as one slot.`;
}

export type FailurePlace =
	| { where: 'slot'; stepId: number; message: string }
	| { where: 'edit'; field: 'name' | 'notes'; message: string }
	| { where: 'extract'; field: 'name' | null; message: string }
	| { where: 'banner'; message: string };

/** Where a form refusal belongs: on its slot, its field, or a banner. */
export function failurePlace(form: unknown, slotIds: number[]): FailurePlace | null {
	if (typeof form !== 'object' || form === null) return null;
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
