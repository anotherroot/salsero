/**
 * How many copies new audio on a song would reach (the question before Use
 * another YouTube link downloads). The flow's own walk (`flowOnward`) without
 * writing: copies that pair with one already reached, live, switched on,
 * writable by the flow, and on the same audio now (a copy on other audio is
 * not in step on it). The `audio` key is `always`, so every option lets it go.
 */
import type { Db } from '../db';
import { familyRows, geneOf } from './genes';
import { pairBase } from './pairs';
import { syncSettingsOf } from './sync-settings';
import { flatOf } from './trees';
import { writerFor } from './flow';

export function audioReach(db: Db, actorId: string, songId: number): number {
	const gene = geneOf(db, 'song', songId);
	if (gene === null) return 0;
	const audio = (id: number) => flatOf(db, 'song', id).audio?.value ?? '';
	const mine = audio(songId);
	const rows = familyRows(db, 'song', gene);
	const reached = new Set<number>([songId]);
	const queue = [songId];
	while (queue.length > 0) {
		const from = queue.shift()!;
		for (const y of rows) {
			if (reached.has(y.id) || y.archivedAt !== null) continue;
			if (!pairBase(db, 'song', from, y.id)) continue;
			if (!syncSettingsOf(db, 'song', y.id).on) continue;
			if (writerFor(db, actorId, 'song', y, from) === null) continue;
			if (audio(y.id) !== mine) continue;
			reached.add(y.id);
			queue.push(y.id);
		}
	}
	return reached.size - 1;
}
