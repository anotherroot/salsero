/**
 * Server rows → picker groups. PURE and client-safe.
 *
 * Each builder makes the rows of one kind of thing the same way wherever it
 * is picked: the same keys, labels and second lines (rule 10 of the unified
 * pickers spec).
 */
import { dateLabel } from '$lib/format';
import { moveHeading, possessive, usedAsIs } from '$lib/clones/view';
import { twinPickMeta } from '$lib/clones/twins';
import { spotLabel } from '$lib/video/spots';
import { holdLine } from '$lib/positions/hold';
import { figureTypeTitle, tagAsItIs, type StyleLabel } from '$lib/positions/view';
import type {
	FigureVersion,
	LinkOption,
	LinkOptions,
	PickExercise,
	PickRoutine,
	PositionSummary,
	SectionGroup,
	TeamRef
} from '$lib/types';
import { fromTags } from '$lib/clones/from-tag';
import { isHeading, type PickEntry, type PickGroup, type PickHeading, type PickRow } from './model';

/** Only a row that says so carries `linked`: field and act pickers have no such idea. */
const withLinked = (row: PickRow, linked: boolean | undefined): PickRow =>
	linked === undefined ? row : { ...row, linked };

const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * One heading per figure (collapse; headings alphabetical, rows in id order), rows key `figure:{id}`, label v.label, short v.name, linked when given.
 * A row that stands for its twins (`twins`, folded on the server) says which is used.
 */
export function variationEntries(vs: (FigureVersion & { linked?: boolean })[]): PickHeading[] {
	const byGroup = new Map<number, PickHeading>();
	for (const v of vs) {
		let heading = byGroup.get(v.groupId);
		if (!heading) {
			heading = { heading: moveHeading(v.figure, v.team), rows: [], collapse: true };
			byGroup.set(v.groupId, heading);
		}
		heading.rows.push(
			withLinked(
				{
					key: `figure:${v.id}`,
					value: v.id,
					label: v.label,
					short: v.name,
					...(v.twins && v.twins.length > 0
						? { meta: twinPickMeta(v, v.twins) }
						: v.team
							? { meta: usedAsIs(v.team.name) }
							: {})
				},
				v.linked
			)
		);
	}
	for (const h of byGroup.values()) h.rows.sort((a, b) => a.value - b.value);
	// A same-named copy says where it came from ("Basic · Sreda 17:30"), within its heading.
	for (const [groupId, h] of byGroup) {
		const own = vs.filter((v) => v.groupId === groupId);
		const tags = fromTags(own.map((v) => ({ id: v.id, name: v.name, from: v.from ?? null })));
		if (tags.size === 0) continue;
		h.rows = h.rows.map((r) => {
			const tag = tags.get(r.value);
			return tag ? { ...r, label: `${r.label} ${tag}`, short: `${r.short} ${tag}` } : r;
		});
	}
	return [...byGroup.values()].sort((a, b) => byName(a.heading, b.heading));
}

/** A figure picked as a figure: key `group:{id}`, meta variations joined ', '. Takes `MoveTarget`s as they are; a `LinkFigureChoice` maps `groupId` to `id`. */
export function figureRows(ts: { id: number; name: string; variations: string[] }[]): PickRow[] {
	return ts.map((t) => ({
		key: `group:${t.id}`,
		value: t.id,
		label: t.name,
		meta: t.variations.join(', ')
	}));
}

/** "4 slots · loops", "1 slot". */
function routineMeta(slots: number, loops: boolean): string {
	return `${slots} ${slots === 1 ? 'slot' : 'slots'}${loops ? ' · loops' : ''}`;
}

/** key `routine:{id}`, meta per the second-line constraint. */
export function routineRows(rs: (Omit<PickRoutine, 'linked'> & { linked?: boolean })[]): PickRow[] {
	return rs.map((r) =>
		withLinked(
			{
				key: `routine:${r.id}`,
				value: r.id,
				label: r.name,
				meta:
					r.twins && r.twins.length > 0
						? twinPickMeta({ figure: null, team: r.team }, r.twins)
						: r.team
							? usedAsIs(r.team.name)
							: routineMeta(r.slots, r.loops)
			},
			r.linked
		)
	);
}

/**
 * Figures (headings by figure, short = variation), Routines, Drills (source
 * 'custom', and 'added': an entry on a group's drill, named as the drill),
 * Lessons (source 'lesson'); meta only for a group's row. Headings and
 * rows alphabetical; a figure's exercises in id order under it.
 */
