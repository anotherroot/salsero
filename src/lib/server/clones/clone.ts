/**
 * The clone engine: a figure, a drill, a song, a routine or a lesson copied
 * into another place — a person's own app or a group — as a member of the
 * same family.
 *
 * A clone stamps the family's gene on the source (root and pieces) and writes
 * it on the copy, records `cloned_from`, writes the pair's snapshot (the
 * source's hashes; the recordings left behind in `skip`), and logs `add` in a
 * group as the kind's create function does: one line per thing made. Files
 * are hard-linked under new names before the transaction (`CloneFiles`), so
 * one side's delete or purge never takes the other's file, and are charged to
 * the receiving place. A refusal or a throw unlinks every name this call made.
 *
 * Every reference inside a copy (a routine's options and embedded routine, a
 * lesson's hand links, a section's links) becomes the receiving place's member
 * of that family: the row itself when it is there, the family's member there
 * (archived included, linked as it is), else a clone of it made in the same
 * call when it is live and the actor reads it (any live one, when
 * `trusted`), with the same `recordings` flag. A reference to an archived
 * row (or a figure under an archived move) or one the actor cannot read is
 * dropped; only the root may be archived, and only with `archivedRoot`.
 *
 * At most one member of a family per place: copying again answers the member
 * already there (`made: false`, archived or not), and copying into the
 * source's own place answers the source.
 *
 * `cloneInto` is the whole flow (checks, room, files, the write); `cloneTx` is
 * the write alone, for callers already inside a transaction (the rescue,
 * Keep), and runs in a savepoint so a refusal leaves nothing behind.
 */
import { and, asc, eq, isNotNull, type SQL } from 'drizzle-orm';
import type { CloneKind, PieceKind } from '$lib/types';
import { initialBase } from '$lib/clones/diff';
import { shortNames } from '$lib/names';
import type { Db } from '../db';
import {
	exercises,
	figureGroups,
	figureStartPositions,
	figures,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	links,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	songs,
	spotLinks,
	users,
	videoSpots
} from '../db/schema';
import { inSpace, isTeam, actorOf, ownerValues, type Space } from '../scope';
import { getTeam, roleOf } from '../teams';
import { roomForOwner, type Owner, type Room } from '../storage';
import { logChange, type ChangeEntry } from '../changes';
import { figureNameTaken, moveFor, variationNameTaken } from '../figures';
import { insertRoutine, routineSlots } from '../routines';
import { insertLesson } from '../lessons';
import { suffixed } from './names';
import { entryFor, type EntryTarget } from '../entries';
import { accessTo, memberIn, stampGene } from './genes';
import { hashValue, pairBase, writePair } from './pairs';
import { flatOf } from './trees';
import type { CloneFileKind, CloneFiles } from './files';

export type CloneRequest = {
	kind: CloneKind;
	id: number;
	into: Space;
	/** Bring the figures' recordings (with their sections), nested figures' too. */
	recordings: boolean;
	/** Skip the room check (Keep: losing access must not lose the files). */
	overLimitOk?: boolean;
	/**
	 * A family's gene → the row to copy for that family (the twin chosen in Copy
	 * to…); a row with no gene yet is keyed `<kind>#<id>` (`useKey`).
	 */
	use?: Record<string, number>;
};

/**
 * What only the server's own flows decide, never a request: kept out of
 * `CloneRequest` so no route can set it by spreading form data.
 */
export type CloneOptions = {
	/** Skip the read check (the root's and every reference's): the rescue and Keep only. */
	trusted?: boolean;
	/** Allow an archived root; a nested reference to an archived row still drops. */
	archivedRoot?: boolean;
	/**
	 * Keep: when the family's member is already in `into`, add the source's
	 * recordings (with `recordings`) and lesson videos it lacks, matched by gene
	 * inside the parent, with their sections; no field of the member changes.
	 */
	fill?: boolean;
	/**
	 * Take: of the figures' recordings (with `recordings`), only these travel,
	 * by the source's recording id; every other one stays behind, in `skip`,
	 * nested copies' included.
	 */
	only?: number[];
	/** Collects every root this call copied (the request's and nested ones), once it lands. */
	made?: ClonePair[];
	/**
	 * `cloneInto` only: run in the same transaction as the write, once it
	 * answers ok (a new copy, or the member already there), so what follows
	 * the copy (Make it mine's re-point) lands with it or not at all. A throw
	 * rolls the copy back and unlinks its files.
	 */
	after?: (tx: Db, result: Extract<CloneResult, { ok: true }>) => void;
};

/** A root a clone call made: `from` (the source row) became `id` in `into`. */
export type ClonePair = { kind: CloneKind; from: number; id: number };

export type CloneResult =
	| { ok: true; id: number; made: boolean; archived: boolean }
	| { ok: false; reason: 'room'; room: Room }
	| { ok: false; reason: 'name'; message: string }
	| { ok: false; reason: 'denied' };

/** One file a clone links: `key` is what `cloneTx` looks the new name up by. */
export type PlanFile = { key: string; kind: CloneFileKind; file: string; bytes: number };

export type ClonePlan = {
	kind: CloneKind;
	/** The row that would be copied (after `use`); null when there is none of this kind. */
	sourceId: number | null;
	/** The family's member already in `into` (the source itself, when it is there). */
	existing: { id: number; archived: boolean } | null;
	/** The rows a clone would make, by the row each is copied from. */
	rows: { kind: CloneKind | PieceKind; from: number }[];
	/** The references (not the root) that link the member already in `into`: `from` → `at`. */
	reused: { kind: CloneKind; from: number; at: number }[];
	files: PlanFile[];
	/** What `into` is charged: the files' bytes. */
	bytes: number;
};

