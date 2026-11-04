/**
 * Take theirs and Send mine on an item page (figure, routine, drill, song,
 * lesson): the `take` action the compare sheet posts, the `send` action the
 * send sheet posts and the `drop` action of Drop my copy. The data side is
 * `clones/compare.ts`, `clones/send.ts` and `clones/drop.ts`;
 * this is the route's share: reading the form, the real files and the free
 * disk, and the refusals' answers. Whoever may not take into the row gets the
 * missing row's 404.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { CloneKind, Picks } from '$lib/types';
import type { Db } from './db';
import { freeDisk } from './storage';
import { realCloneFiles } from './clones/files';
import { takeTheirs } from './clones/compare';
import { sendMine } from './clones/send';
import { dropCopy, dropOptions } from './clones/drop';
import { detach, detachOffer } from './clones/detach';
import { itemHref } from './make-mine-form';
import type { Wall } from './scope';

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

/**
 * The `drop` action (board C5): the person's own row `id` goes for the
 * version `to`, with `addLesson` when they ticked "Add Week 2 too"
 * (`clones/drop.ts`). Lands on that version's page (303), whose toast says
 * so. A version no longer offered is a 409 with its words; a row not theirs
 * (or one with nothing to go back to) is the missing row's 404.
 */
export async function dropFrom(db: Db, wall: Wall, kind: CloneKind, id: number, request: Request) {
	const form = await request.formData();
	const to = int(form.get('to'));
	const rawLesson = form.get('addLesson');
	const addLessonId = rawLesson === null || rawLesson === '' ? undefined : int(rawLesson);
	if (to === null || addLessonId === null)
		throw error(400, 'This page is out of date. Reload it and try again.');
	if (!dropOptions(db, wall, kind, id)) throw error(404, 'Not found');
	const res = dropCopy(db, wall, kind, id, to, { addLessonId }, Date.now());
	if (!res.ok) return fail(409, { action: 'drop' as const, message: res.message });
	throw redirect(303, itemHref(wall, kind, res.toId));
}

/**
 * The `detach` action (board C8): the page's row leaves its family
 * (`clones/detach.ts`). Answers `{ action: 'detach', detached: true }`; a row
 * the person may not detach (not theirs to edit, or nothing to leave) is the
 * missing row's 404.
 */
export function detachFrom(db: Db, userId: string, kind: CloneKind, id: number) {
	if (!detachOffer(db, userId, kind, id) || !detach(db, userId, kind, id, Date.now()))
		throw error(404, 'Not found');
	return { action: 'detach' as const, detached: true };
}