export function exerciseGroups(es: PickExercise[]): PickGroup[] {
	const row = (e: PickExercise, label: string, short?: string): PickRow => ({
		key: `exercise:${e.id}`,
		value: e.id,
		label,
		...(short === undefined ? {} : { short }),
		...(e.team ? { meta: usedAsIs(e.team.name) } : {}),
		linked: e.linked
	});
	const flat = (...sources: PickExercise['source'][]): PickRow[] =>
		es
			.filter((e) => sources.includes(e.source))
			.map((e) => row(e, e.name))
			.sort((a, b) => byName(a.label, b.label));

	const headings = new Map<string, PickHeading>();
	const loose: PickRow[] = [];
	for (const e of es) {
		if (e.source !== 'figure') continue;
		// Every figure exercise has both names; one without is shown as itself.
		if (e.figure === null || e.variation === null) {
			loose.push(row(e, e.name));
			continue;
		}
		let heading = headings.get(e.figure);
		if (!heading) {
			heading = { heading: e.figure, rows: [], collapse: true };
			headings.set(e.figure, heading);
		}
		heading.rows.push(row(e, `${e.figure} · ${e.variation}`, e.variation));
	}
	for (const h of headings.values()) h.rows.sort((a, b) => a.value - b.value);
	const nameOf = (e: PickEntry) => (isHeading(e) ? e.heading : e.label);
	const figures: PickEntry[] = [...headings.values(), ...loose].sort((a, b) =>
		byName(nameOf(a), nameOf(b))
	);

	const groups: PickGroup[] = [
		{ title: 'Figures', entries: figures },
		{ title: 'Routines', entries: flat('routine') },
		{ title: 'Drills', entries: flat('custom', 'added') },
		{ title: 'Lessons', entries: flat('lesson') }
	];
	return groups.filter((g) => g.entries.length > 0);
}

/**
 * Sections, a heading per video: the videos of lessons the target is taught in
 * under `nearTitle`, the rest under "Other videos", in input order. A row is
 * previewable; an unnamed section is found by its time.
 */
export function sectionGroups(gs: SectionGroup[], nearTitle: string): PickGroup[] {
	const heading = (g: SectionGroup): PickHeading => {
		const title =
			g.video.from.kind === 'lesson'
				? `${g.video.from.title} · ${dateLabel(g.video.from.lessonDay)}`
				: `Recording · ${g.video.from.figure}`;
		return {
			heading: title,
			collapse: false,
			rows: [...g.sections]
				.sort((a, b) => a.startMs - b.startMs)
				.map((s) => {
					const meta = [
						s.label ? spotLabel({ ...s, label: null }) : '',
						s.linkedTo.length > 0 ? `→ ${s.linkedTo.join(', ')}` : ''
					]
						.filter(Boolean)
						.join(' · ');
					return {
						key: `spot:${s.id}`,
						value: s.id,
						label: spotLabel(s),
						...(meta ? { meta } : {}),
						keywords: `${spotLabel({ ...s, label: null })} ${title}`,
						linked: s.linked,
						preview: true
					};
				})
		};
	};
	const groups: PickGroup[] = [
		{ title: nearTitle, entries: gs.filter((g) => g.taughtHere).map(heading) },
		{ title: 'Other videos', entries: gs.filter((g) => !g.taughtHere).map(heading) }
	];
	return groups.filter((g) => g.entries.length > 0);
}

/**
 * The Link popup: the near group (variations as headings, then drills, then
 * positions), Figures, Drills, Positions. Rows key `figure:{id}` /
 * `exercise:{id}` / `position:{id}`; a drill's meta is how often, a
 * position's its hold (a group's: whose it is). Linked targets stay, flagged.
 * A point's options hold positions only, so only those groups show.
 */
export function linkOptionGroups(o: LinkOptions): PickGroup[] {
	// Figure names are unique per dance and space, so a name and its group stand in
	// for the figure: a group's Enchufla offered beside yours is its own heading.
	const variations = (os: LinkOption[]) => {
		const ids = new Map<string, number>();
		return variationEntries(
			os
				.filter((x) => 'figureId' in x.target)
				.map((x) => {
					const figure = x.figure ?? '';
					const whose = `${x.team?.id ?? ''}:${figure}`;
					if (!ids.has(whose)) ids.set(whose, ids.size);
					return {
						id: (x.target as { figureId: number }).figureId,
						groupId: ids.get(whose)!,
						figure,
						name: x.name,
						label: x.label,
						...(x.team ? { team: x.team } : {}),
						...(x.twins ? { twins: x.twins } : {}),
						from: x.from ?? null,
						linked: x.linked
					};
				})
		);
	};
	const drills = (os: LinkOption[]): PickRow[] =>
		os
			.filter((x) => 'exerciseId' in x.target)
			.map((x) => ({
				key: `exercise:${(x.target as { exerciseId: number }).exerciseId}`,
				value: (x.target as { exerciseId: number }).exerciseId,
				label: x.label,
				...(x.team ? { meta: usedAsIs(x.team.name) } : {}),
				linked: x.linked
			}));
	const positions = (os: LinkOption[]): PickRow[] =>
		os.flatMap((x) => {
			if (!('positionId' in x.target)) return [];
			const meta = x.team ? usedAsIs(x.team.name) : x.hold ? holdLine(x.hold) : null;
			return [
				{
					key: `position:${x.target.positionId}`,
					value: x.target.positionId,
					label: x.label,
					...(meta ? { meta } : {}),
					linked: x.linked
				}
			];
		});
	const groups: PickGroup[] = [
		{
			title: o.nearTitle,
			entries: [...variations(o.near), ...drills(o.near), ...positions(o.near)]
		},
		{ title: 'Figures', entries: variations(o.figures) },
		{ title: 'Drills', entries: drills(o.drills) },
		{ title: 'Positions', entries: positions(o.positions) }
	];
	return groups.filter((g) => g.entries.length > 0);
}

