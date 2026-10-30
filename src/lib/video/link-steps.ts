/**
 * The Link popup's levels. PURE and client-safe.
 */

/** The popup's levels, bottom first. 'links': linked list + the Link button. 'pick': the picker.
 *  'variation' | 'figure' | 'drill': create steps. 'variation-figure': the variation step's Figure picker. */
export type LinkStep = 'links' | 'pick' | 'variation' | 'figure' | 'drill' | 'variation-figure';

/** Where a host opens the popup: straight into the picker when the section has no links. */
export function openingSteps(linkedCount: number): LinkStep[] {
	return linkedCount === 0 ? ['pick'] : ['links'];
}
