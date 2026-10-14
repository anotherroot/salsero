import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { deviceTokens, users } from './db/schema';
import { isVideoShortSide, type VideoShortSide } from '$lib/video-sizes';
import type { DeviceRow } from '$lib/types';

/**
 * The Android app's side of identity and settings. A device holds a bearer
 * token minted by `/device/pair` while logged in; the server keeps only its
 * hash. See docs/superpowers/specs/2026-10-14-android-app-design.md.
 */

/** Last use is a hint for the Settings list, not an audit: one write a minute. */
const TOUCH_EVERY_MS = 60_000;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export function createDeviceToken(
	db: Db,
	userId: string,
	label: string,
	now: number
): { id: number; token: string } {
	const token = randomBytes(32).toString('base64url');
	const row = db
		.insert(deviceTokens)
		.values({ userId, label, tokenHash: hash(token), createdAt: now })
		.returning({ id: deviceTokens.id })
		.get();
	return { id: row.id, token };
}

/** The user a device token belongs to, or null. Touches `last_used_at`. */
export function userForDeviceToken(db: Db, token: string, now: number) {
	if (!token) return null;
	const row = db
		.select({
			deviceId: deviceTokens.id,
			lastUsedAt: deviceTokens.lastUsedAt,
			id: users.id,
			email: users.email,
			timezone: users.timezone
		})
		.from(deviceTokens)
		.innerJoin(users, eq(users.id, deviceTokens.userId))
		.where(eq(deviceTokens.tokenHash, hash(token)))
		.get();
	if (!row) return null;
	if (row.lastUsedAt === null || now - row.lastUsedAt >= TOUCH_EVERY_MS) {
		db.update(deviceTokens)
			.set({ lastUsedAt: now })
			.where(eq(deviceTokens.id, row.deviceId))
			.run();
	}
	return { id: row.id, email: row.email, timezone: row.timezone };
}

export function listDevices(db: Db, userId: string): DeviceRow[] {
	return db
		.select({
			id: deviceTokens.id,
			label: deviceTokens.label,
			createdAt: deviceTokens.createdAt,
			lastUsedAt: deviceTokens.lastUsedAt
		})
		.from(deviceTokens)
		.where(eq(deviceTokens.userId, userId))
		.orderBy(desc(deviceTokens.createdAt), desc(deviceTokens.id))
		.all();
}

/** A hard delete: a token is a credential, not history. False if not the user's. */
export function removeDevice(db: Db, userId: string, id: number): boolean {
	const result = db
		.delete(deviceTokens)
		.where(and(eq(deviceTokens.id, id), eq(deviceTokens.userId, userId)))
		.run();
	return result.changes > 0;
}

export function deviceSettings(
	db: Db,
	userId: string
): { reminderMinute: number | null; shortSide: VideoShortSide } {
	const row = db
		.select({ reminderMinute: users.reminderMinute, shortSide: users.videoShortSide })
		.from(users)
		.where(eq(users.id, userId))
		.get();
	const side = row?.shortSide;
	return {
		reminderMinute: row?.reminderMinute ?? null,
		shortSide: isVideoShortSide(side) ? side : 480
	};
}

export function setReminderMinute(db: Db, userId: string, minute: number | null) {
	if (minute !== null && !(Number.isInteger(minute) && minute >= 0 && minute < 24 * 60)) {
		throw new RangeError(`reminder minute out of range: ${minute}`);
	}
	db.update(users).set({ reminderMinute: minute }).where(eq(users.id, userId)).run();
}

export function setVideoShortSide(db: Db, userId: string, side: number) {
	if (!isVideoShortSide(side)) throw new RangeError(`not a video size: ${side}`);
	db.update(users).set({ videoShortSide: side }).where(eq(users.id, userId)).run();
}

/** `Bearer <token>` → the token; anything else → null. */
export function bearerToken(header: string | null): string | null {
	if (!header?.startsWith('Bearer ')) return null;
	return header.slice(7).trim() || null;
}
