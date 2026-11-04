/**
 * People who left a group before Keep shipped: an add on a group's lesson and
 * no membership. The boot pass gives them Keep everything, once.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { exercises, lessonAdds, lessons, recordings, teamMembers, users } from '../db/schema';
import { createTeam, deleteTeam, joinTeam } from '../teams';
import { addRecording, createFigure } from '../figures';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { addLesson, entryFor } from '../entries';
import { crossRefs } from '../integrity';
import { purgeTeams } from '../team-purge';
import { T1_SALSA } from '../test-walls';
import type { CloneFileKind, CloneFiles } from './files';
import { geneOf } from './genes';
import { settleFormerMembers } from './settle';

const DAY = 24 * 60 * 60 * 1000;
const T = Date.UTC(2026, 10, 3, 20);

let db: Db;
let lesson: number;
let figure: number;

function fakeFiles() {
	const linked: [CloneFileKind, string][] = [];
	const files: CloneFiles = {
		async link(kind, file) {
			linked.push([kind, file]);
			return `copy-${file}`;
		},
		async unlink() {}
	};
	return { files, linked };
}

/** Out of the group the way people left before this shipped: the row goes, the add stays. */
const leftEarlier = (userId: string) =>
	db
		.delete(teamMembers)
		.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, userId)))
		.run();
const ownLessons = (userId: string) =>
	db
		.select()
		.from(lessons)
		.where(and(eq(lessons.userId, userId), isNull(lessons.teamId)))
		.all();

beforeEach(() => {
	db = openDb(':memory:');
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka'],
		['u3', 'Maja']
	])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
	figure = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Doble',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	addRecording(
		db,
		{
			figureId: figure,
			file: 'f.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		},
		'u1'
	);
	lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Week 1', notes: null })
		.lesson.id;
	linkFigure(db, lesson, figure, 'u1');
	publishLesson(db, T1_SALSA, lesson, T);
	for (const u of ['u2', 'u3'])
		addLesson(
			db,
			u,
			lesson,
			{ lesson: true, routineIds: [], drillIds: [], figureIds: [figure] },
			T
		);
});

describe('settleFormerMembers', () => {
	it('gives someone who already left their copies, and a second run does nothing', async () => {
		leftEarlier('u2');
		const f = fakeFiles();
		expect(await settleFormerMembers(db, f.files, T + DAY)).toBe(1);

		const [copy] = ownLessons('u2');
		expect(copy.geneId).toBe(geneOf(db, 'lesson', lesson));
		expect(f.linked).toEqual([['recording', 'f.mp4']]);
		expect(
			db.select().from(recordings).where(eq(recordings.file, 'copy-f.mp4')).all()
		).toHaveLength(1);
		// Their practice is on the copy; the add is gone.
		const entry = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), eq(exercises.lessonId, copy.id)))
			.get()!;
		expect(entry.archivedAt).toBeNull();
		expect(db.select().from(lessonAdds).where(eq(lessonAdds.userId, 'u2')).all()).toEqual([]);
		expect(crossRefs(db)).toEqual([]);

		// A member still in the group is left alone.
		expect(ownLessons('u3')).toEqual([]);
		expect(entryFor(db, 'u3', { lessonId: lesson })!.archivedAt).toBeNull();

		const again = fakeFiles();
		expect(await settleFormerMembers(db, again.files, T + 2 * DAY)).toBe(0);
		expect(again.linked).toEqual([]);
		expect(ownLessons('u2')).toHaveLength(1);
	});

	it('settles the former members of a deleted group, but not of a purged one', async () => {
		leftEarlier('u2');
		deleteTeam(db, 1, 'u1', T);
		expect(await settleFormerMembers(db, fakeFiles().files, T + DAY)).toBe(1);
		expect(ownLessons('u2')).toHaveLength(1);

		// Group 2, purged with an add left behind by hand: nothing to read any more.
		createTeam(db, 'u1', 'salsa', 'Other', T);
		const other = createLesson(
			db,
			{ ...T1_SALSA, teamId: 2 },
			{ lessonDay: '2026-11-03', title: 'O', notes: null }
		).lesson.id;
		publishLesson(db, { ...T1_SALSA, teamId: 2 }, other, T);
		deleteTeam(db, 2, 'u1', T);
		await purgeTeams(db, T + 31 * DAY, {
			lessonVideos: '/nowhere',
			recordings: '/nowhere',
			audio: '/nowhere'
		});
		db.insert(lessonAdds).values({ userId: 'u3', lessonId: other, addedAt: T, seenAt: T }).run();
		expect(await settleFormerMembers(db, fakeFiles().files, T + 32 * DAY)).toBe(0);
	});

	it('one person’s failure is logged and the others are still settled', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		leftEarlier('u2');
		leftEarlier('u3');
		let calls = 0;
		const files: CloneFiles = {
			async link(_kind, file) {
				if (++calls === 1) throw new Error('disk full');
				return `copy-${calls}-${file}`;
			},
			async unlink() {}
		};
		expect(await settleFormerMembers(db, files, T + DAY)).toBe(1);
		expect(ownLessons('u2')).toEqual([]);
		expect(ownLessons('u3')).toHaveLength(1);
		expect(warn).toHaveBeenCalledWith('[clones] could not settle u2 in group 1', expect.any(Error));
		warn.mockRestore();
	});
});
