/**
 * The full-screen player's keys (the work PC), per level. PURE: the player
 * passes the key event's fields and the level on screen. Esc is not here —
 * it is the dialog's own `cancel`, which goes up one level.
 */
import type { Screen } from './screens';

export type KeyAction =
	| 'toggle'
	| 'back1'
	| 'fwd1'
	| 'tenthBack'
	| 'tenthFwd'
	| 'mark'
	| 'section'
	| 'setStart'
	| 'setEnd'
	| 'jumpStart'
	| 'jumpEnd'
	| 'loop'
	| 'keys';

type Level = Screen['kind'];

const EVERYWHERE: Record<string, KeyAction> = {
	' ': 'toggle',
	ArrowLeft: 'back1',
	ArrowRight: 'fwd1',
	',': 'tenthBack',
	'.': 'tenthFwd',
	'?': 'keys'
};

/**
 * Letters only where their button is on screen: marking from a section or an
 * editor would start a section that screen does not show.
 */
const BY_LEVEL: Partial<Record<Level, Record<string, KeyAction>>> = {
	full: { m: 'mark', s: 'section' },
	section: { '[': 'jumpStart', ']': 'jumpEnd' },
	edit: { i: 'setStart', o: 'setEnd', '[': 'jumpStart', ']': 'jumpEnd', l: 'loop' }
};

/**
 * On the focused timeline, Up / Down are its small step, as a slider's are.
 * Nowhere else: there they scroll the list or the page.
 */
const ON_SLIDER: Record<string, KeyAction> = { ArrowUp: 'tenthFwd', ArrowDown: 'tenthBack' };

export function keyAction(
	e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
	level: Level,
	/** Focus is on the timeline (`role="slider"`). */
	onSlider = false
): KeyAction | null {
	// Ctrl/Cmd+L, Ctrl+S and the like belong to the browser.
	if (e.ctrlKey || e.metaKey || e.altKey) return null;
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	return (
		EVERYWHERE[key] ?? BY_LEVEL[level]?.[key] ?? (onSlider ? ON_SLIDER[key] : undefined) ?? null
	);
}
