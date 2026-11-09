/**
 * One minute of a timeline, as the home worker uploads it: frames (JPEG,
 * base64, each with its time in the video) and the minute's sound (MP3,
 * base64, or null for a video without sound). The refusals are the worker's
 * to read: English.
 */
import { PIECE_MS } from './store';

export type Piece = { frames: { tMs: number; data: string }[]; sound: string | null };

/** A minute of frames every 2 s is 30; one more for a frame on the boundary. */
export const MAX_FRAMES = 31;
export const MAX_FRAME_B64 = 256 * 1024;
export const MAX_SOUND_B64 = 1024 * 1024;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

const isB64 = (s: unknown, max: number): s is string =>
	typeof s === 'string' && s.length > 0 && s.length <= max && B64.test(s);

export function parsePiece(raw: unknown, k: number): Piece | string {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'The piece must be an object.';
	const r = raw as Record<string, unknown>;
	const extra = Object.keys(r).find((key) => key !== 'frames' && key !== 'sound');
	if (extra) return `Unknown key: ${extra}.`;
	if (!Array.isArray(r.frames)) return 'frames must be a list.';
	if (r.frames.length > MAX_FRAMES) return `At most ${MAX_FRAMES} frames a piece.`;
	const from = k * PIECE_MS;
	const frames: Piece['frames'] = [];
	for (const f of r.frames as unknown[]) {
		const frame = (f ?? {}) as Record<string, unknown>;
		const t = frame.t_ms;
		if (typeof t !== 'number' || !Number.isInteger(t) || t < from || t >= from + PIECE_MS)
			return `Each frame's t_ms must be a whole number in [${from}, ${from + PIECE_MS}).`;
		if (frames.length && t <= frames[frames.length - 1].tMs)
			return 'Frames must be in order of t_ms.';
		if (!isB64(frame.data, MAX_FRAME_B64))
			return `Each frame's data must be base64 of at most ${MAX_FRAME_B64} characters.`;
		frames.push({ tMs: t, data: frame.data });
	}
	if (r.sound !== null && !isB64(r.sound, MAX_SOUND_B64))
		return `sound must be null or base64 of at most ${MAX_SOUND_B64} characters.`;
	return { frames, sound: r.sound as string | null };
}
