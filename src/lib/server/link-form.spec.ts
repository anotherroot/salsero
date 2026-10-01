import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { links } from './db/schema';
import { addFigureExercise, createFigure } from './figures';
import { addLinkFrom, deleteLinkFrom } from './link-form';
import { listLinks } from './links';

let db: Db;
let figureId: number;
let figureExerciseId: number;
beforeEach(() => {
	db = openDb(':memory:');
	const made = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	figureId = made.figure.id;
	figureExerciseId = addFigureExercise(db, made.figure.id)!.id;
});

const form = (fields: Record<string, string>) =>
	new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});

describe('addLinkFrom', () => {
	it('adds every pasted line', async () => {
		const res = await addLinkFrom(form({ urls: 'https://a.org\nhttps://b.org', title: '' }), db, {
			figureId
		});
		expect(res).toMatchObject({ ok: true, added: 2 });
		expect(listLinks(db, { figureId })).toHaveLength(2);
	});

	it('stores nothing when any line is bad, names it, and hands the text back', async () => {
		const typed = 'https://a.org\njavascript:alert(1)';
		const res = (await addLinkFrom(form({ urls: typed }), db, { figureId })) as {
			status: number;
			data: { message: string; urls: string };
		};
		expect(res.status).toBe(400);
		expect(res.data.message).toContain('javascript:alert(1)');
		expect(res.data.urls).toBe(typed);
		expect(db.select().from(links).all()).toHaveLength(0);
	});

	it('asks for a link when the box is empty', async () => {
		const res = (await addLinkFrom(form({ urls: '  \n ' }), db, { figureId })) as {
			status: number;
		};
		expect(res.status).toBe(400);
	});

	it('refuses links on an exercise its figure owns', async () => {
		const res = (await addLinkFrom(form({ urls: 'https://a.org' }), db, {
			exerciseId: figureExerciseId
		})) as {
			status: number;
		};
		expect(res.status).toBe(400);
	});
});

describe('deleteLinkFrom', () => {
	it('deletes its own link and 404s on a stranger’s', async () => {
		await addLinkFrom(form({ urls: 'https://a.org' }), db, { figureId });
		const [link] = listLinks(db, { figureId });
		expect(
			await deleteLinkFrom(form({ linkId: String(link.id) }), db, { lessonId: 999 })
		).toMatchObject({
			status: 404
		});
		expect(await deleteLinkFrom(form({ linkId: String(link.id) }), db, { figureId })).toMatchObject(
			{
				ok: true
			}
		);
	});
});
