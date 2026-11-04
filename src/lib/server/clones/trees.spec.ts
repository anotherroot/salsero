/**
 * Each kind as a Flat: built through the app's own create functions, then the
 * exact key set and a couple of `show` strings. Every key must pass
 * `fieldLabel`, and empty values are present as `''`, never left out.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Flat } from '$lib/types';
import { fieldLabel } from '$lib/clones/flat';
import { openDb, type Db } from '../db';
import { exercises, figures, lessonExercises, recordings, songs, users } from '../db/schema';
import { createTeam } from '../teams';
import {
	addFigureExercise,
	addRecording,
	createFigure,
	createVariationIn,
	moveVariation
} from '../figures';
import { addLessonVideo, createLesson, linkExercise, linkFigure, linkRoutine } from '../lessons';
import { addChildSlot, addFigureSlot, addOption, createRoutine, setSlotNote } from '../routines';
import { createCustomExercise } from '../exercises';
import { createSongFromUpload, setAnchors, setSampleStart, setTempoFactor } from '../songs';
import { addSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { addLinks } from '../links';
import { listPositions } from '../positions';
import { seedPositions } from '../test-positions';
import { setFigureShape } from '../graph';
import { T1_SALSA, U1_SALSA } from '../test-walls';
import { stampGene } from './genes';
import { flatOf } from './trees';

const T = Date.UTC(2026, 10, 3, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	seedPositions(db);
	db.insert(users)
		.values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' })
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
});

const keys = (f: Flat) => Object.keys(f).sort();

/** Every recording dated `T` (3 Nov), so the shown dates are fixed. */
const dated = () => db.update(recordings).set({ createdAt: T }).run();

/** Every field's key matches its map key, and its label is what `fieldLabel` gives. */
function wellFormed(f: Flat) {
	for (const [key, field] of Object.entries(f)) {
		expect(field.key).toBe(key);
		expect(() => fieldLabel(key, field.show)).not.toThrow();
		expect(typeof field.value).toBe('string');
	}
}

function drill(name = 'Shines') {
	return createCustomExercise(db, U1_SALSA, { name, everyDays: 2, notes: null }).id;
}

