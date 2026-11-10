import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AppAgent } from '$lib/app-update/agent';
import type { DanceSlug } from '$lib/dances/dances';
import { ERROR_CHARS, KEEP_ERRORS, KEEP_PAGES } from '$lib/feedback/trail';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db';
import { feedback, users } from './db/schema';

/*
 * Send feedback: a tester's message to the admin of their dance, with what the
 * page knew (where they were, the build, the app, the browser). The admin reads
 * them on /admin and marks each done; nothing is ever deleted.
 */

/** The longest message. */
export const MESSAGE_MAX = 4000;
const PATH_MAX = 500;
const AGENT_MAX = 500;
/** How many done messages the admin page lists. */
export const DONE_SHOWN = 30;

export interface FeedbackInput {
	message: string;
	page: string | null;
	trail: string[];
	errors: string[];
	siteVersion: string | null;
	viewport: string | null;
}

/** A JSON array of strings from the form, each cut to `chars`, at most `keep`; anything else is []. */
function strings(raw: FormDataEntryValue | null, keep: number, chars: number): string[] {
	try {
		const v: unknown = JSON.parse(String(raw ?? '[]'));
		if (!Array.isArray(v)) return [];
		return v
			.filter((s): s is string => typeof s === 'string' && s !== '')
			.slice(-keep)
			.map((s) => s.slice(0, chars));
	} catch {
		return [];
	}
}

/** A short field kept only when it looks right; never a refusal (the page fills these, not the person). */
function short(raw: FormDataEntryValue | null, re: RegExp): string | null {
	const v = String(raw ?? '').trim();
	return re.test(v) ? v : null;
}

/**
 * The form's message and what the page sent with it. 'empty' and 'long' are the
 * person's to fix; everything the page adds is cut or dropped, never refused.
 */
export function readFeedback(form: FormData): FeedbackInput | 'empty' | 'long' {
	const message = String(form.get('message') ?? '').trim();
	if (message === '') return 'empty';
	if (message.length > MESSAGE_MAX) return 'long';
	return {
		message,
		page: short(form.get('page'), new RegExp(`^/[^\\s]{0,${PATH_MAX - 1}}$`)),
		trail: strings(form.get('trail'), KEEP_PAGES, PATH_MAX),
		errors: strings(form.get('errors'), KEEP_ERRORS, ERROR_CHARS),
		siteVersion: short(form.get('version'), /^[\w.-]{1,40}$/),
		viewport: short(form.get('viewport'), /^\d{1,5}×\d{1,5}$/)
	};
}

/** Keep one message. `agent`: the Android app's, read from the request; `userAgent` the raw header. */
export function sendFeedback(
	db: Db,
	who: { userId: string; dance: DanceSlug },
	input: FeedbackInput,
	sent: { agent: AppAgent | null; userAgent: string | null },
	now: number
): number {
	const row = db
		.insert(feedback)
		.values({
			userId: who.userId,
			dance: who.dance,
			message: input.message,
			page: input.page,
			trail: JSON.stringify(input.trail),
			errors: JSON.stringify(input.errors),
			siteVersion: input.siteVersion,
			appVersion: sent.agent?.versionCode ?? null,
			appChannel: sent.agent?.channel ?? null,
			userAgent: sent.userAgent?.slice(0, AGENT_MAX) ?? null,
			viewport: input.viewport,
			createdAt: now
		})
		.returning({ id: feedback.id })
		.get();
	return row.id;
}

export interface FeedbackRow {
	id: number;
	email: string;
	firstName: string | null;
	lastName: string | null;
	message: string;
	page: string | null;
	trail: string[];
	errors: string[];
	siteVersion: string | null;
	appVersion: number | null;
	appChannel: string | null;
	userAgent: string | null;
	viewport: string | null;
	/** The screenshot's file name, when one came with it. */
	shot: string | null;
	createdAt: number;
	doneAt: number | null;
}

const parsed = (raw: string): string[] => {
	try {
		const v: unknown = JSON.parse(raw);
		return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
	} catch {
		return [];
	}
};