/** The key a linked file is found by in `cloneTx`'s `linked` map. */
export const fileKey = (kind: CloneFileKind, file: string) => `${kind}:${file}`;

/** A refusal raised inside the write, so the savepoint rolls back. */
class Refusal extends Error {
	constructor(readonly result: Extract<CloneResult, { ok: false }>) {
		super(result.reason);
	}
}

const DENIED = { ok: false, reason: 'denied' } as const;

/* ── Roots ──────────────────────────────────────────────────────────────── */

type RootRow = {
	id: number;
	dance: string;
	userId: string | null;
	teamId: number | null;
	archivedAt: number | null;
	geneId: string | null;
};

/** A root row of the kind (a drill only when `source = 'custom'`), or null. */
function rootRow(db: Db, kind: CloneKind, id: number): RootRow | null {
	switch (kind) {
		case 'figure':
			return db.select().from(figures).where(eq(figures.id, id)).get() ?? null;
		case 'drill':
			return (
				db
					.select()
					.from(exercises)
					.where(and(eq(exercises.id, id), eq(exercises.source, 'custom')))
					.get() ?? null
			);
		case 'song':
			return db.select().from(songs).where(eq(songs.id, id)).get() ?? null;
		case 'routine':
			return db.select().from(routines).where(eq(routines.id, id)).get() ?? null;
		case 'lesson':
			return db.select().from(lessons).where(eq(lessons.id, id)).get() ?? null;
	}
}

/** The key `use` names a row's family by: its gene, or `<kind>#<id>` while it has none. */
export const useKey = (kind: CloneKind, row: { id: number; geneId: string | null }) =>
	row.geneId ?? `${kind}#${row.id}`;

/** The row to copy for a reference to `id`: itself, or the one `use` names for its family. */
function chosenRow(db: Db, kind: CloneKind, id: number, use: CloneRequest['use']): RootRow | null {
	const row = rootRow(db, kind, id);
	if (!row || !use) return row;
	const chosen = use[useKey(kind, row)];
	return chosen === undefined || chosen === row.id ? row : rootRow(db, kind, chosen);
}

/** The request's own row to copy (after `use`). */
const sourceOf = (db: Db, req: CloneRequest) => chosenRow(db, req.kind, req.id, req.use);

/** The family's member in the place: the row itself when it is there, else its gene's member. */
function existingIn(
	db: Db,
	kind: CloneKind,
	row: RootRow,
	place: Space
): { id: number; archived: boolean } | null {
	if (inSpace(row, place)) return { id: row.id, archived: row.archivedAt !== null };
	return row.geneId === null ? null : memberIn(db, kind, row.geneId, place);
}

const ownerOf = (s: Space): Owner => (isTeam(s) ? { teamId: s.teamId } : { userId: s.userId });

/** Where a reference inside a copy goes: a row already in `into`, a row to clone, or nowhere. */
type RefTo = { at: number } | { clone: RootRow } | null;

/**
 * The reference rule, shared by the plan and the write: the chosen row (after
 * `use`) when it is in `into`, else its family's member there (archived
 * included), else the row to clone when it is of `into`'s dance, live (a
 * figure's move too) and readable to the actor (any, when `trusted`), else
 * null: the reference drops. `archivedRoot` never reaches a reference.
 */
function refTarget(
	db: Db,
	kind: CloneKind,
	id: number,
	req: CloneRequest,
	opts: CloneOptions
): RefTo {
	const row = chosenRow(db, kind, id, req.use);
	if (!row) return null;
	const found = existingIn(db, kind, row, req.into);
	if (found) return { at: found.id };
	if (row.dance !== req.into.dance) return null;
	if (row.archivedAt !== null) return null;
	if (kind === 'figure' && underArchivedMove(db, row.id)) return null;
	if (!opts.trusted && accessTo(db, actorOf(req.into), kind, row.id) === null) return null;
	return { clone: row };
}

/** Whether a figure's move is archived (or missing). */
function underArchivedMove(db: Db, figureId: number): boolean {
	const move = db
		.select({ archivedAt: figureGroups.archivedAt })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(eq(figures.id, figureId))
		.get();
	return !move || move.archivedAt !== null;
}

/* ── Plan ───────────────────────────────────────────────────────────────── */

/**
 * What a clone would do, reading only: the source (after `use`), the member
 * it would reuse, else the rows it would make (the nested clones its
 * references bring included), the files to link and the bytes charged to
 * `into`. Says nothing about whether the actor may make it.
 */
export function planClone(db: Db, req: CloneRequest, opts: CloneOptions = {}): ClonePlan {
	const plan: ClonePlan = {
		kind: req.kind,
		sourceId: null,
		existing: null,
		rows: [],
		reused: [],
		files: [],
		bytes: 0
	};
	const src = sourceOf(db, req);
	if (!src) return plan;
	plan.sourceId = src.id;
	plan.existing = existingIn(db, req.kind, src, req.into);
	if (plan.existing) {
		if (opts.fill && plan.existing.id !== src.id)
			new Planner(db, req, opts, plan).fill(req.kind, src, plan.existing.id);
	} else new Planner(db, req, opts, plan).visit(req.kind, src);
	plan.bytes = plan.files.reduce((n, f) => n + f.bytes, 0);
	return plan;
}

/**
 * The plan's walk: the write's tree, read only. Every root it would clone,
 * once (a family already planned, by id or by gene, is not planned again),
 * with the pieces and files that root brings.
 */
class Planner {
	private seen = new Set<string>();

	constructor(
		readonly db: Db,
		readonly req: CloneRequest,
		readonly opts: CloneOptions,
		readonly plan: ClonePlan
	) {}

