import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePiece } from './piece';
import { readPiece, writePiece } from './files';

const frame = (t_ms: number) => ({ t_ms, data: 'AAAA' });

describe('parsePiece', () => {
	it('accepts frames inside its minute and a sound', () => {
		expect(parsePiece({ frames: [frame(60_000), frame(62_000)], sound: 'QUJD' }, 1)).toEqual({
			frames: [
				{ tMs: 60_000, data: 'AAAA' },
				{ tMs: 62_000, data: 'AAAA' }
			],
			sound: 'QUJD'
		});
		expect(parsePiece({ frames: [], sound: null }, 0)).toEqual({ frames: [], sound: null });
	});

	it('refuses a frame outside its minute', () => {
		expect(typeof parsePiece({ frames: [frame(59_000)], sound: null }, 1)).toBe('string');
		expect(typeof parsePiece({ frames: [frame(120_000)], sound: null }, 1)).toBe('string');
	});

	it('refuses frames out of order', () => {
		expect(typeof parsePiece({ frames: [frame(2000), frame(0)], sound: null }, 0)).toBe('string');
	});

	it('refuses an extra key', () => {
		expect(typeof parsePiece({ frames: [], sound: null, more: 1 }, 0)).toBe('string');
	});

	it('refuses frame data that is not base64', () => {
		expect(typeof parsePiece({ frames: [{ t_ms: 0, data: 'AA AA' }], sound: null }, 0)).toBe(
			'string'
		);
		expect(typeof parsePiece({ frames: [], sound: '' }, 0)).toBe('string');
	});

	it('refuses more than 31 frames', () => {
		const frames = Array.from({ length: 32 }, (_, i) => frame(i * 1000));
		expect(typeof parsePiece({ frames, sound: null }, 0)).toBe('string');
	});
});

describe('writePiece and readPiece', () => {
	it('round-trip; a missing piece is null', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'salsa-tl-'));
		try {
			const piece = { frames: [{ tMs: 0, data: 'AAAA' }], sound: null };
			await writePiece(dir, 0, piece);
			expect(await readPiece(dir, 0)).toEqual(piece);
			expect(await readPiece(dir, 1)).toBeNull();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
