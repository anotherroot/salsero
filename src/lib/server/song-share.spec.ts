/**
 * A group's songs: Share with the class, Stop sharing, Delete and Restore,
 * and what each does to the members' practice entries that use the song
 * (dropped to count only, recorded in `song_drops`, given back on Share or
 * Restore unless the person picked another song since).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, songDrops, songs, teamChanges, users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { leaveTeam, setRole } from './membership';
import { NO_FILES } from './test-walls';
import { createCustomExercise, setPracticeSettings } from './exercises';
import { createLesson, linkExercise, publishLesson } from './lessons';
import { addLesson, entryFor, reconcileEntries } from './entries';
import { createSongFromUpload, getSong, setAnchors } from './songs';
import { deleteGroupSong, shareSong, songUsers, unshareSong } from './song-share';
import { listTrash, restoreDeleted } from './trash';
import { checkSeen, songSeen } from './clash';
import type { TeamSpace } from './scope';

let db: Db;
/** Luka, the class's editor. */
const ED: TeamSpace = { teamId: 1, actorId: 'u2', dance: 'salsa' };
const T = 1_790_000_000_000;

let S: number;
let D: number;

const ready = (id: number) =>
	db
		.update(songs)
		.set({ status: 'ready', durationS: 200, beatsJson: '[]' })
		.where(eq(songs.id, id))
		.run();

const song = (space: Parameters<typeof createSongFromUpload>[1], title: string) => {
	const s = createSongFromUpload(db, space, {
		file: `${title}.mp3`,
		mime: 'audio/mpeg',
		title,
		style: 'salsa'
	});
	ready(s.id);
	return s.id;
};

const entry = (userId: string) => entryFor(db, userId, { drillId: D })!;
const songOf = (userId: string) => entry(userId).songId;
const drops = () => db.select().from(songDrops).where(eq(songDrops.songId, S)).all();
const changes = (verb: string) =>
	db
		.select()
		.from(teamChanges)
		.where(and(eq(teamChanges.rootKind, 'song'), eq(teamChanges.verb, verb)))
		.all();

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values(
			['Ana', 'Luka', 'Maja', 'Nik'].map((firstName, i) => ({
				id: `u${i + 1}`,
				email: `${firstName.toLowerCase()}@x.si`,
				passwordHash: 'x',
				firstName
			}))
		)
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
	for (const u of ['u2', 'u3', 'u4']) joinTeam(db, u, 1, 2);
	setRole(db, 1, 'u2', 'editor');

	// A published lesson with a drill; u3 and u4 add it, and practise it to S.
	D = createCustomExercise(db, ED, { name: 'Shines', everyDays: 3, notes: null }).id;
	const lesson = createLesson(db, ED, { lessonDay: '2026-11-01', title: 'Class', notes: null })
		.lesson.id;
	linkExercise(db, lesson, D, 'u2');
	publishLesson(db, ED, lesson, T);
	const picks = { lesson: false, routineIds: [], drillIds: [D], figureIds: [] };
	for (const u of ['u3', 'u4']) expect(addLesson(db, u, lesson, picks, T)).toBe(true);

	S = song(ED, 'Chan Chan');
	expect(shareSong(db, ED, S, T)).toBe(true);
	for (const u of ['u3', 'u4']) {
		db.update(exercises)
			.set({ practiceMode: 'song', songId: S })
			.where(eq(exercises.id, entry(u).id))
			.run();
	}
});

