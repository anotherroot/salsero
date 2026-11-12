import { describe, expect, it } from 'vitest';
import { openDb, type Db } from '../db';
import { figures } from '../db/schema';
import { eq } from 'drizzle-orm';
import { makeWorld, type World } from '../sync/test-world';
import { CLASS_ED } from '../test-class';
import { createLesson, addLessonVideo, linkFigure } from '../lessons';
import { createFigure } from '../figures';
import { addSpot } from '../spots';
import { judgeFigure } from '../access';
import { addLesson } from '../entries';
import { linkInSpace, linkSpot, sectionsFor } from '../spot-links';
import type { Space } from '../scope';
import { looksFor, movePictures } from './pictures';

const u1 = { userId: 'u1', dance: 'salsa' } as const;

function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	return { db, w: makeWorld(db) };
}

/** A lesson on `day` with one video and a section 3–9 s, linked to `figure`. */
function taught(
	db: Db,
	space: Space,
	day: string,
	figure: number,
	file: string,
	by?: string,
	asPerson = false
): number {
	const { lesson } = createLesson(db, space, {
		lessonDay: day,
		title: `Class ${day}`,
		notes: null
	});
	const video = addLessonVideo(
		db,
		{ lessonId: lesson.id, file, mime: 'video/mp4', sizeBytes: 10 },
		by
	).id;
	const spot = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 3000, endMs: 9000, label: null },
		by
	)!.id;
	if (asPerson) linkSpot(db, (space as { userId: string }).userId, spot, { figureId: figure });
	else linkInSpace(db, space, spot, { figureId: figure });
	return spot;
}
const fileN = (n: number) => `00000000-0000-4000-8000-0000000${String(n).padStart(5, '0')}.mp4`;

/** What the figure page leads with for this viewer. */
function pageTop(db: Db, viewer: string, figureId: number, own = true): number | null {
	const row = db.select().from(figures).where(eq(figures.id, figureId)).get()!;
	const { reach } = judgeFigure(db, viewer, row);
	return (
		sectionsFor(db, { figureId }, reach ?? undefined, own ? viewer : undefined)[0]?.spot.id ?? null
	);
}
const picked = (db: Db, viewer: string, figureId: number, own = true) => {
	const p = looksFor(db, [figureId], { viewer, ownSections: own }).get(figureId)?.picture;
	return p ? Number(/\/loops\/(\d+)-/.exec(p.strip)![1]) : null;
};

describe('looksFor: the picture', () => {
	it("is the figure page's top section: the newest lesson's before an older one and the recording", () => {
		const { db, w } = setup();
		const f = w.own.u1.figure;
		taught(db, u1, '2026-10-01', f, fileN(1));
		const newer = taught(db, u1, '2026-11-01', f, fileN(2));
		expect(pageTop(db, 'u1', f)).toBe(newer);
		expect(picked(db, 'u1', f)).toBe(newer);
	});

	it('a group editor sees the draft lesson; a reader never does', () => {
		const { db, w } = setup();
		const f = w.group.figure;
		linkInSpace(db, CLASS_ED, w.group.spot, { figureId: f });
		linkInSpace(db, CLASS_ED, w.group.draftSpot, { figureId: f });
		expect(picked(db, 'u2', f, false)).toBe(pageTop(db, 'u2', f, false));
		expect(picked(db, 'u2', f, false)).toBe(w.group.draftSpot);
		expect(picked(db, 'u3', f)).toBe(pageTop(db, 'u3', f));
		expect(picked(db, 'u3', f)).toBe(w.group.spot);
	});

	it("a group's figure: the group's section before the member's own", () => {
		const { db, w } = setup();
		const f = w.group.figure;
		const u3 = { userId: 'u3', dance: 'salsa' } as const;
		// u3 adds the published lesson: its figure becomes theirs to use.
		addLesson(
			db,
			'u3',
			w.group.published,
			{ lesson: false, routineIds: [], drillIds: [], figureIds: [f] },
			1
		);
		const mine = taught(db, u3, '2026-11-05', f, fileN(3), undefined, true);
		expect(picked(db, 'u3', f)).toBe(pageTop(db, 'u3', f));
		expect(picked(db, 'u3', f)).toBe(mine);
		expect(picked(db, 'u3', f, false)).toBeNull();
		linkInSpace(db, CLASS_ED, w.group.spot, { figureId: f });
		expect(picked(db, 'u3', f)).toBe(pageTop(db, 'u3', f));
		expect(picked(db, 'u3', f)).toBe(w.group.spot);
	});

	it('no linked section: no picture', () => {
		const { db, w } = setup();
		expect(picked(db, 'u1', w.own.u1.twin)).toBeNull();
	});
});

describe('looksFor: hands and length', () => {
	it("the figure's positions and its length; a length set per slot shows none", () => {
		const { db, w } = setup();
		const look = looksFor(db, [w.own.u1.figure], { viewer: 'u1', ownSections: true }).get(
			w.own.u1.figure
		)!;
		expect(look.hands).toBe('Cerrada u1 → Cerrada u1');
		expect(look.length).toBe(8);
		db.update(figures).set({ lengthFree: 1 }).where(eq(figures.id, w.own.u1.figure)).run();
		expect(
			looksFor(db, [w.own.u1.figure], { viewer: 'u1', ownSections: true }).get(w.own.u1.figure)!
				.length
		).toBeNull();
	});
});

describe('movePictures', () => {
	it("a move's picture is its first variation's, in id order, that has one", () => {
		const { db, w } = setup();
		const move = db.select().from(figures).where(eq(figures.id, w.own.u1.figure)).get()!.groupId!;
		// u1's figure has its recording section linked: the move takes it.
		const got = movePictures(db, [move], u1);
		expect(got.get(move)).toEqual({
			strip: `/loops/${w.own.u1.spot}-0-1000.jpg`,
			still: `/loops/${w.own.u1.spot}-0-1000-still.jpg`
		});
	});

	it('a move with no picture at all: null', () => {
		const { db, w } = setup();
		const move = db.select().from(figures).where(eq(figures.id, w.own.u1.twin)).get()!.groupId!;
		expect(movePictures(db, [move], u1).get(move)).toBeNull();
	});
});

describe('looksFor: a reader, figures out of reach first (review)', () => {
	it("an unreadable figure gets no picture, and never sets the group's reach for the rest", () => {
		const { db, w } = setup();
		// A readable figure made AFTER the draft one: rows come back by id, the draft figure first.
		const made = createFigure(db, CLASS_ED, {
			figureName: 'Later',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		linkFigure(db, w.group.published, made, 'u2');
		linkInSpace(db, CLASS_ED, w.group.spot, { figureId: made });
		linkInSpace(db, CLASS_ED, w.group.draftSpot, { figureId: made });
		linkInSpace(db, CLASS_ED, w.group.draftSpot, { figureId: w.group.draftFigure });
		expect(w.group.draftFigure).toBeLessThan(made);
		const looks = looksFor(db, [w.group.draftFigure, made], { viewer: 'u3', ownSections: true });
		expect(looks.get(w.group.draftFigure)?.picture ?? null).toBeNull();
		expect(looks.get(made)!.picture!.strip).toBe(`/loops/${w.group.spot}-0-1000.jpg`);
	});
});
