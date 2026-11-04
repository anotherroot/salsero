/** The hold vocabulary: PURE, client-safe. */
import type { Facing, Frame, Hands, Hold } from '$lib/types';

export const HANDS = ['two', 'one', 'none'] as const satisfies readonly Hands[];
export const FACING = ['face', 'side', 'shadow', 'back'] as const satisfies readonly Facing[];
export const FRAME = ['open', 'closed'] as const satisfies readonly Frame[];

export const HANDS_LABEL: Record<Hands, string> = {
	two: 'Two hands',
	one: 'One hand',
	none: 'No hands'
};
export const FACING_LABEL: Record<Facing, string> = {
	face: 'Face to face',
	side: 'Side by side',
	shadow: 'Shadow',
	back: 'Back to back'
};
export const FRAME_LABEL: Record<Frame, string> = { open: 'Open', closed: 'Closed' };
export const CROSSED_LABEL = 'Crossed, right on top';

export const EMPTY_HOLD: Hold = { hands: null, crossed: null, facing: null, frame: null };

/** The hold as chips, in the order hands, crossed, facing, frame. Unknown parts are left out. */
export function holdChips(h: Hold): string[] {
	const chips: string[] = [];
	if (h.hands) chips.push(HANDS_LABEL[h.hands]);
	if (h.crossed) chips.push(CROSSED_LABEL);
	if (h.facing) chips.push(FACING_LABEL[h.facing]);
	if (h.frame) chips.push(FRAME_LABEL[h.frame]);
	return chips;
}

/** The picker's second line: the chips joined " · ", all but the first lower-cased. Null when empty. */
export function holdLine(h: Hold): string | null {
	const chips = holdChips(h);
	if (chips.length === 0) return null;
	return chips.map((c, i) => (i === 0 ? c : c.toLowerCase())).join(' · ');
}

function pick<T extends string>(v: FormDataEntryValue | null, all: readonly T[]): T | null {
	return typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : null;
}

/** The hold from a form's `hands`, `crossed` ('1'), `facing` and `frame`; unknown values are null. */
export function parseHold(form: FormData): Hold {
	return {
		hands: pick(form.get('hands'), HANDS),
		crossed: form.get('crossed') === '1' ? true : null,
		facing: pick(form.get('facing'), FACING),
		frame: pick(form.get('frame'), FRAME)
	};
}
