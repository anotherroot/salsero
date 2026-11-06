/**
 * Music with notes (spec Part B): a lesson's, a drill's and a routine's
 * suggested songs, each with a note — which songs a row may take, who sees
 * them, and the History of a group's.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, ne } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { songs, teamChanges, users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { createCustomExercise } from './exercises';
import { createLesson } from './lessons';
import { createRoutine } from './routines';
import { addFigureExercise, createFigure } from './figures';
import { createSongFromUpload } from './songs';
import { shareSong, unshareSong } from './song-share';
import { addMusic, listMusic, musicNote, removeMusic, setMusicNote } from './song-links';
import type { TeamSpace, Wall } from './scope';

const T = 1_790_000_000_000;
const U1: Wall = { userId: 'u1', dance: 'salsa' };
const U2: Wall = { userId: 'u2', dance: 'salsa' };
/** u1 owns group 1; u2 edits it; u3 is a member. */
const ED: TeamSpace = { teamId: 1, actorId: 'u2', dance: 'salsa' };

let db: Db;

const song = (space: Parameters<typeof createSongFromUpload>[1], title: string, ready = true) => {
	const s = createSongFromUpload(db, space, {
		file: `${title}.mp3`,
		mime: 'audio/mpeg',
		title,
		style: 'salsa'
	});
	if (ready)
		db.update(songs)
			.set({ status: 'ready', durationS: 200, beatsJson: '[]', audioFile: `${title}.mp3` })
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
