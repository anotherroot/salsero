import { describe, expect, it } from 'vitest';
import { dragEdges } from './edges';

describe('dragEdges', () => {
	it('on the desk, where the slim band and the tab bar are not drawn, uses the band row and the window', () => {
		expect(dragEdges({ top: 0, bottom: 0, height: 0 }, { top: 0, height: 0 }, 88, 900)).toEqual({
			top: 88,
			bottom: 900
		});
	});

	it('on the phone, below the slim band and above the tab bar', () => {
		expect(dragEdges({ top: 0, bottom: 64, height: 64 }, { top: 780, height: 64 }, 0, 844)).toEqual(
			{ top: 64, bottom: 780 }
		);
	});

	it('with neither on the page, the whole window', () => {
		expect(dragEdges(null, null, 0, 844)).toEqual({ top: 0, bottom: 844 });
	});
});
