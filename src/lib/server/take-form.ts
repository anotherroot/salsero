/**
 * Take theirs on an item page (figure, routine, drill, song, lesson): the
 * `take` action the compare sheet posts. The data side is `clones/compare.ts`;
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
