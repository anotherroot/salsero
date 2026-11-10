import { describe, expect, it } from 'vitest';
import type { KeepStatus, SpaceRow } from './protocol';
import {
	keepWord,
	lessonOnPhone,
	phoneRowLine,
	spaceLine,
	suggestions,
	videoKeep
} from './kept-view';

const MB = 1024 * 1024;
const row = (over: Partial<SpaceRow> = {}): SpaceRow => ({
	id: 'team:7',
	name: 'Salsa',
	on: true,
	videos: 12,
	bytes: 151 * MB,
	held: 4,
	heldBytes: 63 * MB,
	...over
});
function status(over: Partial<KeepStatus> = {}): KeepStatus {
	return {
		settings: { spaces: ['team:7'], wifiOnly: true, videos: ['lesson-videos/k.mp4'] },
		spaces: [row()],
		kept: [],
		bySpace: { 'lesson-videos/s.mp4': 'team:7', 'lesson-videos/held.mp4': 'team:7' },
		partial: {},
		held: ['lesson-videos/held.mp4', 'lesson-videos/mine.mp4'],
		inFlight: null,
		waiting: null,
		canTellWifi: true,
		bytes: { songs: 34 * MB, videos: 152 * MB },
		free: 9000 * MB,
		low: false,
		...over
	};
}

describe('videoKeep: the button under a video (offline phase 4b)', () => {
	it('no store, or not a video: no button', () => {
		expect(videoKeep(null, '/lesson-videos/a.mp4')).toBeNull();
		expect(videoKeep(status(), '/audio/x.m4a')).toBeNull();
		expect(videoKeep(status(), '/elsewhere/x.mp4')).toBeNull();
	});

	it('every state', () => {
		const s = status({ inFlight: { key: 'lesson-videos/s.mp4', received: 42, total: 100 } });
		expect(videoKeep(s, '/lesson-videos/a.mp4')).toEqual({ state: 'off' });
		expect(videoKeep(s, '/lesson-videos/mine.mp4')).toEqual({ state: 'on' });
		expect(videoKeep(s, '/lesson-videos/held.mp4')).toEqual({
			state: 'space',
			space: 'team:7',
			name: 'Salsa'
		});
		expect(videoKeep(s, '/lesson-videos/s.mp4')).toEqual({ state: 'coming', percent: 42 });
		// Kept, in line behind the one in flight.
		expect(videoKeep(s, '/lesson-videos/k.mp4')).toEqual({ state: 'coming', percent: 0 });
		expect(videoKeep(status({ waiting: 'wifi' }), '/lesson-videos/k.mp4')).toEqual({
			state: 'waiting',
			why: 'wifi'
		});
		expect(videoKeep(status(), '/recordings/r.webm')).toEqual({ state: 'off' });
	});
});

describe('lessonOnPhone: the mark in the Lessons list', () => {
	it('only when every video is on the phone', () => {
		expect(lessonOnPhone(status(), [])).toBe(false);
		expect(lessonOnPhone(null, ['held.mp4'])).toBe(false);
		expect(lessonOnPhone(status(), ['held.mp4', 'a.mp4'])).toBe(false);
		expect(lessonOnPhone(status(), ['held.mp4', 'mine.mp4'])).toBe(true);
	});
});

describe("spaceLine: a space's line on the On this phone page", () => {
	it('off: how many videos and how big', () => {
		expect(spaceLine(row({ on: false }), status())).toEqual({
			mark: null,
			text: '12 videos · 151 MB',
			bar: null
		});
	});

	it('on and all there', () => {
		const r = row({ held: 12, heldBytes: 151 * MB });
		expect(spaceLine(r, status())).toEqual({
			mark: { text: 'on this phone', tone: 'done' },
			text: '12 videos · 151 MB',
			bar: null
		});
	});

	it('coming: which one of how many, and how far', () => {
		const s = status({ inFlight: { key: 'lesson-videos/s.mp4', received: 0, total: 10 } });
		const line = spaceLine(row(), s);
		expect(line.mark).toBeNull();
		expect(line.text).toBe('Downloading 5 of 12 · 63 MB of 151 MB');
		expect(line.bar).toBeCloseTo(63 / 151);
	});

	it('waiting for Wi-Fi', () => {
		expect(spaceLine(row(), status({ waiting: 'wifi' }))).toEqual({
			mark: { text: 'waiting for Wi-Fi', tone: 'warn' },
			text: '4 of 12 on this phone',
			bar: 63 / 151
		});
	});
});

describe('suggestions: what to remove when space is short', () => {
	it('switched-on spaces and kept videos that free space, largest first', () => {
		const s = status({
			spaces: [row(), row({ id: 'mine', name: null, on: false, heldBytes: 0 })],
			kept: [
				{
					key: 'lesson-videos/mine.mp4',
					title: 'Marmelada',
					index: 1,
					bytes: 300 * MB,
					held: true
				},
				{ key: 'lesson-videos/k.mp4', title: 'Not here', index: 2, bytes: 900 * MB, held: false },
				{
					key: 'lesson-videos/held.mp4',
					title: 'Its space keeps it',
					index: 1,
					bytes: 5,
					held: true
				}
			]
		});
		expect(suggestions(s)).toEqual([
			{
				kind: 'video',
				key: 'lesson-videos/mine.mp4',
				title: 'Marmelada',
				index: 1,
				bytes: 300 * MB
			},
			{ kind: 'space', id: 'team:7', name: 'Salsa', videos: 4, bytes: 63 * MB }
		]);
	});
});

describe("phoneRowLine: Settings' row", () => {
	it('songs, videos and what is free', () => {
		expect(phoneRowLine(status())).toBe('Songs 34 MB · videos 152 MB · free 8.8 GB');
		expect(phoneRowLine(status({ free: null }))).toBe('Songs 34 MB · videos 152 MB');
	});
});

describe("keepWord: the words after a video's size", () => {
	it('for each state', () => {
		expect(keepWord(null)).toBeNull();
		expect(keepWord({ state: 'off' })).toBeNull();
		expect(keepWord({ state: 'on' })).toEqual({ text: 'on this phone', tone: 'done' });
		expect(keepWord({ state: 'space', space: 'mine', name: null })).toEqual({
			text: 'on this phone',
			tone: 'done'
		});
		expect(keepWord({ state: 'coming', percent: 40 })).toEqual({
			text: 'downloading 40 %',
			tone: 'muted'
		});
		expect(keepWord({ state: 'waiting', why: 'wifi' })).toEqual({
			text: 'waiting for Wi-Fi',
			tone: 'warn'
		});
		expect(keepWord({ state: 'waiting', why: 'space' })?.text).toBe('no space');
		expect(keepWord({ state: 'waiting', why: 'offline' })?.text).toBe('waiting for a connection');
	});
});

describe('spaceLine keeps what a cut-off download already has (phone, 2026-11-10)', () => {
	it('waiting: the bar stays where it was, the part counted', () => {
		const s = status({ waiting: 'wifi', partial: { 'lesson-videos/s.mp4': 12 * MB } });
		const line = spaceLine(row(), s);
		expect(line.mark).toEqual({ text: 'waiting for Wi-Fi', tone: 'warn' });
		expect(line.bar).toBeCloseTo(75 / 151);
	});

	it('coming again from the part: counted once, not twice', () => {
		const s = status({
			partial: { 'lesson-videos/s.mp4': 12 * MB },
			inFlight: { key: 'lesson-videos/s.mp4', received: 20 * MB, total: 30 * MB }
		});
		expect(spaceLine(row(), s).bar).toBeCloseTo(83 / 151);
	});
});
