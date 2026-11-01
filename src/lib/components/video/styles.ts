/**
 * The full-screen player's button classes. The player is always dark because
 * its dialog carries `.theme-media`, so these are the site's token classes and
 * the dance's accent reaches every button. Builders carry colour, size and
 * radius: append nothing that sets any of them.
 */

import { swap } from '$lib/components/ui/styles';

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
