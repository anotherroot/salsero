/**
 * The Link popup's levels. PURE and client-safe.
 */
import type { LinkCreateField, LinkOptions } from '$lib/types';
import { MAX_SPOT_LABEL } from '$lib/limits';
import { lengthText, spotTime } from '$lib/video/spots';

/** The popup's levels, bottom first. 'links': linked list + the Link button. 'pick': the picker.
 *  'variation' | 'figure' | 'drill': create steps. 'variation-figure': the variation step's Figure picker.
 *  'unlink': the "Unlink …?" question, a level of its own only in the player (Back closes just it). */
export type LinkStep =
	'links' | 'pick' | 'variation' | 'figure' | 'drill' | 'variation-figure' | 'unlink';

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

/** The popup's heading: the range, and the name and length under it. */
export function linkHeading(spot: { startMs: number; endMs: number; label: string | null }): {
	range: string;
	sub: string;
} {
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

export type CreateStep = 'variation' | 'figure' | 'drill';
export type CreateSpot = LinkCreateField | 'banner';

const SHOWN: Record<CreateStep, CreateSpot[]> = {
	variation: ['groupId', 'name'],
	figure: ['figureName', 'name', 'style'],
	drill: ['name', 'everyDays']
};

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
