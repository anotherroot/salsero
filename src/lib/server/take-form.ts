/**
 * Take theirs and Send mine on an item page (figure, routine, drill, song,
 * lesson): the `take` action the compare sheet posts, the `send` action the
 * send sheet posts, the `drop` action of Drop my copy, Copy to…'s `copyTo` and Move to…'s `moveTo`. The data side is
 * `clones/compare.ts`, `clones/send.ts`, `clones/drop.ts` and `clones/copy-to.ts`;
 * this is the route's share: reading the form, the real files and the free
 * disk, and the refusals' answers. Whoever may not take into the row gets the
 * missing row's 404.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { CloneKind, Picks, TwinKind } from '$lib/types';
import type { Db } from './db';
import { freeDisk } from './storage';
import { realCloneFiles } from './clones/files';
import { takeTheirs } from './clones/compare';
import { sendMine } from './clones/send';
import { dropCopy, dropOptions } from './clones/drop';
import { detach, detachOffer } from './clones/detach';
import { chosenSource, copyTo, intoOf, restoreMember } from './clones/copy-to';
import { moveLesson, movePreview } from './clones/move';
import { MOVE_GONE, SAME_AS_FAILED } from '$lib/clones/view';
import { ints } from './form';
import { separateFamily, setTwins } from './twins';
import { placeOfRow } from './clones/genes';
import { itemHref } from './make-mine-form';
import type { Wall } from './scope';
import { serverNow } from '$lib/server/server-clock';

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
		serverNow(),
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
		serverNow(),
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
	const res = dropCopy(db, wall, kind, id, to, { addLessonId }, serverNow());
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
	if (!detachOffer(db, userId, kind, id) || !detach(db, userId, kind, id, serverNow()))
		throw error(404, 'Not found');
	return { action: 'detach' as const, detached: true };
}

/** The twins' answers (`{ use key: row id }`, as JSON; absent is none), or null when malformed. */
export function useFrom(raw: FormDataEntryValue | null): Record<string, number> | null {
	if (raw === null || raw === '') return {};
	if (typeof raw !== 'string') return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	const use: Record<string, number> = {};
	for (const [key, id] of Object.entries(parsed)) {
		if (!Number.isSafeInteger(id) || (id as number) <= 0) return null;
		use[key] = id as number;
	}
	return use;
}

/**
 * The `copyTo` action (board C4): the page's row copied into `into` (`mine`
 * or a group's id), with the twins' answers in `use`; with `restore`, the
 * family's archived member there is restored instead. Answers, for the sheet:
 * `{ copied, href }` for a new copy; `{ existing, href, from, place }` when
 * the place holds a member (after a restore too), for Compare between the
 * member there and the row it would have copied, taking into the member's
 * page; `{ restore }` when that member is archived. 413 for room, 409 for a
 * name or a refused restore; a place that is not a target is the missing
 * row's 404.
 */
