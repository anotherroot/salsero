/** Every positions screen's words: PURE, client-safe. The words are the catalog's (`positions`). */
import { classDayLabel, dayMonth, monthHeading, weekdayDayMonth } from '$lib/format';
import { spotLabel } from '$lib/video/spots';
import type { PickGroup, PickRow } from '$lib/picker/model';
import type {
	PositionListRow,
	PositionSummary,
	SectionGroup,
	SectionVideo,
	TeamRef
} from '$lib/types';
import { twinsChip } from '$lib/clones/twins';
import { markWord, type MapMark } from './map';
import type { MenuItem } from '$lib/menu';
import { t } from '$lib/i18n/catalog';
import { lazyWords } from '$lib/i18n/lazy';
import { styleLabelsOf } from '$lib/moves/figures';

export { holdChips } from './hold';

/** The label of a style tag; null (no type) reads as "Other". */
export type StyleLabel = (tag: string | null) => string;

// ---- the list ----

export function taggedLine(n: { done: number; total: number }): string {
	return t().positions.list.tagged(n.done, n.total);
}

export const optionalLine = (): string => t().positions.list.optional;

/**
 * A row's second line. A gap's word (dead end, orphan, island) is drawn after the text;
 * dead end and orphan are danger-toned, an island is not. Unused is part of the text.
 */
export function rowMeta(
	r: PositionListRow,
	styleLabel: StyleLabel
): {
	text: string;
	word: string | null;
	tone: 'danger' | null;
} {
	const w = t().positions;
	const parts = [styleLabel(r.styleTag)];
	if (r.unused) {
		parts.push(w.list.unused);
		return { text: parts.join(' · '), word: null, tone: null };
	}
	if (r.inCount > 0) parts.push(w.counts.ins(r.inCount));
	if (r.outCount > 0) parts.push(w.counts.outs(r.outCount));
	const text = parts.join(' · ');
	if (r.deadEnd) return { text: `${text} ·`, word: w.gaps.deadEnd, tone: 'danger' };
	if (r.orphan) return { text: `${text} ·`, word: w.gaps.orphan, tone: 'danger' };
	if (r.island) return { text: `${text} ·`, word: w.gaps.island, tone: null };
	return { text, word: null, tone: null };
}

/** A group's row: "Salsa · from Week 6". */
export function groupRowMeta(r: PositionListRow, styleLabel: StyleLabel): string {
	const type = styleLabel(r.styleTag);
	return r.from ? t().positions.list.fromLesson(type, r.from) : type;
}

export function noPositionRow(n: number): { title: string; meta: string } {
	const w = t().positions.none;
	return { title: w.title, meta: w.rowMeta(n) };
}

export function noPositionHead(n: { none: number; onlyStart: number; onlyEnd: number }): string {
	return t().positions.none.head(n.none + n.onlyStart + n.onlyEnd, n.none, n.onlyStart + n.onlyEnd);
}

export const FITS_ANYWHERE: { title: string; body: string } = lazyWords(
	(c) => c.positions.none.fits
);

/** The No position page's groups (empty ones left out): no start and no end, only an end, only a start. */
export function noPositionGroups(ids: {
	none: number[];
	onlyStart: number[];
	onlyEnd: number[];
}): { title: string; ids: number[] }[] {
	const w = t().positions.none.groups;
	const groups = [
		{ title: w.none, ids: ids.none },
		{ title: w.onlyEnd, ids: ids.onlyEnd },
		{ title: w.onlyStart, ids: ids.onlyStart }
	];
	return groups
		.filter((g) => g.ids.length > 0)
		.map((g) => ({ title: `${g.title} · ${g.ids.length}`, ids: g.ids }));
}

/** The tag a half-tagged figure row shows: "ends in A, B" / "starts in A". */
export function noPositionTag(side: 'start' | 'end', names: string[]): string {
	const w = t().positions.none;
	return side === 'end' ? w.endsIn(names.join(', ')) : w.startsIn(names.join(', '));
}

