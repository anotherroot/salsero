/**
 * Take and Send: one member of a family receives the other's value of the
 * fields a person picked, in place (the spec's "field by field"). The
 * target's row keeps its id, so its practice entries, logs, lesson links and
 * its sections' links survive; every write is to the target's own rows.
 *
 * By key family (`$lib/clones/flat.ts`):
 * - root fields: the columns the kind's own save writes, with its side
 *   effects (an exercise renamed with its figure, routine, drill or lesson);
 *   a figure's timing through `writeFigureShape`. A figure's name is refused
 *   when another figure of the target's move has it, a position's when a
 *   live position of the target's place has it;
 * - `start:`, `end:` (a figure's positions): through `writeFigureShape`
 *   with its timing, an added one mapped into the target's place
 *   (`Mapper.ref`), a removed one taken off; an archived tag stays;
 * - `link:<url>`: the URL link added, or deleted through `deleteLink`;
 * - `fig:`, `routine:`, `drill:`, `pos:` (a lesson's hand links): added,
 *   the row mapped into the target's place (`Mapper.ref`: the place's
 *   member of that family, or a copy of it made now), or taken off through
 *   the lesson's own unlink;
 * - a piece (`rec:<g>`, `video:<g>`): copied in with its sections (its file
 *   linked beforehand), or deleted through its own delete function, which
 *   refuses a linked section and, in a group, puts it in Recently deleted;
 * - a piece's parts: a recording's note and a section's times and label
 *   updated in place; a section added (links mapped) or deleted
 *   (`deleteSpot`); a section's links made the giver's, mapped;
 * - `slots`: the routine's whole slot list replaced, each option and
 *   embedded routine mapped into the target's place.
 *
 * `syncFrom` is the whole flow Take and Send share: access, the `seen`
 * check, the picks, the files and room, then in one transaction the apply,
 * the pair's next snapshot, History and the reconcile.
 */
import { and, eq, inArray, isNotNull, isNull, type Column } from 'drizzle-orm';
import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT } from '$lib/graph/timing';
import type { ChangeValues, CloneKind, Flat, Picks, SyncResult } from '$lib/types';
import { diff, nextBase, unpicked } from '$lib/clones/diff';
import { pieceParts, ROOT_KEYS, setPrefixOf } from '$lib/clones/flat';
import { nameTaken, PICK_BOTH, STALE } from '$lib/clones/view';
import type { Db } from '../db';
import {
	exercises,
	figureGroups,
	figures,
	lessonExercises,
	figureEndPositions,
	figureStartPositions,
	lessonFigures,
	lessonPositions,
	lessonRoutines,
	lessons,
	lessonVideos,
	links,
	positions,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	songs,
	spotLinks,
	spotPositionLinks,
	videoSpots
} from '../db/schema';
import { isTeam, spaceOfRow } from '../scope';
import { roomForOwner, ownerOfRow } from '../storage';
import { fieldChange, logChange, type ChangeEntry } from '../changes';
import { deleteRecording, syncExerciseNames, variationNameTaken } from '../figures';
import { figurePositions, writeFigureShape } from '../graph';
import {
	ownEntryIds,
	deleteLessonVideo,
	reviewName,
	unlinkExercise,
	unlinkFigure,
	unlinkPosition,
	unlinkRoutine
} from '../lessons';
import { nameRefusal as positionNameRefusal, nameTaken as positionNameTaken } from '../positions';
import { unlinkSpotFromPosition } from '../position-links';
import { routineSlots } from '../routines';
import { deleteLink, type LinkOwner } from '../links';
import { deleteSpot } from '../spots';
import { SpotLinkedError, unlinkSpot } from '../spot-links';
import { reconcileEntries } from '../entries';
import { autoAddPending } from '../auto-add';
import { accessTo, geneOf, stampGene } from './genes';
import { digest, hashValue, pairBase, writePair } from './pairs';
import { flatOf } from './trees';
import {
	copyRecording,
	copySpot,
	copyVideo,
	fileKey,
	mappedLinks,
	Mapper,
	Refusal as CopyRefusal,
	type SpotOwner
} from './clone';
import type { CloneFileKind, CloneFiles } from './files';

export type ApplyOutcome =
	| {
			ok: true;
			/** Something of the target was deleted or unlinked: reach may have shrunk. */
			removals: boolean;
			/** Files of the target's deleted pieces to remove once the transaction lands (a person's: a group's wait in Recently deleted). */
			unlink: [CloneFileKind, string][];
			/** The root fields that changed, as History keeps them. */
			before: ChangeValues;
			after: ChangeValues;
	  }
	| { ok: false; reason: 'name' | 'linked'; message: string };

/** A refusal raised inside the apply, so its savepoint rolls back. */
class Refused extends Error {
	constructor(readonly outcome: Extract<ApplyOutcome, { ok: false }>) {
		super(outcome.reason);
	}
}

function rootOf(db: Db, kind: CloneKind, id: number) {
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
		case 'position':
			return db.select().from(positions).where(eq(positions.id, id)).get() ?? null;
	}
}

/** A `<ref>` (a gene, or `#<id>` for a row with none) as a where clause on a table's id and gene. */
function byRef(table: { id: Column; geneId: Column }, ref: string) {
	return ref.startsWith('#') ? eq(table.id, Number(ref.slice(1))) : eq(table.geneId, ref);
}

