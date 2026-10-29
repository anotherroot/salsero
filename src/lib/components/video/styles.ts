/**
 * The full-screen player's button classes. The player is always dark; its
 * colours are custom properties set on the player's root (`--pl-*`, see
 * `ui/VideoPlayer.svelte`), so the dance's accent reaches every button.
 */
const BASE =
	'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[14px] font-medium whitespace-nowrap tabular-nums select-none transition-colors disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-(--pl-accent)';
const SIZE = 'h-11 min-w-11 px-3';

export const BTN = `${BASE} ${SIZE} bg-(--pl-raised) text-(--pl-ink) enabled:hover:bg-(--pl-hover)`;
export const BTN_GHOST = `${BASE} ${SIZE} text-(--pl-ink) enabled:hover:bg-(--pl-raised)`;
/** A ghost with a hairline, for a row of secondary actions. */
export const BTN_OUTLINE = `${BASE} ${SIZE} border border-(--pl-line) text-(--pl-ink) enabled:hover:bg-(--pl-raised)`;
export const BTN_ACCENT = `${BASE} ${SIZE} bg-(--pl-accent) text-(--pl-accent-ink)`;
export const BTN_DANGER = `${BASE} ${SIZE} text-(--pl-danger) enabled:hover:bg-(--pl-raised)`;
export const BTN_DANGER_FILL = `${BASE} ${SIZE} bg-(--pl-danger-fill) text-white`;
/** Floating over the picture (landscape). */
export const BTN_ON_VIDEO = `${BASE} ${SIZE} bg-black/55 text-white enabled:hover:bg-black/70`;