/** "Salsa · starts on 1 · 8 counts · 1 recording": the type, then what the figure row says. */
export function noPositionMeta(
	type: string,
	f: { startCount: number | null; lengthCounts: number | null; recordings: number }
): string {
	const c = t();
	const parts = [type];
	if (f.startCount !== null) parts.push(c.positions.none.startsOn(f.startCount));
	if (f.lengthCounts !== null) parts.push(c.nouns.counts(f.lengthCounts));
	if (f.recordings > 0) parts.push(c.nouns.recordings(f.recordings));
	return parts.join(' · ');
}

/** The line under the Fits anywhere card when no figure is missing a position. */
export const noPositionEmpty = (): string => t().positions.none.empty;

export const EMPTY: { title: string; body: string } = lazyWords((c) => ({
	title: c.positions.empty.title,
	body: c.positions.empty.body
}));

/** The first-run (wide) body, which counts the figures. */
export function firstRunBody(figures: number): string {
	return t().positions.empty.firstRun(figures);
}

export const groupNote = (): string => t().positions.list.groupNote;

/** The empty state's three buttons. */
export const EMPTY_ACTIONS: { templates: string; create: string; how: string } = lazyWords(
	(c) => c.positions.empty.actions
);

/** The label over the list: the person's own as "Yours · 15"; a group's (group mode) by count. */
export function listHeading(n: number, groupMode: boolean): string {
	const c = t();
	return groupMode ? c.nouns.positions(n) : c.positions.list.yours(n);
}

/** The row into the map, under No position. */
export const mapRow = (): string => t().positions.list.mapRow;

/** A search or a chip that leaves nothing. */
export const noMatch = (): string => t().positions.list.noMatch;

/** Only a group's positions so far: the person's own list starts here. */
export const noneOwn = (): string => t().positions.list.noneOwn;

/** A type's label, in the reader's language; an untyped position reads as "Other". */
export function styleLabelOf(labels: Record<string, string>): StyleLabel {
	return (tag) => (tag === null ? t().moves.styles.other : (styleLabelsOf(labels)[tag] ?? tag));
}

/** The list's filter, as the URL carries it: the search is always a string, the rest only when set. */
export type PositionFilter = { q: string; type?: string; gaps?: '1'; sync?: '1' };

export type PositionChip = {
	key: string;
	label: string;
	count?: number;
	on: boolean;
	/** What tapping it does to the filter. Never touches `q`. */
	change: Partial<PositionFilter>;
};

const FILTER_KEYS = ['q', 'type', 'gaps', 'sync'] as const;

/** The query string for `filter` with `change` applied, without the `?`; `''` when nothing is set. */
export function positionQuery(filter: PositionFilter, change: Partial<PositionFilter>): string {
	const next: Partial<PositionFilter> = { ...filter, ...change };
	return FILTER_KEYS.filter((k) => next[k])
		.map((k) => `${k}=${encodeURIComponent(next[k] as string)}`)
		.join('&');
}

/** What the chip row is built from. */
export interface PositionChipsOf {
	/** The dance's types, in its order. */
	types: readonly string[];
	typeLabel: Record<string, string>;
	/** The Gaps chip's count. */
	gaps: number;
	groupMode: boolean;
	/** Whether the space has positions of its own (not only a group's). */
	hasOwn: boolean;
	/** Whether any row shown (own or a group's) has no type. */
	untyped: boolean;
}

/** The filter's key for untyped rows, where the dance has no type of that name. */
export const OTHER_TYPE = 'other';

/**
 * The chip row: All · a chip per type · Other (untyped rows, where the dance
 * has no Other type: bachata) · Gaps N (the person's own report: not in
 * group mode, and not without positions of their own). A chip that is on
 * always shows, so it can be turned off. A type is single-valued: the on one
 * clears, another replaces. All clears both; no chip drops the search.
 */
