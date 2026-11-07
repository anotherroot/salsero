/** Every positions screen's words: PURE, client-safe. Strings come from the design boards. */
import { classDayLabel, dayMonth, monthHeading, plural, weekdayDayMonth } from '$lib/format';
import { spotLabel } from '$lib/video/spots';
import type { PickGroup, PickRow } from '$lib/picker/model';
import type {
	PositionListRow,
	PositionSummary,
	SectionGroup,
	SectionVideo,
	TeamRef
} from '$lib/types';
import { TWINS_CHIP } from '$lib/clones/twins';
import { possessive } from '$lib/clones/view';
import type { MenuItem } from '$lib/menu';

export { holdChips } from './hold';

/** The label of a style tag; null (no type) reads as "Other". */
export type StyleLabel = (tag: string | null) => string;

const NUMBER_WORDS = [
	'Zero',
	'One',
	'Two',
	'Three',
	'Four',
	'Five',
	'Six',
	'Seven',
	'Eight',
	'Nine'
];
function capNumber(n: number): string {
	return NUMBER_WORDS[n] ?? String(n);
}

// ---- the list ----

export function taggedLine(t: { done: number; total: number }): string {
	return `${t.done} of ${t.total} figures have positions.`;
}

export const OPTIONAL_LINE =
	'Positions are optional: a figure without one fits anywhere in a routine.';

/**
 * A row's second line. A gap's word (dead end, orphan, island) is drawn after the text;
 * dead end and orphan are danger-toned, an island is not. Unused is part of the text.
 */
export function rowMeta(
	r: PositionListRow,
	styleLabel: StyleLabel
): {
	text: string;
	word: 'dead end' | 'orphan' | 'island' | null;
	tone: 'danger' | null;
} {
	const parts = [styleLabel(r.styleTag)];
	if (r.unused) {
		parts.push('unused');
		return { text: parts.join(' · '), word: null, tone: null };
	}
	if (r.inCount > 0) parts.push(`${r.inCount} in`);
	if (r.outCount > 0) parts.push(`${r.outCount} out`);
	const text = parts.join(' · ');
	if (r.deadEnd) return { text: `${text} ·`, word: 'dead end', tone: 'danger' };
	if (r.orphan) return { text: `${text} ·`, word: 'orphan', tone: 'danger' };
	if (r.island) return { text: `${text} ·`, word: 'island', tone: null };
	return { text, word: null, tone: null };
}

/** A group's row: "Salsa · from Week 6". */
export function groupRowMeta(r: PositionListRow, styleLabel: StyleLabel): string {
	const type = styleLabel(r.styleTag);
	return r.from ? `${type} · from ${r.from}` : type;
}

export function noPositionRow(n: number): { title: 'No position'; meta: string } {
	return { title: 'No position', meta: `${plural(n, 'figure', 'figures')} · they fit anywhere` };
}

export function noPositionHead(n: { none: number; onlyStart: number; onlyEnd: number }): string {
	return `${plural(n.none + n.onlyStart + n.onlyEnd, 'figure', 'figures')} · ${n.none} with none, ${n.onlyStart + n.onlyEnd} with only a start or an end`;
}

export const FITS_ANYWHERE = {
	title: 'Fits anywhere',
	body: 'A figure with no position can follow anything and lead into anything: the routine editor offers it everywhere and never marks a break for it.'
} as const;

/** The No position page's groups (empty ones left out): no start and no end, only an end, only a start. */
export function noPositionGroups(ids: {
	none: number[];
	onlyStart: number[];
	onlyEnd: number[];
}): { title: string; ids: number[] }[] {
	const groups = [
		{ title: 'No start and no end', ids: ids.none },
		{ title: 'Only an end', ids: ids.onlyEnd },
		{ title: 'Only a start', ids: ids.onlyStart }
	];
	return groups
		.filter((g) => g.ids.length > 0)
		.map((g) => ({ title: `${g.title} · ${g.ids.length}`, ids: g.ids }));
}

/** The tag a half-tagged figure row shows: "ends in A, B" / "starts in A". */
export function noPositionTag(side: 'start' | 'end', names: string[]): string {
	return `${side === 'end' ? 'ends in' : 'starts in'} ${names.join(', ')}`;
}

