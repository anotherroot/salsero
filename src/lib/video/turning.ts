/**
 * Lets the phone turn while the full-screen player is open. The Android app
 * keeps every page upright and listens on `SalsaTurn`: `free` lets it turn,
 * `portrait` stands it up again. In a browser there is no bridge and this does
 * nothing. PURE apart from what it is handed — the player passes
 * `window.SalsaTurn`.
 */

export interface TurnBridge {
	postMessage(message: string): void;
}

/** Frees the turning now; returns what stands the app upright again. */
export function letPhoneTurn(bridge: TurnBridge | undefined): () => void {
	bridge?.postMessage('free');
	return () => bridge?.postMessage('portrait');
}
