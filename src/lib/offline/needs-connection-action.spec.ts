import { afterEach, describe, expect, it, vi } from 'vitest';
import { needsConnection } from './needs-connection-action';

afterEach(() => vi.unstubAllGlobals());

/** A button as far as the action needs one: events, and attributes it sets. */
function fakeElement() {
	const el = new EventTarget() as EventTarget & {
		attrs: Map<string, string>;
		setAttribute(k: string, v: string): void;
		removeAttribute(k: string): void;
	};
	el.attrs = new Map();
	el.setAttribute = (k, v) => void el.attrs.set(k, v);
	el.removeAttribute = (k) => void el.attrs.delete(k);
	return el;
}

describe('use:needsConnection', () => {
	it('offline, a tap toasts and goes nowhere', () => {
		const told = vi.fn();
		vi.stubGlobal('window', { dispatchEvent: told });
		const el = fakeElement();
		needsConnection(el as unknown as HTMLElement, false);
		expect(el.attrs.get('aria-disabled')).toBe('true');
		expect(el.attrs.has('data-offline')).toBe(true);
		const tap = new Event('click', { cancelable: true });
		el.dispatchEvent(tap);
		expect(tap.defaultPrevented).toBe(true);
		expect(told).toHaveBeenCalledTimes(1);
		expect((told.mock.calls[0][0] as Event).type).toBe('salsa:needs-connection');
	});

	it('online, it is an ordinary button', () => {
		const told = vi.fn();
		vi.stubGlobal('window', { dispatchEvent: told });
		const el = fakeElement();
		const action = needsConnection(el as unknown as HTMLElement, false);
		action?.update?.(true);
		expect(el.attrs.has('aria-disabled')).toBe(false);
		expect(el.attrs.has('data-offline')).toBe(false);
		const tap = new Event('click', { cancelable: true });
		el.dispatchEvent(tap);
		expect(tap.defaultPrevented).toBe(false);
		expect(told).not.toHaveBeenCalled();
	});
});
