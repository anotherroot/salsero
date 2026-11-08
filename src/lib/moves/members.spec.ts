import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { anyHidden, hiddenFromMembers, membersNote } from './members';

describe('members', () => {
	it('words the marker and the note exactly', () => {
		expect(hiddenFromMembers()).toBe("Members don't see it yet");
		expect(membersNote()).toBe(
			'Anything not in a published lesson stays with the editors. Link it from a lesson and members get it.'
		);
	});
	it('notes only when a row is explicitly hidden', () => {
		expect(anyHidden([{ membersSee: true }, {}])).toBe(false);
		expect(anyHidden([{ membersSee: true }, { membersSee: false }])).toBe(true);
		expect(anyHidden([])).toBe(false);
	});
});

describe('members in Slovenian', () => {
	it('words the marker and the note', () => {
		expect(withLocale('sl', hiddenFromMembers)).toBe('Člani tega še ne vidijo');
		expect(withLocale('sl', membersNote)).toBe(
			'Kar ni v objavljeni lekciji, vidijo le tisti, ki lahko urejajo. Ko to povežete z lekcijo, to dobijo tudi člani.'
		);
	});
});
