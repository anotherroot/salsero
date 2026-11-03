/**
 * The clash check's server half: read what a save saw, and compare it with
 * what is stored now. See `$lib/clash/clash.ts` for why it is values, not
 * versions.
 *
 * Check and write run with no `await` between them, so on the one Node
 * process no other request can land in the gap.
 *
 * On a group's row a save without `seen` is refused (risk 27): group rows are
 * new, so no tab open from before the check can lack it, and a save path that
 * forgot it would overwrite silently. On a person's own row a save without
 * `seen` is accepted as before, so a tab opened before the check still saves.
 */
import { fail, type ActionFailure } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { figureGroups, figures } from './db/schema';
import { figurePositions } from './graph';
import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT } from '$lib/graph/timing';
import { asSeen, changedFields, clashTitle, goneTitle, type Seen } from '$lib/clash/clash';

export type SeenCheck =
	| { ok: true }
	| { ok: false; gone: true; by: string | null; at: number | null }
	| { ok: false; changed: string[]; current: Seen; by: string | null; at: number | null };

/** What a save saw: one hidden input, `seen`, holding JSON. Null when absent or unreadable. */
export function seenFrom(form: FormData): Seen | null {
	const raw = form.get('seen');
	if (typeof raw !== 'string' || raw === '') return null;
	try {
		return asSeen(JSON.parse(raw));
	} catch {
		return null;
	}
}

/**
 * Whether a save that saw `seen` may write over `current`. `current` null is a
 * target deleted or archived since. A missing `seen` passes: whether that is
 * allowed (a person's own row) or not (a group's) is the caller's question,
 * asked first (`seenRefusal`, `missingSeen`).
 *
 * `by` and `at` come from History once it exists (Task 12); null until then.
 */
export function checkSeen(current: Seen | null, seen: Seen | null): SeenCheck {
	if (current === null) return { ok: false, gone: true, by: null, at: null };
	if (seen === null) return { ok: true };
	const changed = changedFields(seen, current);
	if (changed.length === 0) return { ok: true };
	return { ok: false, changed, current, by: null, at: null };
}

/**
 * Whether a save said what it saw of every field it writes. On a group's row
 * one that did not is refused (risk 27): `seen: {}` must not pass where no
 * `seen` would not.
 */
export function seesAll(seen: Seen | null, keys: string[]): boolean {
	return seen !== null && keys.every((k) => k in seen);
}

/** The refusal for a group's save that carried no `seen`. */
export const MISSING_SEEN = 'This page is out of date. Reload it and try again.';

/**
 * A form save's clash check, as the failure to return (or null to go on):
 * 400 for a group's save without `seen`, 409 carrying `clash` (the other
 * version), 410 carrying `gone`. `extra` is the action's own failure fields
 * (its `action`, what was typed), so the page keeps the typed values.
 */
export function seenRefusal<T extends Record<string, unknown>>(
	form: FormData,
	team: boolean,
	current: Seen | null,
	extra: T,
	now = Date.now()
): ActionFailure<T & { message: string; clash?: unknown; gone?: unknown }> | null {
	const seen = seenFrom(form);
	if (team && current !== null && !seesAll(seen, Object.keys(current))) {
		return fail(400, { ...extra, message: MISSING_SEEN });
	}
	const check = checkSeen(current, seen);
	if (check.ok) return null;
	if ('gone' in check) {
		const gone = { by: check.by, at: check.at };
		return fail(410, { ...extra, message: goneTitle(gone, now), gone });
	}
	const { changed, current: theirs, by, at } = check;
	return fail(409, {
		...extra,
		message: clashTitle({ by, at }, now),
		clash: { changed, current: theirs, by, at }
	});
}

/*
 * What each save path's form shows, as a `Seen`: one builder per kind, used
 * both by the page's load (what the editor sees) and by the action (what is
 * stored now), so the two can only disagree when the row changed. The keys
 * are the form's own field names.
 */

/** A lesson's edit form. */
export function lessonSeen(lesson: {
	title: string;
	lessonDay: string;
	notes: string | null;
}): Seen {
	return { title: lesson.title, lessonDay: lesson.lessonDay, notes: lesson.notes };
}

/** A routine's Edit form (its name and notes; the slots have their fingerprint). */
export function routineSeen(routine: { name: string; notes: string | null }): Seen {
	return { name: routine.name, notes: routine.notes };
}

/**
 * An exercise's settings form. Only a drill (`custom`) names itself; the
 * others take their name from their owner, so a rename there is no clash
 * here. A group's drill has no frequency or Active of its own: each member's
 * entry holds theirs.
 */
export function exerciseSeen(row: {
	source: string;
	name: string;
	notes: string | null;
	everyDays: number;
	active: boolean;
	teamId: number | null;
}): Seen {
	const content: Seen = { notes: row.notes };
	if (row.source === 'custom') content.name = row.name;
	return row.teamId !== null
		? content
		: { ...content, everyDays: row.everyDays, active: row.active ? 'on' : '' };
}

/** A section's or a point's fields, as the player edits them. */
export function spotSeen(spot: {
	label: string | null;
	startMs: number;
	endMs: number | null;
}): Seen {
	return { label: spot.label, startMs: spot.startMs, endMs: spot.endMs };
}

/**
 * A variation's edit form — the figure's name with it — or null when the
 * variation or its figure is archived or gone.
 */
export function variationSeen(db: Db, figureId: number): Seen | null {
	const row = db
		.select({
			figure: figures,
			groupName: figureGroups.name,
			groupArchived: figureGroups.archivedAt
		})
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(eq(figures.id, figureId))
		.get();
	if (!row || row.figure.archivedAt !== null || row.groupArchived !== null) return null;
	const { figure } = row;
	const tags = figurePositions(db, figureId);
	return {
		figureName: row.groupName,
		name: figure.name,
		partner: figure.partner,
		style: figure.styleTag,
		notes: figure.notes,
		startIds: tags.startIds.join(','),
		endId: tags.endId,
		startCount: figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	};
}