	visit(kind: CloneKind, row: RootRow): void {
		this.seen.add(`${kind}:${row.id}`);
		if (row.geneId !== null) this.seen.add(`${kind}:gene:${row.geneId}`);
		this.plan.rows.push({ kind, from: row.id });
		const { db } = this;
		switch (kind) {
			case 'figure':
				this.pieces(kind, row.id, null);
				return;
			case 'routine':
				for (const slot of routineSlots(db, row.id)) {
					if (slot.childId !== null) this.ref('routine', slot.childId);
					for (const f of slot.figureIds) this.ref('figure', f);
				}
				return;
			case 'lesson': {
				const hand = handLinks(db, row.id);
				for (const id of hand.figures) this.ref('figure', id);
				for (const id of hand.routines) this.ref('routine', id);
				for (const id of hand.exercises) this.ref('drill', id);
				this.pieces(kind, row.id, null);
				return;
			}
			case 'song': {
				const s = db.select().from(songs).where(eq(songs.id, row.id)).get()!;
				if (s.audioFile) this.file('audio', s.audioFile, s.sizeBytes ?? 0);
				return;
			}
			case 'drill':
				return;
		}
	}

	/** `fill`: the pieces the member already in `into` lacks, as a clone would bring them. */
	fill(kind: CloneKind, row: RootRow, memberId: number): void {
		this.seen.add(`${kind}:${row.id}`);
		if (row.geneId !== null) this.seen.add(`${kind}:gene:${row.geneId}`);
		this.pieces(kind, row.id, memberId);
	}

	/** A figure's recordings (when asked for) or a lesson's videos: all, or those `memberId` lacks. */
	private pieces(kind: CloneKind, sourceId: number, memberId: number | null): void {
		if (kind === 'figure' && this.req.recordings) {
			for (const r of travelling(
				missing(recordingsOf(this.db, sourceId), memberId, (id) => recordingsOf(this.db, id)),
				this.opts
			)) {
				this.plan.rows.push({ kind: 'recording', from: r.id });
				this.file('recording', r.file, r.sizeBytes);
				this.spots({ recordingId: r.id });
			}
		}
		if (kind === 'lesson') {
			for (const v of missing(videosOf(this.db, sourceId), memberId, (id) =>
				videosOf(this.db, id)
			)) {
				this.plan.rows.push({ kind: 'video', from: v.id });
				this.file('lesson-video', v.file, v.sizeBytes);
				this.spots({ lessonVideoId: v.id });
			}
		}
	}

	private file(kind: CloneFileKind, file: string, bytes: number): void {
		this.plan.files.push({ key: fileKey(kind, file), kind, file, bytes });
	}

	private spots(owner: SpotOwner): void {
		for (const s of spotsOf(this.db, owner)) {
			this.plan.rows.push({ kind: 'spot', from: s.id });
			for (const t of linksOfSpot(this.db, s.id)) {
				if (t.figureId !== null) this.ref('figure', t.figureId);
				else this.ref('drill', t.exerciseId!);
			}
		}
	}

	private ref(kind: CloneKind, id: number): void {
		if (this.seen.has(`${kind}:${id}`)) return;
		this.seen.add(`${kind}:${id}`);
		const to = refTarget(this.db, kind, id, this.req, this.opts);
		if (to && 'at' in to) this.plan.reused.push({ kind, from: id, at: to.at });
		if (!to || 'at' in to) return;
		const row = to.clone;
		// `use` chose another row of the family, or a twin of it is planned already.
		if (row.id !== id && this.seen.has(`${kind}:${row.id}`)) return;
		if (row.geneId !== null && this.seen.has(`${kind}:gene:${row.geneId}`)) return;
		this.visit(kind, row);
	}
}

/**
 * Whether the actor (`into`'s) may make this clone: the source is of the
 * place's dance, live and readable to them (unless `trusted`), a song is
 * ready, and they edit `into` (their own app, or a living group they own or
 * edit).
 */
function mayClone(db: Db, req: CloneRequest, sourceId: number, opts: CloneOptions): boolean {
	const src = rootRow(db, req.kind, sourceId);
	if (!src || src.dance !== req.into.dance) return false;
	const actor = actorOf(req.into);
	if (!opts.archivedRoot && src.archivedAt !== null) return false;
	if (!opts.trusted && accessTo(db, actor, req.kind, src.id) === null) return false;
	if (req.kind === 'song') {
		const song = db.select().from(songs).where(eq(songs.id, src.id)).get()!;
		if (song.status !== 'ready' || !song.audioFile) return false;
	}
	if (isTeam(req.into)) {
		const team = getTeam(db, req.into.teamId);
		if (!team || team.deletedAt !== null || team.purgedAt !== null) return false;
		if (team.dance !== req.into.dance) return false;
		const role = roleOf(db, actor, team.id);
		if (role !== 'owner' && role !== 'editor') return false;
	}
	return true;
}

/* ── The whole flow ─────────────────────────────────────────────────────── */

/**
 * Clone a figure, drill, song, routine or lesson into `into` for its actor. `denied` unless
 * they may (`mayClone`); the member already there is answered as it is; a
 * clone that does not fit `into`'s room (or the disk floor) is refused before
 * any file is linked, unless `overLimitOk` (a clone with no files charges
 * nothing and is never refused for room). Files are linked, then the rows
 * written in one transaction; a refusal, a reuse found only then, or a throw
 * unlinks every name linked here (a throw is rethrown). `after` runs inside that
 * transaction (for a reuse, in one of its own).
 */
