import { describe, expect, it } from 'vitest';
import { sampleLabels, songSubtitle, tapProblem } from './song-page';

describe('tapProblem', () => {
	it('refuses a tap before the song has ever played', () => {
		expect(tapProblem(null)).toBe('Play the song first.');
		expect(tapProblem({ paused: true, currentTime: 0 })).toBe('Play the song first.');
	});

	it('lets a pause mid-song tap, as today', () => {
		expect(tapProblem({ paused: true, currentTime: 42.5 })).toBeNull();
	});

	it('lets a playing song tap, even at 0:00', () => {
		expect(tapProblem({ paused: false, currentTime: 0 })).toBeNull();
	});
});

describe('songSubtitle', () => {
	it('joins artist, style and a rounded BPM', () => {
		expect(songSubtitle({ artist: 'Marc Anthony', style: 'Salsa', bpm: 191.6 })).toBe(
			'Marc Anthony · Salsa · 192 BPM'
		);
	});

	it('leaves out what is not known', () => {
		expect(songSubtitle({ artist: null, style: 'Son', bpm: null })).toBe('Son');
		expect(songSubtitle({ artist: '', style: 'Sensual', bpm: 128 })).toBe('Sensual · 128 BPM');
	});
});

describe('sampleLabels', () => {
	it('says whose start the sample has', () => {
		expect(sampleLabels(true)).toEqual({ badge: 'Yours', tone: 'accent', meta: 'Set by you' });
		expect(sampleLabels(false)).toEqual({
			badge: 'Automatic',
			tone: 'neutral',
			meta: 'A third of the way in, on a 1'
		});
	});
});
