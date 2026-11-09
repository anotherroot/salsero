/**
 * Which video in the player's details has the sound, across the page: a
 * clip, a lesson video or a YouTube card, by its key, or nobody. One at a
 * time: a tap on another takes it, and the one that held it goes back to
 * mute (or its poster). The run pauses while a video holds it and Setup
 * stops a song sample; the music never starts again by itself
 * (practise-card design).
 */
export const videoSound = $state<{ key: string | null }>({ key: null });

/** A video took the sound: it is the one that plays aloud now. */
export function claimSound(key: string): void {
	videoSound.key = key;
}

/** A video gives the sound back, if it still holds it. */
export function releaseSound(key: string): void {
	if (videoSound.key === key) videoSound.key = null;
}

/**
 * Whether the run must pause now that `key` holds the sound: only a run that
 * plays, and only when a video took it. Giving the sound back never starts
 * the music; that is Resume's.
 */
export function pauseForVideo(key: string | null, paused: boolean): boolean {
	return key !== null && !paused;
}