/**
 * Write the giver's value of each of `keys` into the target, in place (see the
 * module's comment). Runs in a savepoint of `tx`: a refusal (`name`, its own
 * or a copy's made on the way, or `linked` when a delete meets a linked
 * section) leaves nothing of it. Files
 * of pieces copied in must be in `linked` (`fileKey` → the new name); `actorId`
 * is who acts, for the group's History lines of deletes and for what the
 * mapper may read. Writes no snapshot and no History line of its own.
 */
export function applyInto(
	tx: Db,
	kind: CloneKind,
	targetId: number,
	giverId: number,
	keys: string[],
	linked: Map<string, string>,
	actorId: string,
	now: number
): ApplyOutcome {
	try {
		return tx.transaction((inner) =>
			new Applier(inner as unknown as Db, kind, targetId, giverId, linked, actorId, now).run(keys)
		);
	} catch (err) {
		if (err instanceof Refused) return err.outcome;
		// A copy made on the way (a position a tag brings into the target's place) refused its name.
		if (err instanceof CopyRefusal && err.result.reason === 'name')
			return { ok: false, reason: 'name', message: err.result.message };
		if (err instanceof SpotLinkedError)
			return { ok: false, reason: 'linked', message: err.message };
		throw err;
	}
}

class Applier {
	/** Maps a giver's reference into the target's place (the target's space, acted in by the actor). */
	readonly m: Mapper;
	readonly giverFlat: Flat;
	readonly targetFlat: Flat;
	removals = false;
	readonly unlink: [CloneFileKind, string][] = [];
	readonly before: ChangeValues = {};
	readonly after: ChangeValues = {};

	constructor(
		readonly tx: Db,
		readonly kind: CloneKind,
		readonly targetId: number,
		readonly giverId: number,
		linked: Map<string, string>,
		readonly actorId: string,
		readonly now: number
	) {
		const target = rootOf(tx, kind, targetId);
		const giver = rootOf(tx, kind, giverId);
		if (!target || !giver) throw new Error(`apply: no ${kind} ${targetId} or ${giverId}`);
		this.m = new Mapper(
			tx,
			{ kind, id: giverId, into: spaceOfRow(target, actorId), recordings: false },
			linked,
			now,
			{}
		);
		this.giverFlat = flatOf(tx, kind, giverId);
		this.targetFlat = flatOf(tx, kind, targetId);
	}

	run(keys: string[]): ApplyOutcome {
		const roots = keys.filter((k) => (ROOT_KEYS as readonly string[]).includes(k));
		// A figure's sides are written with its timing, in one shape.
		const tags = keys.filter((k) => TAG_PREFIXES.has(setPrefixOf(k) ?? ''));
		this.roots(roots, this.kind === 'figure' ? tags : []);
		for (const key of keys) {
			if (tags.includes(key)) continue;
			if (setPrefixOf(key)) this.member(key);
			else if (pieceParts(key)) this.piece(key);
		}
		return {
			ok: true,
			removals: this.removals,
			unlink: this.unlink,
			before: this.before,
			after: this.after
		};
	}

	/** Note what a root field was and became, under History's key. */
	private changed(key: string, was: unknown, now: unknown): void {
		this.before[key] = (was ?? null) as string | number | null;
		this.after[key] = (now ?? null) as string | number | null;
	}

	/* ── Root fields ───────────────────────────────────────────────────── */

	private roots(keys: string[], tags: string[]): void {
		if (keys.length === 0 && tags.length === 0) return;
		const has = (k: string) => keys.includes(k);
		switch (this.kind) {
			case 'figure':
				return this.figureRoots(has, tags);
			case 'drill':
				return this.drillRoots(has);
			case 'song':
				return this.songRoots(has);
			case 'routine':
				return this.routineRoots(has);
			case 'lesson':
				return this.lessonRoots(has);
			case 'position':
				return this.positionRoots(has);
		}
	}

	private figureRoots(has: (k: string) => boolean, tags: string[]): void {
		const { tx, targetId } = this;
		const t = tx.select().from(figures).where(eq(figures.id, targetId)).get()!;
		const g = tx.select().from(figures).where(eq(figures.id, this.giverId)).get()!;
		const set: Partial<typeof figures.$inferInsert> = {};
		if (has('name') && t.name !== g.name) {
			if (t.groupId !== null && variationNameTaken(tx, t.groupId, g.name, targetId)) {
				const move =
					tx.select().from(figureGroups).where(eq(figureGroups.id, t.groupId)).get()?.name ?? '';
				throw new Refused({ ok: false, reason: 'name', message: nameTaken(g.name, move) });
			}
			set.name = g.name;
			this.changed('name', t.name, g.name);
		}
		if (has('notes')) {
			set.notes = g.notes;
			this.changed('notes', t.notes, g.notes);
		}
		if (has('partner')) {
			set.partner = g.partner;
			this.changed('partner', t.partner, g.partner);
		}
		if (has('style')) {
			set.styleTag = g.styleTag;
			this.changed('style', t.styleTag, g.styleTag);
		}
		if (Object.keys(set).length > 0) {
			tx.update(figures).set(set).where(eq(figures.id, targetId)).run();
			if (set.name !== undefined) syncExerciseNames(tx, eq(figures.id, targetId));
		}
		if (has('timing') || tags.length > 0) {
			const timing = (f: typeof t) => ({
				startCount: f.startCount ?? DEFAULT_START_COUNT,
				lengthCounts: f.lengthCounts ?? DEFAULT_LENGTH_COUNTS
			});
			const written = writeFigureShape(tx, targetId, {
				...this.sidesAfter(tags),
				...timing(has('timing') ? g : t)
			});
			if (!written) throw new Error(`apply: figure ${targetId} refused its shape`);
			for (const k of Object.keys(written.after) as (keyof typeof written.after)[]) {
				if (written.before[k] !== written.after[k])
					this.changed(k, written.before[k], written.after[k]);
			}
		}
	}

