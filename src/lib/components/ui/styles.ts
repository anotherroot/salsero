/**
 * Class strings for the shared controls. Components and pages build their
 * buttons, fields and chips from these so the copies cannot drift. Colours are
 * tokens only; the global focus rule in layout.css draws the ring.
 */

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
	bare: 'text-ink active:bg-step disabled:text-disabled-ink',
	tonal: 'bg-accent-soft text-accent-text disabled:bg-disabled-bg disabled:text-disabled-ink',
	filled: 'bg-accent text-on-accent disabled:bg-disabled-bg disabled:text-disabled-ink',
	step: 'bg-step text-ink active:brightness-90 disabled:bg-disabled-bg disabled:text-disabled-ink'
};

/** A 44 px round icon-only button; give it an aria-label. */
export function iconButton(variant: IconButtonVariant): string {
	return `flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-default ${ICON_BUTTON[variant]}`;
}

export const FIELD =
	'h-[52px] w-full rounded-[14px] border border-field-line bg-surface px-3.5 font-sans text-[16px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent aria-invalid:border-2 aria-invalid:border-danger disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-ink';
/** Text under a field. */
export const FIELD_ERROR = 'mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-danger';
export const LABEL = 'mb-1.5 block pl-1 text-[13px] font-bold text-ink-2';
/** A radio styled as a chip: wrap the input (`sr-only`) and its text in a <label> with this. */
export const CHIP =
	'flex h-9 flex-none cursor-pointer items-center justify-center rounded-full bg-chip px-4 font-sans text-[14px] font-semibold text-chip-ink has-checked:bg-accent has-checked:font-extrabold has-checked:text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent has-disabled:bg-disabled-bg has-disabled:text-disabled-ink';
/** A grouped card of rows; hairlines between rows. */
export const GROUP = 'divide-y divide-hairline overflow-hidden rounded-2xl bg-surface';
export const ROW = 'flex min-h-14 items-center gap-3 px-4 py-2';
export const SECTION_LABEL = 'px-4 text-[13px] font-bold text-muted';
