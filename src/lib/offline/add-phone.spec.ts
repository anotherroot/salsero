import { describe, expect, it } from 'vitest';
import { addMode, addOnPhone, phoneFileName } from './add-phone';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const video = (name: string, type: string, n = 5) => new File([new Uint8Array(n)], name, { type });

describe('phoneFileName: a uuid and the extension', () => {
	it('from the type, then the name, else mp4', () => {
		expect(phoneFileName(video('a.MOV', 'video/quicktime'), UUID)).toBe(`${UUID}.mov`);
		expect(phoneFileName(video('a.webm', 'video/webm'), UUID)).toBe(`${UUID}.webm`);
		expect(phoneFileName(video('clip', 'video/mp4'), UUID)).toBe(`${UUID}.mp4`);
		expect(phoneFileName(video('clip.mkv', ''), UUID)).toBe(`${UUID}.mkv`);
		expect(phoneFileName(video('clip', ''), UUID)).toBe(`${UUID}.mp4`);
	});
});

describe('addOnPhone: a new own video stays on this phone (offline phase 4c)', () => {
	it('the original stored first, then its row (the device runs it)', async () => {
		const order: string[] = [];
		const out = await addOnPhone({ figureId: 4 }, video('a.mp4', 'video/mp4'), {
			put: async (file) => {
				order.push(`put ${file}`);
				return { ok: true };
			},
			post: async (url, body) => {
				order.push(`post ${url} ${JSON.stringify(body)}`);
				return new Response(JSON.stringify({ id: 9 }), { status: 201 });
			},
			drop: async () => true,
			uuid: () => UUID,
			slot: () => 3
		});
		expect(out).toEqual({ ok: true, file: `${UUID}.mp4`, id: 9 });
		expect(order).toEqual([
			`put ${UUID}.mp4`,
			`post /api/figures/4/recordings/phone {"file":"${UUID}.mp4","mime":"video/mp4","sizeBytes":5,"slot":3}`
		]);
	});

	it('no space: nothing posted', async () => {
		let posted = false;
		const out = await addOnPhone({ lessonId: 2 }, video('a.mp4', 'video/mp4'), {
			put: async () => ({ ok: false, reason: 'space' }),
			post: async () => {
				posted = true;
				return new Response(null, { status: 201 });
			},
			drop: async () => true,
			uuid: () => UUID,
			slot: () => null
		});
		expect(out).toEqual({ ok: false, reason: 'space' });
		expect(posted).toBe(false);
	});

	it('the row refused: the original is dropped', async () => {
		const dropped: string[] = [];
		const out = await addOnPhone({ lessonId: 2 }, video('a.mp4', 'video/mp4'), {
			put: async () => ({ ok: true }),
			post: async () => new Response('{"message":"No."}', { status: 404 }),
			drop: async (f) => {
				dropped.push(f);
				return true;
			},
			uuid: () => UUID,
			slot: () => null
		});
		expect(out).toEqual({ ok: false, reason: 'refused' });
		expect(dropped).toEqual([`${UUID}.mp4`]);
	});
});

describe('addMode: what adding a video does here', () => {
	const env = { app: false, appVideos: false, coarse: true, store: true };
	it('a phone with the store, own place: phone', () => {
		expect(addMode(env, true)).toBe('phone');
	});
	it("a group's place: upload, as today", () => {
		expect(addMode(env, false)).toBe('upload');
	});
	it('a computer: upload', () => {
		expect(addMode({ ...env, coarse: false }, true)).toBe('upload');
	});
	it('the Android app: the new one keeps it (own), an old one and a group hand over to the app', () => {
		expect(addMode({ ...env, app: true, appVideos: true }, true)).toBe('app-phone');
		expect(addMode({ ...env, app: true, appVideos: false }, true)).toBe('app-link');
		expect(addMode({ ...env, app: true, appVideos: true }, false)).toBe('app-link');
	});
});
