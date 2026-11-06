import { env } from '$env/dynamic/private';
import { seedAdmin } from '../admin';
import { sweepUploads } from '../files';
import { crossRefs, familyIntegrity, ownerIntegrity } from '../integrity';
import { importNoteLinks } from '../links';
import { movePositionsToOwners } from '../positions-move';
import { nameLinkedSpots } from '../section-names';
import { backfillSongSizes } from '../storage';
import { startTrashPurge } from '../trash';
import { UPLOAD_PARTIAL_TTL_MS } from '$lib/limits';
import { getDb, type Db } from './index';

let ready: Promise<void> | undefined;

/**
 * Who owns what, one member of a family per parent, and nobody's row
 * pointing where it must not: checked once per process. Only logged, with a
 * count each: a bad row is for a person to look at, never a reason to refuse
 * requests. A check that throws is logged and the others still run.
 */
function checkIntegrity(db: Db): void {
	const checks = { owners: ownerIntegrity, families: familyIntegrity, 'cross-refs': crossRefs };
	for (const [name, check] of Object.entries(checks)) {
		try {
			const lines = check(db);
			for (const line of lines) console.warn(`[integrity] ${line}`);
			console.info(`[integrity] ${name}: ${lines.length} found`);
		} catch (err) {
			console.warn(`[integrity] ${name} check failed`, err);
		}
	}
}

/**
 * Open (and so migrate) the database and seed the admin, once per process.
 * Awaited by the first request so nothing can race an unmigrated schema.
 */
export function bootstrap(): Promise<void> {
	ready ??= seedAdmin(getDb(), env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
		.then(() => {
			// Today's shared positions become the admin's, and every other person
			// or group using one gets its own copy. Once EVER (`app_flags`).
			const moved = movePositionsToOwners(getDb(), Date.now());
			if (moved.ran)
				console.info(
					`[positions] moved: ${moved.copies} copies, ${moved.figures} figures, ${moved.ends} ends`
				);
		})
		.then(() => {
			// Lesson notes carried their YouTube links as plain text before links
			// existed. Copied out once EVER — `app_flags` remembers — so a link the
			// user deletes afterwards is never brought back by a restart.
			importNoteLinks(getDb(), Date.now());
		})
		.then(() => {
			// Sections linked before a link named them take their link's name.
			// Once EVER (`app_flags`), so a name cleared later stays cleared.
			const named = nameLinkedSpots(getDb(), Date.now());
			if (named.ran) console.info(`[sections] named ${named.named}`);
		})
		.then(() => backfillSongSizes(getDb(), Date.now()))
		.then(() => {
			// Abandoned chunked uploads, swept once per process rather than by a
			// cron or a unit there would be nothing to remind anyone about. Not
			// awaited: a slow disk must not hold up the first request, and a
			// failure here is never worth a 500.
			void sweepUploads(UPLOAD_PARTIAL_TTL_MS).catch(() => {});
			// A group's Recently deleted: what has waited 30 days goes for good,
			// files included, and so does a group deleted 30 days ago. Now, and
			// every hour while the process lives. The integrity checks run once
			// the people who left before Keep are settled (failed or not), before
			// the first purge: run earlier, the first boot after a deploy would
			// report the rows the settling is about to fix.
			startTrashPurge(getDb, () => checkIntegrity(getDb()));
		})
		.catch((err) => {
			ready = undefined;
			throw err;
		});
	return ready;
}
