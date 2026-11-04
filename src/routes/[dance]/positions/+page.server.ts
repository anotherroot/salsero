import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { canonicalOf, graphFor } from '$lib/server/graph';
import { noPosition, positionCounts, taggedCount } from '$lib/graph/graph';
import {
	addTemplates,
	createPosition,
	listPositions,
	positionsFrom,
	positionSummary
} from '$lib/server/positions';
import { usableOf, usablePositions } from '$lib/server/usable';
import { withoutShadowed } from '$lib/server/clones/shadow';
import { storedTwinSets } from '$lib/server/twins';
import { foldSections } from '$lib/clones/twins';
import { defaultStyle } from '$lib/server/default-styles';
import { optionalText } from '$lib/server/form';
import { wallOf, type Space } from '$lib/server/scope';
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import { DANCES } from '$lib/dances/dances';
import { fold } from '$lib/fold';
import { parseHold } from '$lib/positions/hold';
import { templateTypes } from '$lib/positions/templates';
import type { PositionFilter } from '$lib/positions/view';
import type { PositionListRow, TeamRef } from '$lib/types';
import type { PositionRow } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

const hasGap = (r: PositionListRow) => r.deadEnd || r.orphan || r.island;

export const load: PageServerLoad = ({ url, params, locals, cookies }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const dance = wall.dance;
	const db = getDb();
	const mode = groupModeOf(db, wall.userId, dance, cookies);
	// In group mode the page reads the group's side; the person's own is not shown.
	const space: Space = mode ? { dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	const styles = DANCES[dance].styles;

	const q = url.searchParams.get('q')?.trim() ?? '';
	const type = url.searchParams.get('type');
	const filter: PositionFilter = {
		q,
		...(type && styles.includes(type) ? { type } : {}),
		// Gaps are the person's own report: group mode has none.
		...(!mode && url.searchParams.get('gaps') === '1' ? { gaps: '1' as const } : {})
	};

	// The graph is the viewer's (ruling 14): a person's own figures plus the group
	// figures they may use; in group mode, the group's.
	const usable = mode ? undefined : usableOf(db, wall);
	const graph = graphFor(db, space, usable);
	const own = listPositions(db, space);
	// Each group's positions the person may use. Yours replaces theirs: a group
	// position with your own copy shows as yours.
	const theirs = mode
		? []
		: withoutShadowed(db, wall, 'position', usablePositions(db, wall, usable));
	// Every row's counts in one pass: the parts of the graph are worked out once.
	const counts = new Map(
		positionCounts(graph, [
			...new Set([...own, ...theirs].map((p) => canonicalOf(graph, p.id)))
		]).map((c) => [c.id, c])
	);
	const row = (p: PositionRow, from: string | null): PositionListRow => {
		const c = counts.get(canonicalOf(graph, p.id))!;
		return {
			...positionSummary(p, space),
			inCount: c.inCount,
			outCount: c.outCount,
			// The gap report is hidden in group mode.
			deadEnd: !mode && c.deadEnd,
			orphan: !mode && c.orphan,
			island: !mode && c.island,
			unused: c.unused,
			from,
			twins: false
		};
	};

	let mine = own.map((p) => row(p, null));
	let groups: { team: TeamRef; rows: PositionListRow[] }[] = [];
	if (!mode) {
		// Each group's under its heading.
		const byTeam = new Map<number, { team: TeamRef; rows: PositionRow[] }>();
		for (const p of theirs) {
			const g = byTeam.get(p.team.id) ?? { team: p.team, rows: [] };
			g.rows.push(p);
			byTeam.set(p.team.id, g);
		}
		const sections = [...byTeam.values()].map((g) => {
			const from = positionsFrom(
				db,
				wall.userId,
				g.team.id,
				g.rows.map((p) => p.id)
			);
			return { team: g.team, rows: g.rows.map((p) => row(p, from.get(p.id) ?? null)) };
		});
		// Twins show as one (Same as…): yours if you have one, else the first by group name.
		const folded = foldSections(mine, sections, storedTwinSets(db, wall.userId, 'position'));
		const twinned = (r: PositionListRow) => ({ ...r, twins: folded.twinOf.has(r.id) });
		mine = folded.mine.map(twinned);
		groups = folded.groups.map((g) => ({ team: g.team, rows: g.rows.map(twinned) }));
	}

	const matches = (r: PositionListRow) =>
		(!filter.q || fold(r.name).includes(fold(filter.q))) &&
		(!filter.type ||
			r.styleTag === filter.type ||
			(r.styleTag === null && filter.type === 'other')) &&
		(!filter.gaps || hasGap(r));
	const none = noPosition(graph);
	return {
		rows: mine.filter(matches),
		// Gaps are about the person's own: a group's rows step aside under the chip.
		groups: filter.gaps
			? []
			: groups
					.map((g) => ({ team: g.team, rows: g.rows.filter(matches) }))
					.filter((g) => g.rows.length > 0),
		none: {
			none: none.none.length,
			onlyStart: none.onlyStart.length,
			onlyEnd: none.onlyEnd.length
		},
		tagged: taggedCount(graph),
		// The Gaps chip's count, whatever the other chips.
		gaps: mine.filter(hasGap).length,
		types: [...styles],
		styleLabel: DANCES[dance].styleLabel,
		// Settings' "New figures" type: where New position's type starts.
		defaultStyle: defaultStyle(db, wall.userId, dance),
		/** The space's own names, folded: Templates marks them "You have it". */
		owned: own.map((p) => fold(p.name)),
		/** In a group's own workspace (not `groupMode`: the layout's, which the shell reads). */
		inGroupMode: mode !== null,
		filter
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals, cookies }) => {
		const db = getDb();
		// The cookie is the client's: `spaceOf` re-checks it, so a member who
		// is not an editor creates in their own space, never in the group.
		const space = spaceOf(db, params, locals, cookies);
		const form = await request.formData();
		const styleTag = String(form.get('styleTag') ?? '');
		const typed = {
			action: 'create' as const,
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? ''),
			styleTag
		};
		const notes = optionalText(form, 'notes');
		if (notes === undefined) {
			return fail(400, {
				...typed,
				field: 'notes' as const,
				message: 'Notes are up to 2000 characters.'
			});
		}
		if (typed.name.trim().length > 200) {
			return fail(400, {
				...typed,
				field: 'name' as const,
				message: 'A name is up to 200 characters.'
			});
		}
		const made = createPosition(
			db,
			space,
			{
				name: typed.name,
				styleTag: DANCES[space.dance].styles.includes(styleTag) ? styleTag : null,
				hold: parseHold(form),
				notes,
				pictureSpotId: null
			},
			Date.now()
		);
		if ('field' in made) return fail(400, { ...typed, field: made.field, message: made.message });
		throw redirect(303, `/${space.dance}/positions/${made.id}`);
	},

	templates: async ({ params, request, locals, cookies }) => {
		const db = getDb();
		const space = spaceOf(db, params, locals, cookies);
		const form = await request.formData();
		const type = String(form.get('type') ?? '');
		const names = form.getAll('names').map(String);
		if (!templateTypes(space.dance).includes(type)) {
			return fail(400, { action: 'templates' as const, message: 'Pick a type with templates.' });
		}
		if (names.length === 0) {
			return fail(400, { action: 'templates' as const, message: 'Tick at least one position.' });
		}
		const made = addTemplates(db, space, space.dance, type, names, Date.now());
		return { action: 'templates' as const, added: made.length };
	}
};