/** "Salsa · starts on 1 · 8 counts · 1 recording": the type, then what the figure row says. */
export function noPositionMeta(
	type: string,
	f: { startCount: number | null; lengthCounts: number | null; recordings: number }
): string {
	const parts = [type];
	if (f.startCount !== null) parts.push(`starts on ${f.startCount}`);
	if (f.lengthCounts !== null) parts.push(plural(f.lengthCounts, 'count', 'counts'));
	if (f.recordings > 0) parts.push(plural(f.recordings, 'recording', 'recordings'));
	return parts.join(' · ');
}

/** The line under the Fits anywhere card when no figure is missing a position. */
export const NO_POSITION_EMPTY = 'Every figure has a position on both sides.';

export const EMPTY = {
	title: 'No positions yet',
	body: 'Start from a template’s rough positions, or make your own.'
} as const;

/** The first-run (wide) body, which counts the figures. */
export function firstRunBody(figures: number): string {
	return `Your ${figures} figures have none, and that is fine: they fit anywhere. Add positions when you want routines checked for what can follow what.`;
}

export const GROUP_NOTE = 'The group’s own positions. Its figures can only be tagged with these.';

/** The empty state's three buttons. */
export const EMPTY_ACTIONS = {
	templates: 'Start from a template',
	create: 'New position',
	how: 'How positions work'
} as const;

/** The label over the list: the person's own as "Yours · 15"; a group's (group mode) by count. */
export function listHeading(n: number, groupMode: boolean): string {
	return groupMode ? plural(n, 'position', 'positions') : `Yours · ${n}`;
}

/** The row into the map, under No position. */
export const MAP_ROW = 'The map';

/** A search or a chip that leaves nothing. */
export const NO_MATCH = 'No positions match';

/** Only a group's positions so far: the person's own list starts here. */
export const NONE_OWN = 'No positions of your own yet.';

/** A type's label; an untyped position reads as "Other". */
export function styleLabelOf(labels: Record<string, string>): StyleLabel {
	return (tag) => (tag === null ? 'Other' : (labels[tag] ?? tag));
}

/** The list's filter, as the URL carries it: the search is always a string, the rest only when set. */
export type PositionFilter = { q: string; type?: string; gaps?: '1' };

export type PositionChip = {
	key: string;
	label: string;
	count?: number;
	on: boolean;
	/** What tapping it does to the filter. Never touches `q`. */
	change: Partial<PositionFilter>;
};

