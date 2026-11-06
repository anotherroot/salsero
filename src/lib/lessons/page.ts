/** PURE, client-safe: what a lesson's page shows. */
import type { ScheduleState } from '$lib/schedule/schedule';
import { dueWords } from '$lib/schedule/words';
import { PARTNER_LABEL } from '$lib/labels';
import type {
	LessonExerciseRow,
	LessonFigureRow,
	LessonPositionRow,
	PositionSummary,
	TeamRef,
	ViaSection,
	VideoSection
} from '$lib/types';
import { spotTime } from '$lib/video/spots';
import { positionGroups } from '$lib/picker/build';
import type { PickEntry, PickGroup } from '$lib/picker/model';
import type { StyleLabel } from '$lib/positions/view';

/** `Figures · 3`, bare at zero. */
export function sectionHeading(label: string, n: number): string {
	return n === 0 ? label : `${label} · ${n}`;
}

/** How many sections and points a via list holds (a point has no end). */
function viaCounts(via: ViaSection[]): { sections: number; points: number } {
	const points = via.filter((v) => v.endMs === null).length;
	return { sections: via.length - points, points };
}

/** The badge on a row that is on the lesson through sections or points. */
export function viaBadge(via: ViaSection[]): string | null {
	if (via.length === 0) return null;
	const { sections, points } = viaCounts(via);
	const one = (n: number, word: string) => (n === 1 ? `a ${word}` : `${n} ${word}s`);
	if (points === 0) return sections === 1 ? 'via section' : `via ${sections} sections`;
	if (sections === 0) return points === 1 ? 'via point' : `via ${points} points`;
	return `via ${one(sections, 'section')} and ${one(points, 'point')}`;
}

/** The bare noun for a via list: "section", "points", "section and point". */
function viaNoun(via: ViaSection[]): string {
	const { sections, points } = viaCounts(via);
	const s = sections === 1 ? 'section' : 'sections';
	const p = points === 1 ? 'point' : 'points';
	if (points === 0) return s;
	if (sections === 0) return p;
	return `${s} and ${p}`;
}

/** `1:12.0–1:30.4, 3:05.0–3:22.8`; a point is its moment alone, `1:12.0`. */
export function viaRanges(via: ViaSection[]): string {
	return via
		.map((v) =>
			v.endMs === null ? spotTime(v.startMs) : `${spotTime(v.startMs)}–${spotTime(v.endMs)}`
		)
		.join(', ');
}

export function figureMeta(f: Pick<LessonFigureRow, 'partner' | 'viaSections'>): string {
	return f.viaSections.length > 0 ? viaRanges(f.viaSections) : PARTNER_LABEL[f.partner];
}

/**
 * A position row's line: where it is taught (the sections, for a row there through
 * them) and its type, "1:12.0–1:31.0 · Son"; the type alone by hand; null for neither.
 */
export function positionMeta(
	p: Pick<LessonPositionRow, 'styleTag' | 'viaSections'>,
	styleLabel: (tag: string | null) => string
): string | null {
	const parts = [
		p.viaSections.length > 0 ? viaRanges(p.viaSections) : null,
		p.styleTag === null ? null : styleLabel(p.styleTag)
	].filter((x): x is string => x !== null);
	return parts.length > 0 ? parts.join(' · ') : null;
}

/** A link card on a group's lesson that opens the person's own copy says so. */
export function yoursMeta(meta: string | null, mineId: number | null): string | null {
	if (mineId === null) return meta;
	return meta === null || meta === '' ? 'Yours' : `Yours · ${meta}`;
}

/** An exercise's due words ("Due Sunday", "New"), or null with no schedule to read. */
function dueText(state: ScheduleState | undefined, today: string): string | null {
	return state ? dueWords(state, today, state.lastDay === null)[0].text : null;
}

export function routineMeta(state: ScheduleState | undefined, today: string): string | null {
	return dueText(state, today);
}

export function exerciseMeta(
	e: Pick<LessonExerciseRow, 'viaSections'>,
	state: ScheduleState | undefined,
	today: string
): string | null {
	return e.viaSections.length > 0 ? viaRanges(e.viaSections) : dueText(state, today);
}

