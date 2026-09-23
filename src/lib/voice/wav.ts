/**
 * PCM float frames → a WAV file, as a pure function.
 *
 * WAV rather than a compressed format because nothing in this app can encode
 * one: the browser's `MediaRecorder` is not used (it reports no time origin,
 * so a take could not be aligned to the click), and the server runs no ffmpeg.
 * `decodeAudioData` reads WAV everywhere, a half-bar is ~200 KB, and 16-bit is
 * past the point where anyone can hear the difference in a spoken count.
 */

/** 16-bit signed PCM, mono. `samples` outside [-1, 1] are clipped, not wrapped. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
	if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
		throw new Error(`encodeWav: bad sample rate ${sampleRate}`);
	}
	const HEADER = 44;
	const bytes = new ArrayBuffer(HEADER + samples.length * 2);
	const view = new DataView(bytes);

	const ascii = (offset: number, s: string) => {
		for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
	};

	ascii(0, 'RIFF');
	view.setUint32(4, 36 + samples.length * 2, true); // everything after this field
	ascii(8, 'WAVE');
	ascii(12, 'fmt ');
	view.setUint32(16, 16, true); // PCM fmt chunk length
	view.setUint16(20, 1, true); // format 1 = PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true); // byte rate: rate × block align
	view.setUint16(32, 2, true); // block align: 1 channel × 2 bytes
	view.setUint16(34, 16, true); // bits per sample
	ascii(36, 'data');
	view.setUint32(40, samples.length * 2, true);

	for (let i = 0; i < samples.length; i++) {
		// Clamp BEFORE scaling: a sample of 1.2 would otherwise wrap to a loud
		// negative spike, which is far more audible than the clipping it hides.
		const s = Math.max(-1, Math.min(1, samples[i]));
		view.setInt16(HEADER + i * 2, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true);
	}
	return new Uint8Array(bytes);
}
