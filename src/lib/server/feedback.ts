import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AppAgent } from '$lib/app-update/agent';
import type { DanceSlug } from '$lib/dances/dances';
import { ERROR_CHARS, KEEP_ERRORS, KEEP_PAGES } from '$lib/feedback/trail';
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
