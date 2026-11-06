import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { myClassOf, teamsWithNew } from '$lib/server/my-class';
import { levelShown } from '$lib/levels/levels';
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
	const teams = teamsWithNew(db, wall);
	if (levelShown(locals.user!.level) !== 'follow') return { teams, myClass: null };
	return { teams, myClass: myClassOf(db, wall, teams, locals.user!.timezone, Date.now()) };
};
