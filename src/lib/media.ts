/**
 * Telling "the file is gone" apart from "this browser can't decode it".
 *
 * A media element only reports that it failed, never why, so the answer comes
 * from asking the server for one byte: a 404 means the file is missing, and
 * anything else means the bytes are there and the codec is the problem.
 *
 * Client-safe and used by both the figure page and the lesson page.
 */
export type MediaProblem = 'missing' | 'unplayable';

async function diagnose(url: string): Promise<MediaProblem> {
	const res = await fetch(url, { headers: { range: 'bytes=0-0' } }).catch(() => null);
	return res?.status === 404 ? 'missing' : 'unplayable';
}

/**
 * A Svelte attachment, not an `onerror` handler: the player is server-rendered
 * and starts loading before hydration, so an error can land before any listener
 * is attached. Checking `el.error` on mount catches exactly that case.
 */
export function watchMedia(url: string, onproblem: (problem: MediaProblem) => void) {
	return (el: HTMLMediaElement) => {
		const fail = () => {
			void diagnose(url).then(onproblem);
		};
		if (el.error) fail();
		el.addEventListener('error', fail);
		return () => el.removeEventListener('error', fail);
	};
}
