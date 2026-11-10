/**
 * Class strings for the shared controls. Components and pages build their
 * buttons, fields and chips from these so the copies cannot drift. Colours are
 * tokens only; the global focus rule in layout.css draws the ring.
 */

/**
 * Replace one class (or run of classes) in a builder's output. A plain
 * `.replace()` does nothing when the token is missing, so a builder that
 * changes leaves the caller on the old look without a sound. This throws in
 * dev and in tests; in a production build it returns the string unchanged
 * (a wrong look is better than a blank page).
 */
export function swap(cls: string, from: string, to: string): string {
	// Whole class tokens only: `px-3` must not match inside `px-3.5`.
	const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const at = new RegExp(`(?<!\\S)${escaped}(?!\\S)`);
	if (!at.test(cls)) {
		if (import.meta.env.DEV) throw new Error(`swap: "${from}" is not in "${cls}"`);
		return cls;
	}
	return cls.replace(at, () => to);
}

export type ButtonKind =
	'primary' | 'secondary' | 'tertiary' | 'danger' | 'danger-text' | 'done-soft' | 'done';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'bare' | 'tonal' | 'filled' | 'step';

/**
 * A press (motion round 1): the colour change as before, and the control dips
 * under the finger (short, arriving) and settles back when it lets go (medium,
 * settling). Still with reduced motion, and while a swipe or a drag moves what
 * holds it (`data-swiping`: Swipeable; `data-dragging`: a list with a lifted
 * row). Only on the tap target, or on a box holding nothing else to press:
 * `:active` also matches the ancestors of what is pressed.
 */
const PRESS_MOTION =
	'transition duration-260 ease-settle active:duration-150 active:ease-arrive motion-reduce:active:scale-100 in-data-swiping:active:scale-100 in-data-dragging:active:scale-100';
/** A button's press: down to 94 %, never while disabled or busy. */
export const PRESS = `${PRESS_MOTION} active:scale-94 disabled:active:scale-100 aria-busy:active:scale-100`;
/** A whole row's press (a list row that is one link or button): down to 98.5 %. */
export const PRESS_ROW = `${PRESS_MOTION} active:scale-[.985]`;

const BUTTON_BASE = `inline-flex flex-none cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-sans font-extrabold ${PRESS} active:brightness-90 disabled:cursor-default disabled:active:brightness-100 aria-busy:cursor-default`;

const BUTTON_KIND: Record<ButtonKind, string> = {
	primary: 'bg-accent text-on-accent disabled:bg-disabled-bg disabled:text-disabled-ink',
	secondary: 'bg-accent-soft text-accent-text disabled:bg-disabled-bg disabled:text-disabled-ink',
	tertiary: 'text-accent-text active:opacity-60 disabled:text-disabled-ink',
	danger: 'bg-danger text-on-danger disabled:bg-disabled-bg disabled:text-disabled-ink',
	'danger-text': 'text-danger active:opacity-60 disabled:text-disabled-ink',
	'done-soft': 'bg-done-soft text-done disabled:bg-disabled-bg disabled:text-disabled-ink',
	done: 'bg-done text-on-done disabled:bg-disabled-bg disabled:text-disabled-ink'
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
	sm: 'h-11 gap-2 px-[18px] text-[15px]',
	md: 'h-[52px] gap-2 px-6 text-[16px]',
	lg: 'h-16 gap-2.5 px-7 font-display text-[22px]'
};

/** A pill button. Loading: render a `<Spinner>` in place of the label, keep the width. */
export function button(kind: ButtonKind, size: ButtonSize = 'md', full = false): string {
	const text = kind === 'tertiary' || kind === 'danger-text';
	const size_ = text ? BUTTON_SIZE[size].replace(/px-\S+/, 'px-3.5') : BUTTON_SIZE[size];
	return `${BUTTON_BASE} ${BUTTON_KIND[kind]} ${size_}${full ? ' w-full' : ''}`;
}

/**
 * A full pill that shares a row with others (the pane's pinned log bar: Skip,
 * Log set, Next, Finish): it grows with them. The builder's `flex-none` would
 * keep its full width and push the row past its column; an appended `flex-1`
 * loses to it (Tailwind orders by property).
 */
export function rowButton(kind: ButtonKind): string {
	return swap(button(kind, 'md', true), 'flex-none', 'min-w-0 flex-1');
}

const ICON_BUTTON: Record<IconButtonVariant, string> = {
	bare: 'active:bg-step disabled:text-disabled-ink',
	tonal: 'bg-accent-soft text-accent-text disabled:bg-disabled-bg disabled:text-disabled-ink',
	filled: 'bg-accent text-on-accent disabled:bg-disabled-bg disabled:text-disabled-ink',
	step: 'bg-step active:brightness-90 disabled:bg-disabled-bg disabled:text-disabled-ink'
};

export type IconTone = 'ink' | 'muted' | 'accent' | 'accent-text' | 'danger' | 'done';

