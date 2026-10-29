import { describe, expect, it } from 'vitest';
import { linkOptionKey } from './link-options';

describe('linkOptionKey', () => {
	it('tells apart two drills with the same name', () => {
		const a = { target: { exerciseId: 1 }, label: 'Shines', drill: true };
		const b = { target: { exerciseId: 2 }, label: 'Shines', drill: true };
		expect(linkOptionKey(a)).not.toBe(linkOptionKey(b));
	});

	it('tells apart a variation and a drill with the same id', () => {
		const v = { target: { figureId: 3 }, label: 'X', drill: false };
		const d = { target: { exerciseId: 3 }, label: 'X', drill: true };
		expect(linkOptionKey(v)).not.toBe(linkOptionKey(d));
	});
});
