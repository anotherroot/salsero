/*
 * What only the server knows, sent with every pull (device first): the
 * layouts drawn on the device read it from the copy's meta, since its tables
 * (`song_imports`, `ai_*`, `oauth_*`) never reach a device and the APK release
 * lives on the server's disk.
 */
import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';
import type { Db } from '../db';
import {
	deviceSlots,
	figures,
	lessons,
	lessonVideos,
	recordings,
	teamMembers,
	users
} from '../db/schema';
import { parseDeviceLabel, type DeviceLabel } from '$lib/devices/label';
import { teamTrashBytes } from '../storage';
import { lastEdit } from '../changes';
import { isDanceSlug } from '$lib/dances/dances';
import { pendingCount } from '$lib/server/ai-queue/store';
import { listGrants } from '$lib/server/oauth/store';
import { currentRelease } from '$lib/server/releases';
import { groupChoices } from '$lib/server/group-mode';
import { groupImportsToPick, importsWaiting, listImports } from '$lib/server/song-imports';
import { serverNow } from '../server-clock';
import type { ServerExtras } from '$lib/sync/wire';

const NONE: ServerExtras = {
	musicToPick: false,
	aiPending: 0,
	aiConnected: false,
	release: null,
	imports: { own: [], teams: {} },
	teamTrashBytes: {},
	lastEdits: {},
	devices: {}
};

export function serverExtras(db: Db, userId: string): ServerExtras {
	const dance = db
		.select({ dance: users.dance })
		.from(users)
		.where(eq(users.id, userId))
		.get()?.dance;
	if (!dance || !isDanceSlug(dance)) return NONE;
	const own = { dance, userId };
	const teams: Record<string, ServerExtras['imports']['own']> = {};
	const teamTrash: Record<string, number> = {};
	// The groups a person may view (`groupChoices`): the songs layout's group view lists theirs.
	for (const g of groupChoices(db, userId, dance)) {
		teams[String(g.teamId)] = listImports(db, { dance, teamId: g.teamId, actorId: userId });
		teamTrash[String(g.teamId)] = teamTrashBytes(db, g.teamId);
	}
	return {
		musicToPick: importsWaiting(db, userId, dance),
		aiPending: pendingCount(db, userId, dance),
		aiConnected: listGrants(db, userId, serverNow()).length > 0,
		release: currentRelease(dance),
		imports: { own: [...listImports(db, own), ...groupImportsToPick(db, userId, dance)], teams },
		teamTrashBytes: teamTrash,
		lastEdits: lessonEdits(db, userId, dance),
		devices: originDevices(db, userId)
	};
}

/** "Edited by" for every group lesson a person may read: History's last change to each. */
function lessonEdits(
	db: Db,
	userId: string,
	dance: string
): Record<string, { actorId: string; at: number }> {
	const rows = db
		.select({ id: lessons.id, teamId: lessons.teamId })
		.from(lessons)
		.innerJoin(teamMembers, eq(teamMembers.teamId, lessons.teamId))
		.where(
			and(
				eq(teamMembers.userId, userId),
				eq(lessons.dance, dance),
				// A plain member reads a group's published lessons only; its owner and editors, drafts too.
				or(isNotNull(lessons.publishedAt), inArray(teamMembers.role, ['owner', 'editor']))
			)
		)
		.all();
	const out: Record<string, { actorId: string; at: number }> = {};
	for (const r of rows) {
		const last = r.teamId === null ? null : lastEdit(db, r.teamId, 'lesson', r.id);
		if (last) out[`lesson:${r.id}`] = last;
	}
	return out;
}

/** The devices holding the person's phone-only originals, by id slot (offline phase 4c). */
function originDevices(db: Db, userId: string): Record<string, DeviceLabel> {
	const slots = new Set<number>();
	for (const r of db
		.select({ slot: recordings.originSlot })
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.where(and(eq(figures.userId, userId), isNotNull(recordings.originSlot)))
		.all())
		if (r.slot !== null) slots.add(r.slot);
	for (const r of db
		.select({ slot: lessonVideos.originSlot })
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(and(eq(lessons.userId, userId), isNotNull(lessonVideos.originSlot)))
		.all())
		if (r.slot !== null) slots.add(r.slot);
	if (slots.size === 0) return {};
	const out: Record<string, DeviceLabel> = {};
	for (const d of db
		.select({ slot: deviceSlots.slot, label: deviceSlots.label })
		.from(deviceSlots)
		.where(inArray(deviceSlots.slot, [...slots]))
		.all()) {
		const label = parseDeviceLabel(d.label);
		if (label) out[String(d.slot)] = label;
	}
	return out;
}
