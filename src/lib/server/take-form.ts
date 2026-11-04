/**
 * Take theirs and Send mine on an item page (figure, routine, drill, song,
 * lesson): the `take` action the compare sheet posts and the `send` action the
 * send sheet posts. The data side is `clones/compare.ts` and `clones/send.ts`;
 * this is the route's share: reading the form, the real files and the free
 * disk, and the refusals' answers. Whoever may not take into the row gets the
 * missing row's 404.
 */
import { error, fail } from '@sveltejs/kit';
import type { CloneKind, Picks } from '$lib/types';
import type { Db } from './db';
import { freeDisk } from './storage';
import { realCloneFiles } from './clones/files';
import { takeTheirs } from './clones/compare';
import { sendMine } from './clones/send';

const int = (v: FormDataEntryValue | null) =>
	typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null;

/** The sheet's picks (`{ key: 'mine' | 'theirs' }`, as JSON), or null when malformed. */
export function picksFrom(raw: FormDataEntryValue | null): Picks | null {
	if (typeof raw !== 'string') return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	const picks: Picks = {};
	for (const [key, side] of Object.entries(parsed)) {
		if (side !== 'mine' && side !== 'theirs') return null;
		picks[key] = side;
	}
	return picks;
}

/**
 * The `take` action: `intoId` (the page's row) receives `from`'s fields picked
 * `'theirs'`. Answers `{ action: 'take', taken: true }`, or a refusal the
 * sheet shows: 409 for a stale sheet, a missing pick, a name taken, a linked
 * section; 413 for room.
 */
export async function takeFrom(
	db: Db,
	userId: string,
	kind: CloneKind,
	intoId: number,
	request: Request
) {
	const form = await request.formData();
	const from = int(form.get('from'));
	const picks = picksFrom(form.get('picks'));
	const seen = form.get('seen');
	if (from === null || picks === null || typeof seen !== 'string')
		throw error(400, 'This page is out of date. Reload it and try again.');
	const res = await takeTheirs(
		db,
		userId,
		kind,
		intoId,
		from,
		picks,
		seen,
		realCloneFiles(),
		Date.now(),
		await freeDisk()
	);
	if (res.ok) return { action: 'take' as const, taken: true };
	if (res.reason === 'denied') throw error(404, 'Not found');
	return fail(res.reason === 'room' ? 413 : 409, {
		action: 'take' as const,
		reason: res.reason,
		message: res.message
	});
}

/** At most this many targets in one send: a person edits far fewer places. */
export const MAX_SEND_TARGETS = 50;

/** The send sheet's targets (`[{ id, picks, seen }]`, as JSON), or null when malformed. */
export function targetsFrom(
	raw: FormDataEntryValue | null
): { id: number; picks: Picks; seen: string }[] | null {
	if (typeof raw !== 'string') return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_SEND_TARGETS)
		return null;
	const out: { id: number; picks: Picks; seen: string }[] = [];
	for (const t of parsed) {
		if (!t || typeof t !== 'object') return null;
		const { id, picks, seen } = t as Record<string, unknown>;
		const p = picksFrom(JSON.stringify(picks ?? null));
		if (!Number.isSafeInteger(id) || (id as number) <= 0 || p === null || typeof seen !== 'string')
			return null;
		out.push({ id: id as number, picks: p, seen });
	}
	return out;
}

/**
 * The `send` action (board C3 p2): the page's row `fromId` gives to each
 * target the sheet ticked, each in its own transaction (`sendMine`). Answers
 * `{ action: 'send', results }`, one per target, landed or refused with its
 * words, so the sheet shows which did not land; a 404 when nothing could be
 * reached at all.
 */
export async function sendFrom(
	db: Db,
	userId: string,
	kind: CloneKind,
	fromId: number,
	request: Request
) {
	const form = await request.formData();
	const targets = targetsFrom(form.get('targets'));
	if (targets === null) throw error(400, 'This page is out of date. Reload it and try again.');
	const results = await sendMine(
		db,
		userId,
		kind,
		fromId,
		targets,
		realCloneFiles(),
		Date.now(),
		await freeDisk()
	);
	if (results.every((r) => !r.result.ok && r.result.reason === 'denied'))
		throw error(404, 'Not found');
	return { action: 'send' as const, results };
}
