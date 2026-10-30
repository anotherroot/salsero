/**
 * Server rows → picker groups. PURE and client-safe.
 *
 * Each builder makes the rows of one kind of thing the same way wherever it
 * is picked: the same keys, labels and second lines (rule 10 of the unified
 * pickers spec).
 */
import { frequencyLabel } from '$lib/frequency';
import { dateLabel } from '$lib/format';
import { spotLabel } from '$lib/video/spots';
import type {
	FigureVersion,
	LinkOption,
	LinkOptions,
	PickExercise,
	PickRoutine,
	SectionGroup
} from '$lib/types';
import { isHeading, type PickEntry, type PickGroup, type PickHeading, type PickRow } from './model';

/** Only a row that says so carries `linked`: field and act pickers have no such idea. */
const withLinked = (row: PickRow, linked: boolean | undefined): PickRow =>
	linked === undefined ? row : { ...row, linked };

const byName = (a: string, b: string) => a.localeCompare(b);

/** One heading per figure (collapse), rows key `figure:{id}`, label v.label, short v.name, linked when given. */
export function variationEntries(vs: (FigureVersion & { linked?: boolean })[]): PickHeading[] {
	const byGroup = new Map<number, PickHeading>();
	for (const v of vs) {
		let heading = byGroup.get(v.groupId);
		if (!heading) {
			heading = { heading: v.figure, rows: [], collapse: true };
			byGroup.set(v.groupId, heading);
		}
		heading.rows.push(
			withLinked({ key: `figure:${v.id}`, value: v.id, label: v.label, short: v.name }, v.linked)
		);
	}
	return [...byGroup.values()];
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
			{ key: `routine:${r.id}`, value: r.id, label: r.name, meta: routineMeta(r.slots, r.loops) },
			r.linked
		)
	);
}

/**
 * Figures (headings by figure, short = variation), Routines, Drills (source
 * 'custom'), Lessons (source 'lesson'); meta frequencyLabel. Headings and
 * rows alphabetical; a figure's exercises in id order under it.
 */
export function exerciseGroups(es: PickExercise[]): PickGroup[] {
	const row = (e: PickExercise, label: string, short?: string): PickRow => ({
		key: `exercise:${e.id}`,
		value: e.id,
		label,
		...(short === undefined ? {} : { short }),
		meta: frequencyLabel(e.everyDays),
		linked: e.linked
	});
	const flat = (source: PickExercise['source']): PickRow[] =>
		es
			.filter((e) => e.source === source)
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
		{ title: 'Drills', entries: flat('custom') },
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
 * The Link popup: the near group (variations as headings, then drills),
 * Figures, Drills. Rows key `figure:{id}` / `exercise:{id}`; a drill's meta is
 * how often. Linked targets stay, flagged.
 */
export function linkOptionGroups(o: LinkOptions): PickGroup[] {
	// Figure names are unique per dance, so a name stands in for the figure.
	const variations = (os: LinkOption[]) => {
		const ids = new Map<string, number>();
		return variationEntries(
			os
				.filter((x) => 'figureId' in x.target)
				.map((x) => {
					const figure = x.figure ?? '';
					if (!ids.has(figure)) ids.set(figure, ids.size);
					return {
						id: (x.target as { figureId: number }).figureId,
						groupId: ids.get(figure)!,
						figure,
						name: x.name,
						label: x.label,
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
				meta: frequencyLabel(x.everyDays ?? 0),
				linked: x.linked
			}));
	const groups: PickGroup[] = [
		{ title: o.nearTitle, entries: [...variations(o.near), ...drills(o.near)] },
		{ title: 'Figures', entries: variations(o.figures) },
		{ title: 'Drills', entries: drills(o.drills) }
	];
	return groups.filter((g) => g.entries.length > 0);
}