export function positionChips(filter: PositionFilter, o: PositionChipsOf): PositionChip[] {
	const c = t();
	const w = c.positions.list.chips;
	const labels = styleLabelsOf(o.typeLabel);
	const types =
		!o.types.includes(OTHER_TYPE) && (o.untyped || filter.type === OTHER_TYPE)
			? [...o.types, OTHER_TYPE]
			: o.types;
	const chips: PositionChip[] = [
		{
			key: 'all',
			label: w.all,
			on: !filter.type && !filter.gaps && !filter.sync,
			change: { type: undefined, gaps: undefined, sync: undefined }
		},
		...types.map((type) => ({
			key: `type:${type}`,
			label: labels[type] ?? (type === OTHER_TYPE ? c.moves.styles.other : type),
			on: filter.type === type,
			change: { type: filter.type === type ? undefined : type }
		}))
	];
	const { gaps, groupMode } = o;
	if (!groupMode && (o.hasOwn || filter.gaps)) {
		chips.push({
			key: 'gaps',
			label: w.gaps,
			count: gaps,
			on: !!filter.gaps,
			change: { gaps: filter.gaps ? undefined : '1' }
		});
	}
	return chips;
}

/** The order of the list's group sections: by group name, then by id. A `sort` comparator. */
export function byGroupName(
	a: { team: { id: number; name: string } },
	b: { team: { id: number; name: string } }
): number {
	return a.team.name.localeCompare(b.team.name) || a.team.id - b.team.id;
}

// ---- New position / Edit ----

export const SHEET = lazyWords((c) => c.positions.sheet);

/** A position's fields (New, Edit, the picker's create step): labels and hints. */
export const FIELDS = lazyWords((c) => c.positions.fields);

/** A sheet's request that failed without the server saying why. */
export const SHEET_FAILED = lazyWords((c) => c.positions.failed);

/** A busy button's name, for a screen reader, while its spinner shows. */
export const BUSY = lazyWords((c) => c.positions.busy);

/** Templates' type switch, for a screen reader. */
export const templatePick = (): string => t().positions.templates.pick;

/** An Unlink button's name: "Unlink Point at 1:12 from Manos cruzadas". */
export function unlinkLabel(what: string, from: string): string {
	return t().figure.recordings.unlinkLabel(what, from);
}

/** A position page's link and unlink refusals, read when the refusal is made. */
export const LINK_REFUSED: {
	pickSpot: string;
	pickLesson: string;
	linkGone: string;
	lessonArchived: string;
	already: string;
	lessonGone: string;
} = lazyWords((c) => c.positions.links.refused);

/** A lesson the owner rule refused to link. */
export function notLinked(lesson: string): string {
	return t().positions.links.notLinked(lesson);
}

export function editTitle(name: string): string {
	return t().positions.editTitle(name);
}

/** A spot's video as the picture line names it: the lesson's title, or the recording's figure. */
export function spotVideoLabel(v: SectionVideo): string {
	return v.from.kind === 'lesson' ? v.from.title : t().positions.recording(v.from.figure);
}

