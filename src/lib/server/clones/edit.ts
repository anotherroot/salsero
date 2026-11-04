/**
 * Edit makes it yours ("Make it mine"): a person who can only READ a group's
 * figure, routine, drill, song or lesson presses Edit, and gets their own
 * copy of it, a member of the same family, with everything of theirs that
 * used the group's row moved onto it. Editors keep editing the group's row
 * (ruling 1); Make my own copy on a lesson or song is this same action
 * (ruling 12).
 *
 * The copy has no recordings (ruling 5): a figure's stay the group's, to take
 * one at a time. A lesson brings its videos and a song its audio, charged to
 * the person, so either may be refused for room. Nested things a routine or
 * lesson brings (its figures, routines, drills) are copied with it, or the
 * person's member of their family is linked as it is (an archived one
 * included: only the root, the copy the person lands on, is brought back).
 *
 * In the copy's own transaction (`cloneInto`'s `after`): the person's
 * archived copy comes back through its kind's restore, and `repoint` moves
 * their own rows and practice from each group row copied (the root, and what
 * it brought) onto its copy: the live practice wins a merge. What a new copy
 * brings to practise starts paused, so Today never doubles; moved practice
 * carries its schedule on.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { CloneKind } from '$lib/types';
import { ARCHIVED_SONG_COPY } from '$lib/clones/view';
import type { Db } from '../db';
import { exercises, figureGroups, figures, lessons, routines, songs } from '../db/schema';
import { labelFor, restoreVariation } from '../figures';
import { restoreRoutine } from '../routines';
import { restoreDrill } from '../exercises';
import { restoreLesson } from '../lessons';
import { ownedBy, type Wall } from '../scope';
import type { ArchiveRestore } from '../trash';
import { cloneInto, planClone, type ClonePair, type CloneRequest, type CloneResult } from './clone';
import { accessTo } from './genes';
import { repoint, repointPreview, type RepointReport } from './repoint';
import { ENTRY, keepNestedEmbeds } from './rescue';
import type { CloneFiles } from './files';

export type MakeMineResult =
	| CloneResult
	/** A song copy the person archived: a person's song has no restore. */
	| { ok: false; reason: 'archived'; message: string };

export type MakeMinePreview = {
	/** "Setenta · Básico", the routine's or drill's name, the song's or lesson's title. */
	title: string;
	/** What of the person's would move: off the root and off what it brings. */
	repoint: RepointReport;
	/** The person practises the root itself (an entry, or a song pick). */
	practised: boolean;
	/** What the copy charges them; 0 when their member is reused. */
	bytes: number;
	existing: { id: number; archived: boolean } | null;
};

export type Row = {
	id: number;
	dance: string;
	teamId: number | null;
	archivedAt: number | null;
	title: string;
};

/** The root row Make it mine works on, with its label, or null. A drill is a `custom` exercise. */
export function rowOf(db: Db, kind: CloneKind, id: number): Row | null {
	const base = (t: typeof routines | typeof exercises | typeof songs | typeof lessons) => ({
		id: t.id,
		dance: t.dance,
		teamId: t.teamId,
		archivedAt: t.archivedAt
	});
	switch (kind) {
		case 'figure': {
			const row = db
				.select({
					id: figures.id,
					dance: figures.dance,
					teamId: figures.teamId,
					archivedAt: figures.archivedAt,
					move: figureGroups.name,
					name: figures.name
				})
				.from(figures)
				.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
				.where(eq(figures.id, id))
				.get();
			return row ? { ...row, title: labelFor(row.move, row.name) } : null;
		}
		case 'routine':
			return (
				db
					.select({ ...base(routines), title: routines.name })
					.from(routines)
					.where(eq(routines.id, id))
					.get() ?? null
			);
		case 'drill':
			return (
				db
					.select({ ...base(exercises), title: exercises.name })
					.from(exercises)
					.where(and(eq(exercises.id, id), eq(exercises.source, 'custom')))
					.get() ?? null
			);
		case 'song':
			return (
				db
					.select({ ...base(songs), title: songs.title })
					.from(songs)
					.where(eq(songs.id, id))
					.get() ?? null
			);
		case 'lesson':
			return (
				db
					.select({ ...base(lessons), title: lessons.title })
					.from(lessons)
					.where(eq(lessons.id, id))
					.get() ?? null
			);
	}
}

/**
 * The live group row of the wall's dance this person only reads, or null:
 * a person's own row, an archived one, one of the other dance, one they edit
 * (ruling 1) and one they cannot read get no Make it mine.
 */
function readable(db: Db, wall: Wall, kind: CloneKind, id: number): Row | null {
	const row = rowOf(db, kind, id);
	if (!row || row.teamId === null || row.archivedAt !== null || row.dance !== wall.dance)
		return null;
	return accessTo(db, wall.userId, kind, id) === 'read' ? row : null;
}

const requestOf = (wall: Wall, kind: CloneKind, id: number): CloneRequest => ({
	kind,
	id,
	into: wall,
	recordings: false
});

const ROOT_KINDS = new Set<string>(['figure', 'routine', 'drill', 'song', 'lesson']);

/** Two reports as one: rows by id, once; counts added. */
function merged(a: RepointReport, b: RepointReport): RepointReport {
	const routinesById = new Map([...a.routines, ...b.routines].map((r) => [r.id, r]));
	const lessonsById = new Map([...a.lessons, ...b.lessons].map((l) => [l.id, l]));
	return {
		routines: [...routinesById.values()].sort((x, y) => x.name.localeCompare(y.name)),
		lessons: [...lessonsById.values()].sort((x, y) => x.title.localeCompare(y.title)),
		sections: a.sections + b.sections,
		entries: a.entries + b.entries,
		twins: a.twins + b.twins
	};
}

