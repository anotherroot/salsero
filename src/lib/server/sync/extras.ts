/*
 * What only the server knows, sent with every pull (device first): the
 * layouts drawn on the device read it from the copy's meta, since its tables
 * (`song_imports`, `ai_*`, `oauth_*`) never reach a device and the APK release
 * lives on the server's disk.
 */
import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { users } from '../db/schema';
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
	imports: { own: [], teams: {} }
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
	// The groups a person may view (`groupChoices`): the songs layout's group view lists theirs.
	for (const g of groupChoices(db, userId, dance)) {
		teams[String(g.teamId)] = listImports(db, { dance, teamId: g.teamId, actorId: userId });
	}
	return {
		musicToPick: importsWaiting(db, userId, dance),
		aiPending: pendingCount(db, userId, dance),
		aiConnected: listGrants(db, userId, serverNow()).length > 0,
		release: currentRelease(dance),
		imports: { own: [...listImports(db, own), ...groupImportsToPick(db, userId, dance)], teams }
	};
}
