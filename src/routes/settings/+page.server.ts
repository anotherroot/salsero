import { error, fail } from '@sveltejs/kit';
import { minuteOfDay } from '$lib/clock';
import { localDay } from '$lib/day/day';
import { getDb } from '$lib/server/db';
import {
	deviceSettings,
	listDevices,
	removeDevice,
	restoreDevice,
	setReminderMinute,
	setVideoShortSide,
	type DeviceSnapshot
} from '$lib/server/devices';
import { defaultStyle, setDefaultStyle } from '$lib/server/default-styles';
import { listCountTakes } from '$lib/server/countTakes';
import { askForMore, openRequest, storageOf } from '$lib/server/storage';
import { askedLine } from '$lib/storage-view';
import { Hold, UNDO_MS } from '$lib/server/undo-hold';
import { int, optionalText, text } from '$lib/server/form';
import { isDanceSlug, isStyleOf } from '$lib/dances/dances';
import { deviceMeta } from '$lib/settings/view';
import { ownVoiceSummary } from '$lib/voice/grid';
import { isVideoShortSide } from '$lib/video-sizes';
import { THEME_COOKIE, isThemeChoice } from '$lib/theme/scheme';
import type { Actions, PageServerLoad } from './$types';

/**
 * A removed phone, held for Undo, keyed by user and id so only the user who
 * removed it can bring it back. The snapshot (it carries the token's hash)
 * never leaves the server: the page only ever sees the id.
 */
const removed = new Hold<DeviceSnapshot>(UNDO_MS);
const holdKey = (userId: string, id: number) => `${userId}:${id}`;

export const load: PageServerLoad = async ({ locals, parent }) => {
	if (!locals.user) throw error(401);
	const db = getDb();
	const tz = locals.user.timezone;
	// /settings has no dance in its URL and Today links to it plain, so the
	// dance is the last one visited: the root layout's `lastDance`.
	const { lastDance: dance } = await parent();
	const today = localDay(Date.now(), tz);
	const asked = openRequest(db, locals.user.id);
	return {
		dance,
		isAdmin: locals.user.isAdmin,
		defaultStyle: defaultStyle(db, locals.user.id, dance),
		device: deviceSettings(db, locals.user.id),
		devices: listDevices(db, locals.user.id).map((d) => ({
			id: d.id,
			label: d.label,
			meta: deviceMeta(
				localDay(d.createdAt, tz),
				d.lastUsedAt === null ? null : localDay(d.lastUsedAt, tz),
				today
			)
		})),
		ownVoice: ownVoiceSummary(listCountTakes(db, locals.user.id)),
		storage: storageOf(db, locals.user.id),
		asked: asked ? askedLine(localDay(asked.createdAt, tz)) : null
	};
};

export const actions: Actions = {
	/** An optional note to the admin; one open request per person. */
	ask: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const note = optionalText(await request.formData(), 'note', 500);
		if (note === undefined) return fail(400, { message: 'Keep the note under 500 characters.' });
		const res = askForMore(getDb(), locals.user.id, note, Date.now());
		return { asked: res === 'asked' };
	},

	/** Light, dark or the system's: per browser, so the phone and the work PC keep their own. */
	theme: async ({ locals, request, cookies }) => {
		if (!locals.user) throw error(401);
		const theme = text(await request.formData(), 'theme');
		if (!isThemeChoice(theme)) return fail(400, { message: 'Pick one of the themes.' });
		cookies.set(THEME_COOKIE, theme, {
			path: '/',
			maxAge: 365 * 24 * 3600,
			sameSite: 'lax',
			httpOnly: true
		});
		return { ok: true };
	},

	/** The style a new figure of one dance starts on. */
	style: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const form = await request.formData();
		const dance = text(form, 'dance');
		const style = text(form, 'style');
		if (!dance || !isDanceSlug(dance) || !style || !isStyleOf(dance, style)) {
			return fail(400, { message: 'Pick one of the styles.' });
		}
		setDefaultStyle(getDb(), locals.user.id, dance, style);
		return { ok: true };
	},

	/** The Android app's reminder time: '' is off. */
	reminder: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const form = await request.formData();
		const raw = form.get('reminder');
		const minute = typeof raw === 'string' ? minuteOfDay(raw) : undefined;
		if (minute === undefined) return fail(400, { message: 'Pick a time, or switch it off.' });
		setReminderMinute(getDb(), locals.user.id, minute);
		return { ok: true };
	},

	videoSize: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const side = int(await request.formData(), 'shortSide');
		if (!isVideoShortSide(side)) return fail(400, { message: 'Pick one of the sizes.' });
		setVideoShortSide(getDb(), locals.user.id, side);
		return { ok: true };
	},

	removeDevice: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const id = int(await request.formData(), 'id');
		const snap = id === undefined ? null : removeDevice(getDb(), locals.user.id, id);
		if (id === undefined || !snap) return fail(404, { message: 'That phone is already gone.' });
		removed.put(holdKey(locals.user.id, id), snap);
		return { removed: id };
	},

	restoreDevice: async ({ locals, request }) => {
		if (!locals.user) throw error(401);
		const id = int(await request.formData(), 'id');
		const snap = id === undefined ? null : removed.take(holdKey(locals.user.id, id));
		if (!snap || !restoreDevice(getDb(), locals.user.id, snap)) {
			return fail(410, { message: 'Too late to undo.' });
		}
		return { ok: true };
	}
};
