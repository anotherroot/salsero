import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { links, users } from './db/schema';
import { addFigureExercise, addRecording, createFigure } from './figures';
import { addLinkFrom, deleteLinkFrom, retryVideoFrom, saveVideoFrom } from './link-form';
import { addLinks, listLinks } from './links';
import { claimVideoJob, failVideoJob } from './video-downloads';
import { U1_SALSA } from '$lib/server/test-walls';

let db: Db;
let figureId: number;
let figureExerciseId: number;
beforeEach(() => {
	db = openDb(':memory:');
	const made = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
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

describe('saveVideoFrom and retryVideoFrom', () => {
	const linkOf = (url: string) => addLinks(db, { figureId }, [url], null)![0].id;

	it('refuses a save when the person is already over the limit', async () => {
		db.insert(users)
			.values({ id: 'u1', email: 'u1@example.com', passwordHash: 'x', storageLimitBytes: 0 })
			.run();
		const id = linkOf('https://youtu.be/dQw4w9WgXcQ');
		// Nothing used yet and nothing incoming: 0 <= 0 fits, so fill one byte first.
		const f = createFigure(db, U1_SALSA, {
			figureName: 'X',
			name: 'Y',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		addRecording(db, {
			figureId: f.figure.id,
			file: 'x.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		expect(await saveVideoFrom(form({ linkId: String(id) }), db, { figureId }, 'u1')).toMatchObject(
			{
				status: 413,
				data: { action: 'saveVideo' }
			}
		);
		expect(listLinks(db, { figureId })[0].saving).toBeFalsy();
	});

	it('refuses a retry when the person is already over the limit', async () => {
		db.insert(users)
			.values({ id: 'u1', email: 'u1@example.com', passwordHash: 'x', storageLimitBytes: 0 })
			.run();
		const id = linkOf('https://youtu.be/dQw4w9WgXcQ');
		const f = createFigure(db, U1_SALSA, {
			figureName: 'X',
			name: 'Y',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		addRecording(db, {
			figureId: f.figure.id,
			file: 'x.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		expect(
			await retryVideoFrom(form({ linkId: String(id) }), db, { figureId }, 'u1')
		).toMatchObject({ status: 413, data: { action: 'retryVideo' } });
	});

	it('queues a YouTube link, and retries it once it failed', async () => {
		const id = linkOf('https://youtu.be/dQw4w9WgXcQ');
		expect(await saveVideoFrom(form({ linkId: String(id) }), db, { figureId }, 'u1')).toMatchObject(
			{
				action: 'saveVideo',
				ok: true
			}
		);
		expect(listLinks(db, { figureId })[0].saving?.status).toBe('queued');

		failVideoJob(db, claimVideoJob(db, Date.now())!.id, 'Private video', true);
		expect(
			await retryVideoFrom(form({ linkId: String(id) }), db, { figureId }, 'u1')
		).toMatchObject({
			action: 'retryVideo',
			ok: true
		});
		expect(listLinks(db, { figureId })[0].saving).toEqual({ status: 'queued', error: null });
	});

	it('refuses a web link and a link that is gone', async () => {
		const web = linkOf('https://a.org/x');
		expect(
			await saveVideoFrom(form({ linkId: String(web) }), db, { figureId }, 'u1')
		).toMatchObject({
			status: 400,
			data: { action: 'saveVideo', message: 'Only a YouTube link can be saved as a video.' }
		});
		expect(await saveVideoFrom(form({ linkId: '999' }), db, { figureId }, 'u1')).toMatchObject({
			status: 404,
			data: { action: 'saveVideo', message: 'That link was already removed.' }
		});
		expect(await retryVideoFrom(form({ linkId: '999' }), db, { figureId }, 'u1')).toMatchObject({
			status: 404,
			data: { action: 'retryVideo' }
		});
	});
});
