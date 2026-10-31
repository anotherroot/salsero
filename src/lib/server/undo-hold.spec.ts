import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hold, UNDO_MS } from './undo-hold';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Hold', () => {
	it('is a minute', () => expect(UNDO_MS).toBe(60_000));
	it('hands a held value back once', () => {
		const h = new Hold<number>(60_000);
		h.put('a', 1);
		expect(h.take('a')).toBe(1);
		expect(h.take('a')).toBeNull();
	});
	it('forgets after ttl and calls onExpire once', () => {
		const gone = vi.fn();
		const h = new Hold<number>(60_000, gone);
		h.put('a', 1);
		vi.advanceTimersByTime(59_999);
		expect(gone).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(gone).toHaveBeenCalledWith(1);
		expect(gone).toHaveBeenCalledTimes(1);
		expect(h.take('a')).toBeNull();
	});
	it('does not expire what was taken', () => {
		const gone = vi.fn();
		const h = new Hold<number>(60_000, gone);
		h.put('a', 1);
		h.take('a');
		vi.advanceTimersByTime(120_000);
		expect(gone).not.toHaveBeenCalled();
	});
	it('expires the old value when a key is put again', () => {
		const gone = vi.fn();
		const h = new Hold<number>(60_000, gone);
		h.put('a', 1);
		h.put('a', 2);
		expect(gone).toHaveBeenCalledWith(1);
		expect(h.take('a')).toBe(2);
		vi.advanceTimersByTime(120_000);
		expect(gone).toHaveBeenCalledTimes(1);
	});
	it('keeps keys apart', () => {
		const h = new Hold<number>(60_000);
		h.put('a', 1);
		h.put('b', 2);
		expect(h.take('b')).toBe(2);
		expect(h.take('a')).toBe(1);
	});
});
