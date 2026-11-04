/**
 * Keep: what a person takes with them when they leave a group, are removed
 * from it, or it is purged. What they keep becomes clones in their own app
 * (lessons with their videos and sections, figures with their recordings,
 * routines, drills, songs), the files hard-linked under new names and charged
 * to them, over their limit if need be (ruling 5: losing access keeps
 * recordings). Their own rows and their practice follow onto the copies.
 *
 * "Everything" is what the person had of the group: the lessons they added
 * (published and live) with what those lessons reach, every group row they
 * practise (their live entries' targets), every group row their own rows use
 * (`usesOf`, archived owners included), and the group's shared, live songs
 * plus any group song their exercises picked. "Only what my routines use" is
 * the last-but-one alone, and those are kept whatever is chosen: a person's
 * own routine never loses a figure.
 *
 * It never touches membership: leaving, removal and the purge (Task 19) call
 * it first, then change the membership and `reconcileEntries`, which archives
 * any entry left on what was not kept.
 */
import { and, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { CloneKind, KeepChoice, KeepItem, KeepPreview } from '$lib/types';
import type { DanceSlug } from '$lib/dances/dances';
import { dayMonth, plural } from '$lib/format';
import type { Db } from '../db';
import {
	exercises,
	figureGroups,
	figures,
	lessonAdds,
	lessons,
	lessonVideos,
	recordings,
	routines,
	routineSteps,
	songDrops,
	songs
} from '../db/schema';
import { reachFrom, type Reach } from '../access';
import { getTeam } from '../teams';
import { ownedBy, type Wall } from '../scope';
import { storageOf } from '../storage';
import { labelFor } from '../figures';
import { restoreLesson } from '../lessons';
import {
	cloneTx,
	fileKey,
	missingBytes,
	planClone,
	type CloneOptions,
	type ClonePair,
	type CloneRequest,
	type PlanFile
} from './clone';
import type { CloneFileKind, CloneFiles } from './files';
import { geneOf, memberIn } from './genes';
import { repoint } from './repoint';
import { ENTRY, keepNestedEmbeds, lastExercise, revive, usesOf, type Use } from './rescue';

type Ids = Record<CloneKind, Set<number>>;
type Item = { kind: CloneKind; id: number };

const KINDS: CloneKind[] = ['lesson', 'routine', 'figure', 'drill', 'song'];
const none = (): Ids => ({
	lesson: new Set(),
	routine: new Set(),
	figure: new Set(),
	drill: new Set(),
	song: new Set()
});

/** What one person could keep of one group, and why. */
type Scope = {
	teamId: number;
	wall: Wall;
	/** "Everything". */
	all: Ids;
	/** What the person's own rows use: kept whatever the choice. */
	used: Ids;
	/** Each target's first use by the person's own rows (`usesOf` order). */
	uses: Map<string, Use>;
	/** Each added lesson's reach, by lesson id ascending. */
	lessons: Map<number, Reach>;
};

const keyOf = (kind: CloneKind, id: number) => `${kind}:${id}`;

/** A reach's rows as ids by kind (its figures are moves, which are not kept as such). */
function addReach(ids: Ids, r: Reach): void {
	for (const id of r.lessons) ids.lesson.add(id);
	for (const id of r.variations) ids.figure.add(id);
	for (const id of r.routines) ids.routine.add(id);
	for (const id of r.drills) ids.drill.add(id);
}

function scopeOf(db: Db, userId: string, teamId: number): Scope {
	const team = getTeam(db, teamId);
	if (!team) throw new Error(`keep: no group ${teamId}`);
	const wall: Wall = { userId, dance: team.dance as DanceSlug };
	const all = none();
	const used = none();

	// The lessons they added that still count, read from `lesson_adds` itself:
	// a person who already left keeps theirs too (settling former members).
	const added = db
		.select({ id: lessons.id })
		.from(lessonAdds)
		.innerJoin(lessons, eq(lessons.id, lessonAdds.lessonId))
		.where(
			and(
				eq(lessonAdds.userId, userId),
				eq(lessons.teamId, teamId),
				isNotNull(lessons.publishedAt),
				isNull(lessons.archivedAt)
			)
		)
		.all()
		.map((r) => r.id)
		.sort((a, b) => a - b);
	const perLesson = new Map<number, Reach>();
	for (const id of added) {
		const r = reachFrom(db, teamId, [id]);
		perLesson.set(id, r);
		addReach(all, r);
	}

	// What they practise, and the group songs their exercises picked (any of
	// theirs: an entry, a drill, a routine's own exercise).
	const practised = db.all<{ kind: CloneKind; id: number }>(sql`
		select 'lesson' as kind, t.id as id from exercises x join lessons t on t.id = x.lesson_id
		 where x.user_id = ${userId} and x.team_id is null and x.archived_at is null and t.team_id = ${teamId}
		union
		select 'routine', t.id from exercises x join routines t on t.id = x.routine_id
		 where x.user_id = ${userId} and x.team_id is null and x.archived_at is null and t.team_id = ${teamId}
		union
		select 'figure', t.id from exercises x join figures t on t.id = x.figure_id
		 where x.user_id = ${userId} and x.team_id is null and x.archived_at is null and t.team_id = ${teamId}
		union
		select 'drill', t.id from exercises x join exercises t on t.id = x.drill_id
		 where x.user_id = ${userId} and x.team_id is null and x.archived_at is null
		   and t.team_id = ${teamId} and t.source = 'custom'
		union
		select 'song', t.id from exercises x join songs t on t.id = x.song_id
		 where x.user_id = ${userId} and x.team_id is null and t.team_id = ${teamId}
		   and t.status = 'ready' and t.audio_file is not null
	`);
	for (const p of practised) all[p.kind].add(p.id);

	const uses = new Map<string, Use>();
	for (const u of usesOf(db, teamId, userId)) {
		used[u.kind].add(u.id);
		all[u.kind].add(u.id);
		const key = keyOf(u.kind, u.id);
		if (!uses.has(key)) uses.set(key, u);
	}

	for (const s of db
		.select({ id: songs.id })
		.from(songs)
		.where(
			and(
				eq(songs.teamId, teamId),
				isNotNull(songs.sharedAt),
				isNull(songs.archivedAt),
				eq(songs.status, 'ready'),
				isNotNull(songs.audioFile)
			)
		)
		.all())
		all.song.add(s.id);

	return { teamId, wall, all, used, uses, lessons: perLesson };
}

/**
 * What a choice keeps, in the order it is copied: lessons first (they bring
 * what they hold), then routines (they bring their figures), figures, drills
 * and songs, each by id. Only rows in "everything" count: an id from a form
 * that the person never had is ignored.
 */
function itemsOf(scope: Scope, choice: KeepChoice): Item[] {
	let ids: Ids;
	if (choice.mode === 'all') ids = scope.all;
	else {
		ids = none();
		for (const k of KINDS) for (const id of scope.used[k]) ids[k].add(id);
		if (choice.mode === 'chosen') {
			for (const id of choice.lessons) {
				const r = scope.lessons.get(id);
				if (r) addReach(ids, r);
			}
			const pick = (kind: CloneKind, chosen: number[]) => {
				for (const id of chosen) if (scope.all[kind].has(id)) ids[kind].add(id);
			};
			pick('figure', choice.figures);
			pick('routine', choice.routines);
			pick('song', choice.songs);
		}
	}
	return KINDS.flatMap((kind) => [...ids[kind]].sort((a, b) => a - b).map((id) => ({ kind, id })));
}

const requestOf = (wall: Wall, item: Item): CloneRequest => ({
	...item,
	into: wall,
	recordings: true,
	overLimitOk: true
});

/**
 * Keep's clone options: no read check; an archived item is copied as its own
 * root, but anything it references must be live (an archived figure a lesson
 * still links drops, as in any clone). A member already in the person's app
 * gets the recordings and videos it lacks (ruling 5: losing access keeps
 * them). Members reached only by reference are linked as they are: not
 * revived, not filled.
 */
const KEEP: CloneOptions = { trusted: true, archivedRoot: true, fill: true };

/** The files keeping these items links, each once, and the bytes they charge. */
function planOf(db: Db, wall: Wall, items: Item[]): { files: PlanFile[]; bytes: number } {
	const files = new Map<string, PlanFile>();
	for (const item of items) {
		for (const f of planClone(db, requestOf(wall, item), KEEP).files) files.set(f.key, f);
	}
	const list = [...files.values()];
	return { files: list, bytes: list.reduce((n, f) => n + f.bytes, 0) };
}

/**
 * What `keepFromTeam` with this choice charges the person: every file it
 * links (nested copies and pieces filled into a member they have included),
 * each once. What the preview shows and the Choose total use.
 */
export function keepBytes(db: Db, userId: string, teamId: number, choice: KeepChoice): number {
	const scope = scopeOf(db, userId, teamId);
	return planOf(db, scope.wall, itemsOf(scope, choice)).bytes;
}

/* ── Keep ───────────────────────────────────────────────────────────────── */

/**
 * Keep copies of a group's things in the person's own app (see the module
 * comment for what each choice keeps). Every file is linked first; then, in
 * one transaction: each item is cloned with its recordings (`cloneTx`, `KEEP`,
 * over the limit allowed), or the family's member already in the person's
 * app is reused (its fields untouched; the recordings and videos it lacks
 * added; an archived one comes back, as the rescue's does); what the copies
 * bring to practise starts paused; `repoint` moves the person's rows and
 * practice from every group row copied (the items and what they brought)
 * onto its copy (the live practice wins); the person's exercises on the
 * group's songs that were not kept drop to the count; their `lesson_adds` for
 * the group's lessons go. A file already gone from disk is skipped, logged:
 * its recording or video stays behind, and a song without its audio is not
 * kept. A throw unlinks every name linked here; after the write, a name no
 * row took (a reuse found only then) is unlinked too. `kept` is how many
 * items the person now has a copy of; `skipped` names the items not kept
 * (the engine refused a name in the move, or a song's audio is missing).
 */
export async function keepFromTeam(
	db: Db,
	userId: string,
	teamId: number,
	choice: KeepChoice,
	files: CloneFiles,
	now: number
): Promise<{ kept: number; skipped: string[] }> {
	const scope = scopeOf(db, userId, teamId);
	const items = itemsOf(scope, choice);
	const plan = planOf(db, scope.wall, items);

	const made: [CloneFileKind, string][] = [];
	const linked = new Map<string, string>();
	const lost = new Set<string>();
	let result: { kept: number; skipped: string[] };
	try {
		for (const f of plan.files) {
			let name: string;
			try {
				name = await files.link(f.kind, f.file);
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
				// Already gone from disk: that piece stays behind (the engine leaves
				// a recording or video whose key is absent), never a row without a file.
				console.warn(`[clones] keep: ${f.kind} ${f.file} missing on disk, skipped`);
				lost.add(f.key);
				continue;
			}
			made.push([f.kind, name]);
			linked.set(f.key, name);
		}
		result = db.transaction((tx) => keepTx(tx, scope, items, linked, lost, now));
	} catch (err) {
		await Promise.all(made.map(([kind, file]) => files.unlink(kind, file)));
		throw err;
	}
	await unlinkUnused(db, files, made);
	return result;
}

/** Whether this song's audio was planned and found missing on disk. */
function songLost(tx: Db, songId: number, lost: Set<string>): boolean {
	if (lost.size === 0) return false;
	const file = tx.select({ f: songs.audioFile }).from(songs).where(eq(songs.id, songId)).get()?.f;
	return file != null && lost.has(fileKey('audio', file));
}

/** A group row and the person's row that now stands for it. */
type Moved = { kind: CloneKind; from: number; id: number; archived: boolean };

function keepTx(
	tx: Db,
	scope: Scope,
	items: Item[],
	linked: Map<string, string>,
	lost: Set<string>,
	now: number
): { kept: number; skipped: string[] } {
	const { wall, teamId } = scope;
	const before = lastExercise(tx);
	const moves = new Map<string, Moved>();
	const pairs: ClonePair[] = [];
	const skipped: string[] = [];
	let kept = 0;
	for (const item of items) {
		if (item.kind === 'song' && songLost(tx, item.id, lost)) {
			// Its audio is gone from disk: no copy; its picks drop to the count below.
			skipped.push(describe(tx, item).name);
			continue;
		}
		const res = cloneTx(tx, requestOf(wall, item), linked, now, { ...KEEP, made: pairs });
		if (!res.ok) {
			// A clone the engine refuses (no free name) is skipped, as the rescue does.
			skipped.push(describe(tx, item).name);
			continue;
		}
		kept++;
		moves.set(keyOf(item.kind, item.id), {
			...item,
			from: item.id,
			id: res.id,
			archived: res.archived
		});
	}
	// What an item brought with it (a lesson's figures, a routine's) moves too:
	// the person's practice on those group rows follows onto the copies.
	for (const p of pairs) {
		const key = keyOf(p.kind, p.from);
		if (!moves.has(key)) moves.set(key, { ...p, archived: false });
	}
	// What the copies brought to practise (a drill, a routine's or lesson's own
	// exercise) waits off Today: a live entry carries its schedule on (`repoint`).
	tx.update(exercises)
		.set({ active: false })
		.where(and(gt(exercises.id, before), ownedBy(exercises, wall)))
		.run();

	for (const { kind, from, id, archived } of moves.values()) {
		const practice = archived ? bringBack(tx, wall, kind, id, now) : true;
		repoint(tx, wall.userId, wall.dance, kind, from, id, { entries: practice }, now);
		if (kind !== 'song') {
			// An entry merged into the copy's practice is archived at `now`; one
			// instant earlier keeps a restore of the group's row (its own
			// `archived_at`) from bringing back a second practice.
			tx.update(exercises)
				.set({ archivedAt: now - 1 })
				.where(and(ownedBy(exercises, wall), eq(ENTRY[kind], from), eq(exercises.archivedAt, now)))
				.run();
		}
		if (kind === 'routine') keepNestedEmbeds(tx, wall, from, id);
	}

	// The group's songs not kept: off every exercise of theirs, and no drop to
	// bring them back (someone out of the group gets none, `dropSongs`).
	const teamSongs = tx.select({ id: songs.id }).from(songs).where(eq(songs.teamId, teamId));
	const mine = tx.select({ id: exercises.id }).from(exercises).where(ownedBy(exercises, wall));
	tx.update(exercises)
		.set({ songId: null })
		.where(and(ownedBy(exercises, wall), inArray(exercises.songId, teamSongs)))
		.run();
	tx.delete(songDrops)
		.where(and(inArray(songDrops.exerciseId, mine), inArray(songDrops.songId, teamSongs)))
		.run();

	tx.delete(lessonAdds)
		.where(
			and(
				eq(lessonAdds.userId, wall.userId),
				inArray(
					lessonAdds.lessonId,
					tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.teamId, teamId))
				)
			)
		)
		.run();
	return { kept, skipped };
}