export async function cloneInto(
	db: Db,
	req: CloneRequest,
	files: CloneFiles,
	now: number,
	freeDiskBytes = Number.POSITIVE_INFINITY,
	opts: CloneOptions = {}
): Promise<CloneResult> {
	const plan = planClone(db, req, opts);
	if (plan.sourceId === null || !mayClone(db, req, plan.sourceId, opts)) return DENIED;
	if (plan.existing) {
		const result = { ok: true as const, made: false, ...plan.existing };
		const { after } = opts;
		if (after) db.transaction((tx) => after(tx as unknown as Db, result));
		return result;
	}
	if (plan.bytes > 0 && !req.overLimitOk) {
		const room = roomForOwner(db, ownerOf(req.into), plan.bytes, freeDiskBytes);
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
		const { after } = opts;
		const result = after
			? db.transaction((tx) => {
					const r = cloneTx(tx as unknown as Db, req, linked, now, opts);
					if (r.ok) after(tx as unknown as Db, r);
					return r;
				})
			: cloneTx(db, req, linked, now, opts);
		if (!result.ok || !result.made) await unlinkAll();
		return result;
	} catch (err) {
		await unlinkAll();
		throw err;
	}
}

/* ── The write ──────────────────────────────────────────────────────────── */

/**
 * The clone's rows, synchronously, inside a savepoint of `tx` (a transaction
 * of its own when `tx` is the database): a refusal rolls back everything this
 * call wrote, genes included. `linked` maps `fileKey(kind, file)` → the new
 * name; a recording or lesson video whose file is not in it stays behind (in the pair's
 * `skip`, so Take can bring it). Checks nothing about who acts: `cloneInto`
 * does, and the rescue and Keep pass `trusted` sources they decided on.
 * With `fill`, a member already there gets the source's pieces it lacks.
 * `made` receives every root copied, once the savepoint has landed.
 */
export function cloneTx(
	tx: Db,
	req: CloneRequest,
	linked: Map<string, string>,
	now: number,
	opts: CloneOptions = {}
): CloneResult {
	try {
		return tx.transaction((inner) => {
			const src = sourceOf(inner, req);
			if (!src) throw new Refusal(DENIED);
			const m = new Mapper(inner as unknown as Db, req, linked, now, opts);
			const existing = existingIn(inner, req.kind, src, req.into);
			let result: CloneResult;
			if (existing) {
				if (opts.fill && existing.id !== src.id) m.fill(req.kind, src.id, existing.id);
				result = { ok: true as const, made: false, ...existing };
			} else {
				result = { ok: true as const, id: m.clone(req.kind, src.id), made: true, archived: false };
			}
			opts.made?.push(...m.made);
			return result;
		});
	} catch (err) {
		if (err instanceof Refusal) return err.result;
		throw err;
	}
}

/** What a kind's copier made: the new root, the pieces it left behind, its History line. */
type Copied = { id: number; skip: string[]; log: ChangeEntry };
type Copier = (m: Mapper, sourceId: number, gene: string) => Copied;

/**
 * One clone call's state: where it writes, the files it linked, and which
 * source row became which row in `into`, so a reference inside the copy
 * (a section's link, a routine's slots, a lesson's hand links) points at the
 * place's member of that family.
 */
export class Mapper {
	/** `${kind}:${sourceId}` → the row in `into` (null: dropped). */
	private memo = new Map<string, number | null>();
	/** Every root this call copied, in the order made. */
	readonly made: ClonePair[] = [];

	constructor(
		readonly tx: Db,
		readonly req: CloneRequest,
		readonly linked: Map<string, string>,
		readonly now: number,
		readonly opts: CloneOptions
	) {}

	get into(): Space {
		return this.req.into;
	}

	/**
	 * Copy one root into `into`: stamp the family's gene, write the copy (its
	 * kind's copier), the pair's snapshot (the source's Flat after every stamp,
	 * so `skip` names the real genes) and its History line. Returns the copy's id.
	 */
	clone(kind: CloneKind, sourceId: number): number {
		const copier = COPIERS[kind];
		const gene = stampGene(this.tx, kind, sourceId);
		const made = copier(this, sourceId, gene);
		const base = initialBase(flatOf(this.tx, kind, sourceId), made.skip, hashValue);
		// What holds references holds what the copy got: a reference the engine
		// dropped (the actor cannot read its target) is not the copy's own change,
		// and a later Send must not remove it from the source. A carried
		// section's links, a routine's slots, a lesson's hand links (a dropped
		// one leaves the snapshot, so the source reads as having added it).
		const copied = flatOf(this.tx, kind, made.id);
		for (const key of Object.keys(base.fields)) {
			const has = Object.hasOwn(copied, key);
			if (key.endsWith(':links') ? has : refKey(kind, key)) {
				if (has) base.fields[key] = hashValue(copied[key].value);
				else delete base.fields[key];
			}
		}
		writePair(this.tx, kind, sourceId, made.id, base, this.now);
		logChange(this.tx, this.into, made.log, this.now);
		this.made.push({ kind, from: sourceId, id: made.id });
		return made.id;
	}

	/**
	 * `fill`: the source's recordings (with `recordings`) or lesson videos that
	 * the member `memberId` lacks (matched by gene inside the parent), copied
	 * onto it as a clone would, with their sections and section links. No
	 * field of the member changes. Each piece added leaves the pair's `skip`
	 * and enters its snapshot, so a compare reads it as in step.
	 */
	fill(kind: CloneKind, sourceId: number, memberId: number): void {
		const { tx } = this;
		this.started(kind, sourceId, memberId);
		const added: string[] = [];
		if (kind === 'figure' && this.req.recordings) {
			for (const r of travelling(
				missing(recordingsOf(tx, sourceId), memberId, (id) => recordingsOf(tx, id)),
				this.opts
			)) {
				const gene = stampGene(tx, 'recording', r.id);
				const file = this.linked.get(fileKey('recording', r.file));
				if (file === undefined) continue;
				copyRecording(this, r, memberId, gene, file);
				added.push(`rec:${gene}`);
			}
		}
		if (kind === 'lesson') {
			for (const v of missing(videosOf(tx, sourceId), memberId, (id) => videosOf(tx, id))) {
				const gene = stampGene(tx, 'video', v.id);
				const file = this.linked.get(fileKey('lesson-video', v.file));
				if (file === undefined) continue;
				copyVideo(this, v, memberId, gene, file);
				added.push(`video:${gene}`);
			}
		}
		if (added.length === 0) return;
		const base = pairBase(tx, kind, sourceId, memberId);
		// Never in step as a pair (a copy of a copy): no snapshot to claim.
		if (!base) return;
		const source = flatOf(tx, kind, sourceId);
		const member = flatOf(tx, kind, memberId);
		for (const piece of added) {
			base.skip = base.skip.filter((k) => k !== piece);
			for (const key of Object.keys(source)) {
				if (key !== piece && !key.startsWith(`${piece}:`)) continue;
				if (!key.endsWith(':links')) base.fields[key] = hashValue(source[key].value);
				else if (Object.hasOwn(member, key)) base.fields[key] = hashValue(member[key].value);
				else delete base.fields[key];
			}
		}
		writePair(tx, kind, sourceId, memberId, base, this.now);
	}

