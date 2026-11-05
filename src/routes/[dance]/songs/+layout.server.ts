import { getDb } from '$lib/server/db';
import { listSharedSongs, listSongs } from '$lib/server/songs';
import { songUsers } from '$lib/server/song-share';
import { whatsNew } from '$lib/server/whats-new';
import { storedTwinSets } from '$lib/server/twins';
import { foldSongs } from '$lib/clones/twins';
import { wallOf } from '$lib/server/scope';
import { groupModeOf } from '$lib/server/group-mode';
import type { LayoutServerLoad } from './$types';

/**
 * The Music list, for the list page and for a song open beside it (desktop:
 * the list column is the layout's, `ListPane`), so a song page loads its list
 * too: one query.
 *
 * Group mode: the group's songs, drafts first, and how many people practise
 * with each shared one. Otherwise the person's own songs, then a section per
 * group with its shared songs, each marked when it is new to them.
 */
export const load: LayoutServerLoad = ({ params, locals, cookies, url }) => {
	// Every navigation reads the list afresh, as the list page's own load did: a
	// song opened since is no longer new, a song added or archived shows.
	void url.pathname;
	const db = getDb();
	const wall = wallOf(params, locals);
	const mode = groupModeOf(db, wall.userId, wall.dance, cookies);
	if (mode) {
		const list = listSongs(db, { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId });
		return {
			songs: list,
			groups: [],
			twinned: [] as number[],
			users: Object.fromEntries(
				list.filter((s) => s.sharedAt !== null).map((s) => [s.id, songUsers(db, s.id)])
			) as Record<number, number>
		};
	}
	const fresh = whatsNew(db, wall.userId, wall.dance).songs;
	// Twins show as one (board C7): each set once, yours if you have one, else the
	// first group by name; only ready songs fold, so one being added never hides a
	// ready twin. Group mode (above) folds nothing.
	const folded = foldSongs(
		listSongs(db, wall),
		listSharedSongs(db, wall.userId, wall.dance).map((g) => ({ team: g.team, rows: g.songs })),
		storedTwinSets(db, wall.userId, 'song')
	);
	return {
		songs: folded.mine,
		groups: folded.groups.map((g) => ({
			team: g.team,
			songs: g.rows.map((s) => ({ ...s, isNew: fresh.has(s.id) }))
		})),
		/** The songs that stand for their twins: the "Twins" chip. */
		twinned: [...folded.twinOf.keys()],
		users: {} as Record<number, number>
	};
};