	/**
	 * The target's start and end positions once the picked `start:`/`end:`
	 * keys land: one the giver has is added as the target place's member of its
	 * family (`Mapper.ref`: a copy made now when the place has none; an archived
	 * member is not written, being invisible); one only the target has goes. A
	 * tag of an archived position is in neither flat and stays as it is
	 * (`writeFigureShape` keeps it).
	 */
	private sidesAfter(keys: string[]): { startIds: number[]; endIds: number[] } {
		const { tx, targetId, giverId, m } = this;
		const current = figurePositions(tx, targetId);
		const sides = { start: new Set(current.startIds), end: new Set(current.endIds) };
		for (const key of keys) {
			const side = setPrefixOf(key) as 'start' | 'end';
			const ref = key.slice(side.length + 1);
			const adds = Object.hasOwn(this.giverFlat, key);
			if (Object.hasOwn(this.targetFlat, key) === adds) continue;
			if (adds) {
				for (const id of taggedWith(tx, side, giverId, ref)) {
					const to = m.ref('position', id);
					if (to !== null && rootOf(tx, 'position', to)?.archivedAt === null) sides[side].add(to);
				}
			} else {
				// A tag off a group's figure may shrink what its members reach.
				for (const id of taggedWith(tx, side, targetId, ref))
					if (sides[side].delete(id)) this.removals = true;
			}
		}
		return { startIds: [...sides.start], endIds: [...sides.end] };
	}

	/** A position's own fields, as `updatePosition` writes them; a name a live position of the target's place has is refused. */
	private positionRoots(has: (k: string) => boolean): void {
		const { tx, targetId } = this;
		const t = tx.select().from(positions).where(eq(positions.id, targetId)).get()!;
		const g = tx.select().from(positions).where(eq(positions.id, this.giverId)).get()!;
		const set: Partial<typeof positions.$inferInsert> = {};
		if (has('name') && t.name !== g.name) {
			const space = spaceOfRow(t, this.actorId);
			if (positionNameTaken(tx, space, g.name, targetId))
				throw new Refused({
					ok: false,
					reason: 'name',
					message: positionNameRefusal(tx, space, g.name).message
				});
			set.name = g.name;
			this.changed('name', t.name, g.name);
		}
		if (has('notes')) {
			set.notes = g.notes;
			this.changed('notes', t.notes, g.notes);
		}
		if (has('type')) {
			set.styleTag = g.styleTag;
			this.changed('styleTag', t.styleTag, g.styleTag);
		}
		if (has('hands')) {
			set.hands = g.hands;
			this.changed('hands', t.hands, g.hands);
		}
		if (has('crossed')) {
			set.crossed = g.crossed;
			const n = (v: boolean | null) => (v === null ? null : v ? 1 : 0);
			this.changed('crossed', n(t.crossed), n(g.crossed));
		}
		if (has('facing')) {
			set.facing = g.facing;
			this.changed('facing', t.facing, g.facing);
		}
		if (has('frame')) {
			set.frame = g.frame;
			this.changed('frame', t.frame, g.frame);
		}
		if (Object.keys(set).length > 0)
			tx.update(positions).set(set).where(eq(positions.id, targetId)).run();
	}

	private drillRoots(has: (k: string) => boolean): void {
		const { tx, targetId } = this;
		const t = tx.select().from(exercises).where(eq(exercises.id, targetId)).get()!;
		const g = tx.select().from(exercises).where(eq(exercises.id, this.giverId)).get()!;
		const set: Partial<typeof exercises.$inferInsert> = {};
		if (has('name')) {
			set.name = g.name;
			this.changed('name', t.name, g.name);
		}
		if (has('notes')) {
			set.notes = g.notes;
			this.changed('notes', t.notes, g.notes);
		}
		if (has('practice')) {
			set.practiceMode = g.practiceMode;
			set.countBpm = g.countBpm;
			// A song is the person's own pick, never the family's: only a song practice keeps one.
			if (g.practiceMode !== 'song') set.songId = null;
			this.changed('practiceMode', t.practiceMode, g.practiceMode);
			this.changed('countBpm', t.countBpm, g.countBpm);
		}
		if (Object.keys(set).length === 0) return;
		tx.update(exercises).set(set).where(eq(exercises.id, targetId)).run();
		// Every entry practising the drill carries its name (`updateExercise`).
		if (set.name !== undefined)
			tx.update(exercises).set({ name: g.name }).where(eq(exercises.drillId, targetId)).run();
	}

	private songRoots(has: (k: string) => boolean): void {
		const { tx, targetId } = this;
		const t = tx.select().from(songs).where(eq(songs.id, targetId)).get()!;
		const g = tx.select().from(songs).where(eq(songs.id, this.giverId)).get()!;
		const set: Partial<typeof songs.$inferInsert> = {};
		if (has('title')) {
			set.title = g.title;
			this.changed('title', t.title, g.title);
		}
		if (has('artist')) {
			set.artist = g.artist;
			this.changed('artist', t.artist, g.artist);
		}
		if (has('style')) {
			set.style = g.style;
			this.changed('style', t.style, g.style);
		}
		if (has('count')) {
			// One family, one audio: the anchors index the same beats on both sides.
			set.anchorsJson = g.anchorsJson;
			set.tempoFactor = g.tempoFactor;
			this.changed('anchors', t.anchorsJson, g.anchorsJson);
			this.changed('tempoFactor', t.tempoFactor, g.tempoFactor);
		}
		if (has('sample')) {
			set.sampleStartS = g.sampleStartS;
			this.changed('sampleStartS', t.sampleStartS, g.sampleStartS);
		}
		if (Object.keys(set).length > 0) tx.update(songs).set(set).where(eq(songs.id, targetId)).run();
	}

