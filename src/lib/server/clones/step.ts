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
 * Sync to it, and their own deliberate change would nag forever). On a page the
 * person only reads, likewise, their own copy gets no `changed` or `held` line:
 * Update mine only pulls, so there is nothing for it to bring.
 * A name that differs only by a copy suffix is no difference.
 *
 * While the device has changes on their way (`changesOnWay`: saved on the
 * device, the server's flow not pulled yet), a `behind` row Keep in step will
 * carry by itself is no line: the page's switch is on, M's is on and its
 * options allow the key (`allows`), and the person edits both. Its copy is
 * counted in `sending` instead (the version row's "Sending to 2 copies…"). Once
 * the pull lands, whatever still differs is a line again: what the flow could
 * not carry, or refused.
 */
import type {
	CloneKind,
	Flat,
	KeepView,
	MergeRow,
	StepLine,
	StepView,
	SyncSettings
} from '$lib/types';
import { isCopySuffix, NAME_KEYS } from '$lib/clones/diff';
import { pieceParts } from '$lib/clones/flat';
import { allows } from '$lib/clones/sync';
import { changedLabels } from '$lib/clones/view';
import type { Db } from '../db';
import { changesOnWay } from '../device-runtime';
import { accessTo, familyRows, geneOf, visibleMembers } from './genes';
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

/** Whether Keep in step's flow from the page would carry row `r` into copy `m` (a `behind` row). */
function carried(r: MergeRow, page: number, m: number, settings: SyncSettings): boolean {
	const vp = r.values.find((v) => v.holders.includes(page));
	const vm = r.values.find((v) => v.holders.includes(m));
	if (!vp || !vm) return false;
	return allows(settings, r.key, vp.field === null, vp.field !== null && vm.field !== null);
}

/** A recording or video the page has and copy `m` lacks, which `m`'s options keep out. */
function refusedPiece(r: MergeRow, page: number, m: number, settings: SyncSettings): boolean {
	const vp = r.values.find((v) => v.holders.includes(page));
	const vm = r.values.find((v) => v.holders.includes(m));
	if (!vp?.field || !vm || vm.field !== null) return false;
	return pieceParts(r.key)?.part === 'piece' && !allows(settings, r.key, false);
}

export function stepStatus(
	db: Db,
	userId: string,
	kind: CloneKind,
	id: number,
	onWay: boolean = changesOnWay()
): StepView {
	// The same gate as the Sync sheet: no notice where Sync would have no sheet.
	const fam = familyOf(db, userId, kind, id);
	if (!fam) return { lines: [], sending: 0 };
	const flats = new Map<number, Flat>(fam.members.map((m) => [m.id, flatOf(db, kind, m.id)]));
	const rows = rowsOf(db, userId, kind, id, fam.members, flats);
	const lines: StepLine[] = [];
	const sending = new Set<number>();
	const readPage = fam.page.access !== 'edit';
	// A save here flows only while the page's own switch is on (and the person edits it).
	const flows = onWay && !readPage && syncSettingsOf(db, kind, id).on;
	for (const m of fam.members) {
		if (m.id === id) continue;
		// Their own change, seen from a page they only read: nothing to pull.
		const ownFromRead = readPage && m.place.kind === 'mine';
		const settings = flows && m.access === 'edit' ? syncSettingsOf(db, kind, m.id) : null;
		// As the flow's `holdLinkRemovals`: a new piece M's options refuse keeps the link removals back.
		const holdsLinks =
			settings !== null &&
			rows.some((r) => stateOf(r, id, m.id) === 'behind' && refusedPiece(r, id, m.id, settings));
		// One line per state the copy is in (a held one per way), with its rows in that state.
		const byState = new Map<
			string,
			{ state: State; how?: 'added' | 'removed'; rows: MergeRow[] }
		>();
		for (const r of rows) {
			const s = stateOf(r, id, m.id);
			if (s === null || (s === 'behind' && m.access !== 'edit')) continue;
			if (ownFromRead && (s === 'changed' || s === 'held')) continue;
			// On its way: the flow lands it by itself once the device's changes go up.
			const heldLink = holdsLinks && r.key.startsWith('link:');
			if (s === 'behind' && settings && !heldLink && carried(r, id, m.id, settings)) {
				sending.add(m.id);
				continue;
			}
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
	return {
		lines: lines.sort((a, b) => URGENCY[b.state] - URGENCY[a.state]),
		sending: sending.size
	};
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

/**
 * The ids among `ids` whose gene has another live copy, anywhere (another
 * person's own included): only these can have a copy the person reads. Each
 * family is looked up once.
 */
function withLiveCopies(db: Db, kind: CloneKind, ids: number[]): number[] {
	const family = new Map<string, boolean>();
	return ids.filter((id) => {
		const gene = geneOf(db, kind, id);
		if (gene === null) return false;
		let many = family.get(gene);
		if (many === undefined) {
			many = familyRows(db, kind, gene).filter((r) => r.archivedAt === null).length > 1;
			family.set(gene, many);
		}
		return many;
	});
}

/**
 * id → how many other copies differ; only ids whose gene has another live copy
 * are worked out. A copy whose only difference is on its way (`sending`) does
 * not count.
 */
export function outOfStep(
	db: Db,
	userId: string,
	kind: CloneKind,
	ids: number[],
	onWay: boolean = changesOnWay()
): Map<number, number> {
	const out = new Map<number, number>();
	for (const id of withLiveCopies(db, kind, ids)) {
		const n = new Set(stepStatus(db, userId, kind, id, onWay).lines.map((l) => l.id)).size;
		if (n > 0) out.set(id, n);
	}
	return out;
}

/**
 * id → how many other live copies the person reads: the Versions list's
 * copies (`send.ts`), in their own app and their groups. Another person's own
 * copy never counts. Ids with none are absent.
 */
export function copyCounts(
	db: Db,
	userId: string,
	kind: CloneKind,
	ids: number[]
): Map<number, number> {
	const out = new Map<number, number>();
	for (const id of withLiveCopies(db, kind, ids)) {
		const n = visibleMembers(db, userId, kind, id).filter((m) => m.id !== id && !m.archived).length;
		if (n > 0) out.set(id, n);
	}
	return out;
}
