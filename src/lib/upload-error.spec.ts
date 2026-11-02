import { describe, expect, it } from 'vitest';
import { messageFromBody, uploadFailure } from './upload-error';

describe('messageFromBody', () => {
	it('reads a JSON message (also SvelteKit error JSON)', () => {
		expect(messageFromBody('{"message":"Not enough room."}')).toBe('Not enough room.');
	});
	it('keeps a plain-text body', () => {
		expect(messageFromBody('nope')).toBe('nope');
	});
	it('gives nothing for HTML, empty, or JSON without a message', () => {
		expect(messageFromBody('<html>413</html>')).toBe('');
		expect(messageFromBody('')).toBe('');
		expect(messageFromBody('{"a":1}')).toBe('');
	});
});

describe('uploadFailure', () => {
	it('falls back when there is no message', () => {
		expect(uploadFailure('<html></html>', 'too large')).toBe('too large');
		expect(uploadFailure('{"message":"room"}', 'too large')).toBe('room');
	});
});