	private routineRoots(has: (k: string) => boolean): void {
		const { tx, targetId } = this;
		const t = tx.select().from(routines).where(eq(routines.id, targetId)).get()!;
		const g = tx.select().from(routines).where(eq(routines.id, this.giverId)).get()!;
		const set: Partial<typeof routines.$inferInsert> = {};
		if (has('name')) {
			set.name = g.name;
			this.changed('name', t.name, g.name);
		}
		if (has('notes')) {
			set.notes = g.notes;
			this.changed('notes', t.notes, g.notes);
		}
		if (Object.keys(set).length > 0) {
			tx.update(routines).set(set).where(eq(routines.id, targetId)).run();
			if (set.name !== undefined)
				tx.update(exercises).set({ name: g.name }).where(eq(exercises.routineId, targetId)).run();
		}
		if (has('slots')) this.slots();
	}

	private lessonRoots(has: (k: string) => boolean): void {
		const { tx, targetId } = this;
		const t = tx.select().from(lessons).where(eq(lessons.id, targetId)).get()!;
		const g = tx.select().from(lessons).where(eq(lessons.id, this.giverId)).get()!;
		const set: Partial<typeof lessons.$inferInsert> = {};
		if (has('title')) {
			set.title = g.title;
			this.changed('title', t.title, g.title);
		}
		if (has('day')) {
			set.lessonDay = g.lessonDay;
			this.changed('lessonDay', t.lessonDay, g.lessonDay);
		}
		if (has('notes')) {
			set.notes = g.notes;
			this.changed('notes', t.notes, g.notes);
		}
		if (Object.keys(set).length === 0) return;
		tx.update(lessons).set(set).where(eq(lessons.id, targetId)).run();
		if (set.title !== undefined)
			tx.update(exercises)
				.set({ name: reviewName(g.title) })
				.where(eq(exercises.lessonId, targetId))
				.run();
	}

	/**
	 * The routine's whole slot list becomes the giver's, in order, slot notes
	 * kept: each option and embedded routine is the target place's member of
	 * its family (`Mapper.ref`). A slot whose every option or whose embedded
	 * routine drops goes, as in a copy; so does an embed the one-level rule
	 * forbids here (the child embeds another, or this routine is embedded).
	 */
	private slots(): void {
		const { tx, targetId, m, now } = this;
		const old = routineSlots(tx, targetId);
		const oldIds = new Set(
			old.flatMap((s) => (s.childId !== null ? [`r${s.childId}`] : s.figureIds.map((f) => `f${f}`)))
		);
		const stepIds = old.map((s) => s.id);
		for (const id of stepIds)
			tx.delete(routineStepOptions).where(eq(routineStepOptions.stepId, id)).run();
		tx.delete(routineSteps).where(eq(routineSteps.routineId, targetId)).run();

		const embedded =
			tx
				.select({ id: routineSteps.id })
				.from(routineSteps)
				.where(eq(routineSteps.childRoutineId, targetId))
				.get() !== undefined;
		const newIds = new Set<string>();
		let position = 0;
		for (const slot of routineSlots(tx, this.giverId)) {
			let child: number | null = null;
			let options: number[] = [];
			if (slot.childId !== null) {
				// Checked before the mapper runs, so a child that would drop is never copied here.
				if (embedded || embeds(tx, slot.childId)) continue;
				child = m.ref('routine', slot.childId);
				if (child === null || child === targetId || embeds(tx, child)) continue;
				newIds.add(`r${child}`);
			} else {
				const ids = slot.figureIds.map((f) => m.ref('figure', f));
				options = [...new Set(ids.filter((f): f is number => f !== null))];
				if (options.length === 0) continue;
				for (const f of options) newIds.add(`f${f}`);
			}
			const step = tx
				.insert(routineSteps)
				.values({
					routineId: targetId,
					position: position++,
					childRoutineId: child,
					note: slot.note,
					createdAt: now
				})
				.returning({ id: routineSteps.id })
				.get();
			// In the slot's order, main figure first: one instant, so rowid keeps it.
			for (const figureId of options)
				tx.insert(routineStepOptions).values({ stepId: step.id, figureId, createdAt: now }).run();
		}
		this.changed('slots', old.length, position);
		if ([...oldIds].some((id) => !newIds.has(id))) this.removals = true;
	}

	/* ── Set members ───────────────────────────────────────────────────── */

	private member(key: string): void {
		const prefix = setPrefixOf(key)!;
		const ref = key.slice(prefix.length + 1);
		const adds = Object.hasOwn(this.giverFlat, key);
		if (Object.hasOwn(this.targetFlat, key) === adds) return;
		if (prefix === 'link') return adds ? this.addLink(ref) : this.removeLink(ref);
		if (this.kind !== 'lesson') return;
		if (adds) this.addHandLink(prefix, ref);
		else this.removeHandLink(prefix, ref);
	}

