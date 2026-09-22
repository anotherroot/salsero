import { describe, expect, it } from 'vitest';
import { RECORDING_FILE_RE, extensionFor, parseRange } from './files';

describe('recording files', () => {
	it('picks an extension from the MIME type first, then the name', () => {
		expect(extensionFor('video/quicktime', 'IMG_0001.MOV')).toBe('mov');
		expect(extensionFor('video/mp4; codecs=avc1', 'x')).toBe('mp4');
		expect(extensionFor('application/octet-stream', 'clip.MKV')).toBe('mkv');
		expect(extensionFor('', 'no-extension')).toBe('bin');
	});

	it('accepts only our own stored names', () => {
		expect(RECORDING_FILE_RE.test('0f8fad5b-d9cb-469f-a165-70867728950e.mp4')).toBe(true);
		expect(RECORDING_FILE_RE.test('../salsa.db')).toBe(false);
		expect(RECORDING_FILE_RE.test('0f8fad5b-d9cb-469f-a165-70867728950e.mp4/..')).toBe(false);
	});
});

describe('parseRange', () => {
	it('is null without a usable header', () => {
		expect(parseRange(null, 100)).toBeNull();
		expect(parseRange('bytes=-', 100)).toBeNull();
		expect(parseRange('items=0-1', 100)).toBeNull();
	});

	it('reads start-end, clamping the end to the file', () => {
		expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
		expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
	});

	it('reads open-ended and suffix ranges', () => {
		expect(parseRange('bytes=95-', 100)).toEqual({ start: 95, end: 99 });
		expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
		expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
	});

	it('refuses a range past the end', () => {
		expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
		expect(parseRange('bytes=50-40', 100)).toBe('unsatisfiable');
	});
});
