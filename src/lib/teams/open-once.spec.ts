import { describe, expect, it, vi } from 'vitest';
import { openOnce } from './open-once';

/*
 * A group's lesson reports "opened" from an effect that reruns on every load of
 * the page's data. The report is a device write: it lands through a push, the
 * landing refreshes the page (`refreshWhenSettled`), and the fresh data ran the
 * effect again — a refresh about every second for as long as the lesson was
 * open, each one closing the video player. The report goes out once per shown
 * lesson and publish, however often its data reloads.
 */
describe('openOnce', () => {
	it('reports a reloaded lesson once: the same id and publish', () => {
		const send = vi.fn();
		const shown = openOnce(send);
		shown('lesson', 7, null);
		shown('lesson', 7, null);
		shown('lesson', 7, null);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith('lesson', 7);
	});

	it('reports again when the editor publishes it (a new publishedAt)', () => {
		const send = vi.fn();
		const shown = openOnce(send);
		shown('lesson', 7, null);
		shown('lesson', 7, 1_700_000_000_000);
		shown('lesson', 7, 1_700_000_000_000);
		expect(send).toHaveBeenCalledTimes(2);
	});

	it('reports another lesson, and the first again on coming back to it', () => {
		const send = vi.fn();
		const shown = openOnce(send);
		shown('lesson', 7, null);
		shown('lesson', 8, null);
		shown('lesson', 7, null);
		expect(send.mock.calls).toEqual([
			['lesson', 7],
			['lesson', 8],
			['lesson', 7]
		]);
	});
});
