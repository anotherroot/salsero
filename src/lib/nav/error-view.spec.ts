import { describe, expect, it } from 'vitest';
import { errorBack, errorView } from './error-view';
import { STALE_MESSAGE } from '$lib/page-epoch';

describe('errorView', () => {
	it('404', () => {
		expect(errorView(404, 'Not Found', false)).toEqual({
			title: 'Not found',
			icon: 'search',
			tone: 'accent',
			heading: 'Nothing here',
			body: 'This page does not exist, or what it showed was deleted.',
			code: 'ERROR 404',
			retry: false,
			today: true
		});
		expect(errorView(404, 'Nothing was shared', false).heading).toBe('Nothing was shared');
	});
	it('500', () => {
		expect(errorView(500, 'Internal Error', false)).toEqual({
			title: 'Error',
			icon: 'warning',
			tone: 'danger',
			heading: 'Something went wrong',
			body: 'The server could not open this page. Try again in a moment.',
			code: 'ERROR 500',
			retry: true,
			today: true
		});
		expect(errorView(503, undefined, false).code).toBe('ERROR 503');
	});
	it('offline', () => {
		expect(errorView(500, 'Internal Error', true)).toEqual({
			title: 'Offline',
			icon: 'refresh',
			tone: 'warn',
			heading: 'You’re offline',
			body: 'This page needs the server. Check the connection and try again; nothing you saved is lost.',
			code: null,
			retry: true,
			today: false
		});
	});
	it('other 4xx', () => {
		expect(errorView(400, 'Unknown take.', false)).toMatchObject({
			title: 'Error',
			icon: 'warning',
			tone: 'danger',
			heading: 'Unknown take.',
			body: 'Go back and try again.',
			code: 'ERROR 400',
			retry: false,
			today: true
		});
	});
	it('a page the server refused as out of date: the words, no status number', () => {
		expect(errorView(409, STALE_MESSAGE, false)).toEqual({
			title: 'Out of date',
			icon: 'refresh',
			tone: 'warn',
			heading: 'This page is out of date',
			body: 'Reload to continue. Nothing you saved is lost.',
			code: null,
			retry: false,
			today: false
		});
		// Any other 409 is an ordinary error.
		expect(errorView(409, 'That take is in use.', false).code).toBe('ERROR 409');
	});
});

describe('errorBack', () => {
	it('goes to the tab the path belongs to', () => {
		expect(errorBack('/salsa/figures/999', 'salsa')).toEqual({
			href: '/salsa/figures',
			label: 'Back to Moves'
		});
		expect(errorBack('/bachata/lessons/4', 'bachata')).toEqual({
			href: '/bachata/lessons',
			label: 'Back to Lessons'
		});
	});
	it('falls back to Today', () => {
		expect(errorBack('/settings', 'salsa')).toEqual({ href: '/salsa', label: 'Back to Today' });
	});
});
