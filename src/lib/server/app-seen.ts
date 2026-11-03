import { eq } from 'drizzle-orm';
import type { Channel, AppAgent } from '$lib/app-update/agent';
import type { DanceSlug } from '$lib/dances/dances';
import type { Db } from './db';
import { appInstalls } from './db/schema';

/** A sighting of the same app within this long is not written again. */
const REWRITE_AFTER_MS = 60_000;

/** Remember which app version a person just used. Cheap: most calls write nothing. */
export function noteAppSeen(db: Db, userId: string, agent: AppAgent, now: number): void {
	const row = db
		.select()
		.from(appInstalls)
		.where(eq(appInstalls.userId, userId))
		.all()
		.find((r) => r.dance === agent.dance);
	if (
		row &&
		row.versionCode === agent.versionCode &&
		row.channel === agent.channel &&
		now - row.seenAt < REWRITE_AFTER_MS
	) {
		return;
	}
	const values = { versionCode: agent.versionCode, channel: agent.channel, seenAt: now };
	db.insert(appInstalls)
		.values({ userId, dance: agent.dance, ...values })
		.onConflictDoUpdate({ target: [appInstalls.userId, appInstalls.dance], set: values })
		.run();
}

export function listAppsSeen(db: Db): {
	userId: string;
	dance: DanceSlug;
	versionCode: number;
	channel: Channel;
	seenAt: number;
}[] {
	return db
		.select()
		.from(appInstalls)
		.all()
		.map((r) => ({
			userId: r.userId,
			dance: r.dance as DanceSlug,
			versionCode: r.versionCode,
			channel: r.channel as Channel,
			seenAt: r.seenAt
		}));
}