describe('flatOf', () => {
	it('a figure: fields, links, recordings with notes and sections', () => {
		const made = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!;
		const id = createVariationIn(db, made.group.id, { name: 'Doble', ...shape }, 'u1')!.id;
		const [open, closed] = listPositions(db, 'salsa');
		expect(
			setFigureShape(db, id, {
				startIds: [closed.id, open.id],
				endIds: [closed.id],
				startCount: 5,
				lengthCounts: 16
			})
		).toBe(true);
		addLinks(db, { figureId: id }, ['https://example.com/doble'], null);

		const bare = addRecording(db, {
			figureId: id,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 5,
			note: null
		});
		const noted = addRecording(db, {
			figureId: id,
			file: 'b.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 7,
			note: 'lead early'
		});
		dated();
		const g = stampGene(db, 'recording', noted.id);
		const section = addSpot(
			db,
			{ recordingId: noted.id },
			{ startMs: 1000, endMs: 2000, label: 'Turn' }
		)!;
		const point = addSpot(
			db,
			{ recordingId: noted.id },
			{ startMs: 3000, endMs: null, label: null }
		)!;
		const s = stampGene(db, 'spot', section.id);
		const shines = drill();
		linkInSpace(db, U1_SALSA, section.id, { figureId: made.figure.id });
		linkInSpace(db, U1_SALSA, section.id, { exerciseId: shines });
		const basicGene = stampGene(db, 'figure', made.figure.id);

		const f = flatOf(db, 'figure', id);
		wellFormed(f);
		const rec = `rec:#${bare.id}`;
		const sec = `rec:${g}:spot:${s}`;
		const pt = `rec:${g}:spot:#${point.id}`;
		expect(keys(f)).toEqual(
			[
				'name',
				'notes',
				'partner',
				'style',
				'timing',
				'positions',
				'link:https://example.com/doble',
				rec,
				`${rec}:note`,
				`rec:${g}`,
				`rec:${g}:note`,
				sec,
				`${sec}:links`,
				pt,
				`${pt}:links`
			].sort()
		);
		expect(f.timing).toMatchObject({
			value: '5|16',
			show: 'Starts on 5 · 16 counts',
			label: 'Timing'
		});
		expect(f.positions.show).toBe(`${open.name}, ${closed.name} → ${closed.name}`);
		expect(f.notes.value).toBe('');
		expect(f[rec]).toMatchObject({
			value: 'video/mp4|5',
			show: 'Recording, 3 Nov',
			label: 'Recording · 3 Nov'
		});
		expect(f[`${rec}:note`].value).toBe('');
		expect(f[`rec:${g}`].show).toBe('lead early');
		expect(f[`rec:${g}:note`]).toMatchObject({ value: 'lead early', label: 'Note · 3 Nov' });
		expect(f[sec]).toMatchObject({ value: '1000|2000|Turn', label: 'Section · Turn' });
		expect(f[`${sec}:links`].value).toBe(`drill:#${shines},fig:${basicGene}`);
		expect(f[`${sec}:links`].show).toBe('Shines, Enchufla · Basic');
		expect(f[`${pt}:links`].value).toBe('');
	});

	it('a recording’s day is shown in the zone asked for; values do not change', () => {
		const id = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!
			.figure.id;
		const rec = addRecording(db, {
			figureId: id,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 5,
			note: null
		});
		db.update(recordings)
			.set({ createdAt: Date.UTC(2026, 10, 3, 23, 30) })
			.run();
		const utc = flatOf(db, 'figure', id);
		const lj = flatOf(db, 'figure', id, { tz: 'Europe/Ljubljana' });
		const key = `rec:#${rec.id}`;
		expect(utc[key]).toMatchObject({ show: 'Recording, 3 Nov', label: 'Recording · 3 Nov' });
		expect(lj[key]).toMatchObject({ show: 'Recording, 4 Nov', label: 'Recording · 4 Nov' });
		expect(lj[`${key}:note`].label).toBe('Note · 4 Nov');
		expect(Object.keys(lj)).toEqual(Object.keys(utc));
		for (const k of Object.keys(utc)) expect(lj[k].value).toBe(utc[k].value);
	});

	it('flatOf never writes, and an unstamped figure keeps reading as #<id>', () => {
		const id = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!
			.figure.id;
		const rec = addRecording(db, {
			figureId: id,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'audio',
			sizeBytes: 5,
			note: null
		});
		dated();
		const before = db.select().from(figures).all();
		const f = flatOf(db, 'figure', id);
		expect(f[`rec:#${rec.id}`].show).toBe('Audio, 3 Nov');
		expect(db.select().from(figures).all()).toEqual(before);
	});

	it('a figure moved to another move reads the same', () => {
		const made = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!;
		const id = createVariationIn(db, made.group.id, { name: 'Doble', ...shape }, 'u1')!.id;
		const before = flatOf(db, 'figure', id);
		expect(moveVariation(db, id, { newFigure: 'Dile que no' }).ok).toBe(true);
		expect(flatOf(db, 'figure', id)).toEqual(before);
	});

	it('a drill: name, notes, practice, links', () => {
		const id = drill();
		db.update(exercises)
			.set({ practiceMode: 'count', countBpm: 90, notes: 'Slow.' })
			.where(eq(exercises.id, id))
			.run();
		addLinks(db, { exerciseId: id }, ['https://example.com/drill'], 'Video');
		const f = flatOf(db, 'drill', id);
		wellFormed(f);
		expect(keys(f)).toEqual(['link:https://example.com/drill', 'name', 'notes', 'practice']);
		expect(f.practice).toMatchObject({
			value: '{"mode":"count","bpm":90}',
			show: 'Count · 90 BPM'
		});
		// What practising last played is local: it never shows as a difference.
		db.update(exercises).set({ practiceJson: '{"speed":0.8}' }).where(eq(exercises.id, id)).run();
		expect(flatOf(db, 'drill', id)).toEqual(f);
		expect(f['link:https://example.com/drill']).toMatchObject({
			value: '1',
			show: 'Video',
			label: 'Link · Video'
		});
	});

	it('a song: title, artist, style, count, sample; never the audio', () => {
		const id = createSongFromUpload(
			db,
			U1_SALSA,
			{ file: 's.mp3', mime: 'audio/mpeg', title: 'Vivir', style: 'salsa' },
			T
		).id;
		const empty = flatOf(db, 'song', id);
		wellFormed(empty);
		expect(keys(empty)).toEqual(['artist', 'count', 'sample', 'style', 'title']);
		expect(empty.artist.value).toBe('');
		expect(empty.sample).toMatchObject({ value: '', show: 'Automatic' });
		setTempoFactor(db, id, 2);
		setAnchors(db, id, [3, 11]);
		setSampleStart(db, id, 83.5);
		const f = flatOf(db, 'song', id);
		expect(f.count).toMatchObject({ value: '[3,11]|2', show: '2 taps · ×2' });
		expect(f.sample).toMatchObject({ value: '83.5', show: 'From 1:23' });
		expect(f.style.show).toBe('Salsa');
		db.update(songs).set({ audioFile: 'other.mp3', sizeBytes: 99 }).where(eq(songs.id, id)).run();
		expect(flatOf(db, 'song', id)).toEqual(f);
	});

	it('a routine: name, notes and the slots as one field', () => {
		const made = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!;
		const basic = made.figure.id;
		const doble = createVariationIn(db, made.group.id, { name: 'Doble', ...shape }, 'u1')!.id;
		const intro = createRoutine(db, U1_SALSA, { name: 'Intro', notes: null }).routine.id;
		addFigureSlot(db, intro, basic, 'u1');
		const id = createRoutine(db, U1_SALSA, { name: 'Show', notes: 'Twice.' }).routine.id;
		const step = addFigureSlot(db, id, doble, 'u1')!;
		expect(addOption(db, step, basic, 'u1')).toBe(true);
		setSlotNote(db, step, 'hand change');
		expect(addChildSlot(db, id, intro, 'u1')).not.toBeNull();
		const g = stampGene(db, 'figure', basic);

		const f = flatOf(db, 'routine', id);
		wellFormed(f);
		expect(keys(f)).toEqual(['name', 'notes', 'slots']);
		expect(JSON.parse(f.slots.value)).toEqual([
			{ child: null, options: [`#${doble}`, g], note: 'hand change' },
			{ child: `#${intro}`, options: [], note: null }
		]);
		expect(f.slots.show).toBe('2 slots');
		expect(f.notes.show).toBe('Twice.');
	});

	it('a lesson’s drill links are live custom exercises only', () => {
		const id = createLesson(db, U1_SALSA, { lessonDay: '2026-11-03', title: 'Tue', notes: null })
			.lesson.id;
		const fig = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!
			.figure.id;
		const own = addFigureExercise(db, 'u1', fig)!.id;
		const old = drill('Old');
		db.update(exercises).set({ archivedAt: T }).where(eq(exercises.id, old)).run();
		// Hand-linked rows the link functions would refuse today: older data.
		db.insert(lessonExercises)
			.values([
				{ lessonId: id, exerciseId: own },
				{ lessonId: id, exerciseId: old }
			])
			.run();
		const f = flatOf(db, 'lesson', id);
		expect(Object.keys(f).filter((k) => k.startsWith('drill:'))).toEqual([]);
	});

	it('a lesson: fields, hand links, links, videos with sections', () => {
		const id = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Tue', notes: null })
			.lesson.id;
		const made = createFigure(db, T1_SALSA, { figureName: 'Enchufla', name: 'Doble', ...shape })!;
		const routine = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
		const shines = createCustomExercise(db, T1_SALSA, {
			name: 'Shines',
			everyDays: 2,
			notes: null
		}).id;
		linkFigure(db, id, made.figure.id, 'u1');
		linkRoutine(db, id, routine, 'u1');
		linkExercise(db, id, shines, 'u1');
		addLinks(db, { lessonId: id }, ['https://example.com/lesson'], null, 'u1');
		const v1 = addLessonVideo(
			db,
			{ lessonId: id, file: 'v1.mp4', mime: 'video/mp4', sizeBytes: 9 },
			'u1'
		);
		const v2 = addLessonVideo(
			db,
			{ lessonId: id, file: 'v2.mp4', mime: 'video/mp4', sizeBytes: 4 },
			'u1'
		);
		const gv = stampGene(db, 'video', v2.id);
		const spot = addSpot(
			db,
			{ lessonVideoId: v2.id },
			{ startMs: 0, endMs: 1000, label: 'A' },
			'u1'
		)!;
		linkInSpace(db, T1_SALSA, spot.id, { figureId: made.figure.id });
		const gr = stampGene(db, 'routine', routine);

		const f = flatOf(db, 'lesson', id);
		wellFormed(f);
		const sec = `video:${gv}:spot:#${spot.id}`;
		expect(keys(f)).toEqual(
			[
				'title',
				'day',
				'notes',
				'link:https://example.com/lesson',
				`fig:#${made.figure.id}`,
				`routine:${gr}`,
				`drill:#${shines}`,
				`video:#${v1.id}`,
				`video:${gv}`,
				sec,
				`${sec}:links`
			].sort()
		);
		expect(f.day).toMatchObject({ value: '2026-11-03', show: '3 Nov 2026' });
		expect(f[`fig:#${made.figure.id}`]).toMatchObject({
			value: '1',
			label: 'Figure · Enchufla · Doble'
		});
		expect(f[`video:${gv}`]).toMatchObject({ value: 'video/mp4|4', show: 'Video 2' });
		expect(f[`${sec}:links`]).toMatchObject({
			value: `fig:#${made.figure.id}`,
			show: 'Enchufla · Doble'
		});
	});
});
