import { beforeEach, describe, expect, it } from 'vitest';
import { claimSound, pauseForVideo, releaseSound, videoSound } from './video-sound.svelte';

describe('which video has the sound', () => {
	beforeEach(() => releaseSound(videoSound.key ?? ''));

	it('is the last one tapped', () => {
		claimSound('a');
		claimSound('b');
		expect(videoSound.key).toBe('b');
	});

	it('is not given up by one that no longer holds it', () => {
		claimSound('a');
		claimSound('b');
		releaseSound('a');
		expect(videoSound.key).toBe('b');
	});

	it('is nobody once its holder lets go', () => {
		claimSound('b');
		releaseSound('b');
		expect(videoSound.key).toBeNull();
	});
});

describe('the run, when a video takes the sound', () => {
	it('pauses a run that plays', () => {
		expect(pauseForVideo('a', false)).toBe(true);
	});
	it('leaves a run the person already paused as it is', () => {
		expect(pauseForVideo('a', true)).toBe(false);
	});
	it('does nothing when the sound is given back: the music waits for Resume', () => {
		expect(pauseForVideo(null, false)).toBe(false);
		expect(pauseForVideo(null, true)).toBe(false);
	});
});