/**
 * The person's archived member comes back to hold their rows: a figure,
 * routine or drill as the rescue revives one; a lesson through its restore; a
 * song unarchived. What it brings to practise is paused. Whether it came back,
 * so practice may move onto it.
 */
function bringBack(tx: Db, wall: Wall, kind: CloneKind, id: number, now: number): boolean {
	if (kind === 'figure' || kind === 'routine' || kind === 'drill')
		return revive(tx, wall, kind, id, now);
	if (kind === 'song') {
		tx.update(songs).set({ archivedAt: null }).where(eq(songs.id, id)).run();
		return true;
	}
	if (!restoreLesson(tx, wall, id, now).ok) return false;
	tx.update(exercises)
		.set({ active: false })
		.where(and(ownedBy(exercises, wall), eq(exercises.lessonId, id)))
		.run();
	return true;
}

/** Unlink the names this call linked that no row holds (a member found only in the write). */
async function unlinkUnused(db: Db, files: CloneFiles, made: [CloneFileKind, string][]) {
	if (made.length === 0) return;
	const names = made.map(([, n]) => n);
	const held = new Set<string>([
		...db
			.select({ f: recordings.file })
			.from(recordings)
			.where(inArray(recordings.file, names))
			.all()
			.map((r) => r.f),
		...db
			.select({ f: lessonVideos.file })
			.from(lessonVideos)
			.where(inArray(lessonVideos.file, names))
			.all()
			.map((r) => r.f),
		...db
			.select({ f: songs.audioFile })
			.from(songs)
			.where(inArray(songs.audioFile, names))
			.all()
			.map((r) => r.f!)
	]);
	await Promise.all(made.filter(([, n]) => !held.has(n)).map(([kind, n]) => files.unlink(kind, n)));
}