/** The review exercise's line, with `inactive` picked out. */
export function reviewMeta(
	e: { active: boolean },
	state: ScheduleState | undefined,
	today: string
): { text: string; strong: boolean }[] {
	const due = dueText(state, today);
	const parts = due === null ? [] : [{ text: due, strong: false }];
	if (!e.active) parts.push({ text: 'inactive', strong: true });
	parts.push({ text: 'review exercise', strong: false });
	return parts;
}

/**
 * The "Unlink …?" question's title. Asked from the lesson's own page it names
 * what goes; asked from elsewhere (a position's page) `lesson` names the
 * lesson it goes from too.
 */
export function unlinkViaTitle(label: string, lesson?: string): string {
	return lesson ? `Unlink ${label} from ${lesson}?` : `Unlink ${label}?`;
}

/** Its body: the sections and points that bring it, which go too. `lesson` as in the title. */
export function unlinkViaBody(label: string, via: ViaSection[], lesson?: string): string {
	const noun = viaNoun(via);
	return `${label} is on ${lesson ?? 'this lesson'} through ${noun} ${viaRanges(via)}. Unlink it from the lesson and the ${noun}?`;
}

export function deleteVideoBody(sections: number): string {
	const tail = 'Lesson videos aren’t backed up, so this can’t be undone.';
	if (sections === 0) return tail;
	return `Its ${sections} ${sections === 1 ? 'section goes' : 'sections go'} with it. ${tail}`;
}

/** What a spot linked to a position is blocked by: "Position · Cerrada". */
export function positionLinkLabel(name: string): string {
	return `Position · ${name}`;
}

/**
 * What blocks deleting a video, worded as the server's `SpotLinkedError` says
 * it. Mirrors `linksBlocking` in `src/lib/server/spot-links.ts`: every link's
 * label, and every position its sections and points link (`positionLinkLabel`),
 * ` (archived)` when archived, de-duplicated, sorted with `localeCompare`.
 */
export function deleteBlock(
	sections: Pick<VideoSection, 'links'>[],
	positions: { name: string; archived: boolean }[] = []
): string | null {
	const labels = [
		...sections.flatMap((s) => s.links),
		...positions.map((p) => ({ label: positionLinkLabel(p.name), archived: p.archived }))
	].map((c) => (c.archived ? `${c.label} (archived)` : c.label));
	if (labels.length === 0) return null;
	const sorted = [...new Set(labels)].sort((a, b) => a.localeCompare(b));
	return `Linked to ${sorted.join(', ')} — unlink it first.`;
}

/**
 * The "Link a position" picker's groups: the lesson's own positions by type, then a
 * section per group whose positions the person may use (`positionGroups`); every
 * row carries whether the lesson already links it, which the picker draws as "Linked".
 */
export function positionPickGroups(
	rows: (PositionSummary & { linked: boolean; team: TeamRef | null })[],
	styleLabel: StyleLabel
): PickGroup[] {
	const linked = new Set(rows.filter((r) => r.linked).map((r) => r.id));
	const teams = new Map<number, { team: TeamRef; rows: PositionSummary[] }>();
	for (const r of rows) {
		if (!r.team) continue;
		const g = teams.get(r.team.id) ?? { team: r.team, rows: [] };
		g.rows.push(r);
		teams.set(r.team.id, g);
	}
	const mark = (e: PickEntry): PickEntry =>
		'rows' in e
			? { ...e, rows: e.rows.map((x) => ({ ...x, linked: linked.has(x.value) })) }
			: { ...e, linked: linked.has(e.value) };
	return positionGroups(
		rows.filter((r) => !r.team),
		null,
		styleLabel,
		[...teams.values()]
	).map((g) => ({ ...g, entries: g.entries.map(mark) }));
}

/** The aria-label of each list's "+ Add" on the lesson page. */
export const ADD_LABEL = {
	figure: 'Add a figure',
	routine: 'Add a routine',
	exercise: 'Add an exercise',
	position: 'Add a position',
	link: 'Add a link'
} as const;
