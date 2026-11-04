import { describe, expect, it } from 'vitest';
import { HIDDEN_FROM_MEMBERS, MEMBERS_NOTE, anyHidden } from './members';

describe('members', () => {
	it('words the marker and the note exactly', () => {
		expect(HIDDEN_FROM_MEMBERS).toBe("Members don't see it yet");
		expect(MEMBERS_NOTE).toBe(
			'Anything not in a published lesson stays with the editors. Link it from a lesson and members get it.'
		);
	});
	it('notes only when a row is explicitly hidden', () => {
		expect(anyHidden([{ membersSee: true }, {}])).toBe(false);
		expect(anyHidden([{ membersSee: true }, { membersSee: false }])).toBe(true);
		expect(anyHidden([])).toBe(false);
	});
});
