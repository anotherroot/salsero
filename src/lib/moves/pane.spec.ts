import { describe, expect, it } from 'vitest';
import { EMPTY_PANE, emptyPane, revealTop } from './pane';

describe('emptyPane', () => {
	it('asks for a figure, with New figure', () => {
		const p = emptyPane('figures', false);
		expect(p.title).toBe('Pick a figure');
		expect(p.icon).toBe('moves');
		expect(p.body).toBe(EMPTY_PANE.figures.body);
		expect(p.action).toBe('New figure');
	});

	it('asks for a routine, with New routine', () => {
		const p = emptyPane('routines', false);
		expect(p.title).toBe('Pick a routine');
		expect(p.icon).toBe('routine');
		expect(p.body).toBe(EMPTY_PANE.routines.body);
		expect(p.action).toBe('New routine');
	});

	it('in group mode: the group’s words; the figures pane has no button', () => {
		expect(emptyPane('figures', true).action).toBeNull();
		expect(emptyPane('figures', true).body).toBe('The group’s figures open here.');
		expect(emptyPane('figures', true).title).toBe('Pick a figure');
		expect(emptyPane('routines', true).action).toBe('New routine');
		expect(emptyPane('routines', true).body).toBe(EMPTY_PANE.routines.group);
	});
});

describe('revealTop', () => {
	const col = { top: 88, bottom: 900 };
	it('leaves a row already in view alone', () => {
		expect(revealTop(col, { top: 200, bottom: 264 }, 0, 24)).toBeNull();
	});
	it('scrolls down just enough to show a row below the fold, with the margin', () => {
		expect(revealTop(col, { top: 1000, bottom: 1064 }, 100, 24)).toBe(100 + 1064 - (900 - 24));
	});
	it('scrolls up to a row above the top', () => {
		expect(revealTop(col, { top: 40, bottom: 104 }, 500, 24)).toBe(500 - (88 + 24 - 40));
	});
	it('shows the top of a row taller than the column', () => {
		expect(revealTop(col, { top: 50, bottom: 2000 }, 500, 24)).toBe(500 - (88 + 24 - 50));
		// Below the top and running past the bottom: scrolled to its top, not past it.
		expect(revealTop(col, { top: 200, bottom: 2000 }, 500, 24)).toBe(500 + (200 - 112));
	});
});
