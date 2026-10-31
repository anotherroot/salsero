import { describe, expect, it } from 'vitest';
import { NOTHING_CAPTURED, recordingView, silentLine, voiceError } from './recording';

describe('recordingView', () => {
	it('walks from get ready to the last bar', () => {
		expect(recordingView('salsa', 4, null)).toEqual({
			heading: 'Get ready',
			say: null,
			line: null,
			dots: ['next', 'next', 'next', 'silent', 'next', 'next', 'next', 'silent'],
			barsDone: 0,
			barFraction: 0
		});
		expect(recordingView('salsa', 4, { bar: -1, count: 3 })).toMatchObject({
			heading: 'Count-in',
			say: null,
			line: 'Start counting on the next 1',
			dots: ['next', 'next', 'current', 'silent', 'next', 'next', 'next', 'silent'],
			barsDone: 0
		});
		expect(recordingView('salsa', 4, { bar: 1, count: 5 })).toEqual({
			heading: 'Bar 2 of 4',
			say: '5',
			line: null,
			dots: ['said', 'said', 'said', 'silent', 'current', 'next', 'next', 'silent'],
			barsDone: 1,
			barFraction: 5 / 8
		});
		expect(recordingView('salsa', 4, { bar: 0, count: 4 })).toMatchObject({
			say: null,
			line: 'Silent on 4'
		});
		expect(recordingView('son', 4, { bar: 3, count: 1 })).toMatchObject({
			heading: 'Bar 4 of 4',
			say: null,
			line: 'Silent on 1'
		});
		expect(recordingView('all', 4, { bar: 0, count: 8 }).dots).toEqual([
			'said',
			'said',
			'said',
			'said',
			'said',
			'said',
			'said',
			'current'
		]);
	});
});

describe('silentLine', () => {
	it('names the silent beats', () => {
		expect(silentLine('salsa')).toBe('Count evenly and leave beats 4 and 8 silent.');
		expect(silentLine('son')).toBe('Count evenly and leave beats 1 and 5 silent.');
		expect(silentLine('all')).toBe('Count evenly, every beat.');
	});
});

describe('voiceError', () => {
	it('words a refusal and any other failure', () => {
		expect(voiceError(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toEqual({
			title: 'The microphone was refused',
			body: 'Allow it for this app in the phone’s settings, then try again.'
		});
		expect(voiceError(new Error('Boom'))).toEqual({ title: 'Recording failed', body: 'Boom' });
		expect(NOTHING_CAPTURED.title).toBe('Nothing usable was captured');
	});
});