	private linkOwner(id: number): LinkOwner {
		if (this.kind === 'figure') return { figureId: id };
		if (this.kind === 'drill') return { exerciseId: id };
		return { lessonId: id };
	}

	private linkWhere(id: number, url: string) {
		const owner = this.linkOwner(id);
		const col =
			'figureId' in owner
				? eq(links.figureId, owner.figureId)
				: 'exerciseId' in owner
					? eq(links.exerciseId, owner.exerciseId)
					: eq(links.lessonId, owner.lessonId);
		return and(col, eq(links.url, url));
	}

	private addLink(url: string): void {
		const from = this.tx.select().from(links).where(this.linkWhere(this.giverId, url)).get();
		this.tx
			.insert(links)
			.values({
				...this.linkOwner(this.targetId),
				url,
				title: from?.title ?? null,
				createdAt: this.now
			})
			.run();
	}

	private removeLink(url: string): void {
		const row = this.tx.select().from(links).where(this.linkWhere(this.targetId, url)).get();
		if (!row) return;
		deleteLink(this.tx, this.linkOwner(this.targetId), row.id, this.actorId, this.now);
		this.removals = true;
	}

	/** The row of a lesson's hand link of this kind with this ref, or null. */
	private handLinked(lessonId: number, prefix: string, ref: string): number | null {
		const { tx } = this;
		if (prefix === 'fig')
			return (
				tx
					.select({ id: figures.id })
					.from(lessonFigures)
					.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
					.where(and(eq(lessonFigures.lessonId, lessonId), byRef(figures, ref)))
					.get()?.id ?? null
			);
		if (prefix === 'routine')
			return (
				tx
					.select({ id: routines.id })
					.from(lessonRoutines)
					.innerJoin(routines, eq(routines.id, lessonRoutines.routineId))
					.where(and(eq(lessonRoutines.lessonId, lessonId), byRef(routines, ref)))
					.get()?.id ?? null
			);
		if (prefix === 'pos')
			return (
				tx
					.select({ id: positions.id })
					.from(lessonPositions)
					.innerJoin(positions, eq(positions.id, lessonPositions.positionId))
					.where(
						and(
							eq(lessonPositions.lessonId, lessonId),
							isNull(positions.archivedAt),
							byRef(positions, ref)
						)
					)
					.get()?.id ?? null
			);
		return (
			tx
				.select({ id: exercises.id })
				.from(lessonExercises)
				.innerJoin(exercises, eq(exercises.id, lessonExercises.exerciseId))
				.where(
					and(
						eq(lessonExercises.lessonId, lessonId),
						eq(exercises.source, 'custom'),
						isNull(exercises.archivedAt),
						byRef(exercises, ref)
					)
				)
				.get()?.id ?? null
		);
	}

	private addHandLink(prefix: string, ref: string): void {
		const { tx, targetId, now, m } = this;
		const from = this.handLinked(this.giverId, prefix, ref);
		if (from === null) return;
		const kind = HAND_KINDS[prefix];
		const to = m.ref(kind, from);
		if (to === null) return;
		if (kind === 'position') {
			tx.insert(lessonPositions)
				.values({ lessonId: targetId, positionId: to, createdAt: now })
				.onConflictDoNothing()
				.run();
			return;
		}
		if (kind === 'figure')
			tx.insert(lessonFigures)
				.values({ lessonId: targetId, figureId: to, createdAt: now })
				.onConflictDoNothing()
				.run();
		else if (kind === 'routine')
			tx.insert(lessonRoutines)
				.values({ lessonId: targetId, routineId: to, createdAt: now })
				.onConflictDoNothing()
				.run();
		if (kind !== 'drill') {
			// Never in both places (`linkFigure`): the person's own entry for it leaves the hand-linked list.
			const owned = ownEntryIds(
				tx,
				this.m.into,
				kind === 'figure' ? { figureId: to } : { routineId: to }
			);
			if (owned.length > 0)
				tx.delete(lessonExercises)
					.where(
						and(eq(lessonExercises.lessonId, targetId), inArray(lessonExercises.exerciseId, owned))
					)
					.run();
			return;
		}
		tx.insert(lessonExercises)
			.values({ lessonId: targetId, exerciseId: to, createdAt: now })
			.onConflictDoNothing()
			.run();
	}

	private removeHandLink(prefix: string, ref: string): void {
		const { tx, targetId, now, actorId } = this;
		const id = this.handLinked(targetId, prefix, ref);
		if (id === null) return;
		if (prefix === 'fig') unlinkFigure(tx, targetId, id, false, now, actorId);
		else if (prefix === 'routine') unlinkRoutine(tx, targetId, id, now, actorId);
		else if (prefix === 'pos') unlinkPosition(tx, targetId, id, false, now, actorId);
		else unlinkExercise(tx, targetId, id, false, now, actorId);
		this.removals = true;
	}

	/* ── Pieces ────────────────────────────────────────────────────────── */

	/** A piece (`rec:<g>`, `video:<g>`) of a parent, by its ref, or null. */
	private pieceRow(parentId: number, piece: string) {
		const { tx } = this;
		const parts = pieceParts(piece)!;
		const ref = piece.slice(parts.kind.length + 1);
		if (parts.kind === 'rec')
			return (
				tx
					.select()
					.from(recordings)
					.where(and(eq(recordings.figureId, parentId), byRef(recordings, ref)))
					.get() ?? null
			);
		return (
			tx
				.select()
				.from(lessonVideos)
				.where(and(eq(lessonVideos.lessonId, parentId), byRef(lessonVideos, ref)))
				.get() ?? null
		);
	}

