import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARRIVE, LEAVE, MS, SETTLE, play, reducedMotion } from './motion';

function stubReduce(matches: boolean) {
	vi.stubGlobal('matchMedia', (q: string) => ({ matches: matches && q.includes('reduce') }));
}

function fakeEl() {
	return { animate: vi.fn(() => ({}) as Animation) } as unknown as Element & {
		animate: ReturnType<typeof vi.fn>;
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('the motion vocabulary', () => {
	it('has the spec’s durations and easings', () => {
		expect(MS).toEqual({ short: 150, medium: 260, long: 380 });
		expect(ARRIVE).toBe('cubic-bezier(0.2, 0, 0, 1)');
		expect(SETTLE).toBe('cubic-bezier(0.3, 1.35, 0.6, 1)');
		expect(LEAVE).toBe('cubic-bezier(0.4, 0, 1, 1)');
	});

	it('the CSS carries the same easings', () => {
		const css = readFileSync('src/routes/layout.css', 'utf8');
		expect(css).toContain(`--ease-arrive: ${ARRIVE};`);
		expect(css).toContain(`--ease-settle: ${SETTLE};`);
		expect(css).toContain(`--ease-leave: ${LEAVE};`);
	});
});

describe('play', () => {
	it('does nothing when reduced motion is asked for', () => {
		stubReduce(true);
		const el = fakeEl();
		expect(reducedMotion()).toBe(true);
		expect(play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 })).toBeNull();
		expect(el.animate).not.toHaveBeenCalled();
	});

	it('animates once, arriving by default', () => {
		stubReduce(false);
		const el = fakeEl();
		expect(play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 })).not.toBeNull();
		expect(el.animate).toHaveBeenCalledTimes(1);
		expect(el.animate.mock.calls[0][1]).toMatchObject({ duration: 150, easing: ARRIVE });
	});

	it('is still where there is no matchMedia (the server)', () => {
		expect(reducedMotion()).toBe(false);
	});
});