	/** Record a root's copy as soon as it exists, so a reference back to it finds it. */
	started(kind: CloneKind, sourceId: number, id: number): void {
		this.memo.set(`${kind}:${sourceId}`, id);
	}

	/**
	 * The row in `into` a reference to `sourceId` becomes (`refTarget`): the
	 * copy made by this call (one still being made included, so a section
	 * linking back to its own figure does not recurse), the row itself when it
	 * is in `into` already, the family's member there (archived included), else
	 * a clone of the chosen row made now, with the request's `recordings`.
	 * Null drops the reference. Memoised per call.
	 */
	ref(kind: CloneKind, sourceId: number): number | null {
		const key = `${kind}:${sourceId}`;
		if (this.memo.has(key)) return this.memo.get(key)!;
		const to = refTarget(this.tx, kind, sourceId, this.req, this.opts);
		let id: number | null = null;
		if (to && 'at' in to) id = to.at;
		else if (to) {
			const chosen = `${kind}:${to.clone.id}`;
			id = this.memo.has(chosen) ? this.memo.get(chosen)! : this.clone(kind, to.clone.id);
		}
		this.memo.set(key, id);
		return id;
	}
}

/** Whether a root field of the kind holds references the engine maps (or drops). */
function refKey(kind: CloneKind, key: string): boolean {
	if (kind === 'routine') return key === 'slots';
	if (kind === 'lesson') return /^(fig|routine|drill):/.test(key);
	return false;
}

/**
 * Whether a person's own copy starts paused: they practise its source
 * through a live entry (R23), and Today must not double. Never in a group.
 */
function practised(tx: Db, into: Space, source: EntryTarget): boolean {
	return !isTeam(into) && entryFor(tx, into.userId, source)?.archivedAt === null;
}

const pause = (tx: Db, exerciseId: number) =>
	tx.update(exercises).set({ active: false }).where(eq(exercises.id, exerciseId)).run();

/* ── Figures ────────────────────────────────────────────────────────────── */

export const recordingsOf = (db: Db, figureId: number) =>
	db
		.select()
		.from(recordings)
		.where(eq(recordings.figureId, figureId))
		.orderBy(asc(recordings.id))
		.all();

/** What a spot sits on: a figure's recording or a lesson's video. */
export type SpotOwner = { recordingId: number } | { lessonVideoId: number };

export const spotsOf = (db: Db, owner: SpotOwner) =>
	db
		.select()
		.from(videoSpots)
		.where(
			'recordingId' in owner
				? eq(videoSpots.recordingId, owner.recordingId)
				: eq(videoSpots.lessonVideoId, owner.lessonVideoId)
		)
		.orderBy(asc(videoSpots.id))
		.all();

export const linksOfSpot = (db: Db, spotId: number) =>
	db.select().from(spotLinks).where(eq(spotLinks.spotId, spotId)).orderBy(asc(spotLinks.id)).all();

/** How a source's place is named in a suffix: its group's name, or its person's shown name. */
function placeName(db: Db, row: { userId: string | null; teamId: number | null }): string {
	if (row.teamId !== null) return getTeam(db, row.teamId)?.name ?? 'group';
	const user = row.userId
		? db.select().from(users).where(eq(users.id, row.userId)).get()
		: undefined;
	return (user && shortNames([user]).get(user.id)) || 'copy';
}

/** How many numbered suffixes are tried ("(Salsa Tuesdays 2)" … "9") before a refusal. */
const SUFFIX_TRIES = 9;

/**
 * The figure's name in the move: kept when free, else "Doble (Salsa
 * Tuesdays)", then "Doble (Salsa Tuesdays 2)" and on; a refusal once those
 * are all taken.
 */
function freeName(tx: Db, groupId: number, name: string, place: string, move: string): string {
	if (!variationNameTaken(tx, groupId, name, null)) return name;
	for (let n = 1; n <= SUFFIX_TRIES; n++) {
		const candidate = suffixed(name, n === 1 ? ` (${place})` : ` (${place} ${n})`);
		if (!variationNameTaken(tx, groupId, candidate, null)) return candidate;
	}
	throw new Refusal({
		ok: false,
		reason: 'name',
		message: `${name} is taken in ${move}; rename one first.`
	});
}

type LinkOwner = { figureId: number } | { exerciseId: number } | { lessonId: number };

/** A figure's, a drill's or a lesson's URL links, onto its copy. Saves in flight stay behind. */
function copyLinks(tx: Db, from: LinkOwner, to: LinkOwner, now: number): void {
	const where: SQL =
		'figureId' in from
			? eq(links.figureId, from.figureId)
			: 'exerciseId' in from
				? eq(links.exerciseId, from.exerciseId)
				: eq(links.lessonId, from.lessonId);
	const rows = tx.select().from(links).where(where).orderBy(asc(links.id)).all();
	if (rows.length === 0) return;
	tx.insert(links)
		.values(rows.map((l) => ({ ...to, url: l.url, title: l.title, createdAt: now })))
		.run();
}

