/**
 * Spots: saved moments and sections of a figure recording or a lesson video.
 *
 * Every value is validated here rather than in the route, because the route is
 * a JSON API and its body is whatever was sent: a bad time would sit in the
 * table until the player drew it off the end of the bar.
 */
import { asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { lessonVideos, recordings, videoSpots } from './db/schema';
import { MAX_SPOT_LABEL } from '$lib/limits';
import type { Spot, SpotOwner } from '$lib/types';

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

export function listSpots(db: Db, owner: SpotOwner): Spot[] {
	return db
		.select(COLUMNS)
		.from(videoSpots)
		.where(ownerColumn(owner))
		.orderBy(asc(videoSpots.startMs), asc(videoSpots.id))
		.all();
}

/** The new spot, or null when its video does not exist. Throws `SpotError` on a bad value. */
export function addSpot(
	db: Db,
	owner: SpotOwner,
	input: { startMs: unknown; endMs: unknown; label: unknown }
): Spot | null {
	const times = cleanTimes(input.startMs, input.endMs);
	const label = cleanLabel(input.label);
	if (!ownerExists(db, owner)) return null;
	return db
		.insert(videoSpots)
		.values({ ...owner, ...times, label })
		.returning(COLUMNS)
		.get();
}

/** The renamed spot, or null when there is none. Throws `SpotError` on a bad label. */
export function renameSpot(db: Db, id: number, label: unknown): Spot | null {
	const clean = cleanLabel(label);
	return (
		db
			.update(videoSpots)
			.set({ label: clean })
			.where(eq(videoSpots.id, id))
			.returning(COLUMNS)
			.get() ?? null
	);
}

export function deleteSpot(db: Db, id: number): boolean {
	return db.delete(videoSpots).where(eq(videoSpots.id, id)).returning().get() !== undefined;
}
