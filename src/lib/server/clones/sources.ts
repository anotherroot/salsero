/**
 * A tab per source (board C2 p2): every member of a page's family that the
 * person reads, and the rows they marked its twins, as the item pages' switcher
 * draws them. Each copy says where it stands against the page's row (the
 * three-way compare against the pair's snapshot), and what differs.
 *
 * And Take (board C2 p2b): one of a source's recordings, with its sections
 * and their links, copied into the person's own member of the family. Its
 * file is hard-linked under a new name and charged to them, as any clone's.
 *
 * Reads only through `visibleMembers` and `twinsOf`: another person's own
 * member never shows, and a row the person cannot read gives no tabs at all.
 */
import { eq } from 'drizzle-orm';
import type { CloneKind, CompareOffer, Member, PlaceRef, Source, TwinKind } from '$lib/types';
import { diff, standing } from '$lib/clones/diff';
import { changedLabels } from '$lib/clones/view';
import type { Db } from '../db';
import { figures, recordings } from '../db/schema';
import type { Wall } from '../scope';
import { roomForOwner } from '../storage';
import { twinsOf } from '../twins';
import { accessTo, geneOf, memberIn, placeOfRow, visibleMembers } from './genes';
import { hashValue, pairBase } from './pairs';
import { flatOf } from './trees';
import {
	cloneTx,
	planClone,
	type CloneOptions,
	type CloneRequest,
	type CloneResult
} from './clone';
import type { CloneFileKind, CloneFiles } from './files';

/** What `cloneSubtitle` is told about a page's row. */
export type CloneLine = {
	kind: CloneKind;
	self: PlaceRef;
	/** The place the row was copied from, when the person sees it there. */
	clonedFrom: string | null;
	/** How many groups the person sees a live member in. */
	groups: number;
	/** How many other rows the person marked the same. */
	twins: number;
};

export type SourcesView = {
	/** The tabs; empty when there are fewer than two. */
	sources: Source[];
	line: CloneLine;
	/** The person's own live member of the family (this page's row, or another), or null. */
	mineId: number | null;
	/**
	 * The page was opened from the person's copy (`?vs=<its id>`) and is
	 * another place's that they only read: Take brings into `vs`. Null
	 * otherwise (an editor's tab of the group is no read-only source), or
	 * when the id is not their own member of this family.
	 */
	vs: number | null;
	/**
	 * The banner over a row the person edits, when the group's member it was
	 * copied from changed since the two were last in step (its tab `newer` or
	 * `differs`): "Salsa Tuesdays changed it since you took it · Compare".
	 */
	compare: CompareOffer | null;
};

type Twin = { id: number; place: PlaceRef; access: 'edit' | 'read' };

const label = (place: PlaceRef) => (place.kind === 'mine' ? 'Yours' : place.name);

/** Yours first, then groups by name. */
function byPlace(a: { place: PlaceRef }, b: { place: PlaceRef }): number {
	if (a.place.kind !== b.place.kind) return a.place.kind === 'mine' ? -1 : 1;
	return label(a.place).localeCompare(label(b.place));
}

/**
 * The page's family as the person sees it: the page's row (archived or not),
 * the other live members, and the live twins of any of them that are not
 * family. Null when the person cannot read the row.
 */
function familyOf(db: Db, userId: string, kind: CloneKind, id: number) {
	const all = visibleMembers(db, userId, kind, id);
	const page = all.find((m) => m.id === id);
	if (!page) return null;
	const members = all.filter((m) => m.id === id || !m.archived).sort(byPlace);
	const family = new Set(all.map((m) => m.id));
	const twins: Twin[] = [];
	if (kind !== 'drill') {
		for (const m of members) {
			for (const t of twinsOf(db, userId, kind as TwinKind, m.id)) {
				if (family.has(t)) continue;
				family.add(t);
				const place = placeOfRow(db, kind, t);
				const access = accessTo(db, userId, kind, t);
				if (place && access) twins.push({ id: t, place, access });
			}
		}
	}
	twins.sort(byPlace);
	return { all, page, members, twins };
}

/** Where a copy stands against the page's row, and what differs. */
function against(db: Db, kind: CloneKind, pageId: number, other: number) {
	const diffs = diff(
		pairBase(db, kind, pageId, other),
		flatOf(db, kind, pageId),
		flatOf(db, kind, other),
		hashValue
	);
	return { status: standing(diffs), changed: changedLabels(diffs) };
}

/**
 * The page's tabs, its subtitle's facts, the person's own member and the
 * validated `vs` (the raw `?vs=` value).
 */
