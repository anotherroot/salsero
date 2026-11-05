import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { listMyTeams } from '$lib/server/teams';
import { latestClassDays } from '$lib/server/lessons';
import { danceWithClass } from '$lib/server/join-code';
import { whatsNew } from '$lib/server/whats-new';
import { DANCE_SLUGS, getDance } from '$lib/dances/dances';
import { localDay } from '$lib/day/day';
import { levelShown } from '$lib/levels/levels';
import { otherClassLine } from '$lib/teams/view';
import type { LayoutServerLoad } from './$types';

/**
 * The Groups list, once, for the list page and for a group (or its People,
 * storage, History, Recently deleted) open beside it (desktop: the list column
 * is the layout's). Only the person's own groups in this dance, as the list
 * page always read them. Reads `params.dance` and `locals` only, so opening
 * another group does not rerun it; a form in the pane reruns it (`invalidateAll`),
 * so renaming, leaving, deleting and restoring refresh the column.
 *
 * At Follow my class the tab is My class (`myClass`): each class's last class
 * day for the list of classes, and with no class in this dance, the other
 * dance's My class when the person has a class there.
 */
export const load: LayoutServerLoad = ({ params, locals }) => {
	const wall = wallOf(params, locals);
	const db = getDb();
	const fresh = whatsNew(db, wall.userId, wall.dance).byTeam;
	const teams = listMyTeams(db, wall.userId, wall.dance).map((t) => ({
		...t,
		newCount: fresh.get(t.id) ?? 0
	}));
	if (levelShown(locals.user!.level) !== 'follow') return { teams, myClass: null };

	const live = teams.filter((t) => t.deletedAt === null);
	const days = latestClassDays(
		db,
		live.map((t) => t.id)
	);
	const elsewhere =
		live.length === 0 ? danceWithClass(db, wall.userId, wall.dance, DANCE_SLUGS) : wall.dance;
	return {
		teams,
		myClass: {
			lastDays: Object.fromEntries(days),
			today: localDay(Date.now(), locals.user!.timezone),
			other:
				elsewhere === wall.dance
					? null
					: {
							dance: elsewhere,
							line: otherClassLine(getDance(elsewhere).label)
						}
		}
	};
};
