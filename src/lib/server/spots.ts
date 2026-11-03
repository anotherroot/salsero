/**
 * Spots: saved moments and sections of a figure recording or a lesson video.
 *
 * Every value is validated here rather than in the route, because the route is
 * a JSON API and its body is whatever was sent: a bad time would sit in the
 * table until the player drew it off the end of the bar.
 */
import { asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { figures, lessons, lessonVideos, recordings, videoSpots } from './db/schema';
import { MAX_SPOT_LABEL } from '$lib/limits';
import type { Spot, SpotOwner } from '$lib/types';
import { assertUnlinked, linkChips, videoOfSpot, type Visible } from './spot-links';
import { ownerOfRow, type Owner } from './storage';
import { actingIn, fieldChange, logChange, spotRoot, videoRoot } from './changes';

/** A value the user (or a bad client) sent that a spot cannot hold. */
export class SpotError extends Error {}

const COLUMNS = {
	id: videoSpots.id,
	startMs: videoSpots.startMs,
	endMs: videoSpots.endMs,
	label: videoSpots.label
};

/** A positive integer id from a JSON number or a query-string digit run, else null. */
function toId(v: unknown): number | null {
	const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
	return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Exactly one owner id, or null — both, neither, or a bad id. */
export function ownerFrom(raw: {
	recordingId?: unknown;
	lessonVideoId?: unknown;
}): SpotOwner | null {
	const hasRecording = raw.recordingId !== undefined;
	const hasLessonVideo = raw.lessonVideoId !== undefined;
	if (hasRecording === hasLessonVideo) return null;
	const id = toId(hasRecording ? raw.recordingId : raw.lessonVideoId);
	if (id === null) return null;
	return hasRecording ? { recordingId: id } : { lessonVideoId: id };
}

function ownerColumn(owner: SpotOwner) {
	return 'recordingId' in owner
		? eq(videoSpots.recordingId, owner.recordingId)
		: eq(videoSpots.lessonVideoId, owner.lessonVideoId);
}

/**
 * Whose video this is — its figure's owner for a recording, its lesson's for a
 * lesson video, a person or a group — or null when there is no such video.
 * Who may read or change it is `access.ts`'s (`videoAccess`) to say.
 */
export function videoOwner(db: Db, owner: SpotOwner): Owner | null {
	const row =
		'recordingId' in owner
			? db
					.select({ userId: figures.userId, teamId: figures.teamId })
					.from(recordings)
					.innerJoin(figures, eq(figures.id, recordings.figureId))
					.where(eq(recordings.id, owner.recordingId))
					.get()
			: db
					.select({ userId: lessons.userId, teamId: lessons.teamId })
					.from(lessonVideos)
					.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
					.where(eq(lessonVideos.id, owner.lessonVideoId))
					.get();
	return row ? ownerOfRow(row) : null;
}

/** Whose spot this is: its video's owner. Null for a missing spot. */
export function spotOwner(db: Db, spotId: number): Owner | null {
	const video = videoOfSpot(db, spotId);
	return video ? ownerOfRow(video) : null;
}

export function ownerExists(db: Db, owner: SpotOwner): boolean {
	const row =
		'recordingId' in owner
			? db
					.select({ id: recordings.id })
					.from(recordings)
					.where(eq(recordings.id, owner.recordingId))
					.get()
			: db
					.select({ id: lessonVideos.id })
					.from(lessonVideos)
					.where(eq(lessonVideos.id, owner.lessonVideoId))
					.get();
	return row !== undefined;
}

/** Trimmed; empty is null. */
function cleanLabel(raw: unknown): string | null {
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== 'string') throw new SpotError('A label must be text.');
	const label = raw.trim();
	if (label.length > MAX_SPOT_LABEL) {
		throw new SpotError(`A label can be at most ${MAX_SPOT_LABEL} characters.`);
	}
	return label || null;
}

function cleanTimes(startMs: unknown, endMs: unknown): { startMs: number; endMs: number | null } {
	if (typeof startMs !== 'number' || !Number.isSafeInteger(startMs) || startMs < 0) {
		throw new SpotError('A spot needs a start time.');
	}
	if (endMs === null || endMs === undefined) return { startMs, endMs: null };
	if (typeof endMs !== 'number' || !Number.isSafeInteger(endMs) || endMs <= startMs) {
		throw new SpotError('A section has to end after it starts.');
	}
	return { startMs, endMs };
}

/** Rows straight from the table, plus what each is linked to. */
function withLinks(db: Db, rows: Omit<Spot, 'linkedTo'>[], visible?: Visible): Spot[] {
	const chips = linkChips(
		db,
		rows.map((r) => r.id),
		visible
	);
	return rows.map((r) => ({ ...r, linkedTo: (chips.get(r.id) ?? []).map((c) => c.label) }));
}

/** A video's spots. With `visible` (a reader of a group's video), only the links to what it holds. */
export function listSpots(db: Db, owner: SpotOwner, visible?: Visible): Spot[] {
	const rows = db
		.select(COLUMNS)
		.from(videoSpots)
		.where(ownerColumn(owner))
		.orderBy(asc(videoSpots.startMs), asc(videoSpots.id))
		.all();
	return withLinks(db, rows, visible);
}

/** The new spot, or null when its video does not exist. Throws `SpotError` on a bad value.
 * In a group, `by` is who, for History.
 */
export function addSpot(
	db: Db,
	owner: SpotOwner,
	input: { startMs: unknown; endMs: unknown; label: unknown },
	by?: string
): Spot | null {
	const times = cleanTimes(input.startMs, input.endMs);
	const label = cleanLabel(input.label);
	if (!ownerExists(db, owner)) return null;
	return db.transaction((tx) => {
		const row = tx
			.insert(videoSpots)
			.values({ ...owner, ...times, label })
			.returning(COLUMNS)
			.get();
		const root = videoRoot(tx, owner);
		if (root) logSpot(tx, root, by, { verb: 'add', spot: row, after: fields(row) });
		return { ...row, linkedTo: [] };
	});
}

/** A spot as History keeps it: the player's three fields, the clash check's keys. */
const fields = (s: { label: string | null; startMs: number; endMs: number | null }) => ({
	label: s.label,
	startMs: s.startMs,
	endMs: s.endMs
});

/** History's line for a section or a point, filed under its video's lesson or figure. */
function logSpot(
	tx: Db,
	root: NonNullable<ReturnType<typeof videoRoot>>,
	by: string | undefined,
	e: {
		verb: 'add' | 'change' | 'remove' | 'restore';
		spot: { id: number; endMs: number | null };
		before?: Record<string, string | number | null>;
		after?: Record<string, string | number | null>;
	},
	now = Date.now()
): void {
	const { row, ...at } = root;
	logChange(
		tx,
		actingIn(row, by),
		{
			...at,
			verb: e.verb,
			subject: e.spot.endMs === null ? 'point' : 'section',
			subjectId: e.spot.id,
			before: e.before,
			after: e.after
		},
		now
	);
}

/**
 * The spot with whichever of label, start and end were sent changed, or null
 * when there is none. The times are checked merged with the stored ones, as
 * `addSpot` checks them — and a point stays a point, a section a section: the
 * player only nudges edges, so a change of kind is a bad client. Throws
 * `SpotError`, changing nothing, on a bad value. In a group, `by` is who, for
 * History (`verb` is `restore` for its Restore); a line about a move names
 * the section, so its label rides along.
 */
export function updateSpot(
	db: Db,
	id: number,
	changes: { label?: unknown; startMs?: unknown; endMs?: unknown },
	by?: string,
	now = Date.now(),
	verb: 'change' | 'restore' = 'change'
): Spot | null {
	return db.transaction((tx) => {
		const current = tx.select(COLUMNS).from(videoSpots).where(eq(videoSpots.id, id)).get();
		if (!current) return null;
		const times = cleanTimes(
			'startMs' in changes ? changes.startMs : current.startMs,
			'endMs' in changes ? changes.endMs : current.endMs
		);
		if ((times.endMs === null) !== (current.endMs === null)) {
			throw new SpotError(
				current.endMs === null ? 'A point has no end.' : 'A section needs an end.'
			);
		}
		const label = 'label' in changes ? cleanLabel(changes.label) : current.label;
		const row = tx
			.update(videoSpots)
			.set({ ...times, label })
			.where(eq(videoSpots.id, id))
			.returning(COLUMNS)
			.get()!;
		const change = fieldChange(fields(current), fields(row), 'spot');
		const root = change ? spotRoot(tx, id) : null;
		if (change && root) {
			const before = { ...change.before, label: current.label };
			const after = { ...change.after, label: row.label };
			logSpot(tx, root, by, { verb, spot: row, before, after }, now);
		}
		return withLinks(tx, [row])[0];
	});
}

/**
 * Whether a row went. Throws `SpotLinkedError`, deleting nothing, while the
 * section is linked. In a group, `by` is who, for History.
 */
export function deleteSpot(db: Db, id: number, by?: string): boolean {
	return db.transaction((tx) => {
		assertUnlinked(tx, { spotId: id });
		const root = spotRoot(tx, id);
		const gone = tx.delete(videoSpots).where(eq(videoSpots.id, id)).returning().get();
		if (!gone) return false;
		if (root) logSpot(tx, root, by, { verb: 'remove', spot: gone, before: fields(gone) });
		return true;
	});
}
