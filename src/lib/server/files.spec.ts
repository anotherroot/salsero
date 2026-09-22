import { describe, expect, it } from 'vitest';
import { RECORDING_FILE_RE, extensionFor } from './files';

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
