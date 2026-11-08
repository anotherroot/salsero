/** PURE, client-safe: what a lesson's page shows. */
import type { ScheduleState } from '$lib/schedule/schedule';
import { dayWords, dueWords, whenWords } from '$lib/schedule/words';
import { daysBetween } from '$lib/day/day';
import { classDayLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { lazyWords } from '$lib/i18n/lazy';
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

/**
 * The simple page's line over the title: "Class · Tue 3 Nov" for a class (a
 * group's lesson), the day alone for a person's own lesson.
 */
export function lessonBandLine(day: string, today: string, isClass: boolean): string {
	const label = classDayLabel(day, today);
	return isClass ? t().lesson.bandLine(label) : label;
}

/**
 * When an entry is next on Today, in part 1's due words: "On Today today",
 * "On Today tomorrow", "On Today on Sunday" (within the week), "On Today next
 * week" (7 to 13 days), "On Today on 19 Nov". A paused one is "Paused". A
 * weekday is said as a time (`whenWords`: "Na vrsti v nedeljo").
 */
export function whenOnToday(state: ScheduleState, active: boolean, today: string): string {
	const w = t().lesson;
	if (!active) return w.paused;
	const d = daysBetween(today, state.dueDay);
	if (d <= 1) return w.onToday(dayWords(state.dueDay, today));
	if (d >= 7 && d <= 13) return w.onTodayNextWeek;
	return w.onTodayOn(whenWords(state.dueDay, today));
}

/** One of the person's entries from a lesson, as the simple page's load collects them. */
export interface PracticeEntry {
	id: number;
	name: string;
	kind: 'lesson' | 'routine' | 'drill';
	active: boolean;
}

/**
 * "What you're practising": the person's entries from the lesson, in the
 * order given, each with when it is next on Today. `states` holds the
 * person's own live exercises; an entry without one (archived, or not theirs)
 * is not drawn. The lesson's own entry is "Go over this lesson", as the full
 * page names it.
 */
export function practiceRows(
	entries: PracticeEntry[],
	states: Record<number, ScheduleState>,
	today: string
): { id: number; name: string; when: string }[] {
	return entries.flatMap((e) => {
		const state = states[e.id];
		if (!state) return [];
		const name = e.kind === 'lesson' ? t().lesson.goOver : e.name;
		return [{ id: e.id, name, when: whenOnToday(state, e.active, today) }];
	});
}

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
	return t().lesson.via.badge(sections, points);
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
	// How it is danced, in the Figures list's chip words: "With partner", "Solo".
	return f.viaSections.length > 0 ? viaRanges(f.viaSections) : t().moves.chips[f.partner];
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
	const w = t().lesson.meta;
	return meta === null || meta === '' ? w.yours : w.yoursWith(meta);
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
	const w = t().lesson.meta;
	const due = dueText(state, today);
	const parts = due === null ? [] : [{ text: due, strong: false }];
	if (!e.active) parts.push({ text: w.inactive, strong: true });
	parts.push({ text: w.review, strong: false });
	return parts;
}

/**
 * The "Unlink …?" question's title. Asked from the lesson's own page it names
 * what goes; asked from elsewhere (a position's page) `lesson` names the
 * lesson it goes from too.
 */
export function unlinkViaTitle(label: string, lesson?: string): string {
	return t().lesson.via.title(label, lesson ?? null);
}

/** Its body: the sections and points that bring it, which go too. `lesson` as in the title. */
export function unlinkViaBody(label: string, via: ViaSection[], lesson?: string): string {
	const { sections, points } = viaCounts(via);
	return t().lesson.via.body(label, lesson ?? null, sections, points, viaRanges(via));
}

export function deleteVideoBody(sections: number): string {
	return t().lesson.deleteVideoBody(sections);
}

/** What a spot linked to a position is blocked by: "Position · Cerrada". */
export function positionLinkLabel(name: string): string {
	return t().lesson.positionLink(name);
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
	].map((c) => (c.archived ? `${c.label} ${t().video.archived}` : c.label));
	if (labels.length === 0) return null;
	const sorted = [...new Set(labels)].sort((a, b) => a.localeCompare(b));
	return t().video.refusal.linked(sorted.join(', '));
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

/** The aria-label of each list's "+ Add" on the lesson page, read when drawn. */
export const ADD_LABEL = lazyWords((c) => c.lesson.addLabel);

/** A group's draft lesson's strip on the band (spec A6), read when drawn. */
export const DRAFT_BAND = lazyWords(({ lesson: { draft } }) => ({
	title: draft.title,
	line: draft.line,
	publish: draft.publish
}));

/** A group's draft's ⋯ item that publishes it (beside the band's button), naming who will see it. */
export function publishItem(teamName: string) {
	const w = t().lesson.draft;
	return {
		key: 'publish',
		icon: 'upload' as const,
		label: w.publish,
		meta: w.publishMeta(teamName)
	};
}