	/** A section or point of a piece row, by its ref, or null. */
	private spotRow(owner: SpotOwner, ref: string) {
		const col =
			'recordingId' in owner
				? eq(videoSpots.recordingId, owner.recordingId)
				: eq(videoSpots.lessonVideoId, owner.lessonVideoId);
		return (
			this.tx
				.select()
				.from(videoSpots)
				.where(and(col, byRef(videoSpots, ref)))
				.get() ?? null
		);
	}

	private piece(key: string): void {
		const parts = pieceParts(key)!;
		const isRec = parts.kind === 'rec';
		if ((isRec && this.kind !== 'figure') || (!isRec && this.kind !== 'lesson')) return;
		const mine = this.pieceRow(this.targetId, parts.piece);
		const theirs = this.pieceRow(this.giverId, parts.piece);
		const ownerOf = (id: number): SpotOwner =>
			isRec ? { recordingId: id } : { lessonVideoId: id };

		if (parts.part === 'piece') {
			if (theirs && !mine) this.addPiece(isRec, theirs);
			else if (mine && !theirs) this.removePiece(isRec, mine.id);
			return;
		}
		if (!mine || !theirs) return;
		if (parts.part === 'note') {
			const note = (theirs as typeof recordings.$inferSelect).note ?? null;
			this.tx.update(recordings).set({ note }).where(eq(recordings.id, mine.id)).run();
			return;
		}
		const spotRef = (parts.part === 'links' ? key.slice(0, -':links'.length) : key).split(
			':spot:'
		)[1];
		const t = this.spotRow(ownerOf(mine.id), spotRef);
		const g = this.spotRow(ownerOf(theirs.id), spotRef);
		if (parts.part === 'spot') {
			if (g && !t) copySpot(this.m, g, ownerOf(mine.id));
			else if (t && !g) {
				deleteSpot(this.tx, t.id, this.actorId, this.now);
				this.removals = true;
			} else if (t && g)
				this.tx
					.update(videoSpots)
					.set({ startMs: g.startMs, endMs: g.endMs, label: g.label })
					.where(eq(videoSpots.id, t.id))
					.run();
			return;
		}
		if (t && g) this.sectionLinks(t.id, g.id);
	}

	private addPiece(
		isRec: boolean,
		row: typeof recordings.$inferSelect | typeof lessonVideos.$inferSelect
	): void {
		const { tx, m } = this;
		const kind: CloneFileKind = isRec ? 'recording' : 'lesson-video';
		const file = m.linked.get(fileKey(kind, row.file));
		if (file === undefined) throw new Error(`apply: ${kind} ${row.id}'s file was not linked`);
		if (isRec) {
			const gene = stampGene(tx, 'recording', row.id);
			copyRecording(m, row as typeof recordings.$inferSelect, this.targetId, gene, file);
		} else {
			const gene = stampGene(tx, 'video', row.id);
			copyVideo(m, row as typeof lessonVideos.$inferSelect, this.targetId, gene, file);
		}
	}

	private removePiece(isRec: boolean, id: number): void {
		const gone = isRec
			? deleteRecording(this.tx, id, this.actorId, this.now)
			: deleteLessonVideo(this.tx, id, this.actorId, this.now);
		if (!gone) return;
		this.removals = true;
		// A group's file waits in Recently deleted for the purge; a person's goes once this lands.
		if (gone.trashId === null) this.unlink.push([isRec ? 'recording' : 'lesson-video', gone.file]);
	}

	/**
	 * The target section's (or point's) links become the giver's, each mapped
	 * into the target's place: figures and drills, and positions. A link to an
	 * archived position is in neither flat and stays.
	 */
	private sectionLinks(targetSpot: number, giverSpot: number): void {
		const { tx, now, actorId } = this;
		const all = mappedLinks(this.m, giverSpot);
		const wantPositions = all.flatMap((w) => ('positionId' in w ? [w.positionId] : []));
		const want = all.filter(
			(w): w is { figureId: number } | { exerciseId: number } => !('positionId' in w)
		);
		const has = tx.select().from(spotLinks).where(eq(spotLinks.spotId, targetSpot)).all();
		const same = (
			a: { figureId: number | null; exerciseId: number | null },
			b: (typeof want)[number]
		) => ('figureId' in b ? a.figureId === b.figureId : a.exerciseId === b.exerciseId);
		for (const l of has) {
			if (want.some((w) => same(l, w))) continue;
			const target = l.figureId !== null ? { figureId: l.figureId } : { exerciseId: l.exerciseId! };
			unlinkSpot(tx, l.id, target, now, actorId);
			this.removals = true;
		}
		for (const w of want) {
			if (has.some((l) => same(l, w))) continue;
			tx.insert(spotLinks)
				.values({ spotId: targetSpot, ...w, createdAt: now })
				.onConflictDoNothing()
				.run();
		}

		const hasPositions = tx
			.select({ id: spotPositionLinks.id, positionId: spotPositionLinks.positionId })
			.from(spotPositionLinks)
			.innerJoin(positions, eq(positions.id, spotPositionLinks.positionId))
			.where(and(eq(spotPositionLinks.spotId, targetSpot), isNull(positions.archivedAt)))
			.all();
		for (const l of hasPositions) {
			if (wantPositions.includes(l.positionId)) continue;
			unlinkSpotFromPosition(tx, l.id, now, actorId);
			this.removals = true;
		}
		for (const positionId of wantPositions) {
			if (hasPositions.some((l) => l.positionId === positionId)) continue;
			tx.insert(spotPositionLinks)
				.values({ spotId: targetSpot, positionId, createdAt: now })
				.onConflictDoNothing()
				.run();
		}
	}
}

