/**
 * The Link popup's levels. PURE and client-safe.
 */
import type { LinkCreateField, LinkOptions, LinkTarget } from '$lib/types';
import { MAX_SPOT_LABEL } from '$lib/limits';
import { lengthText, spotTime } from '$lib/video/spots';

/** The popup's levels, bottom first. 'links': linked list + the Link button. 'pick': the picker.
 *  'variation' | 'figure' | 'drill' | 'position': create steps. 'variation-figure': the variation step's Figure picker.
 *  'unlink': the "Unlink …?" question, a level of its own only in the player (Back closes just it). */
export type LinkStep =
	'links' | 'pick' | 'variation' | 'figure' | 'drill' | 'position' | 'variation-figure' | 'unlink';

/** Where a host opens the popup: straight into the picker when the section has no links. */
export function openingSteps(linkedCount: number): LinkStep[] {
	return linkedCount === 0 ? ['pick'] : ['links'];
}

/** True for every level above the bottom one. */
export function stacked(steps: LinkStep[], step: LinkStep): boolean {
	return steps.indexOf(step) > 0;
}

/** A time for a range: `0:42`, or `0:42.5` when it is not on a whole second. */
function rangeTime(ms: number): string {
	return spotTime(ms).replace(/\.0$/, '');
}

/**
 * The popup's heading: the range, and the name and length under it. A point
 * (`endMs` null) is its moment, and says it is a point.
 */
export function linkHeading(spot: {
	startMs: number;
	endMs: number | null;
	label: string | null;
}): {
	range: string;
	sub: string;
} {
	if (spot.endMs === null) {
		return {
			range: rangeTime(spot.startMs),
			sub: spot.label ? `${spot.label} · point` : 'Point'
		};
	}
	return {
		range: `${rangeTime(spot.startMs)}–${rangeTime(spot.endMs)}`,
		sub: [spot.label, lengthText(spot.endMs - spot.startMs)].filter(Boolean).join(' · ')
	};
}

/** Where a created thing is linked. */
export function destination(o: Pick<LinkOptions, 'spot' | 'context'>): string {
	const range = linkHeading(o.spot).range;
	return o.context.kind === 'lesson'
		? `Linked to ${range} and to ${o.context.title}`
		: `Linked to ${range}`;
}

export type CreateStep = 'variation' | 'figure' | 'drill' | 'position';
export type CreateSpot = LinkCreateField | 'banner';

const SHOWN: Record<CreateStep, CreateSpot[]> = {
	variation: ['groupId', 'name', 'style'],
	figure: ['figureName', 'name', 'style'],
	drill: ['name'],
	position: ['name', 'style']
};

/** The create row's buttons, bare nouns: the picker draws the +. */
const CREATE_ROW: { key: CreateStep; label: string }[] = [
	{ key: 'variation', label: 'Figure' },
	{ key: 'figure', label: 'Move' },
	{ key: 'drill', label: 'Drill' },
	{ key: 'position', label: 'Position' }
];

/**
 * The popup's words for what it links: a section links figures, drills and
 * positions; a point, positions only (ruling 10), and makes nothing else.
 * `null`: not known yet (its options are on their way), neutral words that
 * promise nothing, so a point never flashes a section's.
 */
export function linkWords(point: boolean | null): {
	opener: string;
	placeholder: string;
	create: { key: CreateStep; label: string }[];
} {
	if (point === null) return { opener: 'Link…', placeholder: 'Search', create: [] };
	return point
		? {
				opener: 'Link a position…',
				placeholder: 'Search positions',
				create: CREATE_ROW.filter((c) => c.key === 'position')
			}
		: {
				opener: 'Link a figure, drill or position…',
				placeholder: 'Search figures, drills and positions',
				create: CREATE_ROW
			};
}

/**
 * The links level's and the picker's titles: by the range once the heading is
 * known ("Link 1:12", "Link 1:12 to…"), else by what the spot is, or neither
 * while that is not known either.
 */
export function linkTitles(
	heading: { range: string } | null,
	point: boolean | null
): { links: string; pick: string } {
	if (heading) return { links: `Link ${heading.range}`, pick: `Link ${heading.range} to…` };
	const what = point === null ? '' : point ? ' a point' : ' a section';
	return { links: `Link${what}`, pick: `Link${what} to…` };
}

/** The popup's words when its options did not load: a section's, a point's, or just "these". */
export function loadFailed(point: boolean | null): { title: string; body: string } {
	const whose = point === null ? 'these' : point ? 'this point’s' : 'this section’s';
	return { title: `Couldn’t load ${whose} links.`, body: 'Close and tap the link button again.' };
}

/** A target's picker key: `figure:3`, `exercise:3`, `position:3` (the builders' keys). */
export function targetKey(t: LinkTarget): string {
	if ('figureId' in t) return `figure:${t.figureId}`;
	if ('exerciseId' in t) return `exercise:${t.exerciseId}`;
	return `position:${t.positionId}`;
}

/**
 * A linked row's id for keys and focus. A position link's id is of its own
 * table, so the same number may be a variation's link too: the kind tells them apart.
 */
export function linkRowId(l: { linkId: number; target: LinkTarget }): string {
	return 'positionId' in l.target ? `position-link-${l.linkId}` : `link-${l.linkId}`;
}

/** What the unlink names besides the id: 'position' for a position link, nothing else. */
export function unlinkKind(t: LinkTarget): 'position' | undefined {
	return 'positionId' in t ? 'position' : undefined;
}

/** "Use this moment as a point": the full-screen player's, under a section's popup. */
export const MOMENT_LABEL = 'Use this moment as a point';

/**
 * Where "Use this moment as a point" shows: on the popup's bottom level (the
 * links list, or the picker when the section opened straight into it), only
 * on a section, and only where a playhead is known (`hasMoment`: the
 * full-screen player). Null: nowhere.
 */
export function momentAt(
	steps: LinkStep[],
	point: boolean,
	hasMoment: boolean
): 'links' | 'pick' | null {
	if (!hasMoment || point) return null;
	const bottom = steps[0];
	return bottom === 'links' || bottom === 'pick' ? bottom : null;
}

/** Where a refusal shows: under the field it names, if the step shows that field, else the banner. */
export function refusalAt(step: CreateStep, field: string | undefined): CreateSpot {
	const hit = SHOWN[step].find((f) => f === field);
	return hit ?? 'banner';
}

/**
 * The name the Rename sheet offers once the popup closes: the link's own, when
 * an unnamed section went from no links to exactly one. Several links, a
 * section that had some already, or one with a name of its own: nothing.
 */
export function suggestedName(
	label: string | null,
	linkedBefore: number,
	linkedNow: string[]
): string | null {
	if (label !== null || linkedBefore !== 0 || linkedNow.length !== 1) return null;
	return linkedNow[0].slice(0, MAX_SPOT_LABEL);
}
