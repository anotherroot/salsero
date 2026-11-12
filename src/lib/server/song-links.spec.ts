/**
 * Music with notes (spec Part B): a lesson's, a drill's and a routine's
 * suggested songs, each with a note — which songs a row may take, who sees
 * them, and the History of a group's.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, ne } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { songLinks, songs, teamChanges, users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { createCustomExercise } from './exercises';
import { createLesson, linkExercise, publishLesson } from './lessons';
import { createRoutine } from './routines';
import { addFigureExercise, createFigure } from './figures';
import { createSongFromUpload } from './songs';
import { deleteGroupSong, shareSong, unshareSong } from './song-share';
import { crossRefs } from './integrity';
import { cloneInto } from './clones/clone';
import { familyStatus } from './clones/send';
import { stepStatus } from './clones/step';
import { syncAll, syncView } from './clones/sync';
import type { CloneKind } from '$lib/types';
import { sourcesOf } from './clones/sources';
import { NO_FILES } from './test-walls';
import { deleteSong } from './songs';
import { purgeTrash } from './trash';
import { purgeTeams } from './team-purge';
import { deleteTeam } from './teams';
import { TEAM_PURGE_MS, TRASH_MS } from '$lib/limits';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addMusic, listMusic, musicNote, removeMusic, setMusicNote } from './song-links';
import type { TeamSpace, Wall } from './scope';

const T = 1_790_000_000_000;
const U1: Wall = { userId: 'u1', dance: 'salsa' };
const U2: Wall = { userId: 'u2', dance: 'salsa' };
/** u1 owns group 1; u2 edits it; u3 is a member. */
const ED: TeamSpace = { teamId: 1, actorId: 'u2', dance: 'salsa' };

let db: Db;

const song = (space: Parameters<typeof createSongFromUpload>[1], title: string, ready = true) => {
	// A stored name, as Keep's copy refuses any other.
	const file = `${randomUUID()}.mp3`;
	const s = createSongFromUpload(db, space, {
		file,
		mime: 'audio/mpeg',
		title,
		style: 'salsa'
	});
	if (ready)
		db.update(songs)
			.set({ status: 'ready', durationS: 200, beatsJson: '[]', audioFile: file })
			.where(eq(songs.id, s.id))
			.run();
	return s.id;
};
const lessonIn = (space: Wall | TeamSpace) =>
	createLesson(db, space, { lessonDay: '2026-11-03', title: 'Class', notes: null }).lesson.id;
const drillIn = (space: Wall | TeamSpace) =>
	createCustomExercise(db, space, { name: 'Shines', everyDays: 3, notes: null }).id;
const routineIn = (space: Wall | TeamSpace) =>
	createRoutine(db, space, { name: 'Rueda', notes: null }).routine.id;
/** A Music line: subject song under a lesson, drill or routine (not the song's own History). */
const songLines = (verb: string) =>
	db
		.select()
		.from(teamChanges)
		.where(
			and(
				eq(teamChanges.subject, 'song'),
				eq(teamChanges.verb, verb),
				ne(teamChanges.rootKind, 'song')
			)
		)
		.all();

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values(
			['Ana', 'Luka', 'Maja'].map((firstName, i) => ({
				id: `u${i + 1}`,
				email: `${firstName.toLowerCase()}@x.si`,
				passwordHash: 'x',
				firstName
			}))
		)
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');
});

