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
 * forgot it would overwrite silently. So is one on a row with copies
 * (`hasCopies`, Keep in step): a change may flow in while its form is open,
 * and a save that did not say what it saw would write the old value back. On
 * a person's own row in no family a save without `seen` is accepted as
 * before, so a tab opened before the check still saves.
 */
import { fail, type ActionFailure } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { figureGroups, figures, positions } from './db/schema';
import { figurePositions } from './graph';
import { DEFAULT_LENGTH_COUNTS, DEFAULT_START_COUNT } from '$lib/graph/timing';
import { asSeen, changedFields, clashTitle, goneTitle, type Seen } from '$lib/clash/clash';
import { t } from '$lib/i18n/catalog';
import { serverNow } from '$lib/server/server-clock';

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
 * `who` says who changed it last and when: History's `editedBy` for a
 * group's thing, asked only when the save is refused. Nobody without it.
 */
export function checkSeen(current: Seen | null, seen: Seen | null, who: Who = nobody): SeenCheck {
	if (current === null) return { ok: false, gone: true, ...who() };
	if (seen === null) return { ok: true };
	const changed = changedFields(seen, current);
	if (changed.length === 0) return { ok: true };
	return { ok: false, changed, current, ...who() };
}

/** Who changed a thing last, by name, and when; asked lazily. */
export type Who = () => { by: string | null; at: number | null };
const nobody: Who = () => ({ by: null, at: null });

/**
 * Whether a save said what it saw of every field it writes. On a group's row
 * one that did not is refused (risk 27): `seen: {}` must not pass where no
 * `seen` would not.
 */
export function seesAll(seen: Seen | null, keys: string[]): boolean {
	return seen !== null && keys.every((k) => k in seen);
}

/** The refusal for a save that had to carry `seen` (a group's row, or one with copies) and did not; the reader's words. */
export const missingSeen = (): string => t().groups.clash.missingSeen;

/**
 * A form save's clash check, as the failure to return (or null to go on):
 * 400 for a save without `seen` where one is `required` (a group's row, or
 * a row with copies: `row.teamId !== null || hasCopies(...)`), 409 carrying
 * `clash` (the other version), 410 carrying `gone`. `extra` is the action's
 * own failure fields (its `action`, what was typed), so the page keeps the
 * typed values. `who` names who changed or archived it (History's `editedBy`).
 */
export function seenRefusal<T extends Record<string, unknown>>(
	form: FormData,
	required: boolean,
	current: Seen | null,
	extra: T,
	now = serverNow(),
	who: Who = nobody
): ActionFailure<T & { message: string; clash?: unknown; gone?: unknown }> | null {
	const seen = seenFrom(form);
	if (required && current !== null && !seesAll(seen, Object.keys(current))) {
		return fail(400, { ...extra, message: missingSeen() });
	}
	const check = checkSeen(current, seen, who);
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
 * here. A group's drill has no Active of its own: each member's
 * entry holds theirs.
 */
export function exerciseSeen(row: {
	source: string;
	name: string;
	notes: string | null;
	active: boolean;
	teamId: number | null;
	comesBack: string | null;
}): Seen {
	const content: Seen = { notes: row.notes };
	if (row.source === 'custom') content.name = row.name;
	// A drill's Comes back is content too: the raw stored value is what the form saw.
	if (row.source === 'custom' || row.source === 'added') content.comesBack = row.comesBack;
	return row.teamId !== null ? content : { ...content, active: row.active ? 'on' : '' };
}

/**
 * A song's fields, as its page edits them: the name, the count (its anchors
 * and tempo) and the sample start. A tap, a tempo or a sample save writes
 * one or two of them; `seen` holds them all.
 */
export function songSeen(song: {
	title: string;
	artist: string | null;
	style: string;
	anchorsJson: string;
	tempoFactor: number;
	sampleStartS: number | null;
	sectionsJson: string;
	startS: number | null;
}): Seen {
	return {
		title: song.title,
		artist: song.artist,
		style: song.style,
		anchorsJson: song.anchorsJson,
		tempoFactor: song.tempoFactor,
		sampleStartS: song.sampleStartS,
		sectionsJson: song.sectionsJson,
		startS: song.startS
	};
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
		endIds: tags.endIds.join(','),
		startCount: figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	};
}

/** A move's rename form (the move's page): its name, or null when archived or gone. */
export function moveSeen(db: Db, groupId: number): Seen | null {
	const row = db.select().from(figureGroups).where(eq(figureGroups.id, groupId)).get();
	if (!row || row.archivedAt !== null) return null;
	return { figureName: row.name };
}

/** A position's edit form, or null when it is archived or gone. */
export function positionSeen(db: Db, id: number): Seen | null {
	const row = db.select().from(positions).where(eq(positions.id, id)).get();
	if (!row || row.archivedAt !== null) return null;
	return {
		name: row.name,
		styleTag: row.styleTag,
		hands: row.hands,
		crossed: row.crossed === null ? null : row.crossed ? 1 : 0,
		facing: row.facing,
		frame: row.frame,
		notes: row.notes,
		pictureSpotId: row.pictureSpotId
	};
}