/**
 * A figure: under `into`'s live move of the source's move name (made when
 * missing), its name kept unless taken there; its shape, notes, positions and
 * links; its recordings, sections and section links when the request brings
 * them (else each recording is in `skip`). No exercise: practice is opt-in.
 */
function copyFigure(m: Mapper, sourceId: number, gene: string): Copied {
	const { tx, into, now } = m;
	const src = tx.select().from(figures).where(eq(figures.id, sourceId)).get()!;
	const move =
		(src.groupId !== null
			? tx.select().from(figureGroups).where(eq(figureGroups.id, src.groupId)).get()?.name
			: null) ?? src.name;
	const newMove = !figureNameTaken(tx, into, move, null);
	const groupId = moveFor(tx, into, move);
	const name = freeName(tx, groupId, src.name, placeName(tx, src), move);
	const copy = tx
		.insert(figures)
		.values({
			...ownerValues(into),
			groupId,
			name,
			notes: src.notes,
			partner: src.partner,
			styleTag: src.styleTag,
			endPositionId: src.endPositionId,
			startCount: src.startCount,
			lengthCounts: src.lengthCounts,
			createdAt: now,
			geneId: gene,
			clonedFrom: src.id
		})
		.returning({ id: figures.id })
		.get();
	m.started('figure', src.id, copy.id);

	const starts = tx
		.select({ positionId: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, src.id))
		.all();
	if (starts.length > 0) {
		tx.insert(figureStartPositions)
			.values(starts.map((s) => ({ figureId: copy.id, positionId: s.positionId })))
			.run();
	}
	copyLinks(tx, { figureId: src.id }, { figureId: copy.id }, now);

	const skip: string[] = [];
	for (const r of recordingsOf(tx, src.id)) {
		const recGene = stampGene(tx, 'recording', r.id);
		const travels = m.req.recordings && travelling([r], m.opts).length > 0;
		const file = travels ? m.linked.get(fileKey('recording', r.file)) : undefined;
		if (file === undefined) {
			// Deliberate: not asked for, or added between the plan and this write
			// (a race), so it stays behind, in `skip`, for Take to bring.
			skip.push(`rec:${recGene}`);
			continue;
		}
		copyRecording(m, r, copy.id, recGene, file);
	}

	const log: ChangeEntry = newMove
		? {
				rootKind: 'figure',
				rootId: groupId,
				subjectId: groupId,
				verb: 'add',
				subject: 'figure',
				after: { name: move }
			}
		: {
				rootKind: 'figure',
				rootId: groupId,
				subjectId: copy.id,
				verb: 'add',
				subject: 'variation',
				after: { name }
			};
	return { id: copy.id, skip, log };
}

/** The rows of `pieces` (a source's) whose family has no member among `memberId`'s (all, for null). */
function missing<P extends { geneId: string | null }>(
	pieces: P[],
	memberId: number | null,
	of: (id: number) => { geneId: string | null }[]
): P[] {
	if (memberId === null) return pieces;
	const have = new Set(of(memberId).map((p) => p.geneId));
	return pieces.filter((p) => p.geneId === null || !have.has(p.geneId));
}

/** The recordings that may travel: all, or only those `only` names. */
function travelling<R extends { id: number }>(rows: R[], opts: CloneOptions): R[] {
	const { only } = opts;
	return only ? rows.filter((r) => only.includes(r.id)) : rows;
}

/** The bytes `fill` would bring a member: the files of the source's pieces it lacks. */
export function missingBytes(db: Db, kind: CloneKind, sourceId: number, memberId: number): number {
	if (sourceId === memberId) return 0;
	const sum = (rows: { sizeBytes: number }[]) => rows.reduce((n, r) => n + r.sizeBytes, 0);
	if (kind === 'figure')
		return sum(missing(recordingsOf(db, sourceId), memberId, (id) => recordingsOf(db, id)));
	if (kind === 'lesson')
		return sum(missing(videosOf(db, sourceId), memberId, (id) => videosOf(db, id)));
	return 0;
}

export type RecordingRow = typeof recordings.$inferSelect;
export type VideoRow = typeof lessonVideos.$inferSelect;

/** One recording onto a figure in `into`, under its new file name, with its sections. */
export function copyRecording(
	m: Mapper,
	r: RecordingRow,
	figureId: number,
	gene: string,
	file: string
) {
	const rec = m.tx
		.insert(recordings)
		.values({
			figureId,
			file,
			mime: r.mime,
			kind: r.kind,
			sizeBytes: r.sizeBytes,
			note: r.note,
			sourceUrl: r.sourceUrl,
			createdAt: r.createdAt,
			geneId: gene,
			clonedFrom: r.id
		})
		.returning({ id: recordings.id })
		.get();
	copySpots(m, { recordingId: r.id }, { recordingId: rec.id });
}

/** One lesson video onto a lesson in `into`, under its new file name, with its sections. */
export function copyVideo(m: Mapper, v: VideoRow, lessonId: number, gene: string, file: string) {
	const video = m.tx
		.insert(lessonVideos)
		.values({
			lessonId,
			file,
			mime: v.mime,
			sizeBytes: v.sizeBytes,
			sourceUrl: v.sourceUrl,
			createdAt: v.createdAt,
			geneId: gene,
			clonedFrom: v.id
		})
		.returning({ id: lessonVideos.id })
		.get();
	copySpots(m, { lessonVideoId: v.id }, { lessonVideoId: video.id });
}

