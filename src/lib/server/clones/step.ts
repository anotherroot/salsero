/**
 * Where a page's copies stand: the notice's lines ("Your copies don't agree")
 * and the Moves lists' counts. Read from the SAME merge rows the Sync sheet
 * shows (`rowsOf`), so the notice is there exactly when Sync has rows.
 *
 * For each other live copy M the person reads, each row where M's value
 * differs from the page's:
 *   - the page's value changed, M's did not: `behind` (M is behind the page);
 *   - M's changed, the page's did not: `changed`;
 *   - both changed, or neither verdict known (an open row): `both`;
 *   - an add or remove row M's side made that the page's options would not
 *     carry (its box starts unticked): `held`.
 * A line takes the most urgent state of its rows: both > changed > held >
 * behind. A copy the person only reads gets no `behind` line (they cannot
 * Sync to it, and their own deliberate change would nag forever).
 * A name that differs only by a copy suffix is no difference.
 */
import type { CloneKind, Flat, MergeRow, StepLine, StepView } from '$lib/types';
import { isCopySuffix, NAME_KEYS } from '$lib/clones/diff';
import type { Db } from '../db';
import { familyRows, geneOf, visibleMembers } from './genes';
import { byPlace, placeLabel, rowsOf } from './sync';
import { flatOf } from './trees';

const URGENCY = { behind: 0, held: 1, changed: 2, both: 3 } as const;
type State = StepLine['state'];

/** How row `r` stands for copy `m` against the page, or null when they hold the same. */
function stateOf(r: MergeRow, page: number, m: number): State | null {
	const vp = r.values.find((v) => v.holders.includes(page));
	const vm = r.values.find((v) => v.holders.includes(m));
	if (!vp || !vm || vp === vm) return null;
	if (NAME_KEYS.has(r.key) && vp.field && vm.field) {
		const [a, b] = [vp.field.value, vm.field.value];
		if (
			typeof a === 'string' &&
			typeof b === 'string' &&
			(isCopySuffix(a, b) || isCopySuffix(b, a))
		)
			return null;
	}
	if (vp.changed && !vm.changed) return 'behind';
	if (vm.changed && !vp.changed) {
		// A box the page's options start unticked: Sync would not carry it.
		const unticked = (r.kind === 'add' && r.pick === null) || r.kind === 'remove';
		return unticked ? 'held' : 'changed';
	}
	return 'both';
}

export function stepStatus(db: Db, userId: string, kind: CloneKind, id: number): StepView {
	const all = visibleMembers(db, userId, kind, id);
	const page = all.find((m) => m.id === id);
	if (!page || page.archived) return { lines: [] };
	const others = all.filter((m) => m.id !== id && !m.archived).sort(byPlace);
	if (others.length === 0) return { lines: [] };
	const members = [page, ...others];
	const flats = new Map<number, Flat>(members.map((m) => [m.id, flatOf(db, kind, m.id)]));
	const rows = rowsOf(db, userId, kind, id, members, flats);
	const lines: StepLine[] = [];
	for (const m of others) {
		// The fields of the line are those of its most urgent state.
		const byState = new Map<State, string[]>();
		for (const r of rows) {
			const s = stateOf(r, id, m.id);
			if (s === null || (s === 'behind' && m.access !== 'edit')) continue;
			const f = byState.get(s) ?? [];
			if (!f.includes(r.label)) f.push(r.label);
			byState.set(s, f);
		}
		const state = [...byState.keys()].sort((a, b) => URGENCY[b] - URGENCY[a])[0] ?? null;
		const fields = state ? byState.get(state)! : [];
		if (state !== null) lines.push({ id: m.id, place: placeLabel(m.place), state, fields });
	}
	return { lines };
}

/** id → how many other copies differ; only ids whose gene has another live copy are worked out. */
export function outOfStep(
	db: Db,
	userId: string,
	kind: CloneKind,
	ids: number[]
): Map<number, number> {
	const out = new Map<number, number>();
	const family = new Map<string, boolean>();
	for (const id of ids) {
		const gene = geneOf(db, kind, id);
		if (gene === null) continue;
		let many = family.get(gene);
		if (many === undefined) {
			many = familyRows(db, kind, gene).filter((r) => r.archivedAt === null).length > 1;
			family.set(gene, many);
		}
		if (!many) continue;
		const n = stepStatus(db, userId, kind, id).lines.length;
		if (n > 0) out.set(id, n);
	}
	return out;
}
