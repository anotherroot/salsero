/**
 * The listening player's own controls. Colours here, never appended in markup
 * (`class-rules.spec.ts`).
 */
import { PRESS_ROW } from '$lib/components/ui/styles';

/** The big area a round is tapped on: the whole lower half, one target. */
export const TAP_PAD = `relative isolate flex h-[200px] w-full flex-none cursor-pointer touch-manipulation select-none flex-col items-center justify-center gap-1 overflow-hidden rounded-[24px] border border-hairline bg-surface text-ink ${PRESS_ROW} disabled:cursor-default disabled:text-disabled-ink`;

/** The ring that answers a tap on the pad. */
export const TAP_RING =
	'pointer-events-none absolute size-[120px] rounded-full border-2 border-accent';

/** The stage's big sign: the hidden count's dash, a drop's "?", the count during a reveal. */
export const STAGE_SIGN =
	'font-display text-[min(120px,30vw)] leading-none font-extrabold tracking-[-0.02em] text-band-ink tabular-nums';
