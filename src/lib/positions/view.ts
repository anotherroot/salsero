/** Every positions screen's words: PURE, client-safe. Strings come from the design boards. */
import { plural } from '$lib/format';
import type { PositionListRow, PositionSummary, SectionVideo } from '$lib/types';

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
	word: 'dead end' | 'orphan' | 'island' | 'unused' | null;
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

/**
 * The chip row: All · a chip per type · Gaps N (the person's own report: not
 * in group mode). A type is single-valued: the on one clears, another
 * replaces. All clears both; no chip drops the search.
 */
export function positionChips(
	filter: PositionFilter,
	types: readonly string[],
	typeLabel: Record<string, string>,
	gaps: number,
	groupMode: boolean
): PositionChip[] {
	const chips: PositionChip[] = [
		{
			key: 'all',
			label: 'All',
			on: !filter.type && !filter.gaps,
			change: { type: undefined, gaps: undefined }
		},
		...types.map((t) => ({
			key: `type:${t}`,
			label: typeLabel[t] ?? t,
			on: filter.type === t,
			change: { type: filter.type === t ? undefined : t }
		}))
	];
	if (!groupMode) {
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
	const lead =
		opts.lead ??
		(opts.teamName
			? `${opts.teamName}${opts.teamName.endsWith('s') ? '’' : '’s'} position`
			: 'Position');
	return `${lead} · ${opts.ins} in · ${opts.outs} out`;
}

const possessive = (team: string) => (team.endsWith('s') ? `${team}’` : `${team}’s`);

/**
 * "Son → ends in Abierta (dos manos), Salsa": `ends` are the positions as named
 * (with their type if it differs). A group's figure in a person's app is led by
 * its group ("Salsa Tuesdays’ · ends in …"); an empty `style` leads with nothing.
 */
export function figureFromRow(f: {
	label: string;
	style: string;
	ends: string[];
	team?: string | null;
}): string {
	const lead = f.team ? possessive(f.team) : f.style;
	if (f.ends.length === 0) return lead;
	const ends = `ends in ${f.ends.join(' or ')}`;
	if (!lead) return ends;
	return f.team ? `${lead} · ${ends}` : `${lead} → ${ends}`;
}

/** "from Cerrada, Salsa"; an empty `style` leaves the type out; a group's figure is led by its group. */
export function figureIntoRow(f: {
	label: string;
	starts: string[];
	style: string;
	team?: string | null;
}): string {
	const from = `from ${f.starts.join(' or ')}`;
	const row = f.style ? `${from}, ${f.style}` : from;
	return f.team ? `${possessive(f.team)} · ${row}` : row;
}

/** The note at the top of a group's position, for a reader: where it came from, and what that means. */
export function positionFromLessonNote(lesson: string, team: string): string {
	return `From ${lesson}. Tag your figures with it as it is; it stays ${possessive(team)}.`;
}

/** Under a reader's Edit. */
export const MAKE_MINE_NOTE =
	'Edit makes it yours (Make it mine); your figures tagged with it move over.';

export const fromTitle = (n: number) => `Figures from here · ${n}`;
export const intoTitle = (n: number) => `Figures into here · ${n}`;
export const routinesTitle = (n: number) => `In routines · ${n}`;
export const NONE_YET = 'None yet.';
/** "+ New" beside Figures from here. */
export const NEW_FIGURE = 'New';

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

export function moreLine(n: number): string {
	return `and ${n} more`;
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

/** The figure page's handholds line: starts and ends joined " or "; none reads "No position". */
export function handholds(starts: string[], ends: string[]): { from: string; to: string } {
	const join = (xs: string[]) => (xs.length === 0 ? 'No position' : xs.join(' or '));
	return { from: join(starts), to: join(ends) };
}
