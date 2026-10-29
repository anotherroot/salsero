/**
 * Keeps the screen on while the player is open, playing or paused: practising
 * with the video paused is exactly when a phone dims. PURE apart from what it
 * is handed — the player passes `navigator.wakeLock` (which the Android app
 * provides inside its WebView) and `document`.
 */

type Sentinel = { release(): Promise<void> };

export interface ScreenOnEnv {
	wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
	doc: {
		visibilityState: string;
		addEventListener(type: 'visibilitychange', f: () => void): void;
		removeEventListener(type: 'visibilitychange', f: () => void): void;
	};
}

/** Takes the lock now and again whenever the page comes back; returns the release. */
export function holdScreenOn({ wakeLock, doc }: ScreenOnEnv): () => void {
	let held: Sentinel | null = null;
	let stopped = false;

	function take() {
		if (!wakeLock || stopped) return;
		wakeLock.request('screen').then(
			(s) => {
				if (stopped) void s.release().catch(() => {});
				else held = s;
			},
			// Refused (no permission, low battery): the screen just dims as before.
			() => {}
		);
	}

	// The browser drops the lock whenever the page is hidden.
	function onVisibility() {
		if (doc.visibilityState === 'visible') take();
	}

	take();
	doc.addEventListener('visibilitychange', onVisibility);
	return () => {
		stopped = true;
		doc.removeEventListener('visibilitychange', onVisibility);
		void held?.release().catch(() => {});
		held = null;
	};
}
