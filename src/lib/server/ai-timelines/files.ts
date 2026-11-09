/**
 * A timeline's pieces on disk: `<dir>/<k>.json`, `{ frames: [{ t_ms, data }], sound }`.
 * The folder is given (`timelineDir(id)` in the app, a temp dir in specs).
 */
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Piece } from './piece';

const pathOf = (dir: string, k: number) => join(dir, `${k}.json`);

/** Written whole, then renamed: a reader never sees half a piece. */
export async function writePiece(dir: string, k: number, piece: Piece): Promise<void> {
	await mkdir(dir, { recursive: true });
	const body = JSON.stringify({
		frames: piece.frames.map((f) => ({ t_ms: f.tMs, data: f.data })),
		sound: piece.sound
	});
	const tmp = `${pathOf(dir, k)}.part`;
	await writeFile(tmp, body);
	await rename(tmp, pathOf(dir, k));
}

export async function readPiece(dir: string, k: number): Promise<Piece | null> {
	const raw = await readFile(pathOf(dir, k), 'utf8').catch(() => null);
	if (raw === null) return null;
	const p = JSON.parse(raw) as { frames: { t_ms: number; data: string }[]; sound: string | null };
	return { frames: p.frames.map((f) => ({ tMs: f.t_ms, data: f.data })), sound: p.sound };
}

/** Which of pieces 0..n-1 are on disk. */
export async function piecesPresent(dir: string, n: number): Promise<boolean> {
	for (let k = 0; k < n; k++) {
		const ok = await access(pathOf(dir, k)).then(
			() => true,
			() => false
		);
		if (!ok) return false;
	}
	return true;
}
