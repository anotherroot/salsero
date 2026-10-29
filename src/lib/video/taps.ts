/**
 * Taps on the player's picture, YouTube-style: a double tap on the left or
 * right third jumps 1 s, and every further tap on that side within the chain
 * window jumps another. PURE: the component feeds it taps and times, and
 * calls `expire` once the window it was told to wait for has passed.
 */

/** How long a side tap waits for a second before it counts as a single tap. */
export const DOUBLE_TAP_MS = 250;
/** How long after a jump another tap on that side keeps jumping. */
export const CHAIN_MS = 600;

export type Side = 'left' | 'right';
export type Zone = Side | 'mid';

export type TapState = {
	pending: { side: Side; t: number } | null;
	chain: { side: Side; t: number; total: number } | null;
};

export const IDLE: TapState = { pending: null, chain: null };

export type TapAct = { kind: 'single' } | { kind: 'jump'; side: Side; total: number };

/** `wait`: a side tap is pending — call `expire` after `DOUBLE_TAP_MS`. */
export type TapResult = { state: TapState; act: TapAct | null; wait: boolean };

export function zoneOf(x: number, width: number): Zone {
	if (x < width / 3) return 'left';
	if (x > (width * 2) / 3) return 'right';
	return 'mid';
}

export function tap(state: TapState, t: number, zone: Zone): TapResult {
	// The middle has no double tap, so it never waits.
	if (zone === 'mid') return { state: IDLE, act: { kind: 'single' }, wait: false };
	const { pending, chain } = state;
	if (chain && chain.side === zone && t - chain.t <= CHAIN_MS) {
		const total = chain.total + 1;
		return {
			state: { pending: null, chain: { side: zone, t, total } },
			act: { kind: 'jump', side: zone, total },
			wait: false
		};
	}
	if (pending && pending.side === zone && t - pending.t <= DOUBLE_TAP_MS) {
		return {
			state: { pending: null, chain: { side: zone, t, total: 1 } },
			act: { kind: 'jump', side: zone, total: 1 },
			wait: false
		};
	}
	return { state: { pending: { side: zone, t }, chain: null }, act: null, wait: true };
}

/** Time has passed: a lone side tap becomes a single tap, and a quiet chain ends. */
export function expire(state: TapState, t: number): TapResult {
	let { pending, chain } = state;
	let act: TapAct | null = null;
	if (pending && t - pending.t >= DOUBLE_TAP_MS) {
		pending = null;
		act = { kind: 'single' };
	}
	if (chain && t - chain.t > CHAIN_MS) chain = null;
	return { state: pending || chain ? { pending, chain } : IDLE, act, wait: false };
}
