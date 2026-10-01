import { describe, expect, it } from 'vitest';
import { pending, type Unsaved } from './pending';

/** A stand-in DOM node: `contains` is the only thing `pending` asks of one. */
const node = (...kids: object[]) =>
	({ contains: (n: unknown) => kids.includes(n as object) }) as unknown as Node;

const entry = (over: Partial<Unsaved> = {}): Unsaved => ({
	label: 'Figure edits',
	dirty: () => true,
	...over
});

describe('pending', () => {
	it('lists only the dirty entries', () => {
		const a = entry({ label: 'a' });
		const b = entry({ label: 'b', dirty: () => false });
		expect(pending([a, b], { scope: null, unload: false })).toEqual([a]);
	});

	it('with a scope, keeps only the entries inside it', () => {
		const inside = {};
		const outside = {};
		const sheet = node(inside);
		const a = entry({ node: inside as Node });
		const b = entry({ node: outside as Node });
		const c = entry();
		expect(pending([a, b, c], { scope: sheet, unload: false })).toEqual([a]);
	});

	it('leaves out what only an unload loses, unless this is one', () => {
		const upload = entry({ label: 'Upload', unloadOnly: true });
		const form = entry();
		expect(pending([upload, form], { scope: null, unload: false })).toEqual([form]);
		expect(pending([upload, form], { scope: null, unload: true })).toEqual([upload, form]);
	});
});