export function sourcesView(
	db: Db,
	userId: string,
	kind: CloneKind,
	id: number,
	vs: string | null = null
): SourcesView {
	const fam = familyOf(db, userId, kind, id);
	if (!fam) {
		return {
			sources: [],
			line: { kind, self: { kind: 'mine' }, clonedFrom: null, groups: 0, twins: 0 },
			mineId: null,
			vs: null,
			compare: null
		};
	}
	const { all, page, members, twins } = fam;
	const used = new Map<string, number>();
	const named = (place: PlaceRef) => {
		const base = label(place);
		const n = (used.get(base) ?? 0) + 1;
		used.set(base, n);
		return n === 1 ? base : `${base} ${n}`;
	};
	const sources: Source[] = [
		...members.map((m: Member): Source => {
			if (m.id === id)
				return {
					id,
					label: named(m.place),
					relation: 'self',
					access: m.access,
					status: null,
					changed: []
				};
			return {
				id: m.id,
				label: named(m.place),
				relation: 'clone',
				access: m.access,
				...against(db, kind, id, m.id)
			};
		}),
		...twins.map((t): Source => ({
			id: t.id,
			label: named(t.place),
			relation: 'twin',
			access: t.access,
			status: null,
			changed: []
		}))
	];

	const from = page.clonedFrom === null ? null : all.find((m) => m.id === page.clonedFrom);
	const mineId = members.find((m) => m.place.kind === 'mine')?.id ?? null;
	const asked = vs !== null && /^\d+$/.test(vs) ? Number(vs) : null;
	// The banner: a row the person edits, copied from a group's member they still read.
	const origin =
		from && from.place.kind === 'team' && !from.archived && page.access === 'edit'
			? { id: from.id, place: from.place.name }
			: null;
	const source = origin ? sources.find((s) => s.id === origin.id) : undefined;
	const compare =
		origin && source && (source.status === 'newer' || source.status === 'differs')
			? { ...origin, changed: source.changed }
			: null;
	return {
		sources: sources.length < 2 ? [] : sources,
		line: {
			kind,
			self: page.place,
			clonedFrom: from ? label(from.place) : null,
			groups: members.filter((m) => m.place.kind === 'team').length,
			twins: twins.length
		},
		mineId,
		vs:
			page.place.kind !== 'mine' && page.access === 'read' && asked !== null && asked === mineId
				? asked
				: null,
		compare
	};
}

/**
 * The tabs of a member page: the person's own member first ("Yours"), then
 * the other live members they read by group name, then twins; the page's
 * row is `self` (where it falls in that order, so the switcher does not
 * reorder as one moves between tabs). A copy's status is against the page's
 * row. Fewer than two gives none.
 */
export function sourcesOf(db: Db, userId: string, kind: CloneKind, id: number): Source[] {
	return sourcesView(db, userId, kind, id).sources;
}

/** What the page's subtitle says (`cloneSubtitle`). */
export function cloneLineOf(db: Db, userId: string, kind: CloneKind, id: number): CloneLine {
	return sourcesView(db, userId, kind, id).line;
}

/** The recording genes a figure holds: which of a source's recordings are already in it. */
export function genesHeld(db: Db, figureId: number): Set<string> {
	return new Set(
		db
			.select({ gene: recordings.geneId })
			.from(recordings)
			.where(eq(recordings.figureId, figureId))
			.all()
			.flatMap((r) => (r.gene === null ? [] : [r.gene]))
	);
}

/* ── Take ───────────────────────────────────────────────────────────────── */

export type TakeResult = CloneResult | { ok: false; reason: 'held' };

const DENIED = { ok: false, reason: 'denied' } as const;

/**
 * Take one of a source's recordings into the person's own figure
 * `intoFigureId`: their live member of the recording's figure's family. The
 * recording comes with its sections, and each section's links become the
 * person's member of the target (or a copy of it, with no recordings), as
 * any clone maps them. Its file is hard-linked under a new name, charged to
 * them: refused for room before anything is linked. Refused (`held`) when
 * their figure already holds that recording's family. The piece leaves the
 * pair's `skip` and enters its snapshot, so a compare reads it as in step.
 * `denied` for anything else: a recording they cannot read, a figure that is
 * not theirs or not of its family.
 */
export async function takeRecording(
	db: Db,
	wall: Wall,
	intoFigureId: number,
	recordingId: number,
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<TakeResult> {
	const rec = db.select().from(recordings).where(eq(recordings.id, recordingId)).get();
	if (!rec || rec.figureId === intoFigureId) return DENIED;
	const source = db.select().from(figures).where(eq(figures.id, rec.figureId)).get();
	if (!source || source.archivedAt !== null || source.dance !== wall.dance) return DENIED;
	if (accessTo(db, wall.userId, 'figure', source.id) === null) return DENIED;
	const gene = geneOf(db, 'figure', source.id);
	const into = gene === null ? null : memberIn(db, 'figure', gene, wall);
	if (!into || into.id !== intoFigureId || into.archived) return DENIED;
	if (rec.geneId !== null && genesHeld(db, intoFigureId).has(rec.geneId))
		return { ok: false, reason: 'held' };

	const req: CloneRequest = { kind: 'figure', id: source.id, into: wall, recordings: true };
	const opts: CloneOptions = { fill: true, only: [rec.id] };
	const plan = planClone(db, req, opts);
	if (plan.existing?.id !== intoFigureId) return DENIED;
	if (plan.bytes > 0) {
		const room = roomForOwner(db, { userId: wall.userId }, plan.bytes, freeDiskBytes);
		if (!room.ok) return { ok: false, reason: 'room', room };
	}

	const made: [CloneFileKind, string][] = [];
	const unlinkAll = () => Promise.all(made.map(([kind, file]) => files.unlink(kind, file)));
	const linked = new Map<string, string>();
	try {
		for (const f of plan.files) {
			const name = await files.link(f.kind, f.file);
			made.push([f.kind, name]);
			linked.set(f.key, name);
		}
		const result = cloneTx(db, req, linked, now, opts);
		// Taken only if a row of the recording's family now sits on the figure.
		const landed =
			result.ok && genesHeld(db, intoFigureId).has(geneOf(db, 'recording', rec.id) ?? '');
		if (!landed) {
			await unlinkAll();
			return result.ok ? DENIED : result;
		}
		return result;
	} catch (err) {
		await unlinkAll();
		throw err;
	}
}

/** What a member page's load sends: its tabs, its subtitle's facts, and `vs` from its URL. */
export function pageSources(db: Db, userId: string, kind: CloneKind, id: number, url: URL) {
	const v = sourcesView(db, userId, kind, id, url.searchParams.get('vs'));
	return { sources: v.sources, cloneLine: v.line, mineId: v.mineId, vs: v.vs, compare: v.compare };
}
