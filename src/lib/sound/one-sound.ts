/**
 * One sound at a time, as Spotify does it: whatever starts playing stops
 * whatever else plays — a small video, the full-screen player, a song, a
 * sample, a YouTube card — and in the Android app another app taking the
 * sound (Spotify, a call) stops ours, while ours starting stops it. PURE: the
 * rule. The wiring that watches the page is `page.ts`.
 */

/** A thing that plays, as the rule sees it. */
export interface Playing {
	playing: boolean;
	/** Muted, or at volume 0. */
	muted: boolean;
	/** A muted background loop (`data-ambient`: the player's About clips): it plays on its own. */
	ambient: boolean;
}

/** It makes a sound now: the phone's other apps go quiet for it. */
export const audible = (p: Playing): boolean => p.playing && !p.muted;

/**
 * It counts as playing: a video the person muted still does (two pictures
 * running at once is the bug), a muted background loop does not — it neither
 * stops another nor is stopped.
 */
export const takesPart = (p: Playing): boolean => p.playing && (!p.muted || !p.ambient);

/** Who stops when `from` starts: every other one that counts. Nothing when `from` itself does not. */
export function quietFor<T>(all: Iterable<T>, from: T, look: (t: T) => Playing): T[] {
	if (!takesPart(look(from))) return [];
	return [...all].filter((t) => t !== from && takesPart(look(t)));
}

/** Another app took the sound: everything audible stops; a muted video plays on. */
export function quietForApp<T>(all: Iterable<T>, look: (t: T) => Playing): T[] {
	return [...all].filter((t) => audible(look(t)));
}

/** What the Android app is told (`SalsaAudio`): `on` while anything of ours is audible. */
export function focusWord<T>(all: Iterable<T>, look: (t: T) => Playing): 'on' | 'off' {
	for (const t of all) if (audible(look(t))) return 'on';
	return 'off';
}