/**
 * A recording's or a lesson video's spots onto its copy, each of the same
 * family, and each section's links through the mapper (`Mapper.ref`): the
 * place's member of the target, or a clone of it, or dropped.
 */
function copySpots(m: Mapper, from: SpotOwner, to: SpotOwner): void {
	for (const s of spotsOf(m.tx, from)) copySpot(m, s, to);
}

/** One spot onto a recording or lesson video in `into`, of the same family, with its links mapped. */
export function copySpot(m: Mapper, s: SpotRow, to: SpotOwner): number {
	const { tx, now } = m;
	const spotGene = stampGene(tx, 'spot', s.id);
	const spot = tx
		.insert(videoSpots)
		.values({
			...to,
			startMs: s.startMs,
			endMs: s.endMs,
			label: s.label,
			createdAt: s.createdAt,
			geneId: spotGene,
			clonedFrom: s.id
		})
		.returning({ id: videoSpots.id })
		.get();
	for (const target of mappedLinks(m, s.id)) {
		tx.insert(spotLinks)
			.values({ spotId: spot.id, ...target, createdAt: now })
			.onConflictDoNothing()
			.run();
	}
	return spot.id;
}

export type SpotRow = typeof videoSpots.$inferSelect;

/** A source section's links, each as the row in `into` it becomes (`Mapper.ref`); dropped ones left out. */
export function mappedLinks(
	m: Mapper,
	spotId: number
): ({ figureId: number } | { exerciseId: number })[] {
	const out: ({ figureId: number } | { exerciseId: number })[] = [];
	for (const t of linksOfSpot(m.tx, spotId)) {
		const target =
			t.figureId !== null
				? mapped('figureId', m.ref('figure', t.figureId))
				: mapped('exerciseId', m.ref('drill', t.exerciseId!));
		if (target) out.push(target);
	}
	return out;
}

function mapped<K extends 'figureId' | 'exerciseId'>(
	key: K,
	id: number | null
): Record<K, number> | null {
	return id === null ? null : ({ [key]: id } as Record<K, number>);
}

/* ── Drills ─────────────────────────────────────────────────────────────── */

/**
 * A drill: name, notes, frequency, practice settings and links; never a song.
 * Into a person's own app it starts paused when they practise the source
 * through a live entry (Make my own copy's rule, R23): Today must not double.
 */
function copyDrill(m: Mapper, sourceId: number, gene: string): Copied {
	const { tx, into, now } = m;
	const src = tx.select().from(exercises).where(eq(exercises.id, sourceId)).get()!;
	const copy = tx
		.insert(exercises)
		.values({
			...ownerValues(into),
			source: 'custom',
			name: src.name,
			notes: src.notes,
			everyDays: src.everyDays,
			practiceMode: src.practiceMode,
			countBpm: src.countBpm,
			practiceJson: src.practiceJson,
			songId: null,
			active: !practised(tx, into, { drillId: src.id }),
			createdAt: now,
			geneId: gene,
			clonedFrom: src.id
		})
		.returning({ id: exercises.id })
		.get();
	m.started('drill', src.id, copy.id);
	copyLinks(tx, { exerciseId: src.id }, { exerciseId: copy.id }, now);
	return {
		id: copy.id,
		skip: [],
		log: {
			rootKind: 'drill',
			rootId: copy.id,
			subjectId: copy.id,
			verb: 'add',
			subject: 'drill',
			after: { name: src.name }
		}
	};
}

/* ── Songs ──────────────────────────────────────────────────────────────── */

/**
 * A ready song with its audio under the new name and the count as it stands
 * (beats, downbeats, anchors, tempo, sample). A person's own, or a group's
 * draft (`shared_at` null) for its teacher to share.
 */
function copySong(m: Mapper, sourceId: number, gene: string): Copied {
	const { tx, into, now } = m;
	const src = tx.select().from(songs).where(eq(songs.id, sourceId)).get()!;
	const audioFile = src.audioFile ? m.linked.get(fileKey('audio', src.audioFile)) : undefined;
	if (!audioFile) throw new Error(`song ${src.id}: its audio was not linked`);
	const copy = tx
		.insert(songs)
		.values({
			...ownerValues(into),
			sharedAt: null,
			title: src.title,
			artist: src.artist,
			style: src.style,
			sourceUrl: src.sourceUrl,
			status: 'ready',
			audioFile,
			mime: src.mime,
			durationS: src.durationS,
			bpm: src.bpm,
			beatsJson: src.beatsJson,
			downbeatsJson: src.downbeatsJson,
			anchorsJson: src.anchorsJson,
			tempoFactor: src.tempoFactor,
			sampleStartS: src.sampleStartS,
			sizeBytes: src.sizeBytes,
			createdAt: now,
			geneId: gene,
			clonedFrom: src.id
		})
		.returning({ id: songs.id })
		.get();
	m.started('song', src.id, copy.id);
	return {
		id: copy.id,
		skip: [],
		log: {
			rootKind: 'song',
			rootId: copy.id,
			verb: 'add',
			subject: 'song',
			after: { name: src.title }
		}
	};
}

/* ── Routines ───────────────────────────────────────────────────────────── */

/** Whether a routine embeds another: such a routine is never embedded itself (depth ≤ 2). */
const embeds = (tx: Db, routineId: number) =>
	tx
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(and(eq(routineSteps.routineId, routineId), isNotNull(routineSteps.childRoutineId)))
		.get() !== undefined;

/**
 * A routine, made as a new one is (a person's comes with its exercise,
 * paused when they practise the source through an entry), then its slots in
 * order: an embedded routine through the mapper, the options too, main figure
 * first; slot notes kept. A slot whose embedded routine or every option
 * dropped goes, and so does one whose embedded routine here embeds another.
 */