describe('group songs', () => {
	it('Share sets shared_at and is logged; a draft is refused for a song not ready', () => {
		expect(getSong(db, S)!.sharedAt).toBe(T);
		expect(changes('share')).toHaveLength(1);
		expect(changes('share')[0]).toMatchObject({ teamId: 1, rootId: S, actorId: 'u2' });
		const waiting = createSongFromUpload(db, ED, {
			file: 'w.mp3',
			mime: 'audio/mpeg',
			title: 'Waiting',
			style: 'salsa'
		}).id;
		expect(shareSong(db, ED, waiting, T)).toBe(false);
		// Another group's editor cannot share it.
		createTeam(db, 'u5', 'salsa', 'Other', 1);
		expect(shareSong(db, { teamId: 2, actorId: 'u5', dance: 'salsa' }, S, T)).toBe(false);
	});

	it('Stop sharing drops it from both entries, records the drops, and logs once by Luka', () => {
		expect(songUsers(db, S)).toBe(2);
		expect(unshareSong(db, ED, S, T + 1)).toEqual({ ok: true });
		expect(getSong(db, S)!.sharedAt).toBeNull();
		expect(songOf('u3')).toBeNull();
		expect(songOf('u4')).toBeNull();
		expect(drops()).toHaveLength(2);
		expect(drops().every((d) => d.droppedAt === T + 1)).toBe(true);
		const logged = changes('unshare');
		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({ actorId: 'u2', rootId: S });
		expect(songUsers(db, S)).toBe(0);
	});

	it('Share again gives it back to u3; u4, who picked their own song since, keeps theirs', () => {
		unshareSong(db, ED, S, T + 1);
		const mine = song({ userId: 'u4', dance: 'salsa' }, 'Mine');
		const config = JSON.parse(entry('u4').practiceJson ?? '{}');
		expect(
			setPracticeSettings(db, entry('u4').id, {
				mode: 'song',
				songId: mine,
				countBpm: null,
				config
			})
		).toBe(true);
		expect(shareSong(db, ED, S, T + 2)).toBe(true);
		expect(songOf('u3')).toBe(S);
		expect(songOf('u4')).toBe(mine);
		expect(drops()).toHaveLength(0);
	});

	it('Delete drops it and shows in Recently deleted; Restore gives it back', () => {
		expect(deleteGroupSong(db, ED, S, T + 1)).toBe(true);
		expect(getSong(db, S)!.archivedAt).toBe(T + 1);
		expect(songOf('u3')).toBeNull();
		expect(changes('delete')).toHaveLength(1);
		const listed = listTrash(db, 1).find((i) => i.kind === 'song');
		expect(listed).toMatchObject({ id: S, label: 'Chan Chan', at: T + 1, purgeOn: null });
		expect(listed!.by).toBe('Luka');

		expect(restoreDeleted(db, ED, 'song', S, T + 2)).toEqual({ ok: true });
		expect(getSong(db, S)!.archivedAt).toBeNull();
		expect(songOf('u3')).toBe(S);
		expect(songOf('u4')).toBe(S);
		expect(drops()).toHaveLength(0);
		expect(changes('restore')).toHaveLength(1);
		expect(listTrash(db, 1).some((i) => i.kind === 'song')).toBe(false);
		// Restoring what is not deleted, or not this group's, is nothing.
		expect(restoreDeleted(db, ED, 'song', S, T + 3)).toBeNull();
	});

	it('Restore of a draft keeps the drops until it is shared again', () => {
		unshareSong(db, ED, S, T + 1);
		deleteGroupSong(db, ED, S, T + 2);
		restoreDeleted(db, ED, 'song', S, T + 3);
		expect(songOf('u3')).toBeNull();
		expect(drops()).toHaveLength(2);
		shareSong(db, ED, S, T + 4);
		expect(songOf('u3')).toBe(S);
		expect(drops()).toHaveLength(0);
	});

	it('leaving without keeping it drops it from the leaver’s entry for good: Share does not give it back', async () => {
		expect(await leaveTeam(db, 1, 'u3', { mode: 'used' }, NO_FILES, T + 1)).toBe('left');
		expect(songOf('u3')).toBeNull();
		expect(songOf('u4')).toBe(S);
		expect(drops()).toHaveLength(0);
		unshareSong(db, ED, S, T + 2);
		shareSong(db, ED, S, T + 3);
		expect(songOf('u3')).toBeNull();
		expect(songOf('u4')).toBe(S);
	});

	it('leaving with everything puts the leaver’s own copy on their practice, out of Share’s reach', async () => {
		expect(await leaveTeam(db, 1, 'u3', { mode: 'all' }, NO_FILES, T + 1)).toBe('left');
		const [copy] = db
			.select()
			.from(songs)
			.where(and(eq(songs.userId, 'u3'), isNull(songs.teamId)))
			.all();
		expect(copy.audioFile).toBe(`copy-${getSong(db, S)!.audioFile}`);
		const playing = () =>
			db
				.select({ song: exercises.songId })
				.from(exercises)
				.where(and(eq(exercises.userId, 'u3'), isNull(exercises.archivedAt)))
				.all()
				.map((r) => r.song)
				.filter((s) => s !== null);
		expect(playing()).toEqual([copy.id]);
		expect(drops()).toHaveLength(0);
		unshareSong(db, ED, S, T + 2);
		shareSong(db, ED, S, T + 3);
		expect(playing()).toEqual([copy.id]);
		expect(songOf('u4')).toBe(S);
	});

	it('an editor’s own entry holds only a shared song too', () => {
		setRole(db, 1, 'u3', 'editor');
		unshareSong(db, ED, S, T + 1);
		expect(songOf('u3')).toBeNull();
		shareSong(db, ED, S, T + 2);
		expect(songOf('u3')).toBe(S);
	});

	it('reconcileEntries for one person touches only that person’s entries', () => {
		db.update(songs).set({ sharedAt: null }).where(eq(songs.id, S)).run();
		reconcileEntries(db, 1, T + 1, 'u3');
		expect(songOf('u3')).toBeNull();
		expect(songOf('u4')).toBe(S);
		expect(drops().map((d) => d.exerciseId)).toEqual([entry('u3').id]);
		// Again: the drop is not doubled.
		reconcileEntries(db, 1, T + 2);
		expect(drops()).toHaveLength(2);
	});

	it('two editors’ saves: the second, which saw older anchors, is refused', () => {
		const seenByLuka = songSeen(getSong(db, S)!);
		const seenByAna = songSeen(getSong(db, S)!);
		expect(checkSeen(songSeen(getSong(db, S)!), seenByAna).ok).toBe(true);
		setAnchors(db, S, [0, 8], { teamId: 1, actorId: 'u1', dance: 'salsa' }, T + 1);
		const check = checkSeen(songSeen(getSong(db, S)!), seenByLuka);
		expect(check.ok).toBe(false);
		expect(!check.ok && 'changed' in check && check.changed).toEqual(['anchorsJson']);
		expect(changes('edit')).toHaveLength(1);
		expect(changes('edit')[0]).toMatchObject({ actorId: 'u1', subject: 'anchors' });
	});

	it('Stop sharing and Delete refuse a song of another group, or a person’s', () => {
		const own = song({ userId: 'u2', dance: 'salsa' }, 'Own');
		expect(unshareSong(db, ED, own, T)).toBeNull();
		expect(deleteGroupSong(db, ED, own, T)).toBe(false);
		expect(shareSong(db, ED, own, T)).toBe(false);
	});
});
