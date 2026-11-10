/*
 * A person's own videos kept only on the phone that holds the original
 * (offline phase 4c, docs/superpowers/specs/2026-11-09-offline-phase-4-design.md).
 * The row is made on the device first (a device write, replayed like any
 * other) with no file on the server; its bytes never pass through the outbox.
 * A group's videos always upload, so only a person's own figure or lesson
 * takes one.
 */
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { deviceSlots, figures, lessons, lessonVideos, recordings } from './db/schema';
import { slotOf } from './db/ids';
import { addRecording } from './figures';
import { addLessonVideo } from './lessons';
import { RECORDING_FILE_RE } from './files';
import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';
import { t } from '$lib/i18n/catalog';

export type PhoneVideoInput = {
	file: string;
	mime: string;
	sizeBytes: number;
	kind: 'video';
	note: string | null;
	/** The sending device's id slot, as it knows it: names the holder when the id cannot. */
	slot?: number;
};
export type PhoneRefusal = 'badFile' | 'badSize' | 'tooBig' | 'notVideo';

/** A phone-only add's body, or why it is refused. */
export function readPhoneVideo(body: unknown): PhoneVideoInput | { refused: PhoneRefusal } {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return { refused: 'badFile' };
	const b = body as Record<string, unknown>;
	if (typeof b.file !== 'string' || !RECORDING_FILE_RE.test(b.file)) return { refused: 'badFile' };
	const size = b.sizeBytes;
	if (typeof size !== 'number' || !Number.isInteger(size) || size < 1)
		return { refused: 'badSize' };
	if (size > MAX_LESSON_VIDEO_BYTES) return { refused: 'tooBig' };
	const mime = typeof b.mime === 'string' ? b.mime.split(';')[0].trim().toLowerCase() : '';
	if (!mime.startsWith('video/')) return { refused: 'notVideo' };
	const note = typeof b.note === 'string' ? b.note.trim().slice(0, 2000) || null : null;
	const out: PhoneVideoInput = { file: b.file, mime, sizeBytes: size, kind: 'video', note };
	if (typeof b.slot === 'number' && Number.isInteger(b.slot) && b.slot > 0) out.slot = b.slot;
	return out;
}

/**
 * The device holding a new phone-only row's original: the id's own slot when
 * a device minted it (on the device, and on its replay), else the slot the
 * device claimed, if it is one of the server's (a row the server made itself).
 */
function originOf(db: Db, id: number, claimed: number | undefined): number | null {
	const minted = slotOf(id);
	if (minted !== 0) return minted;
	if (claimed === undefined) return null;
	const known = db
		.select({ slot: deviceSlots.slot })
		.from(deviceSlots)
		.where(eq(deviceSlots.slot, claimed))
		.get();
	return known ? claimed : null;
}

/** A phone-only recording on the person's own live figure; null for anything else (404). */
export function addPhoneRecording(
	db: Db,
	userId: string,
	figureId: number,
	input: PhoneVideoInput
) {
	const row = db.select().from(figures).where(eq(figures.id, figureId)).get();
	if (!row || row.userId !== userId || row.teamId !== null || row.archivedAt !== null) return null;
	return db.transaction((tx) => {
		const rec = addRecording(tx, {
			figureId,
			file: input.file,
			mime: input.mime,
			kind: input.kind,
			sizeBytes: input.sizeBytes,
			note: input.note,
			serverCopy: false,
			originBytes: input.sizeBytes
		});
		const originSlot = originOf(tx, rec.id, input.slot);
		return tx
			.update(recordings)
			.set({ originSlot })
			.where(eq(recordings.id, rec.id))
			.returning()
			.get();
	});
}

/** A phone-only video on the person's own live lesson; null for anything else (404). */
export function addPhoneLessonVideo(
	db: Db,
	userId: string,
	lessonId: number,
	input: PhoneVideoInput
) {
	const row = db.select().from(lessons).where(eq(lessons.id, lessonId)).get();
	if (!row || row.userId !== userId || row.teamId !== null || row.archivedAt !== null) return null;
	return db.transaction((tx) => {
		const video = addLessonVideo(tx, {
			lessonId,
			file: input.file,
			mime: input.mime,
			sizeBytes: input.sizeBytes,
			serverCopy: false,
			originBytes: input.sizeBytes
		});
		const originSlot = originOf(tx, video.id, input.slot);
		return tx
			.update(lessonVideos)
			.set({ originSlot })
			.where(eq(lessonVideos.id, video.id))
			.returning()
			.get();
	});
}

/** A refusal's words, for the endpoints' 400. */
export function phoneRefusal(why: PhoneRefusal): string {
	return why === 'notVideo' ? t().figure.refused.onlyMedia : t().video.place.refusal[why];
}