/* ── Preview ────────────────────────────────────────────────────────────── */

/** An item's name, meta and own files' bytes. */
function describe(db: Db, item: Item): { name: string; meta: string; bytes: number } {
	switch (item.kind) {
		case 'figure': {
			const row = db
				.select({ move: figureGroups.name, name: figures.name })
				.from(figures)
				.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
				.where(eq(figures.id, item.id))
				.get();
			const recs = db
				.select({ size: recordings.sizeBytes })
				.from(recordings)
				.where(eq(recordings.figureId, item.id))
				.all();
			return {
				name: row ? labelFor(row.move, row.name) : '',
				meta: recs.length > 0 ? plural(recs.length, 'recording', 'recordings') : '',
				bytes: recs.reduce((n, r) => n + r.size, 0)
			};
		}
		case 'lesson': {
			const row = db.select().from(lessons).where(eq(lessons.id, item.id)).get()!;
			const vids = db
				.select({ size: lessonVideos.sizeBytes })
				.from(lessonVideos)
				.where(eq(lessonVideos.lessonId, item.id))
				.all();
			const meta = [dayMonth(row.lessonDay)];
			if (vids.length > 0) meta.push(plural(vids.length, 'video', 'videos'));
			return {
				name: row.title,
				meta: meta.join(' · '),
				bytes: vids.reduce((n, v) => n + v.size, 0)
			};
		}
		case 'routine': {
			const row = db.select().from(routines).where(eq(routines.id, item.id)).get()!;
			const slots = db
				.select({ id: routineSteps.id })
				.from(routineSteps)
				.where(eq(routineSteps.routineId, item.id))
				.all().length;
			return { name: row.name, meta: plural(slots, 'slot', 'slots'), bytes: 0 };
		}
		case 'song': {
			const row = db.select().from(songs).where(eq(songs.id, item.id)).get()!;
			return { name: row.title, meta: row.artist ?? '', bytes: row.sizeBytes ?? 0 };
		}
		case 'drill': {
			const row = db.select().from(exercises).where(eq(exercises.id, item.id)).get()!;
			return { name: row.name, meta: '', bytes: 0 };
		}
	}
}