/** "From Week 6 · Setenta into Sombrero, video 1 at 1:12" (whole seconds, floored). */
export function pictureLine(videoLabel: string, ms: number): string {
	const s = Math.floor(ms / 1000);
	return t().positions.pictureLine(
		videoLabel,
		`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
	);
}

// ---- Templates ----

export const templatesTitle = (): string => t().positions.templates.title;
/** The list's button into Templates, beside How positions work. */
export const templatesButton = (): string => t().positions.list.templates;
export const youHaveIt = (): string => t().positions.templates.youHaveIt;

// ---- a position's page ----

/**
 * The page's subtitle: "Position · 4 in · 3 out", or "<Group>’ position · …" in a group.
 * `lead` replaces the first part (a copy's "Your copy · from Salsa Tuesdays").
 * The type is drawn on its own line; `styleLabel` is accepted for callers but not used.
 */
export function positionSubtitle(
	_p: PositionSummary,
	opts: { teamName?: string; lead?: string; ins: number; outs: number; styleLabel?: StyleLabel }
): string {
	const w = t().positions;
	const lead = opts.lead ?? (opts.teamName ? w.page.teamPosition(opts.teamName) : w.page.position);
	return `${lead} · ${w.counts.ins(opts.ins)} · ${w.counts.outs(opts.outs)}`;
}

/** A relation line, led by a group's name for a group's figure in a person's app. */
function relationLine(line: string, team?: string | null): string {
	const lead = t().positions.page.team;
	if (team) return line ? `${lead(team)} · ${line}` : lead(team);
	return line ? line[0].toUpperCase() + line.slice(1) : '';
}

/** Names joined " or ". */
const either = (names: string[]): string => names.join(` ${t().positions.tags.or} `);

/**
 * A figure's line in the Figures from here sheet: where it ends ("Ends in
 * Cerrada or Abierta, Son"). A group's figure in a person's app is led by its
 * group ("Salsa Tuesdays’ · ends in …"). No end: nothing, or the group alone.
 */
export function fromMeta(f: { ends: string[]; team?: string | null }): string {
	return relationLine(f.ends.length === 0 ? '' : t().positions.page.endsIn(either(f.ends)), f.team);
}

/** A figure's line in the Figures into here sheet: "From Cerrada", led by its group as above. */
export function intoMeta(f: { starts: string[]; team?: string | null }): string {
	return relationLine(
		f.starts.length === 0 ? '' : t().positions.page.from(either(f.starts)),
		f.team
	);
}

export type PositionRelation = 'from' | 'into' | 'routines';

function relationLabel(key: PositionRelation): string {
	const c = t();
	return key === 'routines' ? c.figure.relations.routines : c.positions.page.relations[key];
}

/**
 * The card of three rows at the page's end (as the figure page's Follows from,
 * Leads to, In routines): each with its count; an empty one reads "None" and
 * does not open.
 */
export function relationRows(c: {
	from: number;
	into: number;
	routines: number;
}): { key: PositionRelation; label: string; count: string; opens: boolean }[] {
	const none = t().figure.relations.none;
	return (['from', 'into', 'routines'] as const).map((key) => ({
		key,
		label: relationLabel(key),
		count: c[key] === 0 ? none : String(c[key]),
		opens: c[key] > 0
	}));
}

/** A row's sheet title: "Figures from here" (its count is on the row), "In 3 routines". */
export function relationTitle(key: PositionRelation, n: number): string {
	return key === 'routines' ? t().figure.relations.inRoutines(n) : relationLabel(key);
}

/** The sheet's New in its title row, for a screen reader: a figure starting (or ending) here. */
export function newFigureLabel(key: 'from' | 'into', name: string): string {
	const w = t().positions.page;
	return key === 'from' ? w.newFrom(name) : w.newInto(name);
}

/**
 * The position page's own ⋯ items, before the copy actions: New figure from
 * here and into here (where a figure of the viewer's may take it), Show on the
 * map (a live position), History (a group's). A null href leaves its item out.
 */
export function positionMenuItems(i: {
	name: string;
	newFrom: string | null;
	newInto: string | null;
	mapHref: string | null;
	historyHref: string | null;
}): MenuItem[] {
	const w = t().positions.page.menu;
	const items: MenuItem[] = [];
	if (i.newFrom)
		items.push({
			key: 'newFrom',
			icon: 'plus',
			label: w.newFrom,
			meta: presetLine({ side: 'start', name: i.name }),
			href: i.newFrom
		});
	if (i.newInto)
		items.push({
			key: 'newInto',
			icon: 'plus',
			label: w.newInto,
			meta: presetLine({ side: 'end', name: i.name }),
			href: i.newInto
		});
	if (i.mapHref) items.push({ key: 'map', icon: 'graph', label: w.map, href: i.mapHref });
	if (i.historyHref)
		items.push({ key: 'history', icon: 'clock', label: w.history, href: i.historyHref });
	return items;
}

/** The note at the top of a group's position, for a reader: where it came from, and what that means. */
export function positionFromLessonNote(lesson: string, team: string): string {
	return t().positions.page.fromLessonNote(lesson, team);
}

/** Under a reader's Edit. */
export const makeMineNote = (): string => t().positions.page.makeMineNote(t().clones.makeMine);

/** An archived position's page: what it says, and its way back. */
export const ARCHIVED: { title: string; body: string; restore: string } = lazyWords(
	(c) => c.positions.page.archived
);

/** New move from a position: the line in the sheet that says which tag it gets. */
export function presetLine(p: { side: 'start' | 'end'; name: string }): string {
	const w = t().positions.preset;
	return p.side === 'start' ? w.starts(p.name) : w.ends(p.name);
}

/** The figures list's params that open New move and preset its tag (ruling 8). */
const PRESET_PARAMS = ['new', 'start', 'end'];

/**
 * The figures list's URL once New move closes: `?new=1&start=…` / `&end=…`
 * gone, so the next + (or a reload) is not tagged; the filter stays. Null
 * when there is nothing to strip.
 */
export function withoutPreset(url: URL): string | null {
	if (!PRESET_PARAMS.some((k) => url.searchParams.has(k))) return null;
	const next = new URLSearchParams(url.searchParams);
	for (const k of PRESET_PARAMS) next.delete(k);
	const qs = next.toString();
	return qs ? `${url.pathname}?${qs}` : url.pathname;
}

/** New move from a position whose position is gone (or no longer theirs) since the link was opened. */
export const presetGone = (): string => t().positions.preset.gone;

export function deadEnd(name: string, n: number): { title: string; body: string; action: string } {
	const w = t().positions.page;
	return { title: w.deadEnd.title, body: w.deadEnd.body(name, n), action: w.newFrom(name) };
}

export function orphan(name: string, n: number): { title: string; body: string; action: string } {
	const w = t().positions.page;
	return { title: w.orphan.title, body: w.orphan.body(name, n), action: w.newInto(name) };
}

/** "Slots 2 → 3" / "Slots 5 → 6 and 9 → 10". */
export function throughMeta(pairs: [number, number][]): string {
	const w = t().positions.page;
	const parts = pairs.map(([a, b]) => `${a} → ${b}`);
	const last = parts.pop();
	if (last === undefined) return '';
	return w.through(pairs.length, `${parts.length ? `${parts.join(', ')} ${w.and} ` : ''}${last}`);
}

/** A point card's second line: its video, and "the picture" when it is the position's. */
export function pointMeta(videoLabel: string, picture: boolean): string {
	return picture ? t().positions.links.picture(videoLabel) : videoLabel;
}

/** A moment as whole seconds, floored: "1:12". */
function wholeTime(ms: number): string {
	const s = Math.floor(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "Point at 1:12" (whole seconds, floored). */
export function pointLabel(ms: number): string {
	return t().positions.links.pointAt(wholeTime(ms));
}

// ---- a position's Video and Lessons ----

/** "Recordings · 3" (sections and points), "Recordings" when there are none: as the figure page's. */
export const recordingsTitle = (n: number): string => {
	const w = t().figure.recordings;
	return n === 0 ? w.title : w.titleCount(n);
};
export const lessonsTitle = (n: number): string => {
	const w = t().positions.links;
	return n === 0 ? w.lessons : w.lessonsCount(n);
};
/** The heading rows' buttons (an editor's): what they show, and their names. */
export const ADD_SPOT: { label: string; aria: string } = lazyWords(
	(c) => c.positions.links.addSpot
);
export const LINK_LESSON: { label: string; aria: string } = lazyWords(
	(c) => c.positions.links.linkLesson
);

/**
 * Where focus goes after an Unlink on the page when no row of that list is left
 * to take it, in order: the list's heading button (an editor's Add or Link),
 * Edit (while the position is live and theirs to edit), the list's heading,
 * then the card of figures (always drawn): a reader who unlinked their own has
 * neither of the first two.
 */
export function unlinkFocus(
	list: 'spot' | 'lesson',
	o: { canLink: boolean; canEditPosition: boolean }
): string[] {
	return [
		...(o.canLink ? [list === 'spot' ? 'link-spot' : 'link-lesson'] : []),
		...(o.canEditPosition ? ['edit-position'] : []),
		list === 'spot' ? 'recordings-heading' : 'lessons-heading',
		'relations'
	];
}

/** "Link to Manos cruzadas": the picker over the owner's sections and points. */
export function linkSpotsTitle(name: string): string {
	return t().positions.links.spotsTitle(name);
}

/** The picker's line under its title: whose videos it offers. */
export function linkSpotsSub(team: string | null): string {
	return t().positions.links.spotsSub(team);
}

export const LINK_SPOTS: { search: string; note: string; none: string } = lazyWords(
	(c) => c.positions.links.spots
);

/**
 * Where a video sits, for the spot picker's titles: a lesson video's number
 * among its lesson's videos (1-based), or the day a recording was made (in
 * the person's zone, `YYYY-MM-DD`).
 */
export type VideoPlace = { n: number } | { day: string };

/** A video's key in a `VideoPlace` map: `v<lessonVideoId>` or `r<recordingId>`. */
export function videoKey(owner: SectionVideo['owner']): string {
	return 'lessonVideoId' in owner ? `v${owner.lessonVideoId}` : `r${owner.recordingId}`;
}

/**
 * A spot picker group's title (the board): "Week 6 · Setenta into Sombrero ·
 * video 1", "Kentucky · Doble · recording 26 Oct". Without its place, the
 * picture line's words ("Week 6", "Recording · Kentucky · Doble").
 */
export function spotGroupTitle(v: SectionVideo, place: VideoPlace | undefined): string {
	const w = t().positions.links;
	if (v.from.kind === 'lesson')
		return place && 'n' in place ? w.lessonVideo(v.from.title, place.n) : v.from.title;
	return place && 'day' in place
		? w.recordingOn(v.from.figure, dayMonth(place.day))
		: spotVideoLabel(v);
}

/**
 * The spot picker's groups: one per video (`spotGroupTitle`), its spots in
 * the order the server gives. A section reads "The cross on 7 / Section ·
 * 1:12.0–1:31.0" (an unnamed one is its range, "Section, no name") and
 * previews looping; a point reads "Point at 1:12 / Point" (a named one,
 * "Hands meet / Point at 0:15"). The search also matches the time and the video.
 */
export function spotPickGroups(
	groups: SectionGroup[],
	places: Record<string, VideoPlace> = {}
): PickGroup[] {
	const w = t().positions.links;
	return groups.map((g) => {
		const title = spotGroupTitle(g.video, places[videoKey(g.video.owner)]);
		return {
			title,
			entries: g.sections.map((s): PickRow => {
				const range = spotLabel({ ...s, label: null });
				const point = s.endMs === null;
				const [label, meta] = point
					? s.label
						? [s.label, pointLabel(s.startMs)]
						: [pointLabel(s.startMs), w.point]
					: s.label
						? [s.label, w.section(range)]
						: [range, w.sectionNoName];
				return {
					key: `spot:${s.id}`,
					value: s.id,
					label,
					meta,
					keywords: `${range} ${title}`,
					linked: s.linked,
					preview: !point
				};
			})
		};
	});
}

/**
 * A lesson row's line on the page: "Salsa Tuesdays · 3 Nov" for a group's, the
 * full day for a person's ("Tuesday 13 October", the board's, no comma).
 */
export function lessonMeta(l: { teamName: string | null; lessonDay: string }): string {
	return l.teamName ? `${l.teamName} · ${dayMonth(l.lessonDay)}` : weekdayDayMonth(l.lessonDay);
}

/** "Lessons with Manos cruzadas": the picker over the owner's lessons. */
export function lessonPickTitle(name: string): string {
	return t().positions.links.lessonsTitle(name);
}

export const LESSON_PICK: { sub: string; search: string; none: string } = lazyWords(
	(c) => c.positions.links.lessonPick
);

/** A lesson the picker offers: `linked` by hand or through a section or point (`via`). */
export interface LessonPick {
	id: number;
	title: string;
	lessonDay: string;
	videos: number;
	/** Its group's name, when the page names groups; else null. */
	team: string | null;
	linked: boolean;
	via: boolean;
}

/**
 * The lesson picker's month groups, newest first as given: "November", with
 * the year only when it is not `today`'s. A row's meta is its group, its day
 * ("Tue 3 Nov", its year when not this one), then "through a section" for one
 * that reaches the position through its videos (and so shows linked), else
 * "2 videos" when it has more than one.
 */
export function lessonPickGroups(lessons: LessonPick[], today: string): PickGroup[] {
	const c = t();
	const groups: PickGroup[] = [];
	let month = '';
	for (const l of lessons) {
		const key = l.lessonDay.slice(0, 7);
		if (key !== month || groups.length === 0) {
			month = key;
			groups.push({ title: monthHeading(l.lessonDay, today), entries: [] });
		}
		const meta = [
			l.team,
			classDayLabel(l.lessonDay, today),
			l.via ? c.positions.links.throughSection : l.videos > 1 ? c.nouns.videos(l.videos) : null
		]
			.filter(Boolean)
			.join(' · ');
		groups[groups.length - 1].entries.push({
			key: `lesson:${l.id}`,
			value: l.id,
			label: l.title,
			meta,
			linked: l.linked
		});
	}
	return groups;
}

/** A point card whose video cannot play: what happened. */
export const POINT_PROBLEM: Record<'missing' | 'unplayable', { title: string; body: string }> =
	lazyWords((c) => c.positions.links.problem);

/** A point card's play button, for a screen reader: "Play from 1:12". */
export function playFrom(ms: number): string {
	return t().positions.links.playFrom(wholeTime(ms));
}

// ---- How positions work ----

/** Rows of [start, figure, end]; an empty start draws no start. Dance terms: the same in every language. */
const HOW_EXAMPLE: [string, string, string][] = [
	['Cerrada', 'Dile que no', 'Abierta'],
	['', 'Enchufla', 'Abierta']
];

export const HOW: {
	/** Rows of [start, figure, end]; an empty start draws no start (the figure has only an end). */
	example: [string, string, string][];
	sections: { title: string; body: string }[];
	done: string;
} = lazyWords((c) => ({
	example: HOW_EXAMPLE,
	sections: c.positions.how.sections,
	done: c.positions.how.done
}));

/** The example strip, for a screen reader. */
export const howExampleLabel = (): string => t().positions.how.exampleLabel;

/** Under How positions work where it fills the pane beside an empty list (desktop). */
export const howPaneSubtitle = (): string => t().positions.how.paneSubtitle;

// ---- templates ----

export function templatesNote(typeLabel: string): string {
	return t().positions.templates.note(typeLabel);
}

export function addLabel(n: number): string {
	return t().positions.templates.add(n);
}

// ---- the figure's tags ----

export const tagsEmpty = (): string => t().positions.tags.empty;

export const tagsHelp = (): string => t().positions.tags.help;

/** The picker's group of the figure's own type: "Salsa · this figure’s type". */
export function figureTypeTitle(type: string): string {
	return t().positions.tags.figureType(type);
}

/** A group's position in a person's picker: "Salsa · tag with it as it is". */
export function tagAsItIs(type: string): string {
	return t().positions.tags.asItIs(type);
}

/** The picker's clearing row. */
export const TAGS_CLEAR: { label: string; meta: string } = lazyWords((c) => c.positions.tags.clear);

/** The two pickers' words; `sub` is "Enchufla · Doble · Salsa". */
export const TAGS_PICKER = lazyWords((c) => c.positions.tags.picker);

/** The create step's line under New position. */
export const tagsNewSub = (): string => t().positions.tags.newSub;

/** A create step that failed without the server saying why. */
export const tagsCreateFailed = (): string => t().positions.tags.createFailed;

export function tagsSub(figureLabel: string, type: string | null): string {
	return type ? `${figureLabel} · ${type}` : figureLabel;
}

/** The figure page's handholds line: starts and ends joined " or "; none reads "No position". */
export function handholds(starts: string[], ends: string[]): { from: string; to: string } {
	const none = t().positions.tags.none;
	const join = (xs: string[]) => (xs.length === 0 ? none : either(xs));
	return { from: join(starts), to: join(ends) };
}

/** A sibling's handholds on one line: "Cerrada or Manos cruzadas → Caída"; none at all, "No position". */
export function holdsLine(starts: string[], ends: string[]): string {
	if (starts.length === 0 && ends.length === 0) return t().positions.tags.none;
	const h = handholds(starts, ends);
	return `${h.from} → ${h.to}`;
}

// ---- the map ----

export const MAP: {
	title: string;
	hint: string;
	back: string;
	legend: { deadEnd: string; orphan: string; island: string; size: string };
	notOnMap: string;
	fitsAnywhere: string;
	islands: string;
	/** No positions at all. */
	empty: string;
	/** Positions, but no figure joins any of them. */
	unjoined: string;
	reset: string;
	/** Under a node that stands for twinned positions (Same as…): the lists' chip. */
	twins: string;
} = lazyWords((c) => {
	const w = c.positions.map;
	return {
		title: w.title,
		hint: w.hint,
		back: c.shell.backTo(c.moves.segments.positions),
		legend: w.legend,
		notOnMap: w.notOnMap,
		fitsAnywhere: w.fitsAnywhere,
		islands: w.islands,
		empty: w.empty,
		unjoined: w.unjoined,
		reset: w.reset,
		twins: twinsChip()
	};
});

/** The SVG's name for a screen reader. */
export function mapLabelFor(groupMode: boolean): string {
	const w = t().positions.map.label;
	return groupMode ? w.group : w.own;
}

/**
 * "15 positions · 32 figures between them · 10 with none · 4 stranded": figures
 * between them have a start and an end; with none counts every figure the map
 * draws no arrow for (no position, or only a start or only an end), the same
 * count as the tray's No position chip, the list's No position row and
 * /positions/none; stranded positions are dead ends, orphans and islands. Zero
 * parts after the first are left out.
 */
export function mapSummary(n: {
	positions: number;
	between: number;
	none: number;
	stranded: number;
}): string {
	const c = t();
	const w = c.positions.map;
	const parts = [c.nouns.positions(n.positions)];
	if (n.between > 0) parts.push(w.between(n.between));
	if (n.none > 0) parts.push(w.withNone(n.none));
	if (n.stranded > 0) parts.push(w.stranded(n.stranded));
	return parts.join(' · ');
}

/**
 * A position's accessible name on the map: "Cerrada · 6 in · 8 out", then its
 * mark, then its twins line (`mapTwinsLine`) when it stands for twins.
 */
export function mapNodeName(n: {
	name: string;
	ins: number;
	outs: number;
	mark: MapMark | null;
	twins: string | null;
}): string {
	const w = t().positions;
	const parts = [n.name, w.counts.ins(n.ins), w.counts.outs(n.outs)];
	if (n.mark) parts.push(markWord(n.mark));
	if (n.twins) parts.push(n.twins);
	return parts.join(' · ');
}

/**
 * Who a twinned node stands for (ruling 16), each by its place, in the order
 * given: "Twins: your Cerrada, Salsa Tuesdays’ Closed". The node's tooltip.
 */
export function mapTwinsLine(members: { name: string; team: TeamRef | null }[]): string {
	const w = t().positions.map;
	const each = members.map((m) => (m.team ? w.teamTwin(m.team.name, m.name) : w.yourTwin(m.name)));
	return `${twinsChip()}: ${each.join(', ')}`;
}

/** The tray's way into No position. */
export function noPositionChip(n: number): string {
	return t().positions.map.noPositionChip(n);
}

/** An unused position in the tray. */
export function unusedChip(name: string): string {
	return t().positions.map.unusedChip(name);
}

/** Under the map while a position is lit. */
export function mapLitLine(name: string): string {
	return t().positions.map.litLine(name);
}

/** A link or unlink posted to an archived position's page (another tab, a replay). */
export const archivedLinksLine = (): string => t().positions.links.archived;