/** Written out so Tailwind sees every class. */
const ICON_TONE: Record<IconTone, string> = {
	ink: 'text-ink',
	muted: 'text-muted',
	accent: 'text-accent',
	'accent-text': 'text-accent-text',
	danger: 'text-danger',
	done: 'text-done'
};

/**
 * A 44 px round icon-only button; give it an aria-label. `tone` is the icon's
 * colour for a bare or step button (tonal and filled carry their own). Never
 * append a colour class to the result: Tailwind's order lets the builder win.
 */
export function iconButton(variant: 'bare' | 'step', tone?: IconTone): string;
export function iconButton(variant: 'tonal' | 'filled'): string;
export function iconButton(variant: IconButtonVariant): string;
export function iconButton(variant: IconButtonVariant, tone: IconTone = 'ink'): string {
	const colour = variant === 'bare' || variant === 'step' ? ` ${ICON_TONE[tone]}` : '';
	return `flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full ${PRESS} disabled:cursor-default ${ICON_BUTTON[variant]}${colour}`;
}

/**
 * Where a band button sits. `band`: a bare cream icon on the band. In a pane on
 * the desktop (`inPane()`), the item's header is on the ground, not the band:
 * `pane` is an action there, the tonal icon button (desktop spec, "the item's
 * actions as tonal icon buttons"), `pane-back` its ‹, a bare ink icon. The phone
 * draws all three as `band`: the same element is the phone's band button.
 *
 * `float`: no band at all, at every width. A round surface button with a shadow,
 * floating over what is under it (the map's head, spec 2026-11-08-map-walk).
 */
export type BandTone = 'band' | 'pane' | 'pane-back' | 'float';

const BAND_BUTTON = `flex h-11 w-11 flex-none items-center justify-center rounded-full text-band-ink active:bg-band-ink/15 ${PRESS}`;

/** Desk only, written out so Tailwind sees every class. `desk:active:` also turns the band's hover off (layout.css). */
const BAND_TONE: Record<Exclude<BandTone, 'float'>, string> = {
	band: '',
	pane: ' desk:bg-accent-soft desk:text-accent-text desk:active:bg-accent-soft desk:active:brightness-90',
	'pane-back': ' desk:text-ink desk:active:bg-step'
};

/** The map's floating buttons (`float`): ink on the surface, lifted off the map. */
export const FLOAT_BUTTON = `flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_6px_20px_rgb(0_0_0/0.12)] active:bg-step ${PRESS}`;

/** A band's 44 px icon button (BandButton); give it an aria-label. */
export function bandButton(tone: BandTone = 'band'): string {
	return tone === 'float' ? FLOAT_BUTTON : BAND_BUTTON + BAND_TONE[tone];
}

export const FIELD =
	'h-[52px] w-full rounded-[14px] border border-field-line bg-surface px-3.5 font-sans text-[16px] font-semibold text-ink placeholder:font-medium placeholder:text-muted aria-invalid:border-danger aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger)] disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-ink';
/** A multi-line field: FIELD's look, grows with its rows. */
export const TEXTAREA = swap(FIELD, 'h-[52px]', 'h-auto min-h-[52px] py-3.5 leading-snug resize-y');
/** Text under a field. */
export const FIELD_ERROR = 'mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-danger';
export const LABEL = 'mb-1.5 block pl-1 text-[13px] font-bold text-ink-2';
/** A radio styled as a chip: wrap the input (`sr-only`) and its text in a <label> with this. */
export const CHIP = `relative isolate flex h-11 flex-none cursor-pointer items-center justify-center px-4 font-sans text-[14px] font-semibold text-chip-ink before:absolute before:inset-x-0 before:inset-y-1 before:-z-10 before:rounded-full before:bg-chip has-checked:font-extrabold has-checked:text-on-accent has-checked:before:bg-accent has-focus-visible:before:outline-2 has-focus-visible:before:outline-offset-2 has-focus-visible:before:outline-accent has-disabled:text-disabled-ink has-disabled:before:bg-disabled-bg ${PRESS_MOTION} active:scale-94 has-disabled:active:scale-100`;
/** CHIP for a toggle button: lit by `aria-pressed` instead of a checked radio. Written out, since Tailwind only generates classes it can see literally. */
export const SHORTCUT = `relative isolate flex h-11 flex-none cursor-pointer items-center justify-center px-4 font-sans text-[14px] font-semibold text-chip-ink before:absolute before:inset-x-0 before:inset-y-1 before:-z-10 before:rounded-full before:bg-chip aria-pressed:font-extrabold aria-pressed:text-on-accent aria-pressed:before:bg-accent focus-visible:before:outline-2 focus-visible:before:outline-offset-2 focus-visible:before:outline-accent disabled:text-disabled-ink disabled:before:bg-disabled-bg ${PRESS}`;
/** A tick box (the pick list's): the browser's own checkbox, in the accent colour. */
export const TICK = 'size-6 flex-none cursor-pointer accent-accent';
/** A card that clips its content to its rounded edge; the focus rings inside it draw inside the controls (layout.css). */
export const CLIP = 'focus-inset overflow-hidden';
/** A grouped card of rows; hairlines between rows. Rows draw their focus inside. */
export const GROUP = `${CLIP} divide-y divide-hairline rounded-2xl bg-surface`;
export const ROW = 'flex min-h-14 items-center gap-3 px-4 py-2';
export const SECTION_LABEL = 'px-4 text-[13px] font-bold text-muted';
/** A field-shaped button that opens a sheet; add a `chevron-down` 20 px `text-muted` and a muted placeholder span. */
export const SELECT = `${FIELD} flex cursor-pointer items-center gap-2.5 pr-3 text-left`;