/** The set prefixes that are a figure's sides. */
const TAG_PREFIXES = new Set(['start', 'end']);

/** The kind a lesson's hand link of each prefix is. */
const HAND_KINDS: Record<string, CloneKind> = {
	fig: 'figure',
	routine: 'routine',
	drill: 'drill',
	pos: 'position'
};

/** The live positions on one side of a figure whose family is `ref` (one, or two of one family). */
function taggedWith(tx: Db, side: 'start' | 'end', figureId: number, ref: string): number[] {
	const table = side === 'start' ? figureStartPositions : figureEndPositions;
	return tx
		.select({ id: positions.id })
		.from(table)
		.innerJoin(positions, eq(positions.id, table.positionId))
		.where(and(eq(table.figureId, figureId), isNull(positions.archivedAt), byRef(positions, ref)))
		.all()
		.map((r) => r.id);
}

/** Whether a routine embeds another: such a routine is never embedded itself (depth ≤ 2). */
const embeds = (tx: Db, routineId: number) =>
	tx
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(and(eq(routineSteps.routineId, routineId), isNotNull(routineSteps.childRoutineId)))
		.get() !== undefined;

/* ── The whole flow ─────────────────────────────────────────────────────── */

const DENIED: SyncResult = { ok: false, reason: 'denied', message: 'Not found.' };

/** How a kind's change is filed in History: its root, and the thing a change of several fields names. */
export function logRoot(
	kind: CloneKind,
	row: { id: number; groupId?: number | null }
): Pick<ChangeEntry, 'rootKind' | 'rootId' | 'subjectId'> & { thing: string } {
	switch (kind) {
		case 'figure':
			return { rootKind: 'figure', rootId: row.groupId!, subjectId: row.id, thing: 'variation' };
		case 'song':
			return { rootKind: 'song', rootId: row.id, thing: 'song' };
		default:
			return { rootKind: kind, rootId: row.id, subjectId: row.id, thing: kind };
	}
}

/** The giver's pieces the picks bring in whole: their files to link, and what they charge. */
export function filesFor(
	db: Db,
	kind: CloneKind,
	giverId: number,
	keys: string[],
	into: Flat,
	giver: Flat
) {
	const out: { key: string; kind: CloneFileKind; file: string; bytes: number }[] = [];
	for (const key of keys) {
		const parts = pieceParts(key);
		if (parts?.part !== 'piece' || Object.hasOwn(into, key) || !Object.hasOwn(giver, key)) continue;
		const ref = key.slice(parts.kind.length + 1);
		if (parts.kind === 'rec' && kind === 'figure') {
			const r = db
				.select()
				.from(recordings)
				.where(and(eq(recordings.figureId, giverId), byRef(recordings, ref)))
				.get();
			if (r)
				out.push({
					key: fileKey('recording', r.file),
					kind: 'recording',
					file: r.file,
					bytes: r.sizeBytes
				});
		} else if (parts.kind === 'video' && kind === 'lesson') {
			const v = db
				.select()
				.from(lessonVideos)
				.where(and(eq(lessonVideos.lessonId, giverId), byRef(lessonVideos, ref)))
				.get();
			if (v)
				out.push({
					key: fileKey('lesson-video', v.file),
					kind: 'lesson-video',
					file: v.file,
					bytes: v.sizeBytes
				});
		}
	}
	return out;
}

const REF_TABLES = {
	start: positions,
	end: positions,
	fig: figures,
	routine: routines,
	drill: exercises,
	pos: positions,
	rec: recordings,
	video: lessonVideos,
	spot: videoSpots
} as const;

/** A `<ref>` as the row reads now: `#<id>` becomes the row's gene once something stamped it. */
function refNow(db: Db, of: keyof typeof REF_TABLES, ref: string): string {
	if (!ref.startsWith('#')) return ref;
	const table = REF_TABLES[of] as typeof figures;
	const row = db
		.select({ gene: table.geneId })
		.from(table)
		.where(eq(table.id, Number(ref.slice(1))))
		.get();
	return row?.gene ?? ref;
}

/**
 * A pick's key as the current diff names it. A row without a gene is keyed
 * `#<id>`, and copying it stamps one, so a sheet opened before a copy (Send's
 * first target copies your new recording into it, stamping the recording)
 * names the same row differently: read that way, the pick still lands
 * rather than being dropped as a key outside the diff.
 */
function currentKey(db: Db, key: string): string {
	const prefix = setPrefixOf(key);
	if (prefix === 'link') return key;
	if (prefix) {
		const of = prefix as 'start' | 'end' | 'fig' | 'routine' | 'drill' | 'pos';
		return `${prefix}:${refNow(db, of, key.slice(prefix.length + 1))}`;
	}
	const parts = pieceParts(key);
	if (!parts) return key;
	const [tag, g, ...rest] = key.split(':');
	let out = `${tag}:${refNow(db, tag === 'rec' ? 'rec' : 'video', g)}`;
	if (rest[0] === 'note') out += ':note';
	else if (rest[0] === 'spot') {
		out += `:spot:${refNow(db, 'spot', rest[1])}`;
		if (rest[2] === 'links') out += ':links';
	}
	return out;
}

