/**
 * A video's frame duration, measured — browsers do not expose a frame rate.
 * `requestVideoFrameCallback` reports each presented frame's media time;
 * the gap between two consecutive ones is one frame. Until enough are seen,
 * the player steps by `DEFAULT_FRAME_S`.
 */

export interface FrameSample {
	mediaTime: number;
	presentedFrames: number;
}

/** Plausible frame gaps: between 120 fps and 9 fps. Anything else is a seek or a stall. */
const MIN_GAP_S = 1 / 121;
const MAX_GAP_S = 1 / 9;
const PAIRS_NEEDED = 5;

/**
 * The median gap between consecutive presented frames, from pairs exactly one
 * frame apart — or null until there are `PAIRS_NEEDED` of them. A dropped
 * frame (the count jumps by more than one) and a seek (an implausible gap)
 * are skipped. PURE.
 */
export function frameDurationOf(samples: readonly FrameSample[]): number | null {
	const gaps: number[] = [];
	for (let i = 1; i < samples.length; i++) {
		const a = samples[i - 1];
		const b = samples[i];
		const gap = b.mediaTime - a.mediaTime;
		if (b.presentedFrames - a.presentedFrames === 1 && gap > MIN_GAP_S && gap < MAX_GAP_S) {
			gaps.push(gap);
		}
	}
	if (gaps.length < PAIRS_NEEDED) return null;
	gaps.sort((x, y) => x - y);
	return gaps[Math.floor(gaps.length / 2)];
}

const MAX_SAMPLES = 30;

/**
 * Watch `video` play until its frame duration is known, call `onframe` once
 * with it, and stop. A no-op where `requestVideoFrameCallback` does not
 * exist. Returns the cleanup.
 */
export function watchFrameDuration(
	video: HTMLVideoElement,
	onframe: (frameS: number) => void
): () => void {
	if (!('requestVideoFrameCallback' in video)) return () => {};
	const samples: FrameSample[] = [];
	let handle = 0;
	let done = false;
	const tick = (_now: number, meta: VideoFrameCallbackMetadata) => {
		if (done) return;
		samples.push({ mediaTime: meta.mediaTime, presentedFrames: meta.presentedFrames });
		if (samples.length > MAX_SAMPLES) samples.shift();
		const frameS = frameDurationOf(samples);
		if (frameS !== null) {
			done = true;
			onframe(frameS);
			return;
		}
		handle = video.requestVideoFrameCallback(tick);
	};
	handle = video.requestVideoFrameCallback(tick);
	return () => {
		done = true;
		video.cancelVideoFrameCallback(handle);
	};
}