const INVALID = 'border-danger shadow-[inset_0_0_0_1px_var(--color-danger)]';
/** FIELD / SELECT marked invalid by their owner, for a control that cannot carry `aria-invalid` (a button). Still a 1 px border, so nothing moves. */
export const FIELD_INVALID = swap(FIELD, 'border-field-line', INVALID);
export const SELECT_INVALID = swap(SELECT, 'border-field-line', INVALID);
/** SELECT that grows with wrapping chips (a many-value field's opener). */
export const SELECT_WRAP = swap(SELECT, 'h-[52px]', 'h-auto min-h-[52px] py-2');
export const SELECT_WRAP_INVALID = swap(SELECT_WRAP, 'border-field-line', INVALID);

/** A dashed "add" control: a label (or link) that opens the file picker. */
export const DASHED_ADD =
	'flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-field-line text-[16px] font-extrabold text-accent-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';

/**
 * The Switch's track. Off is `bg-muted` (3:1 against every surface, so an off
 * switch is visible), on is the accent. The thumb is white on both.
 */
export const SWITCH_TRACK =
	'relative block h-8 w-[52px] rounded-full bg-muted transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50 peer-checked:[&>span]:translate-x-5';

/*
 * Variants built with swap() live here, in a module, never in a .svelte file:
 * a spec imports this one, so swap()'s dev guard runs and a token that is no
 * longer in the builder fails `npm run check` (class-rules.spec.ts).
 */

/** A field on a surface card (the exercise page's settings): the box reads as a field. */
export const FIELD_ON_CARD = swap(FIELD, 'bg-surface', 'bg-field');
export const TEXTAREA_ON_CARD = swap(TEXTAREA, 'bg-surface', 'bg-field');
export const SELECT_ON_CARD = swap(SELECT, 'bg-surface', 'bg-field');

/** The filled round Play / Pause at the board's 52 px rather than the usual 44. */
export const PLAY_ROUND = swap(iconButton('filled'), 'h-11 w-11', 'size-[52px]');

/** A row led by a 40 px LeadTile with two lines (Settings' My count): 64 px. */
export const ROW_TALL = swap(ROW, 'min-h-14', 'min-h-16');

/** A full-width danger button sharing its row: less side padding, so the label fits. */
export const DANGER_SHARED = swap(button('danger', 'md', true), 'px-6', 'px-3');

/**
 * The action on a lesson's band strip (Publish, Add): the strip's secondary button
 * on the phone; on the desktop the strip is a soft bar in the pane, and its action
 * the primary on it.
 */
export const STRIP_ACTION = swap(
	button('secondary', 'sm'),
	'bg-accent-soft text-accent-text',
	'bg-accent-soft text-accent-text desk:bg-accent desk:text-on-accent'
);

/**
 * A draft lesson's Publish on its band strip (spec A6, option 3A): a cream pill
 * with band-coloured text on the phone, in both themes (the band does not change
 * with them); on the desktop the strip is a soft bar and Publish its accent fill.
 */
export const PUBLISH_ACTION = swap(
	STRIP_ACTION,
	'bg-accent-soft text-accent-text',
	'bg-band-ink text-on-cream'
);

/**
 * A pane header's padding and title size, shared by `BandHeader`'s `pane`
 * variant (the `_DESK` forms, behind `desk:`) and `PaneHeading` (the plain
 * forms), so the two cannot drift. A spec checks each pair agrees.
 */
export const PANE_PAD = 'px-10 pt-6 pb-1';
export const PANE_PAD_DESK = 'desk:px-10 desk:pt-6 desk:pb-1';
export const PANE_TITLE = 'text-[30px] leading-[1.05] tracking-[-0.015em]';
export const PANE_TITLE_DESK = 'desk:text-[30px] desk:leading-[1.05] desk:tracking-[-0.015em]';

/** The song page's Edit · Grid pinned bar: Tap on the 1 grows to fill the row beside play and + Section. */
export const TAP_ONE = swap(button('primary', 'lg'), 'flex-none', 'min-w-0 flex-1');
/** + Section beside it: the md pill, a little narrower. */
export const ADD_SECTION = swap(button('secondary', 'md'), 'px-6', 'px-4');
