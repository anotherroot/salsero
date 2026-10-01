import { describe, expect, it } from 'vitest';
import { fingerprint } from './fingerprint';

const fd = (pairs: [string, string | File][]) => {
	const f = new FormData();
	for (const [k, v] of pairs) f.append(k, v);
	return f;
};

describe('fingerprint', () => {
	it('is equal for equal contents', () => {
		expect(fingerprint(fd([['name', 'Enchufla']]))).toBe(fingerprint(fd([['name', 'Enchufla']])));
	});

	it('changes when a value changes', () => {
		expect(fingerprint(fd([['name', 'Enchufla']]))).not.toBe(
			fingerprint(fd([['name', 'Enchufla doble']]))
		);
	});

	it('sees a repeated field added or removed', () => {
		const one = fd([['startIds', '1']]);
		const two = fd([
			['startIds', '1'],
			['startIds', '2']
		]);
		expect(fingerprint(one)).not.toBe(fingerprint(two));
	});

	it('does not confuse a separator inside a value with two fields', () => {
		expect(fingerprint(fd([['a', 'x=1&b=2']]))).not.toBe(
			fingerprint(
				fd([
					['a', 'x=1'],
					['b', '2']
				])
			)
		);
	});

	it('records a file by name and size, not by content', () => {
		const a = new File(['abc'], 'clip.mp4');
		const b = new File(['xyz'], 'clip.mp4');
		const c = new File(['abcd'], 'clip.mp4');
		expect(fingerprint(fd([['f', a]]))).toBe(fingerprint(fd([['f', b]])));
		expect(fingerprint(fd([['f', a]]))).not.toBe(fingerprint(fd([['f', c]])));
	});
});
