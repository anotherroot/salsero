import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SYNC } from '$lib/clones/sync';
import { openDb, type Db } from '../db';
import { cloneSync, users } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { createFigure } from '../figures';
import { T1_SALSA, U1_SALSA } from '../test-walls';
import { setSyncSettings, syncSettingsOf } from './sync-settings';

const T = Date.UTC(2026, 10, 7, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const other = { on: false, names: false, small: true, sections: true, media: true };

let db: Db;

const figure = (space: typeof U1_SALSA | typeof T1_SALSA) =>
	createFigure(db, space, { figureName: 'Enchufla', name: 'Basic', ...shape })!.figure.id;

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
	setRole(db, 1, 'u3', 'editor', T);
});

describe('sync settings', () => {
	it('a missing row reads the defaults', () => {
		expect(syncSettingsOf(db, 'figure', figure(U1_SALSA))).toEqual(DEFAULT_SYNC);
	});

	it('the owner writes and reads back, and a second write replaces', () => {
		const id = figure(U1_SALSA);
		expect(setSyncSettings(db, 'u1', 'figure', id, other, T)).toBe(true);
		expect(syncSettingsOf(db, 'figure', id)).toEqual(other);
		expect(setSyncSettings(db, 'u1', 'figure', id, DEFAULT_SYNC, T + 1)).toBe(true);
		expect(syncSettingsOf(db, 'figure', id)).toEqual(DEFAULT_SYNC);
		expect(db.select().from(cloneSync).all()).toHaveLength(1);
	});

	it('another person, or a plain member of the group, writes nothing', () => {
		const mine = figure(U1_SALSA);
		expect(setSyncSettings(db, 'u2', 'figure', mine, other, T)).toBe(false);
		const club = figure(T1_SALSA);
		expect(setSyncSettings(db, 'u2', 'figure', club, other, T)).toBe(false);
		expect(setSyncSettings(db, 'u2', 'figure', 999, other, T)).toBe(false);
		expect(db.select().from(cloneSync).all()).toEqual([]);
	});

	it('a group editor writes the group’s row', () => {
		const club = figure(T1_SALSA);
		expect(setSyncSettings(db, 'u3', 'figure', club, other, T)).toBe(true);
		expect(syncSettingsOf(db, 'figure', club)).toEqual(other);
	});
});
