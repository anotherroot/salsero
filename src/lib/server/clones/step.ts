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
 * A copy gives one line per state it is in, most urgent first (both > changed >
 * held > behind), listing its rows in that state as the notice says them
 * (`changedLabels`: "Notes", "1 recording"); a held line per way it went
 * (`how`: added, removed). A copy the person only reads gets no `behind` line (they cannot
 * Sync to it, and their own deliberate change would nag forever).
 * A name that differs only by a copy suffix is no difference.
 */
import type { CloneKind, Flat, KeepView, MergeRow, StepLine, StepView } from '$lib/types';
import { isCopySuffix, NAME_KEYS } from '$lib/clones/diff';
import { changedLabels } from '$lib/clones/view';
import type { Db } from '../db';
import { accessTo, familyRows, geneOf } from './genes';
import { familyOf, placeLabel, rowsOf } from './sync';
import { syncSettingsOf } from './sync-settings';
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
	// The same gate as the Sync sheet: no notice where Sync would have no sheet.
	const fam = familyOf(db, userId, kind, id);
	if (!fam) return { lines: [] };
	const flats = new Map<number, Flat>(fam.members.map((m) => [m.id, flatOf(db, kind, m.id)]));
	const rows = rowsOf(db, userId, kind, id, fam.members, flats);
	const lines: StepLine[] = [];
	for (const m of fam.members) {
		if (m.id === id) continue;
		// One line per state the copy is in (a held one per way), with its rows in that state.
		const byState = new Map<
			string,
			{ state: State; how?: 'added' | 'removed'; rows: MergeRow[] }
		>();
		for (const r of rows) {
			const s = stateOf(r, id, m.id);
			if (s === null || (s === 'behind' && m.access !== 'edit')) continue;
			const how =
				s === 'held'
					? r.values.find((v) => v.holders.includes(m.id))?.field === null
						? ('removed' as const)
						: ('added' as const)
					: undefined;
			const at = how ? `${s}:${how}` : s;
			const group = byState.get(at) ?? { state: s, ...(how ? { how } : {}), rows: [] };
			group.rows.push(r);
			byState.set(at, group);
		}
		for (const g of byState.values())
			lines.push({
				id: m.id,
				place: placeLabel(m.place),
				state: g.state,
				fields: changedLabels(g.rows),
				...(g.how ? { how: g.how } : {})
			});
	}
	// Most urgent first (both > changed > held > behind); the sort is stable, so places keep their order.
	return { lines: lines.sort((a, b) => URGENCY[b.state] - URGENCY[a.state]) };
}

/**
 * Keep in step on a page: the row's settings, whether the person edits them
 * (the level draws its switches disabled otherwise), and how Sync opens from
 * the row (`familyOf`'s mode; null where Sync has no sheet).
 */
export function keepView(db: Db, userId: string, kind: CloneKind, id: number): KeepView {
	return {
		settings: syncSettingsOf(db, kind, id),
		editable: accessTo(db, userId, kind, id) === 'edit',
		mode: familyOf(db, userId, kind, id)?.mode ?? null
	};
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
		const n = new Set(stepStatus(db, userId, kind, id).lines.map((l) => l.id)).size;
		if (n > 0) out.set(id, n);
	}
	return out;
}
