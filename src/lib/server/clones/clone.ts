/**
 * The clone engine: a figure, a drill or a song (Task 10 adds routines and
 * lessons) copied into another place — a person's own app or a group — as a
 * member of the same family.
 *
 * A clone stamps the family's gene on the source (root and pieces) and writes
 * it on the copy, records `cloned_from`, writes the pair's snapshot (the
 * source's hashes; the recordings left behind in `skip`), and logs `add` in a
 * group as the kind's create function does: one line. Files are hard-linked
 * under new names before the transaction (`CloneFiles`), so one side's delete
 * or purge never takes the other's file, and are charged to the receiving
 * place. A refusal or a throw unlinks every name this call made.
 *
 * At most one member of a family per place: copying again answers the member
 * already there (`made: false`, archived or not), and copying into the
 * source's own place answers the source.
 *
 * `cloneInto` is the whole flow (checks, room, files, the write); `cloneTx` is
 * the write alone, for callers already inside a transaction (the rescue,
 * Keep), and runs in a savepoint so a refusal leaves nothing behind.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { CloneKind, PieceKind } from '$lib/types';
import { initialBase } from '$lib/clones/diff';
import { shortNames } from '$lib/names';
import type { Db } from '../db';
import {
	exercises,
	figureGroups,
	figureStartPositions,
	figures,
	lessons,
	links,
	recordings,
	routines,
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
import { suffixed } from './names';
import { entryFor } from '../entries';
import { accessTo, memberIn, stampGene } from './genes';
import { hashValue, writePair } from './pairs';
import { flatOf } from './trees';
import type { CloneFileKind, CloneFiles } from './files';

export type CloneRequest = {
	kind: CloneKind;
	id: number;
	into: Space;
	/** Bring the figure's recordings (with their sections). */
	recordings: boolean;
	/** Task 10: a lesson into a group is a draft whatever this says. */
	draft?: boolean;
	/** Skip the room check (Keep: losing access must not lose the files). */
	overLimitOk?: boolean;
	/** A family's gene → the row to copy for that family (the twin chosen in Copy to…). */
	use?: Record<string, number>;
};

/**
 * What only the server's own flows decide, never a request: kept out of
 * `CloneRequest` so no route can set it by spreading form data.
 */
export type CloneOptions = {
	/** Skip the read check and allow an archived source: the rescue and Keep only. */
	trusted?: boolean;
};

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

/** The row to copy: the request's, or the one `use` names for its family. */
function sourceOf(db: Db, req: CloneRequest): RootRow | null {
	const row = rootRow(db, req.kind, req.id);
	if (!row || row.geneId === null || !req.use) return row;
	const chosen = req.use[row.geneId];
	return chosen === undefined || chosen === row.id ? row : rootRow(db, req.kind, chosen);
}

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

/* ── Plan ───────────────────────────────────────────────────────────────── */

/**
 * What a clone would do, reading only: the source (after `use`), the member
 * it would reuse, else the rows it would make, the files to link and the
 * bytes charged to `into`. Says nothing about whether the actor may.
 */
