/*
 * Phone-only videos and copies (offline phase 4c): a copy never brings one,
 * since it has no file on the server (`recordingsOf`, `videosOf` and Keep in
 * step's pieces leave it behind). The Copy to sheet says so.
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { deviceSlots, lessonVideos, recordings } from '../db/schema';
import type { CloneKind } from '$lib/types';
import { deviceRuntime } from '../device-runtime';
import { parseDeviceLabel, type DeviceLabel } from '$lib/devices/label';

/**
 * What the device in a slot is: the server's own record, or on a device the
 * last pull's (`device_slots` never reaches one). Null when unknown.
 */
export function deviceLabelFor(db: Db, slot: number | null): DeviceLabel | null {
	if (slot === null) return null;
	const device = deviceRuntime();
	if (device) return device.extras?.devices?.[String(slot)] ?? null;
	const row = db
		.select({ label: deviceSlots.label })
		.from(deviceSlots)
		.where(eq(deviceSlots.slot, slot))
		.get();
	return parseDeviceLabel(row?.label);
}

/**
 * The phone-only videos a copy of this figure or lesson leaves behind, and the
 * device holding them (the first one's; null when none is known).
 */
export function leftBehind(
	db: Db,
	kind: CloneKind,
	id: number
): { count: number; slot: number | null } {
	const rows =
		kind === 'figure'
			? db
					.select({ slot: recordings.originSlot })
					.from(recordings)
					.where(and(eq(recordings.figureId, id), eq(recordings.serverCopy, false)))
					.all()
			: kind === 'lesson'
				? db
						.select({ slot: lessonVideos.originSlot })
						.from(lessonVideos)
						.where(and(eq(lessonVideos.lessonId, id), eq(lessonVideos.serverCopy, false)))
						.all()
				: [];
	return { count: rows.length, slot: rows.find((r) => r.slot !== null)?.slot ?? null };
}
