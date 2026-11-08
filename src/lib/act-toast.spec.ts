import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { refusalMessage, undoToast } from './act-toast';

const noop = () => {};

describe('undoToast', () => {
	it('offers Undo in the current language', () => {
		expect(undoToast(1, 'Salsa app removed', noop, noop)).toMatchObject({
			id: 1,
			message: 'Salsa app removed',
			action: 'Undo'
		});
		expect(withLocale('sl', () => undoToast(1, 'x', noop, noop).action)).toBe('Razveljavi');
	});
});

describe('refusalMessage', () => {
	it("is the server's message, the fallback, or null", () => {
		expect(refusalMessage({ type: 'success', status: 200 }, 'No')).toBeNull();
		expect(refusalMessage({ type: 'failure', status: 400, data: { message: 'Nope' } }, 'No')).toBe(
			'Nope'
		);
		expect(refusalMessage({ type: 'failure', status: 0 }, 'No')).toBe('No');
	});
});