/**
 * What Make it mine would do, reading only: the row's label; what of the
 * person's would switch (their routines, lessons and sections, their
 * practice), off the row and off what a new copy would bring with it; the
 * bytes the copy charges; and their copy already there (archived: it comes
 * back). Null when they may not (`readable`).
 */
export function makeMinePreview(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	id: number
): MakeMinePreview | null {
	const row = readable(db, wall, kind, id);
	if (!row) return null;
	const plan = planClone(db, requestOf(wall, kind, id));
	const own = repointPreview(db, wall.userId, wall.dance, kind, id);
	let report = own;
	for (const r of plan.rows) {
		if (!ROOT_KINDS.has(r.kind) || (r.kind === kind && r.from === id)) continue;
		report = merged(
			report,
			repointPreview(db, wall.userId, wall.dance, r.kind as CloneKind, r.from)
		);
	}
	return {
		title: row.title,
		repoint: report,
		practised: own.entries > 0,
		bytes: plan.bytes,
		existing: plan.existing
	};
}

/** A refusal inside the write: rolls the copy back. */
class Refused extends Error {
	constructor(readonly result: Extract<MakeMineResult, { ok: false }>) {
		super(result.reason);
	}
}

/** The person's archived copy back, through its kind's restore (no practice paused: they asked for it). */
function bringBack(tx: Db, wall: Wall, kind: CloneKind, id: number, now: number): ArchiveRestore {
	switch (kind) {
		case 'figure':
			return restoreVariation(tx, wall, id, now);
		case 'routine':
			return restoreRoutine(tx, wall, id, now);
		case 'drill':
			return restoreDrill(tx, wall, id, now);
		case 'lesson':
			return restoreLesson(tx, wall, id, now);
		case 'song':
			// A person's own song has no restore (Task 10's ruling).
			return { ok: false, reason: 'gone' };
	}
}

/** What a new copy brings to practise: a drill itself, a routine's or lesson's own exercise. */
function pauseWhatItBrings(tx: Db, wall: Wall, made: ClonePair[]): void {
	const ids = (k: CloneKind) => made.filter((p) => p.kind === k).map((p) => p.id);
	const targets = [
		[exercises.id, ids('drill')],
		[ENTRY.routine, ids('routine')],
		[ENTRY.lesson, ids('lesson')],
		[ENTRY.figure, ids('figure')]
	] as const;
	for (const [col, list] of targets) {
		if (list.length === 0) continue;
		tx.update(exercises)
			.set({ active: false })
			.where(and(ownedBy(exercises, wall), inArray(col, list)))
			.run();
	}
}

/**
 * Make it mine: copy the group's row into the person's own app (`cloneInto`,
 * no recordings; a lesson's videos and a song's audio linked and charged to
 * them), or reuse their member of its family: a live one as it is, an
 * archived one restored (a song's is refused: `archived`), and move their own
 * rows and practice onto it, with what a new copy brought. All in one
 * transaction. `denied` for anyone but a reader of a live group row of the
 * wall's dance; `room` when the files do not fit; `name` when no free name
 * is left, or the archived copy's name was taken since. On success the copy is
 * live: `archived` says it was archived and has come back.
 */
export async function makeMine(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	id: number,
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<MakeMineResult> {
	if (!readable(db, wall, kind, id)) return { ok: false, reason: 'denied' };
	const made: ClonePair[] = [];
	try {
		return await cloneInto(db, requestOf(wall, kind, id), files, now, freeDiskBytes, {
			made,
			after: (tx, res) => {
				if (res.archived) {
					if (kind === 'song')
						throw new Refused({ ok: false, reason: 'archived', message: ARCHIVED_SONG_COPY });
					const back = bringBack(tx, wall, kind, res.id, now);
					if (!back.ok)
						throw new Refused(
							back.reason === 'taken'
								? { ok: false, reason: 'name', message: back.message }
								: { ok: false, reason: 'denied' }
						);
				}
				pauseWhatItBrings(tx, wall, made);
				const moves = new Map<string, { kind: CloneKind; from: number; to: number }>();
				moves.set(`${kind}:${id}`, { kind, from: id, to: res.id });
				for (const p of made) {
					const key = `${p.kind}:${p.from}`;
					if (!moves.has(key)) moves.set(key, { kind: p.kind, from: p.from, to: p.id });
				}
				for (const m of moves.values()) {
					if (m.from === m.to) continue;
					repoint(tx, wall.userId, wall.dance, m.kind, m.from, m.to, { entries: true }, now);
					if (m.kind !== 'song') {
						// An entry merged into the copy's practice is archived at `now`;
						// one instant earlier keeps a restore of the group's row (its own
						// `archived_at`) from bringing back a second practice (rescue.ts).
						tx.update(exercises)
							.set({ archivedAt: now - 1 })
							.where(
								and(
									ownedBy(exercises, wall),
									eq(ENTRY[m.kind], m.from),
									eq(exercises.archivedAt, now)
								)
							)
							.run();
					}
					if (m.kind === 'routine') keepNestedEmbeds(tx, wall, m.from, m.to);
				}
			}
		});
	} catch (err) {
		if (err instanceof Refused) return err.result;
		throw err;
	}
}
