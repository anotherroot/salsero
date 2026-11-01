/**
 * The Practice screens' button variants. Built with swap() here rather than in
 * the components, so the spec that imports this module runs swap()'s dev guard.
 */

import { ROW, button, swap } from '$lib/components/ui/styles';

/**
 * Practice's Play. Starting… keeps the accent, as the board's loading button
 * does: it is busy, not unavailable. Still `disabled`, so a second tap cannot
 * build a second player.
 */
export const SETUP_PLAY = button('primary', 'lg', true);
export const SETUP_PLAY_BUSY = swap(
	SETUP_PLAY,
	'disabled:bg-disabled-bg disabled:text-disabled-ink',
	''
);

/** The Voice row on the setup card: a two-line row, 58 px. */
export const SETUP_VOICE_ROW = swap(ROW, 'min-h-14', 'min-h-[58px]');

/**
 * Stop while running: soft danger, as tall as Pause, so the two never get
 * confused mid-dance. A colour appended after button() would lose to its own.
 */
export const RUN_STOP = swap(
	swap(button('danger', 'lg'), 'bg-danger text-on-danger', 'bg-danger-soft text-danger'),
	'px-7',
	'pr-6 pl-5'
);