describe('adding songs', () => {
	it('adds a song with its note to a lesson, a drill and a routine', () => {
		const s = song(U1, 'Casa Mía');
		const parents = [
			{ lessonId: lessonIn(U1) },
			{ exerciseId: drillIn(U1) },
			{ routineId: routineIn(U1) }
		];
		for (const p of parents) {
			expect(addMusic(db, U1, p, s, 'Slow one', T)).toMatchObject({ ok: true });
			expect(listMusic(db, p, 'u1')).toEqual([
				expect.objectContaining({ songId: s, title: 'Casa Mía', note: 'Slow one', shared: true })
			]);
		}
	});

	it('keeps the order added', () => {
		const lesson = { lessonId: lessonIn(U1) };
		const a = song(U1, 'B song');
		const b = song(U1, 'A song');
		addMusic(db, U1, lesson, a, null, T);
		addMusic(db, U1, lesson, b, null, T);
		expect(listMusic(db, lesson, 'u1').map((r) => r.songId)).toEqual([a, b]);
	});

	it('refuses the same song twice', () => {
		const lesson = { lessonId: lessonIn(U1) };
		const s = song(U1, 'Casa Mía');
		addMusic(db, U1, lesson, s, null, T);
		expect(addMusic(db, U1, lesson, s, 'again', T)).toEqual({
			ok: false,
			message: 'Already in Music'
		});
		expect(listMusic(db, lesson, 'u1')).toHaveLength(1);
	});

	it("refuses another person's song", () => {
		const theirs = song(U2, 'Theirs');
		expect(addMusic(db, U1, { lessonId: lessonIn(U1) }, theirs, null, T)).toMatchObject({
			ok: false
		});
	});

	it('refuses a song that is not ready', () => {
		const s = song(U1, 'Still downloading', false);
		expect(addMusic(db, U1, { lessonId: lessonIn(U1) }, s, null, T)).toMatchObject({ ok: false });
	});

	it("refuses a figure's exercise and an entry as a parent, and another person's row", () => {
		const s = song(U1, 'Casa Mía');
		const figure = createFigure(db, U1, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const figEx = addFigureExercise(db, 'u1', figure)!.id;
		expect(addMusic(db, U1, { exerciseId: figEx }, s, null, T)).toMatchObject({ ok: false });
		expect(addMusic(db, U1, { lessonId: lessonIn(U2) }, s, null, T)).toMatchObject({ ok: false });
	});

	it("a person's row takes a shared song of their group", () => {
		const shared = song(ED, 'Chan Chan');
		shareSong(db, ED, shared, T);
		const draft = song(ED, 'Draft');
		const lesson = { lessonId: lessonIn({ userId: 'u3', dance: 'salsa' }) };
		const u3: Wall = { userId: 'u3', dance: 'salsa' };
		expect(addMusic(db, u3, lesson, shared, null, T)).toMatchObject({ ok: true });
		expect(addMusic(db, u3, lesson, draft, null, T)).toMatchObject({ ok: false });
	});

	it("a group's row takes only its group's songs", () => {
		const lesson = { lessonId: lessonIn(ED) };
		const own = song(U2, 'Mine');
		expect(addMusic(db, ED, lesson, own, null, T)).toMatchObject({ ok: false });
		const theirs = song(ED, 'Chan Chan');
		shareSong(db, ED, theirs, T);
		expect(addMusic(db, ED, lesson, theirs, null, T)).toMatchObject({ ok: true });
	});

	it('adding a group draft shares it, logged', () => {
		const lesson = { lessonId: lessonIn(ED) };
		const draft = song(ED, 'Draft');
		expect(addMusic(db, ED, lesson, draft, 'Practise the shines', T)).toMatchObject({ ok: true });
		expect(db.select().from(songs).where(eq(songs.id, draft)).get()!.sharedAt).not.toBeNull();
		expect(db.select().from(teamChanges).where(eq(teamChanges.verb, 'share')).all()).toHaveLength(
			1
		);
		expect(songLines('add')).toEqual([
			expect.objectContaining({ rootKind: 'lesson', rootId: lesson.lessonId, subjectId: draft })
		]);
	});
});

describe('who sees what', () => {
	it('hides an unshared song from members, keeps the link, shows it again when shared', () => {
		const lesson = { lessonId: lessonIn(ED) };
		const s = song(ED, 'Chan Chan');
		shareSong(db, ED, s, T);
		addMusic(db, ED, lesson, s, 'Count it', T);
		unshareSong(db, ED, s, T + 1);
		expect(listMusic(db, lesson, 'u3')).toEqual([]);
		expect(listMusic(db, lesson, 'u2')).toEqual([
			expect.objectContaining({ songId: s, shared: false })
		]);
		shareSong(db, ED, s, T + 2);
		expect(listMusic(db, lesson, 'u3')).toEqual([
			expect.objectContaining({ songId: s, note: 'Count it', shared: true })
		]);
	});
});

describe('notes and removing', () => {
	it('changes a note and removes a row, logged in a group', () => {
		const lesson = { lessonId: lessonIn(ED) };
		const s = song(ED, 'Chan Chan');
		const added = addMusic(db, ED, lesson, s, null, T);
		if (!added.ok) throw new Error(added.message);
		expect(setMusicNote(db, ED, added.id, 'Listen for the clave', T + 1)).toBe(true);
		expect(listMusic(db, lesson, 'u2')[0].note).toBe('Listen for the clave');
		expect(songLines('change')).toHaveLength(1);
		expect(removeMusic(db, ED, added.id, T + 2)).toBe(true);
		expect(listMusic(db, lesson, 'u2')).toEqual([]);
		expect(songLines('remove')).toHaveLength(1);
		expect(removeMusic(db, ED, added.id, T + 3)).toBe(false);
	});

	it("refuses another space's link", () => {
		const lesson = { lessonId: lessonIn(U1) };
		const added = addMusic(db, U1, lesson, song(U1, 'Casa Mía'), null, T);
		if (!added.ok) throw new Error(added.message);
		expect(setMusicNote(db, U2, added.id, 'x', T)).toBe(false);
		expect(removeMusic(db, U2, added.id, T)).toBe(false);
	});
});

describe('musicNote', () => {
	it('trims, empties to null, refuses over 500', () => {
		expect(musicNote('  x ')).toBe('x');
		expect(musicNote('')).toBeNull();
		expect(musicNote(null)).toBeNull();
		expect(musicNote('y'.repeat(500))).toBe('y'.repeat(500));
		expect(musicNote('y'.repeat(501))).toBeUndefined();
	});
});

describe('integrity', () => {
	it("reports a group's row pointing at another group's song", () => {
		createTeam(db, 'u2', 'salsa', 'Wednesdays', 3);
		const other: TeamSpace = { teamId: 2, actorId: 'u2', dance: 'salsa' };
		const theirs = song(other, 'Other class');
		const lesson = lessonIn(ED);
		db.insert(songLinks).values({ songId: theirs, lessonId: lesson, sortOrder: 1 }).run();
		expect(crossRefs(db)).toEqual([
			`song_links on lessons ${lesson}: song ${theirs} is outside group 1`
		]);
	});

	it("reports a person's row pointing at another person's song, or a group they are not in", () => {
		const theirs = song(U2, 'Theirs');
		const lesson = lessonIn(U1);
		db.insert(songLinks).values({ songId: theirs, lessonId: lesson, sortOrder: 1 }).run();
		createTeam(db, 'u2', 'salsa', 'Wednesdays', 3);
		const stranger = song({ teamId: 2, actorId: 'u2', dance: 'salsa' }, 'Strangers');
		const drill = drillIn(U1);
		db.insert(songLinks).values({ songId: stranger, exerciseId: drill, sortOrder: 1 }).run();
		expect(crossRefs(db)).toEqual([
			`song_links on lessons ${lesson}: song ${theirs} is another person's`,
			`song_links on exercises ${drill}: song ${stranger} is group 2's, which u1 is not in`
		]);
	});

	it("accepts a person's link to their group's song, shared or not", () => {
		const s = song(ED, 'Chan Chan');
		shareSong(db, ED, s, T);
		const u3: Wall = { userId: 'u3', dance: 'salsa' };
		addMusic(db, u3, { lessonId: lessonIn(u3) }, s, null, T);
		unshareSong(db, ED, s, T + 1);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('when a song goes for good', () => {
	const scratch = () => {
		const dir = mkdtempSync(join(tmpdir(), 'song-links-'));
		return { lessonVideos: dir, recordings: dir, audio: dir };
	};

	it("a person's Delete takes the song's links with it", () => {
		const s = song(U1, 'Casa Mía');
		const lesson = { lessonId: lessonIn(U1) };
		addMusic(db, U1, lesson, s, null, T);
		expect(deleteSong(db, 'u1', s)).toMatchObject({ ok: true });
		expect(db.select().from(songLinks).all()).toEqual([]);
	});

	it("a group song's purge from Recently deleted takes its links", async () => {
		const s = song(ED, 'Chan Chan');
		shareSong(db, ED, s, T);
		addMusic(db, ED, { lessonId: lessonIn(ED) }, s, null, T);
		addMusic(
			db,
			{ userId: 'u3', dance: 'salsa' },
			{ lessonId: lessonIn({ userId: 'u3', dance: 'salsa' }) },
			s,
			null,
			T
		);
		expect(deleteGroupSong(db, ED, s, T)).toBe(true);
		await purgeTrash(db, T + TRASH_MS + 1, scratch());
		expect(db.select().from(songs).where(eq(songs.id, s)).get()).toBeUndefined();
		expect(db.select().from(songLinks).all()).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it("a group's purge takes the links to its songs", async () => {
		const s = song(ED, 'Chan Chan');
		shareSong(db, ED, s, T);
		addMusic(db, ED, { lessonId: lessonIn(ED) }, s, null, T);
		expect(deleteTeam(db, 1, 'u1', T)).toBe(true);
		const dirs = scratch();
		writeFileSync(
			join(dirs.audio, db.select().from(songs).where(eq(songs.id, s)).get()!.audioFile!),
			'x'
		);
		await purgeTeams(db, T + TEAM_PURGE_MS + 1, dirs);
		expect(db.select().from(songs).where(eq(songs.id, s)).get()).toBeUndefined();
		expect(db.select().from(songLinks).all()).toEqual([]);
	});
});

describe('copies carry Music, never a song', () => {
	const U3: Wall = { userId: 'u3', dance: 'salsa' };
	const songCount = () => db.select().from(songs).all().length;
	const copy = async (kind: 'lesson' | 'drill' | 'routine', id: number, into: Wall | TeamSpace) => {
		const res = await cloneInto(db, { kind, id, into, recordings: false }, NO_FILES, T + 10);
		if (!res.ok) throw new Error(`no copy: ${res.reason}`);
		return res.id;
	};

	it("a member's copy of a group lesson keeps its shared song, with the note", async () => {
		const lesson = lessonIn(ED);
		const s = song(ED, 'Chan Chan');
		addMusic(db, ED, { lessonId: lesson }, s, 'Count it', T);
		publishLesson(db, ED, lesson, T);
		const before = songCount();
		const mine = await copy('lesson', lesson, U3);
		expect(listMusic(db, { lessonId: mine }, 'u3')).toEqual([
			expect.objectContaining({ songId: s, note: 'Count it' })
		]);
		expect(songCount()).toBe(before);
		expect(crossRefs(db)).toEqual([]);
	});

	it('drops a song the new place cannot play', async () => {
		const lesson = lessonIn(ED);
		const s = song(ED, 'Chan Chan');
		addMusic(db, ED, { lessonId: lesson }, s, null, T);
		unshareSong(db, ED, s, T);
		publishLesson(db, ED, lesson, T);
		const mine = await copy('lesson', lesson, U3);
		expect(db.select().from(songLinks).where(eq(songLinks.lessonId, mine)).all()).toEqual([]);
	});

	it("a person's lesson copied into a group: their own song is dropped, not copied", async () => {
		const lesson = lessonIn(U1);
		addMusic(db, U1, { lessonId: lesson }, song(U1, 'Casa Mía'), null, T);
		const before = songCount();
		const theirs = await copy('lesson', lesson, { ...ED, actorId: 'u1' });
		expect(db.select().from(songLinks).where(eq(songLinks.lessonId, theirs)).all()).toEqual([]);
		expect(songCount()).toBe(before);
	});

	it("takes the place's own member of the song's family when it has one", async () => {
		const lesson = lessonIn(U1);
		const s = song(U1, 'Casa Mía');
		addMusic(db, U1, { lessonId: lesson }, s, 'Slow one', T);
		const groupCopy = await cloneInto(
			db,
			{ kind: 'song', id: s, into: { ...ED, actorId: 'u1' }, recordings: false },
			NO_FILES,
			T + 5
		);
		if (!groupCopy.ok) throw new Error('no song copy');
		const theirs = await copy('lesson', lesson, { ...ED, actorId: 'u1' });
		expect(listMusic(db, { lessonId: theirs }, 'u1')).toEqual([
			expect.objectContaining({ songId: groupCopy.id, note: 'Slow one' })
		]);
	});

	it("a group's drill and routine bring their Music too", async () => {
		const drill = drillIn(ED);
		const routine = routineIn(ED);
		const s = song(ED, 'Chan Chan');
		shareSong(db, ED, s, T);
		addMusic(db, ED, { exerciseId: drill }, s, 'Shines', T);
		addMusic(db, ED, { routineId: routine }, s, 'Rueda', T);
		const lesson = lessonIn(ED);
		linkExercise(db, lesson, drill, 'u2');
		publishLesson(db, ED, lesson, T);
		const myDrill = await copy('drill', drill, U3);
		expect(listMusic(db, { exerciseId: myDrill }, 'u3')).toEqual([
			expect.objectContaining({ songId: s, note: 'Shines' })
		]);
		const myRoutine = await cloneInto(
			db,
			{ kind: 'routine', id: routine, into: U3, recordings: false },
			NO_FILES,
			T + 10,
			undefined,
			{ trusted: true }
		);
		if (!myRoutine.ok) throw new Error('no routine copy');
		expect(listMusic(db, { routineId: myRoutine.id }, 'u3')).toEqual([
			expect.objectContaining({ songId: s, note: 'Rueda' })
		]);
	});
});

describe('Sync knows Music', () => {
	const U3: Wall = { userId: 'u3', dance: 'salsa' };
	const songRows = (kind: CloneKind, id: number, who: string) =>
		(syncView(db, who, kind, id)?.rows ?? []).filter((r) => r.key.startsWith('song:'));
	/** Sync from `id` as `who`, onto `targets` (every copy they edit when omitted), with `picks`. */
	async function syncAs(
		who: string,
		kind: CloneKind,
		id: number,
		picks: Record<string, string | null> = {},
		only?: number[]
	) {
		const view = syncView(db, who, kind, id)!;
		const targets = view.targets.filter((t) => !only || only.includes(t.id));
		return syncAll(db, who, kind, id, picks, targets, view.members, NO_FILES, T + 30, 1e15);
	}
	/** A published group lesson with song S, and `who`'s own copy of it. */
	async function lessonAndCopy(who: Wall) {
		const lesson = lessonIn(ED);
		const S = song(ED, 'Chan Chan');
		addMusic(db, ED, { lessonId: lesson }, S, 'Count it', T);
		publishLesson(db, ED, lesson, T);
		const res = await cloneInto(
			db,
			{ kind: 'lesson', id: lesson, into: who, recordings: false },
			NO_FILES,
			T + 10
		);
		if (!res.ok) throw new Error('no copy');
		return { lesson, S, mine: res.id };
	}

	it("offers the group's new song, and Update mine brings it with its note", async () => {
		const { lesson, mine } = await lessonAndCopy(U3);
		const S2 = song(ED, 'Dale Timbal');
		addMusic(db, ED, { lessonId: lesson }, S2, 'Listen for the bridge', T + 20);
		expect(syncView(db, 'u3', 'lesson', mine)?.mode).toBe('update');
		expect(songRows('lesson', mine, 'u3')).toEqual([
			expect.objectContaining({ key: `song:#${S2}`, kind: 'add' })
		]);
		expect(await syncAs('u3', 'lesson', mine)).toEqual({ ok: true, refused: [] });
		expect(listMusic(db, { lessonId: mine }, 'u3').map((r) => [r.songId, r.note])).toEqual([
			[expect.any(Number), 'Count it'],
			[S2, 'Listen for the bridge']
		]);
	});

	it("Sync takes a song off the group's lesson when the removal is ticked", async () => {
		const u2: Wall = { userId: 'u2', dance: 'salsa' };
		const { lesson, S, mine } = await lessonAndCopy(u2);
		const [row] = listMusic(db, { lessonId: mine }, 'u2');
		removeMusic(db, u2, row.id, T + 20);
		const [r] = songRows('lesson', mine, 'u2');
		expect(r).toMatchObject({ key: `song:#${S}`, kind: 'remove' });
		expect(await syncAs('u2', 'lesson', mine, { [r.key]: null })).toEqual({
			ok: true,
			refused: []
		});
		expect(listMusic(db, { lessonId: lesson }, 'u2')).toEqual([]);
	});

	it('offers nothing the other place could not take', async () => {
		const u2: Wall = { userId: 'u2', dance: 'salsa' };
		const { mine } = await lessonAndCopy(u2);
		addMusic(db, u2, { lessonId: mine }, song(u2, 'My own'), null, T + 20);
		expect(songRows('lesson', mine, 'u2')).toEqual([]);
	});

	it('a song the other place cannot take leaves no notice or tab status behind a Sync', async () => {
		const u2: Wall = { userId: 'u2', dance: 'salsa' };
		const { lesson, mine } = await lessonAndCopy(u2);
		addMusic(db, u2, { lessonId: mine }, song(u2, 'My own'), null, T + 20);
		expect(await syncAs('u2', 'lesson', mine)).toEqual({ ok: true, refused: [] });
		const tab = sourcesOf(db, 'u2', 'lesson', mine).find((x) => x.id === lesson);
		expect(tab?.status).toBe('same');
		const group = familyStatus(db, 'u2', 'lesson', mine).find((e) => e.member.id === lesson);
		expect(group?.theirs).toEqual([]);
		expect(stepStatus(db, 'u2', 'lesson', mine)).toEqual({ lines: [], sending: 0 });
		expect(songRows('lesson', mine, 'u2')).toEqual([]);
	});

	it("a drill's Music is merged too", async () => {
		const drill = drillIn(ED);
		const S = song(ED, 'Chan Chan');
		shareSong(db, ED, S, T);
		const lesson = lessonIn(ED);
		linkExercise(db, lesson, drill, 'u2');
		publishLesson(db, ED, lesson, T);
		const res = await cloneInto(
			db,
			{ kind: 'drill', id: drill, into: U3, recordings: false },
			NO_FILES,
			T + 10
		);
		if (!res.ok) throw new Error('no copy');
		addMusic(db, ED, { exerciseId: drill }, S, 'Shines', T + 20);
		expect(songRows('drill', res.id, 'u3')).toEqual([
			expect.objectContaining({ key: `song:#${S}`, kind: 'add' })
		]);
	});
});
