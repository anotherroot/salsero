import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { appFlags, links } from './db/schema';
import { createCustomExercise } from './exercises';
import { createFigure } from './figures';
import { createLesson, updateLesson } from './lessons';
import { addLinks, deleteLink, importNoteLinks, listLinks, NOTE_LINKS_FLAG } from './links';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const figureInput = {
	name: 'Enchufla',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: null,
	callable: true,
	callText: null
};
const lessonOn = (notes: string | null) =>
	createLesson(db, 'salsa', { lessonDay: '2026-09-20', title: 'Class', notes }).lesson;

describe('links', () => {
	it('adds, lists in insertion order, and deletes on each kind of owner', () => {
		const lesson = lessonOn(null);
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const drill = createCustomExercise(db, 'salsa', {
			name: 'Son switch',
			everyDays: 2,
			notes: null
		});

		for (const owner of [
			{ lessonId: lesson.id },
			{ figureId: figure.id },
			{ exerciseId: drill.id }
		]) {
			const added = addLinks(db, owner, ['https://a.org/1', 'https://b.org/2'], null)!;
			expect(listLinks(db, owner).map((l) => l.url)).toEqual([
				'https://a.org/1',
				'https://b.org/2'
			]);
			expect(deleteLink(db, owner, added[0].id)).toBe(true);
			expect(listLinks(db, owner).map((l) => l.url)).toEqual(['https://b.org/2']);
		}
	});

	it('applies a title only to a single added URL', () => {
		const owner = { lessonId: lessonOn(null).id };
		expect(addLinks(db, owner, ['https://a.org'], 'Teacher demo')![0].title).toBe('Teacher demo');
		expect(
			addLinks(db, owner, ['https://b.org', 'https://c.org'], 'Ignored')!.map((l) => l.title)
		).toEqual([null, null]);
	});

	it('skips a URL the owner already has, and refuses a non-http one', () => {
		const owner = { lessonId: lessonOn(null).id };
		addLinks(db, owner, ['https://a.org'], null);
		expect(
			addLinks(db, owner, ['https://a.org', 'javascript:x', 'https://b.org'], null)!.map(
				(l) => l.url
			)
		).toEqual(['https://b.org']);
		expect(listLinks(db, owner)).toHaveLength(2);
	});

	it('refuses links on an exercise a figure, lesson or routine owns', () => {
		const { exercise } = createFigure(db, 'salsa', figureInput)!;
		expect(addLinks(db, { exerciseId: exercise.id }, ['https://a.org'], null)).toBeNull();
		expect(db.select().from(links).all()).toHaveLength(0);
	});

	it('will not delete another owner’s link', () => {
		const a = { lessonId: lessonOn(null).id };
		const b = { lessonId: lessonOn(null).id };
		const [link] = addLinks(db, a, ['https://a.org'], null)!;
		expect(deleteLink(db, b, link.id)).toBe(false);
		expect(listLinks(db, a)).toHaveLength(1);
	});
});

describe('importNoteLinks', () => {
	it('copies the URLs out of lesson notes, once, without editing the notes', () => {
		const lesson = lessonOn('Great class (https://youtu.be/dQw4w9WgXcQ). See https://a.org/x.');
		lessonOn(null);
		expect(importNoteLinks(db, 1_000)).toBe(2);
		expect(listLinks(db, { lessonId: lesson.id }).map((l) => l.url)).toEqual([
			'https://youtu.be/dQw4w9WgXcQ',
			'https://a.org/x'
		]);
		expect(db.select().from(appFlags).all()).toEqual([{ key: NOTE_LINKS_FLAG, doneAt: 1_000 }]);
	});

	it('never runs again, so a deleted link stays deleted', () => {
		const lesson = lessonOn('https://a.org/x');
		importNoteLinks(db, 1_000);
		const [only] = listLinks(db, { lessonId: lesson.id });
		deleteLink(db, { lessonId: lesson.id }, only.id);
		updateLesson(db, lesson.id, {
			lessonDay: '2026-09-20',
			title: 'Class',
			notes: 'https://a.org/x https://b.org'
		});
		expect(importNoteLinks(db, 2_000)).toBe(0);
		expect(listLinks(db, { lessonId: lesson.id })).toEqual([]);
	});

	it('skips a URL the lesson already links', () => {
		const lesson = lessonOn('https://a.org/x');
		addLinks(db, { lessonId: lesson.id }, ['https://a.org/x'], 'Mine');
		expect(importNoteLinks(db, 1_000)).toBe(0);
		expect(listLinks(db, { lessonId: lesson.id }).map((l) => l.title)).toEqual(['Mine']);
	});
});
