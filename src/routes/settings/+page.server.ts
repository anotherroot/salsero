import { error, fail } from '@sveltejs/kit';
import { minuteOfDay } from '$lib/clock';
import { localDay } from '$lib/day/day';
import { dateLabel } from '$lib/format';
import { getDb } from '$lib/server/db';
import {
	deviceSettings,
	listDevices,
	removeDevice,
	setReminderMinute,
	setVideoShortSide
} from '$lib/server/devices';
import { int } from '$lib/server/form';
import { isVideoShortSide } from '$lib/video-sizes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) throw error(401);
	const db = getDb();
	const tz = locals.user.timezone;
	const day = (ms: number) => dateLabel(localDay(ms, tz));
	return {
		device: deviceSettings(db, locals.user.id),
		devices: listDevices(db, locals.user.id).map((d) => ({
			id: d.id,
			label: d.label,
			paired: day(d.createdAt),
			lastUsed: d.lastUsedAt === null ? null : day(d.lastUsedAt)
		}))
	};
};

export const actions: Actions = {
	/** The Android app's reminder time and video size. */
	app: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const form = await request.formData();
		const minute = minuteOfDay(String(form.get('reminder') ?? ''));
		const side = int(form, 'shortSide');
		if (minute === undefined || !isVideoShortSide(side)) {
			return fail(400, { message: 'Pick a time (or leave it empty) and a size.' });
		}
		const db = getDb();
		setReminderMinute(db, locals.user.id, minute);
		setVideoShortSide(db, locals.user.id, side);
		return { ok: true };
	},

	removeDevice: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const id = int(await request.formData(), 'id');
		if (id === undefined || !removeDevice(getDb(), locals.user.id, id)) throw error(404);
		return { ok: true };
	}
};
