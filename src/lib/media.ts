/**
 * Telling "the file is gone" apart from "this browser can't decode it".
 *
 * A media element only reports that it failed, never why, so the answer comes
 * from asking the server for one byte: a 404 means the file is missing, and
 * anything else means the bytes are there and the codec is the problem.
 *
 * Client-safe and used by both the figure page and the lesson page.
 */
import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';

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

/**
 * Why a file picked for a recording cannot be uploaded, or null. Size first:
 * a too-big video is the likelier mistake and the more useful thing to say.
 */
export function uploadProblem(
	file: { size: number; type: string },
	accept: 'audio/*' | 'video/*,audio/*'
): { title: string; body?: string } | null {
	if (file.size > MAX_RECORDING_BYTES) {
		return {
			title: `That file is ${Math.round(file.size / 1024 / 1024)} MB; the limit is ${MAX_RECORDING_LABEL}.`
		};
	}
	if (accept === 'audio/*') {
		return /^audio\//.test(file.type)
			? null
			: { title: 'Only audio files can be added.', body: 'Pick a video with Add video instead.' };
	}
	return /^(video|audio)\//.test(file.type)
		? null
		: { title: 'Only video and audio files can be added.' };
}
