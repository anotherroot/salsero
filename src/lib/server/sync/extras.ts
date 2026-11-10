/*
 * What only the server knows, sent with every pull (device first): the
 * layouts drawn on the device read it from the copy's meta, since its tables
 * (`song_imports`, `ai_*`, `oauth_*`) never reach a device and the APK release
 * lives on the server's disk.
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { lessons, teamMembers, users } from '../db/schema';
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
	lastEdits: {}
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
		lastEdits: lessonEdits(db, userId, dance)
	};
}

/** "Edited by" for every lesson of the groups a person is in: History's last change to each. */
function lessonEdits(
	db: Db,
	userId: string,
	dance: string
): Record<string, { actorId: string; at: number }> {
	const rows = db
		.select({ id: lessons.id, teamId: lessons.teamId })
		.from(lessons)
		.innerJoin(teamMembers, eq(teamMembers.teamId, lessons.teamId))
		.where(and(eq(teamMembers.userId, userId), eq(lessons.dance, dance)))
		.all();
	const out: Record<string, { actorId: string; at: number }> = {};
	for (const r of rows) {
		const last = r.teamId === null ? null : lastEdit(db, r.teamId, 'lesson', r.id);
		if (last) out[`lesson:${r.id}`] = last;
	}
	return out;
}
