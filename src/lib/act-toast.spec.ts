import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { globSync, readFileSync } from 'node:fs';
import { parse } from 'devalue';
import type { ActionResult } from '@sveltejs/kit';
import { offlineWrite } from '$lib/offline/needs-connection';
import { offlineRefusal, refusalMessage, undoToast } from './act-toast';

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

describe('offlineRefusal', () => {
	/** What SvelteKit's client makes of the service worker's offline answer. */
	const offline = (): ActionResult => {
		const body = JSON.parse(offlineWrite(true, 'Needs a connection.').body);
		return { type: 'failure', status: body.status, data: parse(body.data) };
	};

	it("is the service worker's offline refusal: the root layout said it already, translated", () => {
		expect(offlineRefusal(offline())).toBe(true);
		// Still refused: a page never takes it for a success.
		expect(refusalMessage(offline(), 'No')).not.toBeNull();
		expect(offlineRefusal({ type: 'failure', status: 400, data: { message: 'Nope' } })).toBe(false);
		expect(offlineRefusal({ type: 'failure', status: 0 })).toBe(false);
		expect(offlineRefusal({ type: 'success', status: 200 })).toBe(false);
		expect(offlineRefusal({ type: 'error', status: 500, error: new Error('x') })).toBe(false);
	});

	it('is asked by every page that shows a refusal', () => {
		const files = globSync('src/**/*.{svelte,ts}').filter(
			(f) => !f.endsWith('.spec.ts') && !f.endsWith('act-toast.ts')
		);
		const missing = files.filter((f) => {
			const src = readFileSync(f, 'utf8');
			return /refusalMessage\(/.test(src) && !/offlineRefusal\(/.test(src);
		});
		expect(missing).toEqual([]);
	});
});
