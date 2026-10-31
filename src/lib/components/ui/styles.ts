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

export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'danger-text';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'bare' | 'tonal' | 'filled' | 'step';

const BUTTON_BASE =
	'inline-flex flex-none cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-sans font-extrabold transition-colors active:brightness-90 disabled:cursor-default disabled:active:brightness-100 aria-busy:cursor-default';

const BUTTON_KIND: Record<ButtonKind, string> = {
	primary: 'bg-accent text-on-accent disabled:bg-disabled-bg disabled:text-disabled-ink',
	secondary: 'bg-accent-soft text-accent-text disabled:bg-disabled-bg disabled:text-disabled-ink',
	tertiary: 'text-accent-text active:opacity-60 disabled:text-disabled-ink',
	danger: 'bg-danger text-on-danger disabled:bg-disabled-bg disabled:text-disabled-ink',
	'danger-text': 'text-danger active:opacity-60 disabled:text-disabled-ink'
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
	return `flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-default ${ICON_BUTTON[variant]}${colour}`;
}

export const FIELD =
	'h-[52px] w-full rounded-[14px] border border-field-line bg-surface px-3.5 font-sans text-[16px] font-semibold text-ink placeholder:font-medium placeholder:text-muted aria-invalid:border-danger aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger)] disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-ink';
/** A multi-line field: FIELD's look, grows with its rows. */
export const TEXTAREA = swap(FIELD, 'h-[52px]', 'h-auto min-h-[52px] py-3.5 leading-snug resize-y');
/** Text under a field. */
export const FIELD_ERROR = 'mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-danger';
export const LABEL = 'mb-1.5 block pl-1 text-[13px] font-bold text-ink-2';
/** A radio styled as a chip: wrap the input (`sr-only`) and its text in a <label> with this. */
export const CHIP =
	'relative isolate flex h-11 flex-none cursor-pointer items-center justify-center px-4 font-sans text-[14px] font-semibold text-chip-ink before:absolute before:inset-x-0 before:inset-y-1 before:-z-10 before:rounded-full before:bg-chip has-checked:font-extrabold has-checked:text-on-accent has-checked:before:bg-accent has-focus-visible:before:outline-2 has-focus-visible:before:outline-offset-2 has-focus-visible:before:outline-accent has-disabled:text-disabled-ink has-disabled:before:bg-disabled-bg';
/** CHIP for a toggle button: lit by `aria-pressed` instead of a checked radio. Written out, since Tailwind only generates classes it can see literally. */
export const SHORTCUT =
	'relative isolate flex h-11 flex-none cursor-pointer items-center justify-center px-4 font-sans text-[14px] font-semibold text-chip-ink before:absolute before:inset-x-0 before:inset-y-1 before:-z-10 before:rounded-full before:bg-chip aria-pressed:font-extrabold aria-pressed:text-on-accent aria-pressed:before:bg-accent focus-visible:before:outline-2 focus-visible:before:outline-offset-2 focus-visible:before:outline-accent disabled:text-disabled-ink disabled:before:bg-disabled-bg';
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

/** A dashed "add" control: a label (or link) that opens the file picker. */
export const DASHED_ADD =
	'flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-field-line text-[16px] font-extrabold text-accent-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';

/**
 * The Switch's track. Off is `bg-muted` (3:1 against every surface, so an off
 * switch is visible), on is the accent. The thumb is white on both.
 */
export const SWITCH_TRACK =
	'relative block h-8 w-[52px] rounded-full bg-muted transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50 peer-checked:[&>span]:translate-x-5';
