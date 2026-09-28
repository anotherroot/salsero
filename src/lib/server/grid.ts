import { buildGrid } from '$lib/beatgrid/beatgrid';
import type { TempoFactor } from '$lib/labels';
import type { songs } from './db/schema';

type Song = typeof songs.$inferSelect;

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

/**
 * A song's beats and its 1–8, from the stored analysis and the user's anchors.
 * Shared by the player's load and the practice panel's grid endpoint, so the
 * two can never count the same song differently.
 */
export function songGrid(song: Song): { beats: number[]; counts: number[] } {
	const grid = buildGrid({
		beats: parse(song.beatsJson),
		downbeats: parse(song.downbeatsJson),
		anchors: parse(song.anchorsJson),
		tempoFactor: song.tempoFactor as TempoFactor
	});
	return { beats: grid.beats, counts: grid.counts };
}
