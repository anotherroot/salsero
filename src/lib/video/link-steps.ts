/**
 * The Link popup's levels. PURE and client-safe.
 */
import type { LinkOptions } from '$lib/types';
import { lengthText, spotTime } from '$lib/video/spots';

/** The popup's levels, bottom first. 'links': linked list + the Link button. 'pick': the picker.
 *  'variation' | 'figure' | 'drill': create steps. 'variation-figure': the variation step's Figure picker. */
export type LinkStep = 'links' | 'pick' | 'variation' | 'figure' | 'drill' | 'variation-figure';

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
export type CreateSpot = 'name' | 'figureName' | 'groupId' | 'style' | 'everyDays' | 'banner';

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
