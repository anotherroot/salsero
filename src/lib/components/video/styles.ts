/**
 * The full-screen player's button classes. The player is always dark because
 * its dialog carries `.theme-media`, so these are the site's token classes and
 * the dance's accent reaches every button. Builders carry colour, size and
 * radius: append nothing that sets any of them.
 */

import { button, swap } from '$lib/components/ui/styles';

export type PlayerButtonKind = 'neutral' | 'accent' | 'ghost' | 'glass' | 'outline' | 'danger-text';
export type PlayerButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'cta';

const BASE =
	'inline-flex flex-none cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-sans font-extrabold tabular-nums select-none transition-colors disabled:cursor-default';

const SIZE: Record<PlayerButtonSize, string> = {
	sm: 'h-9 px-3 text-[13px]',
	md: 'h-11 px-3 text-[14px]',
	lg: 'h-12 px-4 text-[15px]',
	xl: 'h-[52px] px-1 text-[15px]',
	cta: 'h-[52px] px-9 text-[16px]'
};

const DISABLED = 'disabled:bg-disabled-bg disabled:text-disabled-ink';

const KIND: Record<PlayerButtonKind, string> = {
	neutral: `bg-step text-ink active:brightness-90 ${DISABLED}`,
	accent: `bg-accent text-on-accent active:brightness-90 ${DISABLED}`,
	ghost: 'text-ink active:bg-step disabled:text-disabled-ink',
	glass:
		'bg-surface/72 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] active:bg-surface',
	outline:
		'text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)] active:bg-step disabled:text-disabled-ink',
	'danger-text': 'text-danger active:opacity-60 disabled:text-disabled-ink'
};

export function playerButton(
	kind: PlayerButtonKind,
	size: PlayerButtonSize = 'lg',
	shape: 'pill' | 'tile' = 'pill'
): string {
	return `${BASE} ${KIND[kind]} ${SIZE[size]} ${shape === 'pill' ? 'rounded-full' : 'rounded-2xl'}`;
}

const ROUND_SIZE = {
	44: 'size-11',
	48: 'size-12',
	54: 'size-[54px]',
	56: 'size-14',
	58: 'size-[58px]',
	66: 'size-[66px]',
	78: 'size-[78px]'
} as const;

/** A round button; no font size, the caller adds `text-[13px]` or `text-[14px]`. */
export function roundButton(
	kind: 'neutral' | 'accent' | 'glass' | 'ghost',
	size: keyof typeof ROUND_SIZE
): string {
	return `flex flex-none cursor-pointer items-center justify-center rounded-full font-sans font-extrabold tabular-nums whitespace-nowrap select-none ${ROUND_SIZE[size]} ${KIND[kind]}`;
}

/** A pill on the picture; the caller adds `font-bold text-white/92`, or `font-extrabold text-accent-text` for an invite. */
export const ON_VIDEO =
	'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full bg-black/60 px-2.5 text-[12.5px] tabular-nums';

/** A key cap: the desktop legend and the editor's key hints. */
export const KBD =
	'inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-step px-1 text-[11px] font-bold text-ink tabular-nums';

/** The ghost "Hide" button that folds the portrait controls (and "Show" in the slim bar). */
export const HIDE = swap(
	swap(playerButton('ghost', 'md'), 'text-ink', 'text-ink-2'),
	'px-3',
	'pr-2 pl-3'
);

/*
 * The screens' variants, built here rather than in the components so the spec
 * that imports this module runs swap()'s dev guard on every one of them.
 */

/** The spot list's Edit: a 36 px pill in a 44 px cell, a little less padding before its icon. */
export const SPOT_EDIT = swap(playerButton('neutral', 'sm'), 'px-3', 'pr-3 pl-2.5');
export const SPOT_EDIT_ACCENT = swap(playerButton('accent', 'sm'), 'px-3', 'pr-3 pl-2.5');

/** The editor's ±step tiles share the row (flex-1 for the builder's flex-none). */
export const EDITOR_STEP = swap(playerButton('neutral', 'xl', 'tile'), 'flex-none', 'flex-1');
/** The editor's "now" tile: a little wider, its time over its label. */
export const EDITOR_NOW = swap(
	swap(EDITOR_STEP, 'flex-1', 'flex-[1.3] flex-col'),
	'gap-2',
	'gap-0'
);
export const EDITOR_WHOLE = swap(
	swap(playerButton('outline', 'md'), 'flex-none', 'flex-1'),
	'px-3',
	'px-1'
);
export const EDITOR_DELETE = swap(playerButton('danger-text'), 'px-4', 'px-3');

/** The Keys sheet's cap: one step up from the editor's hint chip. */
export const KEY_CAP = swap(
	swap(swap(KBD, 'h-5 min-w-5', 'h-6 min-w-6'), 'px-1', 'px-1.5'),
	'text-[11px]',
	'text-[12px]'
);

/** Two of the sheet's buttons share a row: flex-1 in place of the builder's flex-none. */
export const SHEET_SECONDARY = swap(button('secondary'), 'flex-none', 'flex-1');
export const SHEET_PRIMARY = swap(button('primary'), 'flex-none', 'flex-1');
export const SHEET_DANGER = swap(button('danger'), 'flex-none', 'flex-1');

/** The top bar's 40 px pills sit in a 44 px button: the outer button is the hit area. */
const top = (kind: PlayerButtonKind) => swap(playerButton(kind, 'md'), 'h-11', 'h-10');
/** The back pill: glass over the picture, ghost on a panel. */
export const topBack = (glass: boolean) =>
	swap(top(glass ? 'glass' : 'ghost'), 'px-3', 'pr-3 pl-1');
export const TOP_GLASS = top('glass');
/** The Edit / Link pill: accent while editing, glass otherwise. */
export const topEdit = (accent: boolean) =>
	swap(top(accent ? 'accent' : 'glass'), 'px-3', 'pr-3.5 pl-3');

/** Mark and Section. */
export const MARK = playerButton('neutral', 'lg');
export const MARK_DESK = playerButton('neutral', 'md');
export const MARK_GLASS = playerButton('glass', 'md');
/** A square 44 px Mark (narrow landscape: the icon without its label). */
export const MARK_DESK_SQUARE = swap(MARK_DESK, 'px-3', 'w-11 px-0');
export const MARK_GLASS_SQUARE = swap(MARK_GLASS, 'px-3', 'w-11 px-0');
export const SECTION_ON = playerButton('accent', 'lg');
export const SECTION_ON_DESK = playerButton('accent', 'md');
// playerButton carries `flex-none`, which would beat a `flex-1` appended to it: swap it.
export const MARK_FILL = swap(MARK, 'flex-none', 'flex-1');
export const MARK_WIDE = swap(MARK, 'flex-none', 'flex-[1.4]');
export const SECTION_WIDE = swap(SECTION_ON, 'flex-none', 'flex-[1.4]');
/** An invite on the picture: accent text needs a darker scrim than white (2.2:1 over a white frame at 60 %). */
export const INVITE = swap(ON_VIDEO, 'bg-black/60', 'bg-black/75');