export async function copyToFrom(
	db: Db,
	wall: Wall,
	kind: CloneKind,
	id: number,
	request: Request
) {
	const form = await request.formData();
	const raw = form.get('into');
	const use = useFrom(form.get('use'));
	const rawRestore = form.get('restore');
	const restore = rawRestore === null || rawRestore === '' ? undefined : int(rawRestore);
	if (typeof raw !== 'string' || use === null || restore === null)
		throw error(400, 'This page is out of date. Reload it and try again.');
	const into = intoOf(db, wall.userId, kind, id, raw);
	if (!into) throw error(404, 'Not found');

	const existing = (memberId: number) => {
		// Only answers the plan asked for: a forged `use` names no row (or its place) here.
		const from = chosenSource(db, wall.userId, kind, id, into, use);
		const place = placeOfRow(db, kind, from);
		return {
			action: 'copy' as const,
			existing: memberId,
			href: itemHref(wall, kind, memberId),
			from,
			place: place?.kind === 'team' ? place.name : 'Yours'
		};
	};

	if (restore !== undefined) {
		const done = restoreMember(db, wall.userId, kind, id, into, restore, serverNow(), use);
		if (done === null) throw error(404, 'Not found');
		if (!done.ok) return fail(409, { action: 'copy' as const, message: done.message });
		return existing(restore);
	}

	const res = await copyTo(
		db,
		wall.userId,
		kind,
		id,
		into,
		use,
		realCloneFiles(),
		serverNow(),
		await freeDisk()
	);
	if (res.ok) {
		if (res.made)
			return { action: 'copy' as const, copied: res.id, href: itemHref(wall, kind, res.id) };
		return res.archived ? { action: 'copy' as const, restore: res.id } : existing(res.id);
	}
	switch (res.reason) {
		case 'room':
			if (res.room.ok) throw error(500, 'Refused without a reason');
			return fail(413, { action: 'copy' as const, message: res.room.message });
		case 'name':
			return fail(409, { action: 'copy' as const, message: res.message });
		case 'denied':
			throw error(404, 'Not found');
	}
}

/** The Move sheet's choices (`{ 'figure:12': 'keep' | 'group' }`, as JSON), or null when malformed. */
function moveChoicesFrom(raw: FormDataEntryValue | null): Record<string, 'keep' | 'group'> | null {
	if (raw === null || raw === '') return {};
	if (typeof raw !== 'string') return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	const choices: Record<string, 'keep' | 'group'> = {};
	for (const [key, choice] of Object.entries(parsed)) {
		if (choice !== 'keep' && choice !== 'group') return null;
		choices[key] = choice;
	}
	return choices;
}

/**
 * The `moveTo` action (board C4 p3): the person's own lesson moved into the
 * group `into` names as a draft (`clones/move.ts`), with `choices` per thing
 * it brings and the twins' answers in `use`. Lands on the group's lesson
 * (303). A group the lesson cannot move to is the missing row's 404; a
 * choice no longer offered (the lesson changed since the sheet opened) a 409,
 * as a name clash; no room a 413; a malformed form a 400.
 */
export async function moveToFrom(db: Db, wall: Wall, lessonId: number, request: Request) {
	const form = await request.formData();
	const teamId = int(form.get('into'));
	const choices = moveChoicesFrom(form.get('choices'));
	const use = useFrom(form.get('use'));
	if (teamId === null || choices === null || use === null)
		throw error(400, 'This page is out of date. Reload it and try again.');
	if (!movePreview(db, wall, lessonId, teamId)) throw error(404, 'Not found');
	const res = await moveLesson(
		db,
		wall,
		lessonId,
		teamId,
		choices,
		use,
		realCloneFiles(),
		serverNow(),
		await freeDisk()
	);
	if (res.ok) throw redirect(303, itemHref(wall, 'lesson', res.id));
	switch (res.reason) {
		case 'room':
			if (res.room.ok) throw error(500, 'Refused without a reason');
			return fail(413, { action: 'move' as const, message: res.room.message });
		case 'name':
			return fail(409, { action: 'move' as const, message: res.message });
		case 'denied':
			return fail(409, { action: 'move' as const, message: MOVE_GONE });
	}
}

/** Same as… (board C7) on a routine, lesson or song page: the row's twins become exactly the ticked ones. */
export async function sameAsFrom(db: Db, wall: Wall, kind: TwinKind, id: number, request: Request) {
	const form = await request.formData();
	if (!setTwins(db, wall, kind, id, ints(form, 'twin')))
		return fail(400, { action: 'sameAs', message: SAME_AS_FAILED });
	return { action: 'sameAs' };
}

/** Not the same? Separate (board C7 p2): the row and the rest of its family leave their twins. */
export function separateFrom(db: Db, wall: Wall, kind: TwinKind, id: number) {
	separateFamily(db, wall, kind, id);
	return { action: 'separate' };
}