const LIST: Record<CloneKind, 'lessons' | 'figures' | 'routines' | 'songs' | 'drills'> = {
	lesson: 'lessons',
	figure: 'figures',
	routine: 'routines',
	song: 'songs',
	drill: 'drills'
};

/**
 * What leaving would keep: every item of "everything" with its name, meta,
 * the bytes its own files charge (0 when the person has a copy of it
 * already), what of theirs uses it and the added lesson that brings it; the
 * bytes of Keep everything and of Keep only what my routines use (files
 * counted once); the names of what their routines use; and their storage now.
 */
export function keepPreview(db: Db, userId: string, teamId: number): KeepPreview {
	const scope = scopeOf(db, userId, teamId);
	const all = itemsOf(scope, { mode: 'all' });
	const used = itemsOf(scope, { mode: 'used' });
	const lists: Pick<KeepPreview, 'lessons' | 'figures' | 'routines' | 'songs' | 'drills'> = {
		lessons: [],
		figures: [],
		routines: [],
		songs: [],
		drills: []
	};
	const names = new Map<string, string>();
	for (const item of all) {
		const d = describe(db, item);
		const gene = geneOf(db, item.kind, item.id);
		const member = gene === null ? null : memberIn(db, item.kind, gene, scope.wall);
		const use = scope.uses.get(keyOf(item.kind, item.id)) ?? null;
		let inLesson: number | null = null;
		if (item.kind !== 'lesson' && item.kind !== 'song') {
			for (const [lessonId, r] of scope.lessons) {
				const set =
					item.kind === 'figure' ? r.variations : item.kind === 'routine' ? r.routines : r.drills;
				if (set.has(item.id)) {
					inLesson = lessonId;
					break;
				}
			}
		}
		const row: KeepItem = {
			kind: item.kind,
			id: item.id,
			name: d.name,
			meta: d.meta,
			bytes: member ? missingBytes(db, item.kind, item.id, member.id) : d.bytes,
			used: use?.byName ?? null,
			usedBy: use?.by ?? null,
			inLesson,
			choosable: item.kind !== 'lesson' || scope.lessons.has(item.id)
		};
		names.set(keyOf(item.kind, item.id), d.name);
		lists[LIST[item.kind]].push(row);
	}
	const byName = (a: KeepItem, b: KeepItem) => a.name.localeCompare(b.name) || a.id - b.id;
	for (const list of Object.values(lists)) list.sort(byName);
	const storage = storageOf(db, userId);
	return {
		...lists,
		allBytes: planOf(db, scope.wall, all).bytes,
		usedBytes: planOf(db, scope.wall, used).bytes,
		usedNames: used.map((i) => names.get(keyOf(i.kind, i.id))!),
		limitBytes: storage.limitBytes,
		nowBytes: storage.usedBytes
	};
}
