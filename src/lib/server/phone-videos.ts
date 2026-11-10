/*
 * A person's own videos kept only on the phone that holds the original
 * (offline phase 4c, docs/superpowers/specs/2026-11-09-offline-phase-4-design.md).
 * The row is made on the device first (a device write, replayed like any
 * other) with no file on the server; its bytes never pass through the outbox.
 * A group's videos always upload, so only a person's own figure or lesson
 * takes one.
 */
import { and, eq, like } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db';
import { deviceSlots, figures, lessons, lessonVideos, recordings, teamTrash } from './db/schema';
import { deviceRuntime } from './device-runtime';
import { slotOf } from './db/ids';
import { addRecording } from './figures';
import { addLessonVideo } from './lessons';
import { lessonVideosDir, RECORDING_FILE_RE, recordingsDir } from './files';
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

/**
 * A file of this name is already the server's (final review 6): on its disk, or waiting
 * in a group's Recently deleted. A phone-only row of that name would later overwrite or
 * delete it. The device has no disk to ask; its replay on the server does.
 */
function serverHasFile(name: string): boolean {
	if (deviceRuntime()) return false;
	try {
		return existsSync(join(recordingsDir(), name)) || existsSync(join(lessonVideosDir(), name));
	} catch {
		return false;
	}
}
function nameTaken(db: Db, name: string, onDisk: (name: string) => boolean): boolean {
	if (onDisk(name)) return true;
	return (
		db
			.select({ id: teamTrash.id })
			.from(teamTrash)
			.where(like(teamTrash.filesJson, `%"${name}"%`))
			.get() !== undefined
	);
}

/** A phone-only recording on the person's own live figure; null for anything else (404). */
export function addPhoneRecording(
	db: Db,
	userId: string,
	figureId: number,
	input: PhoneVideoInput,
	onDisk: (name: string) => boolean = serverHasFile
) {
	const row = db.select().from(figures).where(eq(figures.id, figureId)).get();
	if (!row || row.userId !== userId || row.teamId !== null || row.archivedAt !== null) return null;
	if (nameTaken(db, input.file, onDisk)) return { refused: 'badFile' as const };
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
	input: PhoneVideoInput,
	onDisk: (name: string) => boolean = serverHasFile
) {
	const row = db.select().from(lessons).where(eq(lessons.id, lessonId)).get();
	if (!row || row.userId !== userId || row.teamId !== null || row.archivedAt !== null) return null;
	if (nameTaken(db, input.file, onDisk)) return { refused: 'badFile' as const };
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

export type VideoTable = 'recordings' | 'lesson_videos';
const tableOf = (t: VideoTable) => (t === 'recordings' ? recordings : lessonVideos);

/**
 * Upload's last step: the row now has a server copy of `bytes` (the smaller
 * copy that counts against storage); the original's size stays in `originBytes`.
 */
export function attachServerCopy(db: Db, table: VideoTable, id: number, bytes: number) {
	const tb = tableOf(table);
	const row = db.select().from(tb).where(eq(tb.id, id)).get();
	if (!row) return null;
	return db
		.update(tb)
		.set({ serverCopy: true, sizeBytes: bytes, originBytes: row.originBytes ?? row.sizeBytes })
		.where(eq(tb.id, id))
		.returning()
		.get();
}

/** Remove the server copy, asked by a device that does not hold the original. */
export class NotHolderError extends Error {
	constructor() {
		super('not the holder');
	}
}

/**
 * Remove the server copy: the row is phone-only again, its size the
 * original's. Only the device holding the original may (`slot`). The caller
 * unlinks the file after this write.
 */
export function removeServerCopy(db: Db, table: VideoTable, id: number, slot: number) {
	const tb = tableOf(table);
	const row = db.select().from(tb).where(eq(tb.id, id)).get();
	if (!row) return null;
	if (row.originSlot !== slot) throw new NotHolderError();
	return db
		.update(tb)
		.set({ serverCopy: false, sizeBytes: row.originBytes ?? row.sizeBytes })
		.where(eq(tb.id, id))
		.returning()
		.get();
}

/**
 * Remove server copy as an endpoint answers it (offline phase 4c): the
 * person's own video, from the device holding the original (`slot`, one of
 * this person's). The file is unlinked by the caller after the write.
 */
export function removeServerCopyFor(
	db: Db,
	userId: string,
	table: VideoTable,
	id: number,
	body: unknown
):
	| { ok: true; row: NonNullable<ReturnType<typeof removeServerCopy>>; file: string }
	| { ok: false; status: 400 | 403 | 404 | 409; message: string } {
	const w = t().video.place.refusal;
	const tb = tableOf(table);
	const row = db.select().from(tb).where(eq(tb.id, id)).get();
	const parent =
		row &&
		(table === 'recordings'
			? db
					.select()
					.from(figures)
					.where(eq(figures.id, (row as { figureId: number }).figureId))
					.get()
			: db
					.select()
					.from(lessons)
					.where(eq(lessons.id, (row as { lessonId: number }).lessonId))
					.get());
	if (!row || !parent || parent.userId !== userId || parent.teamId !== null)
		return { ok: false, status: 404, message: t().video.refusal.noVideo };
	if (!row.serverCopy) return { ok: false, status: 409, message: w.noServerCopy };
	const slot = (body as { slot?: unknown } | null)?.slot;
	const mine =
		typeof slot === 'number' &&
		db
			.select({ slot: deviceSlots.slot })
			.from(deviceSlots)
			.where(and(eq(deviceSlots.slot, slot), eq(deviceSlots.userId, userId)))
			.get();
	if (!mine || typeof slot !== 'number') return { ok: false, status: 400, message: w.badSlot };
	try {
		const done = removeServerCopy(db, table, id, slot);
		return done
			? { ok: true, row: done, file: row.file }
			: { ok: false, status: 404, message: t().video.refusal.noVideo };
	} catch (e) {
		if (e instanceof NotHolderError) return { ok: false, status: 403, message: w.notHolder };
		throw e;
	}
}