/** A position as a figure's Starts in / Ends in picker shows it: key `position:{id}`, meta its hold. */
export function positionRow(p: PositionSummary, tag?: string): PickRow {
	const meta = holdLine(p.hold);
	return {
		key: `position:${p.id}`,
		value: p.id,
		label: tag ? `${p.name} ${tag}` : p.name,
		...(meta ? { meta } : {})
	};
}

/** The tags of one list of positions: a same-named copy and where it came from. */
const positionTags = (rows: PositionSummary[]) =>
	fromTags(rows.map((p) => ({ id: p.id, name: p.name, from: p.copiedFrom ?? null })));

/** The title of the type group a position of `styleTag` sits in. */
const typeTitle = (styleTag: string | null, figureStyle: string | null, styleLabel: StyleLabel) =>
	figureStyle !== null && styleTag === figureStyle
		? figureTypeTitle(styleLabel(styleTag))
		: styleLabel(styleTag);

/**
 * A figure's Starts in / Ends in picker: the owner's own positions by type,
 * the figure's type first ("Salsa · this figure’s type"), the other types in
 * the order `rows` comes in (list order: the dance's style order, untyped
 * "Other" last); then, on a person's figure, a section per group whose
 * positions they may use ("Salsa Tuesdays’"), each row's meta its type and
 * "tag with it as it is". An own row's meta is its hold. Empty groups are left out.
 */
export function positionGroups(
	rows: PositionSummary[],
	figureStyle: string | null,
	styleLabel: StyleLabel,
	groups: { team: TeamRef; rows: PositionSummary[] }[]
): PickGroup[] {
	const byType = new Map<string, PickGroup>();
	const tags = positionTags(rows);
	for (const p of rows) {
		const title = typeTitle(p.styleTag, figureStyle, styleLabel);
		let g = byType.get(title);
		if (!g) {
			g = { title, entries: [] };
			byType.set(title, g);
		}
		g.entries.push(positionRow(p, tags.get(p.id)));
	}
	const types = [...byType.values()];
	const first = types.findIndex((g) => g.title === figureTypeTitle(styleLabel(figureStyle)));
	if (figureStyle !== null && first > 0) types.unshift(...types.splice(first, 1));
	const theirs: PickGroup[] = groups.map((g) => {
		const theirTags = positionTags(g.rows);
		return {
			title: possessive(g.team.name),
			entries: g.rows.map((p) => ({
				key: `position:${p.id}`,
				value: p.id,
				label: theirTags.has(p.id) ? `${p.name} ${theirTags.get(p.id)}` : p.name,
				meta: tagAsItIs(styleLabel(p.styleTag))
			}))
		};
	});
	return [...types, ...theirs].filter((g) => g.entries.length > 0);
}

/**
 * `groups` with a position just made from the picker added under its type,
 * once. A type group not there yet is made: the figure's type first, any
 * other right after it (before the groups' sections, which always come last).
 * The input is not changed.
 */
export function withPositionRow(
	groups: PickGroup[],
	p: PositionSummary,
	figureStyle: string | null,
	styleLabel: StyleLabel
): PickGroup[] {
	const key = `position:${p.id}`;
	if (groups.some((g) => g.entries.some((e) => !isHeading(e) && e.key === key))) return groups;
	const title = typeTitle(p.styleTag, figureStyle, styleLabel);
	const row = positionRow(p);
	const at = groups.findIndex((g) => g.title === title);
	if (at >= 0) {
		return groups.map((g, i) => (i === at ? { ...g, entries: [...g.entries, row] } : g));
	}
	const made = { title, entries: [row] };
	const figureFirst =
		figureStyle !== null && groups[0]?.title === figureTypeTitle(styleLabel(figureStyle));
	const where = title === figureTypeTitle(styleLabel(figureStyle)) ? 0 : figureFirst ? 1 : 0;
	return [...groups.slice(0, where), made, ...groups.slice(where)];
}