function currentPicks(db: Db, picks: Picks): Picks {
	const out: Picks = {};
	for (const [key, side] of Object.entries(picks)) out[currentKey(db, key)] = side;
	return out;
}

/**
 * One member (`intoId`) receives another's (`fromId`) fields picked
 * `'theirs'`, against a comparison from `intoId`'s side (`compareWith`):
 * Take theirs, and each target of Send mine. Refused, writing nothing:
 * `denied` unless the actor edits `intoId` and reads `fromId`, both live and
 * of one family; `stale` when `intoId` no longer reads as `seen`; `pick`
 * while a field both changed has no pick; `room` when the pieces brought do
 * not fit the receiving place; `name` and `linked` from the apply. Files are
 * linked under new names first (and unlinked again on any refusal or
 * throw); then, in one transaction: the apply, the pair's next snapshot
 * (`nextBase`, the giver's values), and in a group one History `change` by
 * the actor (the root fields' before and after) and `reconcileEntries` when
 * something was deleted or unlinked. A person's deleted pieces' files go
 * once it has landed.
 */
export async function syncFrom(
	db: Db,
	actorId: string,
	kind: CloneKind,
	intoId: number,
	fromId: number,
	picks: Picks,
	seen: string,
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<SyncResult> {
	if (intoId === fromId) return DENIED;
	const into = rootOf(db, kind, intoId);
	const from = rootOf(db, kind, fromId);
	if (!into || !from || into.archivedAt !== null || from.archivedAt !== null) return DENIED;
	const gene = geneOf(db, kind, intoId);
	if (gene === null || gene !== geneOf(db, kind, fromId)) return DENIED;
	if (accessTo(db, actorId, kind, intoId) !== 'edit') return DENIED;
	if (accessTo(db, actorId, kind, fromId) === null) return DENIED;

	const intoFlat = flatOf(db, kind, intoId);
	if (digest(intoFlat) !== seen) return { ok: false, reason: 'stale', message: STALE };
	const fromFlat = flatOf(db, kind, fromId);
	const base = pairBase(db, kind, intoId, fromId);
	const diffs = diff(base, intoFlat, fromFlat, hashValue);
	const picked = currentPicks(db, picks);
	if (unpicked(diffs, picked).length > 0) return { ok: false, reason: 'pick', message: PICK_BOTH };
	const keys = diffs.filter((d) => picked[d.key] === 'theirs').map((d) => d.key);
	// Keep mine: no field changes, only the pair's snapshot, so the other now
	// reads as behind (what differs is the receiver's own). No History line:
	// nothing a person edits changed.
	if (keys.length === 0) {
		return db.transaction((t) => {
			const tx = t as unknown as Db;
			if (digest(flatOf(tx, kind, intoId)) !== seen)
				return { ok: false as const, reason: 'stale' as const, message: STALE };
			const next = nextBase(intoFlat, fromFlat, base?.skip ?? [], hashValue);
			writePair(tx, kind, intoId, fromId, next, now);
			return { ok: true as const };
		});
	}

	const plan = filesFor(db, kind, fromId, keys, intoFlat, fromFlat);
	const bytes = plan.reduce((n, f) => n + f.bytes, 0);
	if (bytes > 0) {
		const room = roomForOwner(db, ownerOfRow(into), bytes, freeDiskBytes);
		if (!room.ok) return { ok: false, reason: 'room', message: room.message };
	}

	const made: [CloneFileKind, string][] = [];
	const unlinkAll = () => Promise.all(made.map(([k, file]) => files.unlink(k, file)));
	const linked = new Map<string, string>();
	let out: ApplyOutcome | { ok: false; reason: 'stale'; message: string };
	try {
		for (const f of plan) {
			const name = await files.link(f.kind, f.file);
			made.push([f.kind, name]);
			linked.set(f.key, name);
		}
		out = db.transaction((t) => {
			const tx = t as unknown as Db;
			// Again inside the write: a save may have landed while the files were linking.
			if (digest(flatOf(tx, kind, intoId)) !== seen)
				return { ok: false as const, reason: 'stale' as const, message: STALE };
			const applied = applyInto(tx, kind, intoId, fromId, keys, linked, actorId, now);
			if (!applied.ok) return applied;
			const next = nextBase(
				flatOf(tx, kind, intoId),
				flatOf(tx, kind, fromId),
				base?.skip ?? [],
				hashValue
			);
			writePair(tx, kind, intoId, fromId, next, now);
			const space = spaceOfRow(into, actorId);
			if (isTeam(space)) {
				const { thing, ...root } = logRoot(kind, into as { id: number; groupId?: number | null });
				const change = fieldChange(applied.before, applied.after, thing) ?? { subject: thing };
				logChange(tx, space, { ...root, verb: 'change', ...change }, now);
				if (applied.removals) reconcileEntries(tx, space.teamId, now);
				// A class lesson that took in a routine or drill: auto-add brings it to Today. Only a
				// lesson's Take changes what a lesson holds.
				if (kind === 'lesson') autoAddPending(tx, space.teamId, [intoId], now);
			}
			return applied;
		});
	} catch (err) {
		await unlinkAll();
		throw err;
	}
	if (!out.ok) {
		await unlinkAll();
		return { ok: false, reason: out.reason, message: out.message };
	}
	// It has landed: removing the deleted pieces' files can no longer undo it, nor fail it.
	await Promise.all(out.unlink.map(([k, file]) => files.unlink(k, file).catch(() => {})));
	return { ok: true };
}
