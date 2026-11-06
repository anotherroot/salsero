/**
 * Copies you can see, and Send mine (board C3): the members of a page's
 * family the person reads, each with where it stands against the page's row;
 * and Send, which writes the page's changes into every other member the
 * person edits (their own, groups they own or edit).
 *
 * Send is Take with the roles swapped: each target receives from the page's
 * row through `syncFrom`, one target per transaction, so one refusal leaves
 * the others landed. Compared from the target's side (`mine` the target,
 * `theirs` the page's row), what only the page changed lands; what only the
 * target changed stays; a delete only when ticked; a field both changed is
 * picked per target before sending.
 *
 * Reads only through `visibleMembers`: another person's own member is never
 * listed, and a member the person only reads is never a target.
 */
import { fittingDiffs } from '../song-links';
import type {
	CloneKind,
	CompareOffer,
	FamilyEntry,
	FamilyView,
	FieldDiff,
	Member,
	PlaceRef,
	Picks,
	SendResult,
	SendTarget
} from '$lib/types';
import { diff, sendPicks, unpicked } from '$lib/clones/diff';
import { ownChanges, changedLabels, SEND_FAILED } from '$lib/clones/view';
import type { Db } from '../db';
import { roleOf } from '../teams';
import { accessTo, visibleMembers } from './genes';
import { hashValue, pairBase } from './pairs';
import { flatOf } from './trees';
import { compareWith } from './compare';
import { filesFor, syncFrom } from './apply';
import { sourcesOf } from './sources';
import type { CloneFiles } from './files';

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
 * What a member page shows of its family (board C3 p1): the list, Send
 * mine…, and a "differs" banner per copy that moved since it was in step
 * with the page's row. Not for the group's member the page was copied from:
 * that one has Take's own banner ("… changed it since you took it",
 * `sourcesView`). Null unless the person edits some other live member: the
 * list is for Send.
 */
export function familyView(db: Db, userId: string, kind: CloneKind, id: number): FamilyView | null {
	const { page, others } = liveFamily(db, userId, kind, id);
	if (!page || !others.some((m) => m.access === 'edit')) return null;
	const from = others.find((m) => m.id === page.clonedFrom);
	const origin = from && from.place.kind === 'team' ? from.id : null;
	const entries = familyStatus(db, userId, kind, id);
	const canSend = page.access === 'edit' && !page.archived;
	const banners: CompareOffer[] = canSend
		? entries
				.slice(1)
				.filter((e) => e.member.id !== origin && e.theirs.length > 0)
				.map((e) => ({ id: e.member.id, place: label(e.member.place), changed: e.theirs }))
		: [];
	return { entries, canSend, banners };
}

/**
 * Send's sheet (board C3 p2): every other live member the person edits,
 * each compared from its own side (`mine` the target, `theirs` the page's
 * row `fromId`) with Send's preselection (`sendPicks`, `defaultPicks(…,
 * 'send')` turned round: `'theirs'` is what lands), your deletes it still
 * has, the fields both changed, and what the default picks' files charge
 * it. Empty unless the person edits `fromId`. `tz` only changes labels.
 */
export function sendPreview(
	db: Db,
	userId: string,
	kind: CloneKind,
	fromId: number,
	opts: { tz?: string } = {}
): SendTarget[] {
	const { page, others } = liveFamily(db, userId, kind, fromId);
	if (!page || page.access !== 'edit' || page.archived) return [];
	const fromFlat = flatOf(db, kind, fromId);
	const out: SendTarget[] = [];
	for (const target of others) {
		if (target.access !== 'edit') continue;
		const c = compareWith(db, userId, kind, target.id, fromId, opts);
		if (!c) continue;
		const picks = sendPicks(c.diffs);
		const keys = c.diffs.filter((d) => picks[d.key] === 'theirs').map((d) => d.key);
		const files = filesFor(db, kind, fromId, keys, flatOf(db, kind, target.id), fromFlat);
		out.push({
			target,
			comparison: { ...c, picks },
			removals: c.diffs.filter((d) => d.removal && d.side === 'theirs'),
			// A name both changed keeps the target's (sendPicks): not asked.
			both: c.diffs.filter((d) => unpicked(c.diffs, picks).includes(d.key)),
			bytes: files.reduce((n, f) => n + f.bytes, 0)
		});
	}
	return out;
}

const DENIED = { ok: false, reason: 'denied', message: 'Not found.' } as const;

/**
 * Send mine: each target receives the page's row `fromId`'s fields picked
 * `'theirs'` (the target's side, as `sendPreview` gives it), in place,
 * through `syncFrom`: the access check, `seen` (checked again inside the
 * write), the both-changed picks, the files and room, then in the target's
 * own transaction the apply, the pair's next snapshot, and in a group one
 * History `change` by the actor and the reconcile after a delete. One
 * target's refusal, or a throw (a missing file: `failed`, logged), leaves the
 * others as they landed and the rest still tried. Every target is denied
 * unless the actor edits `fromId`; a target they only read is denied.
 */
export async function sendMine(
	db: Db,
	actorId: string,
	kind: CloneKind,
	fromId: number,
	targets: { id: number; picks: Picks; seen: string }[],
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<SendResult[]> {
	const gives = accessTo(db, actorId, kind, fromId) === 'edit';
	const out: SendResult[] = [];
	const done = new Set<number>();
	for (const t of targets) {
		if (done.has(t.id)) continue;
		done.add(t.id);
		if (!gives) {
			out.push({ id: t.id, result: DENIED });
			continue;
		}
		try {
			const result = await syncFrom(
				db,
				actorId,
				kind,
				t.id,
				fromId,
				t.picks,
				t.seen,
				files,
				now,
				freeDiskBytes
			);
			out.push({ id: t.id, result });
		} catch (err) {
			// syncFrom has unlinked what it linked and its transaction rolled back:
			// this target is refused, the next is still tried.
			console.error(`Send mine: ${kind} ${fromId} → ${t.id} failed`, err);
			out.push({ id: t.id, result: { ok: false, reason: 'failed', message: SEND_FAILED } });
		}
	}
	return out;
}