const FILTER_KEYS = ['q', 'type', 'gaps'] as const;

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
	const types =
		!o.types.includes(OTHER_TYPE) && (o.untyped || filter.type === OTHER_TYPE)
			? [...o.types, OTHER_TYPE]
			: o.types;
	const chips: PositionChip[] = [
		{
			key: 'all',
			label: 'All',
			on: !filter.type && !filter.gaps,
			change: { type: undefined, gaps: undefined }
		},
		...types.map((t) => ({
			key: `type:${t}`,
			label: o.typeLabel[t] ?? (t === OTHER_TYPE ? 'Other' : t),
			on: filter.type === t,
			change: { type: filter.type === t ? undefined : t }
		}))
	];
	const { gaps, groupMode } = o;
	if (!groupMode && (o.hasOwn || filter.gaps)) {
		chips.push({
			key: 'gaps',
			label: 'Gaps',
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

export const SHEET = {
	newTitle: 'New position',
	newSub: 'Type starts as your “New figures” type (Settings)',
	add: 'Add position',
	save: 'Save',
	typeHelp: 'One, the same list as a figure’s type.',
	crossed: 'Right hands on top',
	archive: 'Archive position',
	archiveBody:
		'Archived like a figure: Restore brings it back. Its figures lose it and, with no other, have no position.',
	picture: 'Picture',
	change: 'Change',
	pictureLegend: 'Its points'
} as const;

/** A position's fields (New, Edit, the picker's create step): labels and hints. */
export const FIELDS = {
	name: 'Name',
	namePlaceholder: 'e.g. Cerrada, Manos cruzadas',
	type: 'Type',
	hands: 'Hands',
	crossed: 'Crossed',
	facing: 'Facing',
	frame: 'Frame',
	notes: 'Notes',
	notesPlaceholder: 'How the hands meet, where the weight is…'
} as const;

/** A sheet's request that failed without the server saying why. */
export const SHEET_FAILED = {
	save: 'That did not save. Try again.',
	archive: 'That did not archive. Try again.',
	templates: 'Those were not added. Try again.'
} as const;

/** A busy button's name, for a screen reader, while its spinner shows. */
export const BUSY = {
	adding: 'Adding position',
	addingMany: 'Adding positions',
	saving: 'Saving',
	archiving: 'Archiving position'
} as const;

/** Templates' type switch, for a screen reader. */
export const TEMPLATE_PICK = 'Template';

/** An Unlink button's name: "Unlink Point at 1:12 from Manos cruzadas". */
export function unlinkLabel(what: string, from: string): string {
	return `Unlink ${what} from ${from}`;
}

/** A position page's link and unlink refusals. */
export const LINK_REFUSED = {
	pickSpot: 'Pick a section or point.',
	pickLesson: 'Pick a lesson.',
	linkGone: 'That link was already removed.',
	lessonArchived: 'That lesson is archived.',
	already: 'Already linked.',
	lessonGone: 'That lesson was already unlinked.'
} as const;

/** A lesson the owner rule refused to link. */
export function notLinked(lesson: string): string {
	return `${lesson} could not be linked.`;
}

export function editTitle(name: string): string {
	return `Edit ${name}`;
}

/** A spot's video as the picture line names it: the lesson's title, or the recording's figure. */
export function spotVideoLabel(v: SectionVideo): string {
	return v.from.kind === 'lesson' ? v.from.title : `Recording · ${v.from.figure}`;
}

/** "From Week 6 · Setenta into Sombrero, video 1 at 1:12" (whole seconds, floored). */
export function pictureLine(videoLabel: string, ms: number): string {
	const s = Math.floor(ms / 1000);
	return `From ${videoLabel} at ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- Templates ----

export const TEMPLATES_TITLE = 'Start from a template';
/** The list's button into Templates, beside How positions work. */
export const TEMPLATES_BUTTON = 'Templates';
export const YOU_HAVE_IT = 'You have it';

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
	const lead = opts.lead ?? (opts.teamName ? `${possessive(opts.teamName)} position` : 'Position');
	return `${lead} · ${opts.ins} in · ${opts.outs} out`;
}

/** A relation line, led by a group's name for a group's figure in a person's app. */
function relationLine(line: string, team?: string | null): string {
	if (team) return line ? `${possessive(team)} · ${line}` : possessive(team);
	return line ? line[0].toUpperCase() + line.slice(1) : '';
}

/**
 * A figure's line in the Figures from here sheet: where it ends ("Ends in
 * Cerrada or Abierta, Son"). A group's figure in a person's app is led by its
 * group ("Salsa Tuesdays’ · ends in …"). No end: nothing, or the group alone.
 */
export function fromMeta(f: { ends: string[]; team?: string | null }): string {
	return relationLine(f.ends.length === 0 ? '' : `ends in ${f.ends.join(' or ')}`, f.team);
}

/** A figure's line in the Figures into here sheet: "From Cerrada", led by its group as above. */
export function intoMeta(f: { starts: string[]; team?: string | null }): string {
	return relationLine(f.starts.length === 0 ? '' : `from ${f.starts.join(' or ')}`, f.team);
}

export type PositionRelation = 'from' | 'into' | 'routines';

const RELATION_LABEL: Record<PositionRelation, string> = {
	from: 'Figures from here',
	into: 'Figures into here',
	routines: 'In routines'
};

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
	return (['from', 'into', 'routines'] as const).map((key) => ({
		key,
		label: RELATION_LABEL[key],
		count: c[key] === 0 ? 'None' : String(c[key]),
		opens: c[key] > 0
	}));
}

/** A row's sheet title: "Figures from here" (its count is on the row), "In 3 routines". */
export function relationTitle(key: PositionRelation, n: number): string {
	return key === 'routines' ? `In ${plural(n, 'routine', 'routines')}` : RELATION_LABEL[key];
}

/** The sheet's New in its title row, for a screen reader: a figure starting (or ending) here. */
export function newFigureLabel(key: 'from' | 'into', name: string): string {
	return `New figure ${key} ${name}`;
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
	const items: MenuItem[] = [];
	if (i.newFrom)
		items.push({
			key: 'newFrom',
			icon: 'plus',
			label: 'New figure from here',
			meta: presetLine({ side: 'start', name: i.name }),
			href: i.newFrom
		});
	if (i.newInto)
		items.push({
			key: 'newInto',
			icon: 'plus',
			label: 'New figure into here',
			meta: presetLine({ side: 'end', name: i.name }),
			href: i.newInto
		});
	if (i.mapHref)
		items.push({ key: 'map', icon: 'graph', label: 'Show on the map', href: i.mapHref });
	if (i.historyHref)
		items.push({ key: 'history', icon: 'clock', label: 'History', href: i.historyHref });
	return items;
}

/** The note at the top of a group's position, for a reader: where it came from, and what that means. */
export function positionFromLessonNote(lesson: string, team: string): string {
	return `From ${lesson}. Tag your figures with it as it is; it stays ${possessive(team)}.`;
}

/** Under a reader's Edit. */
export const MAKE_MINE_NOTE =
	'Edit makes it yours (Make it mine); your figures tagged with it move over.';

/** An archived position's page: what it says, and its way back. */
export const ARCHIVED = {
	title: 'Archived',
	body: 'Its figures no longer show it. Restore brings it back.',
	restore: 'Restore'
} as const;

/** New move from a position: the line in the sheet that says which tag it gets. */
export function presetLine(p: { side: 'start' | 'end'; name: string }): string {
	return `${p.side === 'start' ? 'Starts in' : 'Ends in'} ${p.name}`;
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
export const PRESET_GONE =
	'That position can no longer tag a figure here. Add the move without it.';

export function deadEnd(
	name: string,
	n: number
): { title: 'Dead end'; body: string; action: string } {
	return {
		title: 'Dead end',
		body: `${capNumber(n)} ${n === 1 ? 'figure ends' : 'figures end'} in ${name} and nothing you know leaves it. A routine that gets here stops.`,
		action: `New figure from ${name}`
	};
}

export function orphan(name: string, n: number): { title: 'Orphan'; body: string; action: string } {
	return {
		title: 'Orphan',
		body: `${capNumber(n)} ${n === 1 ? 'figure leaves' : 'figures leave'} ${name} and nothing you know ends in it.`,
		action: `New figure into ${name}`
	};
}

/** "Slots 2 → 3" / "Slots 5 → 6 and 9 → 10". */
export function throughMeta(pairs: [number, number][]): string {
	const parts = pairs.map(([a, b]) => `${a} → ${b}`);
	const last = parts.pop();
	if (last === undefined) return '';
	return `Slots ${parts.length ? `${parts.join(', ')} and ` : ''}${last}`;
}

/** A point card's second line: its video, and "the picture" when it is the position's. */
export function pointMeta(videoLabel: string, picture: boolean): string {
	return picture ? `${videoLabel} · the picture` : videoLabel;
}

/** "Point at 1:12" (whole seconds, floored). */
export function pointLabel(ms: number): string {
	const s = Math.floor(ms / 1000);
	return `Point at ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- a position's Video and Lessons ----

/** "Recordings · 3" (sections and points), "Recordings" when there are none: as the figure page's. */
export const recordingsTitle = (n: number) => (n === 0 ? 'Recordings' : `Recordings · ${n}`);
export const lessonsTitle = (n: number) => (n === 0 ? 'Lessons' : `Lessons · ${n}`);
/** The heading rows' buttons (an editor's): what they show, and their names. */
export const ADD_SPOT = { label: 'Add', aria: 'Add a section or point to Recordings' } as const;
export const LINK_LESSON = { label: 'Link', aria: 'Link a lesson' } as const;

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
	return `Link to ${name}`;
}

/** The picker's line under its title: whose videos it offers. */
export function linkSpotsSub(team: string | null): string {
	return `Sections and points of ${team ? possessive(team) : 'your'} lessons and recordings`;
}

export const LINK_SPOTS = {
	search: 'Search lessons, recordings, sections',
	note: 'A section loops; a point is one moment, and can be the picture.',
	none: 'No sections or points yet. Open a lesson video or a recording full screen and mark one.'
} as const;

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
	if (v.from.kind === 'lesson')
		return place && 'n' in place ? `${v.from.title} · video ${place.n}` : v.from.title;
	return place && 'day' in place
		? `${v.from.figure} · recording ${dayMonth(place.day)}`
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
						: [pointLabel(s.startMs), 'Point']
					: s.label
						? [s.label, `Section · ${range}`]
						: [range, 'Section, no name'];
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
	return `Lessons with ${name}`;
}

export const LESSON_PICK = {
	sub: 'A lesson linked here shows the position on its page too',
	search: 'Search lessons',
	none: 'No lessons yet. Add one from Lessons.'
} as const;

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
			l.via ? 'through a section' : l.videos > 1 ? plural(l.videos, 'video', 'videos') : null
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
export const POINT_PROBLEM = {
	missing: { title: 'This file is missing', body: 'The server has no file for this video.' },
	unplayable: {
		title: 'Can’t play here',
		body: 'This browser can’t play this file. Open it on your phone.'
	}
} as const;

/** A point card's play button, for a screen reader: "Play from 1:12". */
export function playFrom(ms: number): string {
	return pointLabel(ms).replace('Point at', 'Play from');
}

// ---- How positions work ----

export const HOW: {
	/** Rows of [start, figure, end]; an empty start draws no start (the figure has only an end). */
	example: [string, string, string][];
	sections: { title: string; body: string }[];
	done: 'Got it';
} = {
	example: [
		['Cerrada', 'Dile que no', 'Abierta'],
		['', 'Enchufla', 'Abierta']
	],
	sections: [
		{
			title: 'What is a position?',
			body: 'How the two of you hold each other between figures: open with two hands, closed, crossed hands, a hammerlock, side by side.'
		},
		{
			title: 'Why tag figures with them?',
			body: 'Every figure starts in a position and ends in one. That tells the app what can follow what: the routine editor offers only what fits, and the map shows where you get stuck.'
		},
		{
			title: 'Types',
			body: 'Give each one a type, the same as a figure’s: Salsa, Son, Timba. When you tag a figure, positions of its type come first; a figure can still go from one type to another.'
		},
		{
			title: 'Optional',
			body: 'A figure has no position until you give it one, and then it fits anywhere: the routine editor checks nothing for it. Use positions if they help you; leave them out if they don’t.'
		},
		{
			title: 'Where to start',
			body: 'Add a template’s rough positions and rename or change them as you go, or make your own. Groups have their own, like figures, and you can copy them.'
		}
	],
	done: 'Got it'
};

/** The example strip, for a screen reader. */
export const HOW_EXAMPLE_LABEL = 'A position, a figure, the next position';

/** Under How positions work where it fills the pane beside an empty list (desktop). */
export const HOW_PANE_SUBTITLE = 'Optional: read once, then decide';

// ---- templates ----

export function templatesNote(typeLabel: string): string {
	return `Rough positions to start from: rename, change or remove them later. They get the type ${typeLabel}. What you already have by name is skipped.`;
}

export function addLabel(n: number): string {
	return `Add ${plural(n, 'position', 'positions')}`;
}

// ---- the figure's tags ----

export const tagsEmpty = 'No position · fits anywhere';

export const TAGS_HELP =
	'Any number of each. In a routine, the next figure fits when it starts in any of these ends.';

/** The picker's group of the figure's own type: "Salsa · this figure’s type". */
export function figureTypeTitle(type: string): string {
	return `${type} · this figure’s type`;
}

/** A group's position in a person's picker: "Salsa · tag with it as it is". */
export function tagAsItIs(type: string): string {
	return `${type} · tag with it as it is`;
}

/** The picker's clearing row. */
export const TAGS_CLEAR = { label: 'No position', meta: 'Fits anywhere · the default' } as const;

/** The two pickers' words; `sub` is "Enchufla · Doble · Salsa". */
export const TAGS_PICKER = {
	starts: 'Starts in',
	ends: 'Ends in',
	search: 'Search positions',
	create: 'Position',
	nothingLeft: 'No positions yet.'
} as const;

/** The create step's line under New position. */
export const TAGS_NEW_SUB = 'Its type starts as this figure’s.';

/** A create step that failed without the server saying why. */
export const TAGS_CREATE_FAILED = 'That could not be created. Try it again.';

export function tagsSub(figureLabel: string, type: string | null): string {
	return type ? `${figureLabel} · ${type}` : figureLabel;
}

/** The figure page's handholds line: starts and ends joined " or "; none reads "No position". */
export function handholds(starts: string[], ends: string[]): { from: string; to: string } {
	const join = (xs: string[]) => (xs.length === 0 ? 'No position' : xs.join(' or '));
	return { from: join(starts), to: join(ends) };
}

/** A sibling's handholds on one line: "Cerrada or Manos cruzadas → Caída"; none at all, "No position". */
export function holdsLine(starts: string[], ends: string[]): string {
	if (starts.length === 0 && ends.length === 0) return 'No position';
	const h = handholds(starts, ends);
	return `${h.from} → ${h.to}`;
}

// ---- the map ----

export const MAP = {
	title: 'The map',
	hint: 'Pinch to zoom, tap a position to light its figures.',
	back: 'Back to Positions',
	legend: {
		deadEnd: 'dead end: nothing leaves',
		orphan: 'orphan: nothing gets there',
		island: 'island: cut off from the rest',
		size: 'Bigger: more figures · arrows: how many'
	},
	notOnMap: 'Not on the map',
	fitsAnywhere: 'Figures without a position fit anywhere.',
	islands: 'Islands · cut off from the rest',
	/** No positions at all. */
	empty: 'No positions yet. Add some on Positions and tag your figures’ starts and ends.',
	/** Positions, but no figure joins any of them. */
	unjoined: 'Nothing joins your positions yet: tag a figure’s start and end.',
	reset: 'Reset zoom',
	/** Under a node that stands for twinned positions (Same as…): the lists' chip. */
	twins: TWINS_CHIP
} as const;

/** The SVG's name for a screen reader. */
export function mapLabelFor(groupMode: boolean): string {
	return groupMode ? 'The map of the group’s positions' : 'The map of your positions';
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
	const parts = [plural(n.positions, 'position', 'positions')];
	if (n.between > 0) parts.push(`${plural(n.between, 'figure', 'figures')} between them`);
	if (n.none > 0) parts.push(`${n.none} with none`);
	if (n.stranded > 0) parts.push(`${n.stranded} stranded`);
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
	mark: 'dead end' | 'orphan' | null;
	twins: string | null;
}): string {
	const parts = [n.name, `${n.ins} in`, `${n.outs} out`];
	if (n.mark) parts.push(n.mark);
	if (n.twins) parts.push(n.twins);
	return parts.join(' · ');
}

/**
 * Who a twinned node stands for (ruling 16), each by its place, in the order
 * given: "Twins: your Cerrada, Salsa Tuesdays’ Closed". The node's tooltip.
 */
export function mapTwinsLine(members: { name: string; team: TeamRef | null }[]): string {
	const each = members.map((m) =>
		m.team ? `${possessive(m.team.name)} ${m.name}` : `your ${m.name}`
	);
	return `${TWINS_CHIP}: ${each.join(', ')}`;
}

/** The tray's way into No position. */
export function noPositionChip(n: number): string {
	return `No position · ${plural(n, 'figure', 'figures')}`;
}

/** An unused position in the tray. */
export function unusedChip(name: string): string {
	return `${name} · no figures`;
}

/** Under the map while a position is lit. */
export function mapLitLine(name: string): string {
	return `${name} · tap again to open`;
}

/** A link or unlink posted to an archived position's page (another tab, a replay). */
export const ARCHIVED_LINKS = 'This position is archived. Restore it to change its links.';