function copyRoutine(m: Mapper, sourceId: number, gene: string): Copied {
	const { tx, into, now } = m;
	const src = tx.select().from(routines).where(eq(routines.id, sourceId)).get()!;
	const made = insertRoutine(tx, into, { name: src.name, notes: src.notes });
	const id = made.routine.id;
	tx.update(routines).set({ geneId: gene, clonedFrom: src.id }).where(eq(routines.id, id)).run();
	m.started('routine', src.id, id);
	if (made.exercise && practised(tx, into, { routineId: src.id })) pause(tx, made.exercise.id);

	let position = 0;
	for (const slot of routineSlots(tx, src.id)) {
		let child: number | null = null;
		let options: number[] = [];
		if (slot.childId !== null) {
			child = m.ref('routine', slot.childId);
			if (child === null || embeds(tx, child)) continue;
		} else {
			const mappedIds = slot.figureIds.map((f) => m.ref('figure', f));
			options = [...new Set(mappedIds.filter((f): f is number => f !== null))];
			if (options.length === 0) continue;
		}
		const step = tx
			.insert(routineSteps)
			.values({
				routineId: id,
				position: position++,
				childRoutineId: child,
				note: slot.note,
				createdAt: now
			})
			.returning({ id: routineSteps.id })
			.get();
		// In the slot's order, main figure first: one instant, so rowid keeps it (`MAIN_FIRST`).
		for (const figureId of options) {
			tx.insert(routineStepOptions).values({ stepId: step.id, figureId, createdAt: now }).run();
		}
	}
	return {
		id,
		skip: [],
		log: {
			rootKind: 'routine',
			rootId: id,
			subjectId: id,
			verb: 'add',
			subject: 'routine',
			after: { name: src.name }
		}
	};
}

/* ── Lessons ────────────────────────────────────────────────────────────── */

/** What a lesson links by hand, each kind in the order it was linked. */
function handLinks(db: Db, lessonId: number) {
	return {
		figures: db
			.select({ id: lessonFigures.figureId })
			.from(lessonFigures)
			.where(eq(lessonFigures.lessonId, lessonId))
			.orderBy(asc(lessonFigures.createdAt), asc(lessonFigures.figureId))
			.all()
			.map((r) => r.id),
		routines: db
			.select({ id: lessonRoutines.routineId })
			.from(lessonRoutines)
			.where(eq(lessonRoutines.lessonId, lessonId))
			.orderBy(asc(lessonRoutines.createdAt), asc(lessonRoutines.routineId))
			.all()
			.map((r) => r.id),
		/** Any hand-linked exercise; only a drill maps (`rootRow`), others drop. */
		exercises: db
			.select({ id: lessonExercises.exerciseId })
			.from(lessonExercises)
			.where(eq(lessonExercises.lessonId, lessonId))
			.orderBy(asc(lessonExercises.createdAt), asc(lessonExercises.exerciseId))
			.all()
			.map((r) => r.id)
	};
}

export const videosOf = (db: Db, lessonId: number) =>
	db
		.select()
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, lessonId))
		.orderBy(asc(lessonVideos.id))
		.all();

/**
 * A lesson, made as a new one is (a person's comes with its review exercise,
 * paused when they practise the source through an entry); into a group always
 * a draft. Title, day, notes, URL links; the hand links through the mapper;
 * the videos under their new names, their sections, and each section's links
 * through the mapper. A video whose file was not linked stays behind (`skip`).
 */
function copyLesson(m: Mapper, sourceId: number, gene: string): Copied {
	const { tx, into, now } = m;
	const src = tx.select().from(lessons).where(eq(lessons.id, sourceId)).get()!;
	const made = insertLesson(tx, into, {
		lessonDay: src.lessonDay,
		title: src.title,
		notes: src.notes
	});
	const id = made.lesson.id;
	tx.update(lessons).set({ geneId: gene, clonedFrom: src.id }).where(eq(lessons.id, id)).run();
	m.started('lesson', src.id, id);
	if (made.exercise && practised(tx, into, { lessonId: src.id })) pause(tx, made.exercise.id);
	copyLinks(tx, { lessonId: src.id }, { lessonId: id }, now);

	const hand = handLinks(tx, src.id);
	for (const f of hand.figures) {
		const to = m.ref('figure', f);
		if (to !== null)
			tx.insert(lessonFigures)
				.values({ lessonId: id, figureId: to, createdAt: now })
				.onConflictDoNothing()
				.run();
	}
	for (const r of hand.routines) {
		const to = m.ref('routine', r);
		if (to !== null)
			tx.insert(lessonRoutines)
				.values({ lessonId: id, routineId: to, createdAt: now })
				.onConflictDoNothing()
				.run();
	}
	for (const e of hand.exercises) {
		const to = m.ref('drill', e);
		if (to !== null)
			tx.insert(lessonExercises)
				.values({ lessonId: id, exerciseId: to, createdAt: now })
				.onConflictDoNothing()
				.run();
	}

	const skip: string[] = [];
	for (const v of videosOf(tx, src.id)) {
		const videoGene = stampGene(tx, 'video', v.id);
		const file = m.linked.get(fileKey('lesson-video', v.file));
		if (file === undefined) {
			// Added between the plan and this write (a race): it stays behind for Take.
			skip.push(`video:${videoGene}`);
			continue;
		}
		copyVideo(m, v, id, videoGene, file);
	}
	return {
		id,
		skip,
		log: {
			rootKind: 'lesson',
			rootId: id,
			subjectId: id,
			verb: 'add',
			subject: 'lesson',
			after: { title: src.title }
		}
	};
}

/** Each kind's copier. */
const COPIERS: Record<CloneKind, Copier> = {
	figure: copyFigure,
	drill: copyDrill,
	song: copySong,
	routine: copyRoutine,
	lesson: copyLesson
};
