import { describe, expect, it } from 'vitest';
import { wordDiff, type DiffPart } from './diff';

const join = (parts: DiffPart[], keep: 'del' | 'ins') =>
	parts
		.filter((p) => p.op === 'same' || p.op === keep)
		.map((p) => p.text)
		.join('');

describe('wordDiff', () => {
	it('keeps a run of changed words together, spaces and all', () => {
		expect(wordDiff('Ucili smos e slišati', 'Učili smo se slišati')).toEqual([
			{ op: 'del', text: 'Ucili smos e' },
			{ op: 'ins', text: 'Učili smo se' },
			{ op: 'same', text: ' slišati' }
		]);
	});
	it('says nothing changed when nothing did', () => {
		expect(wordDiff('a b', 'a b')).toEqual([{ op: 'same', text: 'a b' }]);
	});
	it('handles empty sides', () => {
		expect(wordDiff('', 'x')).toEqual([{ op: 'ins', text: 'x' }]);
		expect(wordDiff('x', '')).toEqual([{ op: 'del', text: 'x' }]);
		expect(wordDiff('', '')).toEqual([]);
	});
	it('replaces a misspelt word whole', () => {
		expect(wordDiff('Exchibela', 'Exhibela')).toEqual([
			{ op: 'del', text: 'Exchibela' },
			{ op: 'ins', text: 'Exhibela' }
		]);
	});
	it('keeps the untouched words between two fixes', () => {
		const parts = wordDiff(
			'I dont remember it exatly.. justa tes',
			"I don't remember it exactly.. just a test"
		);
		expect(parts[0]).toEqual({ op: 'same', text: 'I ' });
		expect(parts.some((p) => p.op === 'same' && p.text.includes('remember it'))).toBe(true);
	});
	it('rebuilds both sides exactly', () => {
		for (const [a, b] of [
			['Da se pleše bomj ob mirni salsi.', 'Da se pleše bolj ob mirni salsi.'],
			['On 1 from open position', 'On 1, from the open position.'],
			['a  b\nc', 'a b\n\nc d']
		]) {
			const parts = wordDiff(a, b);
			expect(join(parts, 'del')).toBe(a);
			expect(join(parts, 'ins')).toBe(b);
		}
	});
});
