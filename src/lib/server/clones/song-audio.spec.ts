/**
 * New audio on a song (Use another YouTube link) and its copies: copies kept
 * in step download it too and lose their 1s; a copy with the switch off keeps
 * its old audio, and from then on its count is not offered across (the 1s
 * index different beats). Ana (u1) owns S, copied into Salsa Tuesdays (G1)
 * and Rueda club (G2). Files are fakes; the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { cloneMarks, clonePairs, songs, users } from '../db/schema';
import { createTeam } from '../teams';
import {
	createSongFromUrl,
	setAnchors,
	storeAnalysis,
	storeFetchedAudio,
	useAudioUrl
} from '../songs';
import { T1_SALSA, T2_SALSA, U1_SALSA } from '../test-walls';
import type { Space } from '../scope';
import { DEFAULT_SYNC } from '$lib/clones/sync';
import { diff } from '$lib/clones/diff';
import { cloneInto } from './clone';
import type { CloneFiles } from './files';
import { flatOf } from './trees';
import { hashValue, pairBase } from './pairs';
import { setSyncSettings } from './sync-settings';
import { flowFrom } from './flow';
import { audioReach } from './audio-reach';

const T = Date.UTC(2026, 10, 8, 12);
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
const NEW = 'https://youtu.be/Fd8nEwF3hHk';

let db: Db;
let named = 0;
const files: CloneFiles = {
	async link(_kind, file) {
		return `copy-${++named}-${file}`;
	},
	async unlink() {}
};

let S: number;
let G1s: number;
let G2s: number;

async function copy(id: number, into: Space) {
	const r = await cloneInto(db, { kind: 'song', id, into, recordings: false }, files, T);
	if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
	return r.id;
}
const row = (id: number) => db.select().from(songs).where(eq(songs.id, id)).get()!;

beforeEach(async () => {
	db = openDb(':memory:');
	db.insert(users)
		.values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' })
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u1', 'salsa', 'Rueda club', T);
	S = createSongFromUrl(
		db,
		U1_SALSA,
		{ url: 'https://youtu.be/old', title: 'Hoja', style: 'salsa' },
		T
	).id;
	storeFetchedAudio(db, S, { file: 's.m4a', mime: 'audio/mp4', title: null, durationS: 300 });
	storeAnalysis(db, S, { beats: [0.5, 1, 1.5], downbeats: [], durationS: 300 });
	setAnchors(db, S, [1], U1_SALSA, T);
	G1s = await copy(S, T1_SALSA);
	G2s = await copy(S, T2_SALSA);
	expect(setSyncSettings(db, 'u1', 'song', G2s, { ...DEFAULT_SYNC, on: false }, T)).toBe(true);
});

describe('new audio and the copies', () => {
	it('reaches a copy kept in step, not one with the switch off', async () => {
		expect(useAudioUrl(db, S, NEW, U1_SALSA, NOW)).toMatchObject({ ok: true });
		const report = await flowFrom(db, 'u1', 'song', S, files, NOW, ROOMY);
		expect(report.landed).toContain(G1s);
		expect(row(G1s)).toMatchObject({
			audioUrl: NEW,
			status: 'waiting_download',
			anchorsJson: '[]'
		});
		expect(row(G2s)).toMatchObject({ audioUrl: null, status: 'ready', anchorsJson: '[1]' });
	});

	it('leaves the count out of a comparison across different audio', () => {
		useAudioUrl(db, S, NEW, U1_SALSA, NOW);
		setAnchors(db, S, [2], U1_SALSA, NOW);
		const keys = diff(null, flatOf(db, 'song', S), flatOf(db, 'song', G2s), hashValue).map(
			(d) => d.key
		);
		expect(keys).toContain('audio');
		expect(keys).not.toContain('count');
		expect(keys).not.toContain('sample');
	});

	it('still compares the count when the audio is the same', () => {
		setAnchors(db, G2s, [2], T2_SALSA, NOW);
		const keys = diff(null, flatOf(db, 'song', S), flatOf(db, 'song', G2s), hashValue).map(
			(d) => d.key
		);
		expect(keys).toContain('count');
		expect(keys).not.toContain('audio');
	});

	it('reaches a copy made before the audio field existed', async () => {
		// Snapshots and marks written before 2026-11-08 hold no `audio`.
		for (const p of db.select().from(clonePairs).all()) {
			const base = JSON.parse(p.baseJson);
			delete base.fields.audio;
			db.update(clonePairs)
				.set({ baseJson: JSON.stringify(base) })
				.where(and(eq(clonePairs.aId, p.aId), eq(clonePairs.bId, p.bId)))
				.run();
		}
		for (const m of db.select().from(cloneMarks).all()) {
			const fields = JSON.parse(m.fieldsJson);
			delete fields.audio;
			db.update(cloneMarks)
				.set({ fieldsJson: JSON.stringify(fields) })
				.where(eq(cloneMarks.rowId, m.rowId))
				.run();
		}
		useAudioUrl(db, S, NEW, U1_SALSA, NOW);
		await flowFrom(db, 'u1', 'song', S, files, NOW, ROOMY);
		expect(row(G1s)).toMatchObject({ audioUrl: NEW, status: 'waiting_download' });
	});

	it('counts the copies new audio would reach, before the swap', () => {
		expect(audioReach(db, 'u1', S)).toBe(1);
		expect(setSyncSettings(db, 'u1', 'song', G2s, { ...DEFAULT_SYNC, on: true }, T)).toBe(true);
		expect(audioReach(db, 'u1', S)).toBe(2);
		// A copy already on other audio is not "in step" on it.
		db.update(songs).set({ audioUrl: 'https://youtu.be/mine' }).where(eq(songs.id, G2s)).run();
		expect(audioReach(db, 'u1', S)).toBe(1);
	});

	it('refuses a copy the worker is still on, so its pair still reads the swap as new', async () => {
		db.update(songs).set({ status: 'waiting_analysis' }).where(eq(songs.id, G1s)).run();
		expect(audioReach(db, 'u1', S)).toBe(0);
		useAudioUrl(db, S, NEW, U1_SALSA, NOW);
		const report = await flowFrom(db, 'u1', 'song', S, files, NOW, ROOMY);
		expect(report.landed).not.toContain(G1s);
		expect(report.refused).toEqual([expect.objectContaining({ id: G1s, reason: 'busy' })]);
		expect(row(G1s).audioUrl).toBeNull();
		// The swap is still S's change: a Sync offers G1 the new audio, never the old to S.
		const audio = diff(
			pairBase(db, 'song', S, G1s),
			flatOf(db, 'song', G1s),
			flatOf(db, 'song', S),
			hashValue
		).find((d) => d.key === 'audio');
		expect(audio?.side).toBe('theirs');
	});

	it('clears the sections and the music start with the count: they mark the old recording', async () => {
		db.update(songs)
			.set({
				sectionsJson: '[{"at":4,"name":"Mambo","countOff":false}]',
				startS: 3,
				startFoundS: 18
			})
			.where(eq(songs.id, S))
			.run();
		useAudioUrl(db, S, NEW, U1_SALSA, NOW);
		expect(row(S)).toMatchObject({ sectionsJson: '[]', startS: null, startFoundS: null });
		db.update(songs)
			.set({ sectionsJson: '[{"at":9,"name":"Coro","countOff":false}]', startS: 7 })
			.where(eq(songs.id, G2s))
			.run();
		const keys = diff(null, flatOf(db, 'song', S), flatOf(db, 'song', G2s), hashValue).map(
			(d) => d.key
		);
		expect(keys).toContain('audio');
		expect(keys).not.toContain('sections');
		expect(keys).not.toContain('musicStart');
	});
});
