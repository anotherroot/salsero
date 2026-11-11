/**
 * The listening player's own controls. Colours here, never appended in markup
 * (`class-rules.spec.ts`).
 */
import { PRESS_ROW, button, swap } from '$lib/components/ui/styles';

/** The big area a round is tapped on: the whole lower half, one target. */
export const TAP_PAD = `relative isolate flex h-[200px] w-full flex-none cursor-pointer touch-manipulation select-none flex-col items-center justify-center gap-1 overflow-hidden rounded-[24px] border border-hairline bg-surface text-ink ${PRESS_ROW} disabled:cursor-default disabled:text-disabled-ink`;

/** The ring that answers a tap on the pad. */
export const TAP_RING =
	'pointer-events-none absolute size-[120px] rounded-full border-2 border-accent';

/** The stage's big sign: the hidden count's dash, a drop's "?", the count during a reveal. */
export const STAGE_SIGN =
	'font-display text-[min(120px,30vw,13svh)] leading-none font-extrabold tracking-[-0.02em] text-band-ink tabular-nums';

/**
 * Reset and Skip on a round's bar: they share the row with Stop and grow to
 * fill it, so a third button never pushes the bar past the screen.
 */
export const BAR_SHARED = swap(
	swap(button('secondary', 'lg'), 'flex-none', 'min-w-0 flex-1'),
	'px-7',
	'px-3'
);

/**
 * The replay's bar: four buttons on one row. The small ones keep less padding and
 * Play takes the rest, so a long word ("Predvajaj") fits on a narrow phone.
 */
export const REPLAY_SMALL = swap(button('secondary', 'lg'), 'px-7', 'px-4');
export const REPLAY_PLAY = swap(button('primary', 'lg', true), 'px-7', 'px-3');
