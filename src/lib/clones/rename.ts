/**
 * Send's one rename box (merge sheets spec): a name never goes by default, so
 * the sheet offers one box, "Rename their copies to …", for every copy named
 * differently, with a line per copy to leave one out. PURE and client-safe.
 *
 * A target's diffs are read from its side: `mine` the target, `theirs` yours.
 */
import type { FieldDiff, Picks, SendTarget } from '$lib/types';
import { NAME_KEYS } from './diff';

/** The target's difference on its name or title, if any. */
export function nameDiffOf(t: SendTarget): FieldDiff | null {
	return t.comparison.diffs.find((d) => NAME_KEYS.has(d.key)) ?? null;
}

/** Your name, what the differing copies are called now, and which they are; null when none differs. */
export function renameOffer(
	targets: SendTarget[]
): { name: string; names: string[]; ids: number[] } | null {
	const named = targets
		.map((t) => ({ t, d: nameDiffOf(t) }))
		.filter((x): x is { t: SendTarget; d: FieldDiff } => x.d !== null && x.d.theirs !== null);
	if (named.length === 0) return null;
	return {
		name: named[0].d.theirs!.show,
		names: named.map((x) => x.d.mine?.show ?? ''),
		ids: named.map((x) => x.t.target.id)
	};
}

/** The target's picks, with your name landing there when the rename is on for it. */
export function withRename(picks: Picks, t: SendTarget, on: boolean): Picks {
	const d = nameDiffOf(t);
	return on && d ? { ...picks, [d.key]: 'theirs' } : picks;
}

/** A copy whose one difference is its name. */
export function sendsOnlyName(t: SendTarget): boolean {
	const diffs = t.comparison.diffs;
	return diffs.length > 0 && diffs.every((d) => NAME_KEYS.has(d.key));
}
