/**
 * Copies you can see (board C3): the members of a page's family the person
 * reads, each with where it stands against the page's row, for the Versions
 * list. (Send mine, which once lived here, is Sync now: `sync.ts`.)
 *
 * Reads only through `visibleMembers`: another person's own member is never
 * listed.
 */
import { fittingDiffs } from '../song-links';
import type { CloneKind, FamilyEntry, FamilyView, FieldDiff, Member, PlaceRef } from '$lib/types';
import { diff } from '$lib/clones/diff';
import { ownChanges, changedLabels } from '$lib/clones/view';
import type { Db } from '../db';
import { roleOf } from '../teams';
import { visibleMembers } from './genes';
import { hashValue, pairBase } from './pairs';
import { flatOf } from './trees';
import { sourcesOf } from './sources';

const label = (place: PlaceRef) => (place.kind === 'mine' ? 'Yours' : place.name);

/** Yours first, then groups by name: the tabs' order. */
function byPlace(a: { place: PlaceRef }, b: { place: PlaceRef }): number {
	if (a.place.kind !== b.place.kind) return a.place.kind === 'mine' ? -1 : 1;
	return label(a.place).localeCompare(label(b.place));
}

/** The page's row and the other live members, in the tabs' order. */
function liveFamily(db: Db, userId: string, kind: CloneKind, id: number) {
	const all = visibleMembers(db, userId, kind, id);
	const page = all.find((m) => m.id === id) ?? null;
	const others = all.filter((m) => m.id !== id && !m.archived).sort(byPlace);
	return { page, others };
}

const roleIn = (db: Db, userId: string, m: Member) =>
	m.place.kind === 'team' ? roleOf(db, userId, m.place.teamId) : null;

/**
 * Every member of the page's family the person reads: the page's own row
 * first ("This one"), then the other live ones (Yours, then groups by name).
 * Each copy's status and what differs are its tab's (`sourcesOf`); `theirs`
 * is what the copy changed since the two were in step, and the page's own
 * `changed` what it changed that some copy lacks. Empty when the person
 * cannot read the page's row.
 */
export function familyStatus(db: Db, userId: string, kind: CloneKind, id: number): FamilyEntry[] {
	const { page, others } = liveFamily(db, userId, kind, id);
	if (!page) return [];
	const tabs = new Map(sourcesOf(db, userId, kind, id).map((s) => [s.id, s]));
	const pageFlat = flatOf(db, kind, id);
	const own = new Map<string, FieldDiff>();
	const rows: FamilyEntry[] = others.map((m) => {
		const diffs = fittingDiffs(
			db,
			kind,
			id,
			m.id,
			diff(pairBase(db, kind, id, m.id), pageFlat, flatOf(db, kind, m.id), hashValue),
			userId
		);
		for (const d of diffs) if (d.side === 'mine' && !own.has(d.key)) own.set(d.key, d);
		const tab = tabs.get(m.id);
		return {
			member: m,
			role: roleIn(db, userId, m),
			status: tab?.status ?? null,
			changed: tab?.changed ?? [],
			theirs: changedLabels(diffs.filter((d) => d.side !== 'mine')),
			editable: m.access === 'edit'
		};
	});
	return [
		{
			member: page,
			role: roleIn(db, userId, page),
			status: null,
			changed: ownChanges([...own.values()]),
			theirs: [],
			editable: page.access === 'edit'
		},
		...rows
	];
}

/**
 * What a member page's Versions list shows of its family (board C3 p1): every
 * copy the person reads with its role and status. Null unless the person
 * edits some other live member. Where the copies disagree is the notice's
 * (`step.ts`), and Sync is offered by `keepView`.
 */
export function familyView(db: Db, userId: string, kind: CloneKind, id: number): FamilyView | null {
	const { page, others } = liveFamily(db, userId, kind, id);
	if (!page || !others.some((m) => m.access === 'edit')) return null;
	return { entries: familyStatus(db, userId, kind, id) };
}
