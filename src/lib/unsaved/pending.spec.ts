import { describe, expect, it } from 'vitest';
import { pending, sendingCount, stillToAsk, type Unsaved } from './pending';

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

describe('sendingCount', () => {
	it('counts forms whose save is out: not dirty while sending, but not done either', () => {
		const out = entry({ dirty: () => false, sending: () => true });
		const idle = entry({ dirty: () => false, sending: () => false });
		const plain = entry();
		expect(sendingCount([out, idle, plain])).toBe(1);
		expect(sendingCount([idle, plain])).toBe(0);
	});
});

describe('stillToAsk', () => {
	const log = entry({ label: 'Practice log' });
	const settings = entry({ label: 'Exercise settings' });
	const pass = { href: '/salsa/exercises/2?session=1', answered: [log] };

	it('without a pass, asks about everything', () => {
		expect(stillToAsk([log, settings], null, '/salsa/exercises/2?session=1')).toEqual([
			log,
			settings
		]);
	});

	it('for the answered move, asks about only what the question did not cover', () => {
		expect(stillToAsk([log, settings], pass, '/salsa/exercises/2?session=1')).toEqual([settings]);
		expect(stillToAsk([log], pass, '/salsa/exercises/2?session=1')).toEqual([]);
	});

	it('for another move, the pass covers nothing', () => {
		expect(stillToAsk([log, settings], pass, '/salsa/exercises/3?session=1')).toEqual([
			log,
			settings
		]);
		expect(stillToAsk([log], pass, null)).toEqual([log]);
	});

	it('a pass that answered nothing covers nothing', () => {
		expect(stillToAsk([settings], { ...pass, answered: [] }, pass.href)).toEqual([settings]);
	});
});
