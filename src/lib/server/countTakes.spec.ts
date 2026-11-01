import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { deleteCountTake, listCountTakes, putCountTake, restoreCountTake } from './countTakes';

const take = (file: string, phrase: 'a' | 'b' = 'a') => ({
	pattern: 'salsa' as const,
	bpm: 120,
	phrase,
	file,
	sampleRate: 44100,
	preRollS: 0.1,
	lengthS: 1,
	durationS: 1.5,
	sizeBytes: 10
});

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

describe('deleteCountTake', () => {
	it('returns the whole row, or null when it is gone', () => {
		putCountTake(db, take('a.wav'));
		const id = listCountTakes(db)[0].id;
		const row = deleteCountTake(db, id);
		expect(row).toMatchObject({ id, file: 'a.wav', bpm: 120, phrase: 'a' });
		expect(listCountTakes(db)).toEqual([]);
		expect(deleteCountTake(db, id)).toBeNull();
	});
});

describe('restoreCountTake', () => {
	it('puts the take back under a new id', () => {
		putCountTake(db, take('a.wav'));
		const row = deleteCountTake(db, listCountTakes(db)[0].id)!;
		expect(restoreCountTake(db, row)).toBe('ok');
		expect(listCountTakes(db)).toHaveLength(1);
		expect(listCountTakes(db)[0].file).toBe('a.wav');
	});

	it('is taken when the slot holds a newer take, and changes nothing', () => {
		putCountTake(db, take('a.wav'));
		const row = deleteCountTake(db, listCountTakes(db)[0].id)!;
		putCountTake(db, take('b.wav'));
		expect(restoreCountTake(db, row)).toBe('taken');
		expect(listCountTakes(db).map((t) => t.file)).toEqual(['b.wav']);
	});
});
