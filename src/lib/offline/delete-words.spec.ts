import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { phoneOnlyDeleteNote } from './delete-words';

describe('deleting a phone-only video says it is final (offline phase 4c)', () => {
	it('phone-only: the words, an iPhone’s own', () => {
		withLocale('en', () => {
			expect(phoneOnlyDeleteNote({ serverCopy: false }, false)).toContain('only on this phone');
			expect(phoneOnlyDeleteNote({ serverCopy: false }, true)).toContain('only on this iPhone');
		});
	});
	it('on the server: nothing to add', () => {
		expect(phoneOnlyDeleteNote({ serverCopy: true }, true)).toBeNull();
	});
});
