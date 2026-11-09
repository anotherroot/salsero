import { describe, expect, it } from 'vitest';
import { resendFields } from './resolve';

describe('a clash resolved from the Sync page', () => {
	it("puts the person's values over the sent fields and the current version as seen", () => {
		const sent: [string, string][] = [
			['title', 'Mine'],
			['notes', 'a'],
			['seen', '{"title":"Old"}']
		];
		const out = resendFields(
			sent,
			{ notes: 'kept theirs' },
			{ title: 'Theirs', notes: 'kept theirs' }
		);
		expect(out).toEqual([
			['title', 'Mine'],
			['notes', 'kept theirs'],
			['seen', JSON.stringify({ title: 'Theirs', notes: 'kept theirs' })]
		]);
	});
});
