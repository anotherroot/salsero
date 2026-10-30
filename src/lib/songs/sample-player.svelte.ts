/**
 * The sample player: one song sample at a time, across the whole page.
 *
 * One lazily created module-level `<audio>` — never the player's own, which
 * `loadSongGrid` mounts for a practice run. `sampling` says which song is
 * sampling, from where, and a `nonce` that bumps on every play so a button's
 * ring restarts even when the same song is played again. The timing maths
 * (the fade) is `sample.ts`; this file only drives the element.
 */
import type { SampleSong } from '$lib/types';
import { SAMPLE_LENGTH_S, sampleGain } from './sample';

export const sampling = $state<{ id: number | null; startS: number; nonce: number }>({
	id: null,
	startS: 0,
	nonce: 0
});

let audio: HTMLAudioElement | null = null;
let frame = 0;

function element(): HTMLAudioElement {
	if (!audio) {
		audio = new Audio();
		audio.preload = 'auto';
		audio.addEventListener('ended', stopSample);
		/*
		 * rAF stops in a background tab; `timeupdate` does not, so a sample
		 * still ends on time when the page is not visible.
		 */
		audio.addEventListener('timeupdate', tick);
	}
	return audio;
}

/** `volume` is read-only on iOS Safari: there the sample plays unfaded. */
function setVolume(el: HTMLAudioElement, v: number) {
	try {
		el.volume = v;
	} catch {
		/* ignored */
	}
}

/** The sample's length: 15 s, or less when the song ends sooner. */
function lengthOf(el: HTMLAudioElement): number {
	const d = el.duration;
	return Number.isFinite(d) && d > 0
		? Math.min(SAMPLE_LENGTH_S, Math.max(0, d - sampling.startS))
		: SAMPLE_LENGTH_S;
}

function tick() {
	if (!audio || sampling.id === null) return;
	const length = lengthOf(audio);
	const elapsed = audio.currentTime - sampling.startS;
	if (elapsed >= length) {
		stopSample();
		return;
	}
	setVolume(audio, sampleGain(elapsed, length));
}

function loop() {
	tick();
	if (sampling.id !== null) frame = requestAnimationFrame(loop);
}

export function playSample(song: SampleSong): void {
	stopSample();
	const el = element();
	sampling.id = song.id;
	sampling.startS = song.startS;
	const nonce = ++sampling.nonce;
	setVolume(el, 0);
	el.src = `/audio/${encodeURIComponent(song.audioFile)}`;
	/*
	 * Set before the metadata loads, this is the "default playback start
	 * position" the element seeks to once it can. Some engines drop it, so
	 * it is set again when the metadata arrives if playback is not there.
	 */
	el.currentTime = song.startS;
	el.addEventListener(
		'loadedmetadata',
		() => {
			if (sampling.nonce === nonce && el.currentTime < song.startS - 0.25) {
				el.currentTime = song.startS;
			}
		},
		{ once: true }
	);
	el.play().catch(() => {
		// Refused (autoplay rules, a broken file) or interrupted by a newer play.
		if (sampling.nonce === nonce) stopSample();
	});
	frame = requestAnimationFrame(loop);
}

export function stopSample(): void {
	cancelAnimationFrame(frame);
	frame = 0;
	sampling.id = null;
	if (audio && audio.getAttribute('src')) {
		audio.pause();
		// Drop the source so the element stops fetching the rest of the song.
		audio.removeAttribute('src');
		audio.load();
	}
}
