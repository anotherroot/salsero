import { describe, expect, it } from 'vitest';
import { pollStep } from './poll';

describe('pollStep', () => {
	it('pulls when the device draws the page: the pull re-reads it once the worker is done', () =>
		expect(pollStep(true)).toBe('pull'));
	it('reloads from the network without a device (dev, a failed start)', () =>
		expect(pollStep(false)).toBe('reload'));
});
