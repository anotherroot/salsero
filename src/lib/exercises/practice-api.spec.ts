import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { practiceSaver, SAVE_DELAY_MS } from './practice-api';
import type { PracticeInput } from './practice';

const config = { count: 'salsa', clave: null, speed: 1, callEvery: null } as const;
const loaded: PracticeInput = { mode: 'count', songId: null, countBpm: 180, config };
const at = (bpm: number, count: 'salsa' | 'off' = 'salsa') => ({
	source: 'count' as const,
	songId: null,
	bpm,
	config: { ...config, count }
});

describe('practiceSaver', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	function saver(known: PracticeInput | null = loaded) {
		const post = vi.fn();
		return { post, s: practiceSaver('salsa', 7, known, post) };
	}

	it('saves a change once things settle, as one post', () => {
		const { post, s } = saver();
		s.change(at(170));
		s.change(at(160));
		s.change(at(150, 'off'));
		expect(post).not.toHaveBeenCalled();
		vi.advanceTimersByTime(SAVE_DELAY_MS);
		expect(post).toHaveBeenCalledTimes(1);
		expect(post).toHaveBeenCalledWith('/salsa/exercises/7/practice', {
			mode: 'count',
			songId: null,
			countBpm: 150,
			config: { ...config, count: 'off' }
		});
		expect(s.known).toEqual({ ...loaded, countBpm: 150, config: { ...config, count: 'off' } });
	});

	it('posts nothing for what the page already knew', () => {
		const { post, s } = saver();
		s.change(at(180));
		vi.advanceTimersByTime(SAVE_DELAY_MS);
		expect(post).not.toHaveBeenCalled();
	});

	it('sends a change at once on flush, and nothing after', () => {
		const { post, s } = saver();
		s.change(at(150));
		s.flush();
		expect(post).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(SAVE_DELAY_MS);
		expect(post).toHaveBeenCalledTimes(1);
		s.flush();
		expect(post).toHaveBeenCalledTimes(1);
	});

	it('posts a change made and then undone, so the server ends on the last one', () => {
		const { post, s } = saver();
		s.change(at(150));
		s.flush();
		s.change(at(180));
		s.flush();
		expect(post).toHaveBeenLastCalledWith('/salsa/exercises/7/practice', loaded);
	});

	it('takes newer loaded data as what it knows, unless a change is waiting', () => {
		const { post, s } = saver();
		const flowed = { ...loaded, countBpm: 200 };
		s.reset(flowed);
		expect(s.known).toEqual(flowed);
		s.change(at(200));
		vi.advanceTimersByTime(SAVE_DELAY_MS);
		expect(post).not.toHaveBeenCalled();

		s.change(at(150));
		s.reset(loaded);
		expect(s.known?.countBpm).toBe(150);
	});

	it('remembers a first practice', () => {
		const { post, s } = saver(null);
		s.change(at(180));
		s.flush();
		expect(post).toHaveBeenCalledWith('/salsa/exercises/7/practice', loaded);
	});
});