function rows(db: Db, dance: DanceSlug, done: boolean, limit?: number): FeedbackRow[] {
	const q = db
		.select({
			id: feedback.id,
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName,
			message: feedback.message,
			page: feedback.page,
			trail: feedback.trail,
			errors: feedback.errors,
			siteVersion: feedback.siteVersion,
			appVersion: feedback.appVersion,
			appChannel: feedback.appChannel,
			userAgent: feedback.userAgent,
			viewport: feedback.viewport,
			shot: feedback.shot,
			createdAt: feedback.createdAt,
			doneAt: feedback.doneAt
		})
		.from(feedback)
		.innerJoin(users, eq(users.id, feedback.userId))
		.where(
			and(eq(feedback.dance, dance), done ? isNotNull(feedback.doneAt) : isNull(feedback.doneAt))
		)
		.orderBy(done ? desc(feedback.doneAt) : desc(feedback.createdAt), desc(feedback.id));
	const all = limit === undefined ? q.all() : q.limit(limit).all();
	return all.map((r) => ({ ...r, trail: parsed(r.trail), errors: parsed(r.errors) }));
}

/**
 * The dance's messages for its admin: the open ones newest first, then the last
 * done ones, and how many are done in all (the list stops at `DONE_SHOWN`).
 */
export function feedbackFor(
	db: Db,
	dance: DanceSlug
): { open: FeedbackRow[]; done: FeedbackRow[]; doneCount: number } {
	return {
		open: rows(db, dance, false),
		done: rows(db, dance, true, DONE_SHOWN),
		doneCount: countOf(db, dance, true)
	};
}

function countOf(db: Db, dance: DanceSlug, done: boolean): number {
	return (
		db
			.select({ n: sql<number>`count(*)` })
			.from(feedback)
			.where(
				and(eq(feedback.dance, dance), done ? isNotNull(feedback.doneAt) : isNull(feedback.doneAt))
			)
			.get()?.n ?? 0
	);
}

/** How many messages wait for the dance's admin. */
export function openFeedbackCount(db: Db, dance: DanceSlug): number {
	return countOf(db, dance, false);
}

/** Mark one of the dance's messages done (`doneAt`) or open again (null); false when it is not the dance's. */
export function markFeedback(db: Db, dance: DanceSlug, id: number, doneAt: number | null): boolean {
	const res = db
		.update(feedback)
		.set({ doneAt })
		.where(and(eq(feedback.id, id), eq(feedback.dance, dance)))
		.run();
	return res.changes > 0;
}

/** The largest screenshot taken: the page sends a JPEG of at most 1280 px on its long side. */
export const SHOT_MAX_BYTES = 3 * 1024 * 1024;

/**
 * The screenshot in the form (`shot`), as its bytes: null when none came, 'bad'
 * when it is not a JPEG or is too large. The page always sends a JPEG (the
 * Android app's capture, or a picked picture redrawn in the page).
 */
export async function readShot(form: FormData): Promise<Uint8Array | null | 'bad'> {
	const file = form.get('shot');
	if (file === null || typeof file === 'string') return null;
	if (file.size === 0) return null;
	if (file.size > SHOT_MAX_BYTES) return 'bad';
	const bytes = new Uint8Array(await file.arrayBuffer());
	const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	return jpeg ? bytes : 'bad';
}

/** Write a message's screenshot to `dir` as `<id>.jpg` and note it on the row. */
export function keepShot(db: Db, dir: string, id: number, bytes: Uint8Array): void {
	const name = `${id}.jpg`;
	writeFileSync(join(dir, name), bytes);
	db.update(feedback).set({ shot: name }).where(eq(feedback.id, id)).run();
}

/** The screenshot's file name of one of the dance's messages; null when it has none or is not the dance's. */
export function shotOf(db: Db, dance: DanceSlug, id: number): string | null {
	const row = db
		.select({ shot: feedback.shot })
		.from(feedback)
		.where(and(eq(feedback.id, id), eq(feedback.dance, dance)))
		.get();
	return row?.shot ?? null;
}
