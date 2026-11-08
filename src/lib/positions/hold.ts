/** The hold vocabulary: PURE, client-safe. Its words are the catalog's, read at call time. */
import { lazyWords } from '$lib/i18n/lazy';
import { t } from '$lib/i18n/catalog';
import type { Facing, Frame, Hands, Hold } from '$lib/types';

export const HANDS = ['two', 'one', 'none'] as const satisfies readonly Hands[];
export const FACING = ['face', 'side', 'shadow', 'back'] as const satisfies readonly Facing[];
export const FRAME = ['open', 'closed'] as const satisfies readonly Frame[];

export const HANDS_LABEL: Record<Hands, string> = lazyWords((c) => c.positions.hold.hands);
/** The form's Hands choices: short, under a field that says Hands. */
export const HANDS_SHORT: Record<Hands, string> = lazyWords((c) => c.positions.hold.handsShort);
export const FACING_LABEL: Record<Facing, string> = lazyWords((c) => c.positions.hold.facing);
export const FRAME_LABEL: Record<Frame, string> = lazyWords((c) => c.positions.hold.frame);
export const crossedLabel = (): string => t().positions.hold.crossed;
/** A hold known not to be crossed: shown only where two holds are compared. */
export const notCrossedLabel = (): string => t().positions.hold.notCrossed;

export const EMPTY_HOLD: Hold = { hands: null, crossed: null, facing: null, frame: null };

/** The hold as chips, in the order hands, crossed, facing, frame. Unknown parts are left out. */
export function holdChips(h: Hold): string[] {
	const chips: string[] = [];
	if (h.hands) chips.push(HANDS_LABEL[h.hands]);
	if (h.crossed) chips.push(crossedLabel());
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