export function planClone(db: Db, req: CloneRequest): ClonePlan {
	const plan: ClonePlan = {
		kind: req.kind,
		sourceId: null,
		existing: null,
		rows: [],
		files: [],
		bytes: 0
	};
	const src = sourceOf(db, req);
	if (!src) return plan;
	plan.sourceId = src.id;
	plan.existing = existingIn(db, req.kind, src, req.into);
	if (plan.existing) return plan;
	plan.rows.push({ kind: req.kind, from: src.id });
	if (req.kind === 'figure' && req.recordings) {
		for (const r of recordingsOf(db, src.id)) {
			plan.rows.push({ kind: 'recording', from: r.id });
			plan.files.push({
				key: fileKey('recording', r.file),
				kind: 'recording',
				file: r.file,
				bytes: r.sizeBytes
			});
			for (const s of spotsOf(db, r.id)) plan.rows.push({ kind: 'spot', from: s.id });
		}
	}
	if (req.kind === 'song') {
		const s = db.select().from(songs).where(eq(songs.id, src.id)).get()!;
		if (s.audioFile) {
			plan.files.push({
				key: fileKey('audio', s.audioFile),
				kind: 'audio',
				file: s.audioFile,
				bytes: s.sizeBytes ?? 0
			});
		}
	}
	plan.bytes = plan.files.reduce((n, f) => n + f.bytes, 0);
	return plan;
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
	if (!opts.trusted) {
		if (src.archivedAt !== null) return false;
		if (accessTo(db, actor, req.kind, src.id) === null) return false;
	}
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
 * Clone a figure, drill or song into `into` for its actor. `denied` unless
 * they may (`mayClone`); the member already there is answered as it is; a
 * clone that does not fit `into`'s room (or the disk floor) is refused before
 * any file is linked, unless `overLimitOk` (a clone with no files charges
 * nothing and is never refused for room). Files are linked, then the rows
 * written in one transaction; a refusal, a reuse found only then, or a throw
 * unlinks every name linked here (a throw is rethrown).
 */
export async function cloneInto(
	db: Db,
	req: CloneRequest,
	files: CloneFiles,
	now: number,
	freeDiskBytes = Number.POSITIVE_INFINITY,
	opts: CloneOptions = {}
): Promise<CloneResult> {
	const plan = planClone(db, req);
	if (plan.sourceId === null || !mayClone(db, req, plan.sourceId, opts)) return DENIED;
	if (plan.existing) return { ok: true, made: false, ...plan.existing };
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
		const result = cloneTx(db, req, linked, now, opts);
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
 * name; a recording whose file is not in it stays behind (in the pair's
 * `skip`, so Take can bring it). Checks nothing about who acts: `cloneInto`
 * does, and the rescue and Keep pass `trusted` sources they decided on.
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
			const existing = existingIn(inner, req.kind, src, req.into);
			if (existing) return { ok: true as const, made: false, ...existing };
			const id = new Mapper(inner as unknown as Db, req, linked, now, opts).clone(req.kind, src.id);
			return { ok: true as const, id, made: true, archived: false };
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
 * (a section's link, Task 10's slots and lesson links) points at the place's
 * member of that family.
 */
class Mapper {
	/** `${kind}:${sourceId}` → the row in `into` (null: dropped). */
	private memo = new Map<string, number | null>();

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
		if (!copier) throw new Error(`A ${kind} cannot be cloned yet`);
		const gene = stampGene(this.tx, kind, sourceId);
		const made = copier(this, sourceId, gene);
		const base = initialBase(flatOf(this.tx, kind, sourceId), made.skip, hashValue);
		// A carried section's links hold what the copy got: a link the engine
		// dropped (its target has no row here) is not the copy's own change, and
		// a later Send must not remove it from the source.
		const copied = flatOf(this.tx, kind, made.id);
		for (const key of Object.keys(base.fields)) {
			if (key.endsWith(':links') && Object.hasOwn(copied, key)) {
				base.fields[key] = hashValue(copied[key].value);
			}
		}
		writePair(this.tx, kind, sourceId, made.id, base, this.now);
		logChange(this.tx, this.into, made.log, this.now);
		return made.id;
	}

	/** Record a root's copy as soon as it exists, so a reference back to it finds it. */
	started(kind: CloneKind, sourceId: number, id: number): void {
		this.memo.set(`${kind}:${sourceId}`, id);
	}

	/**
	 * The row in `into` a reference to `sourceId` becomes: the copy made by
	 * this call, the row itself when it is in `into` already, or the family's
	 * member there (archived included). Null drops the reference.
	 *
	 * Task 10: before giving up, clone it here (`this.clone`) when the actor
	 * reads it or `opts.trusted`, and honour `req.use`.
	 */
	ref(kind: CloneKind, sourceId: number): number | null {
		const key = `${kind}:${sourceId}`;
		if (this.memo.has(key)) return this.memo.get(key)!;
		const row = rootRow(this.tx, kind, sourceId);
		const found = row ? existingIn(this.tx, kind, row, this.into) : null;
		const id = found?.id ?? null;
		this.memo.set(key, id);
		return id;
	}
}

/* ── Figures ────────────────────────────────────────────────────────────── */

const recordingsOf = (db: Db, figureId: number) =>
	db
		.select()
		.from(recordings)
		.where(eq(recordings.figureId, figureId))
		.orderBy(asc(recordings.id))
		.all();

const spotsOf = (db: Db, recordingId: number) =>
	db
		.select()
		.from(videoSpots)
		.where(eq(videoSpots.recordingId, recordingId))
		.orderBy(asc(videoSpots.id))
		.all();

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

type LinkOwner = { figureId: number } | { exerciseId: number };

/** A figure's or a drill's URL links, onto its copy. Saves in flight stay behind. */
function copyLinks(tx: Db, from: LinkOwner, to: LinkOwner, now: number): void {
	const where =
		'figureId' in from ? eq(links.figureId, from.figureId) : eq(links.exerciseId, from.exerciseId);
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
		const file = m.req.recordings ? m.linked.get(fileKey('recording', r.file)) : undefined;
		if (file === undefined) {
			// Deliberate: not asked for, or added between the plan and this write
			// (a race), so it stays behind, in `skip`, for Take to bring.
			skip.push(`rec:${recGene}`);
			continue;
		}
		const rec = tx
			.insert(recordings)
			.values({
				figureId: copy.id,
				file,
				mime: r.mime,
				kind: r.kind,
				sizeBytes: r.sizeBytes,
				note: r.note,
				sourceUrl: r.sourceUrl,
				createdAt: r.createdAt,
				geneId: recGene,
				clonedFrom: r.id
			})
			.returning({ id: recordings.id })
			.get();
		copySpots(m, r.id, rec.id);
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

/**
 * A recording's spots onto its copy, each of the same family, and each
 * section's links through the mapper: a target with no row in `into` is
 * dropped (Task 10 clones it instead).
 */
function copySpots(m: Mapper, fromRecording: number, toRecording: number): void {
	const { tx, now } = m;
	for (const s of spotsOf(tx, fromRecording)) {
		const spotGene = stampGene(tx, 'spot', s.id);
		const spot = tx
			.insert(videoSpots)
			.values({
				recordingId: toRecording,
				startMs: s.startMs,
				endMs: s.endMs,
				label: s.label,
				createdAt: s.createdAt,
				geneId: spotGene,
				clonedFrom: s.id
			})
			.returning({ id: videoSpots.id })
			.get();
		const targets = tx
			.select()
			.from(spotLinks)
			.where(eq(spotLinks.spotId, s.id))
			.orderBy(asc(spotLinks.id))
			.all();
		for (const t of targets) {
			const target =
				t.figureId !== null
					? mapped('figureId', m.ref('figure', t.figureId))
					: mapped('exerciseId', m.ref('drill', t.exerciseId!));
			if (target)
				tx.insert(spotLinks)
					.values({ spotId: spot.id, ...target, createdAt: now })
					.run();
		}
	}
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
 * through a live entry (copy-lesson's rule, R23): Today must not double.
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
			active: isTeam(into) || entryFor(tx, into.userId, { drillId: src.id })?.archivedAt !== null,
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

/** Each kind's copier. Task 10 adds `routine` and `lesson`. */
const COPIERS: Partial<Record<CloneKind, Copier>> = {
	figure: copyFigure,
	drill: copyDrill,
	song: copySong
};
