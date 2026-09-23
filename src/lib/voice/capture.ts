/**
 * Recording the user counting against a click — the impure half of `src/lib/voice`.
 *
 * `wav.ts` and `slice.ts` beside it are pure and tested; everything that needs
 * a microphone, an `AudioContext` or a permission prompt lives here, the same
 * split `scheduler.ts` and `attach.ts` use.
 *
 * The click is scheduled on the SAME context the capture runs in, and the
 * worklet reports the context frame its first block covers. That is what makes
 * every beat's sample index exact, and it is the reason `MediaRecorder` is not
 * used: it reports no time origin, so a take could only be aligned by guessing.
 */

/** Beats of click before the user is expected to count, so the tempo is established. */
export const COUNT_IN_BARS = 1;

export interface Capture {
	frames: Float32Array;
	sampleRate: number;
	/** Sample index, within `frames`, of the first COUNTED bar's "1". */
	firstBarStart: number;
	beatSamples: number;
}

export interface RecordOptions {
	bpm: number;
	/** Bars to count after the count-in. Four gives four candidates to choose between. */
	bars: number;
	/** Called on every click, counted bars numbered from 0 and the count-in negative. */
	onBeat?: (bar: number, count: number) => void;
	signal?: AbortSignal;
}

/**
 * The browser's defaults are built for voice calls and all three hurt here:
 * gain control pumps a count that should stay even, noise suppression chews
 * the consonants, and echo cancellation hears the click and ducks the voice to
 * cancel it. iOS honours these inconsistently, which is why the UI insists on
 * headphones rather than relying on the constraints alone.
 */
const MIC: MediaTrackConstraints = {
	echoCancellation: false,
	noiseSuppression: false,
	autoGainControl: false
};

async function loadClick(ctx: AudioContext): Promise<AudioBuffer> {
	const res = await fetch('/clips/clave.m4a');
	if (!res.ok) throw new Error(`click: ${res.status}`);
	return ctx.decodeAudioData(await res.arrayBuffer());
}

/**
 * Record `bars` bars of counting at `bpm`, preceded by a count-in.
 *
 * Resolves with the raw capture; slicing it into takes is `slice.ts`'s job and
 * encoding them is `wav.ts`'s. Always releases the microphone and closes the
 * context, including when it throws — a live mic track keeps the browser's
 * recording indicator on and, on iOS, can wedge the next attempt.
 */
export async function recordAgainstClick(opts: RecordOptions): Promise<Capture> {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC });
	const ctx = new AudioContext();
	const blocks: Float32Array[] = [];
	let startFrame: number | null = null;

	try {
		await ctx.resume();
		await ctx.audioWorklet.addModule('/worklets/recorder.js');
		const click = await loadClick(ctx);

		const source = ctx.createMediaStreamSource(stream);
		const recorder = new AudioWorkletNode(ctx, 'recorder');
		recorder.port.onmessage = (e: MessageEvent) => {
			const msg = e.data as { type: string; frame?: number; data?: Float32Array };
			if (msg.type === 'start') startFrame = msg.frame ?? 0;
			else if (msg.data) blocks.push(msg.data);
		};
		source.connect(recorder);
		// A worklet with no downstream is not guaranteed to be pulled. Routing it
		// to a silent gain keeps it processing without anyone hearing the mic.
		const mute = ctx.createGain();
		mute.gain.value = 0;
		recorder.connect(mute);
		mute.connect(ctx.destination);

		const beat = 60 / opts.bpm;
		// Far enough ahead that scheduling and decoding cannot make the first
		// click late; the count-in absorbs it either way.
		const t0 = ctx.currentTime + 0.3;
		const totalBeats = (COUNT_IN_BARS + opts.bars) * 8;

		for (let i = 0; i < totalBeats; i++) {
			const at = t0 + i * beat;
			const src = ctx.createBufferSource();
			src.buffer = click;
			const gain = ctx.createGain();
			// The "1" is accented, or there is nothing telling the user where the
			// bar begins and the count-in cannot do its job.
			gain.gain.value = i % 8 === 0 ? 1 : 0.45;
			src.connect(gain);
			gain.connect(ctx.destination);
			src.start(at);
			if (opts.onBeat) {
				const bar = Math.floor(i / 8) - COUNT_IN_BARS;
				setTimeout(
					() => opts.onBeat?.(bar, (i % 8) + 1),
					Math.max(0, (at - ctx.currentTime) * 1000)
				);
			}
		}

		// One extra beat so the last word has room to ring out before capture stops.
		const endsAt = t0 + (totalBeats + 1) * beat;
		const how = await waitUntil(ctx, endsAt, opts.signal);

		// A run that went the distance and captured nothing is a broken
		// microphone and deserves to say so. A run that was STOPPED may honestly
		// have nothing yet — the user may have pressed it within the count-in —
		// and an empty capture simply yields no candidates.
		if (how === 'done' && startFrame === null) {
			throw new Error('The microphone produced no audio.');
		}

		const frames = concat(blocks);
		const beatSamples = beat * ctx.sampleRate;
		// t0 is a context TIME; the capture is indexed from the frame the worklet
		// first saw. Both are the same clock, so this subtraction is exact.
		// `startFrame` is only null after a stop that caught no audio at all, and
		// then `frames` is empty too, so every candidate is refused regardless.
		const firstBarStart =
			Math.round((t0 + COUNT_IN_BARS * 8 * beat) * ctx.sampleRate) - (startFrame ?? 0);

		return { frames, sampleRate: ctx.sampleRate, firstBarStart, beatSamples };
	} finally {
		for (const track of stream.getTracks()) track.stop();
		await ctx.close().catch(() => {});
	}
}

function concat(blocks: Float32Array[]): Float32Array {
	let total = 0;
	for (const b of blocks) total += b.length;
	const out = new Float32Array(total);
	let at = 0;
	for (const b of blocks) {
		out.set(b, at);
		at += b.length;
	}
	return out;
}

/**
 * Resolve once the context clock passes `time`, or as soon as the user stops.
 *
 * Stopping RESOLVES rather than rejecting: pressing Stop is a way to finish
 * early, not a failure. Whatever whole bars were counted are still worth
 * offering, and the slicer refuses the incomplete one on its own.
 */
function waitUntil(
	ctx: AudioContext,
	time: number,
	signal?: AbortSignal
): Promise<'done' | 'stopped'> {
	return new Promise((resolve) => {
		const tick = setInterval(() => {
			if (signal?.aborted) {
				clearInterval(tick);
				resolve('stopped');
			} else if (ctx.currentTime >= time) {
				clearInterval(tick);
				resolve('done');
			}
		}, 50);
	});
}

/** One candidate take, ready to audition or upload. */
export interface Take {
	frames: Float32Array;
	sampleRate: number;
	preRollS: number;
	lengthS: number;
	durationS: number;
}

/** Copy one slice out of a capture, in the shape the upload endpoint wants. */
export function cutTake(
	capture: Capture,
	slice: { start: number; preRoll: number; length: number; duration: number }
): Take {
	return {
		frames: capture.frames.slice(slice.start, slice.start + slice.duration),
		sampleRate: capture.sampleRate,
		preRollS: slice.preRoll / capture.sampleRate,
		lengthS: slice.length / capture.sampleRate,
		durationS: slice.duration / capture.sampleRate
	};
}
