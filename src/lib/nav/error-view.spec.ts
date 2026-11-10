import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { errorBack, errorView } from './error-view';

describe('errorView', () => {
	it('reads needs-connection as offline', () => {
		expect(errorView(503, 'needs-connection', false)).toEqual(errorView(503, undefined, true));
	});
	it('404', () => {
		expect(errorView(404, 'Not Found', false)).toEqual({
			title: 'Not found',
			icon: 'search',
			tone: 'accent',
			heading: 'Nothing here',
			body: 'This page does not exist, or what it showed was deleted.',
			code: null,
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
});

describe('errorBack', () => {
	it('goes to the tab the path belongs to', () => {
		expect(errorBack('/salsa/figures/999', 'salsa')).toEqual({
			href: '/salsa/figures',
			label: 'Back to Moves'
		});
		// Moves' route id is in a route group, `/[dance]/(moves)/figures`; its URL is not.
		expect(errorBack('/salsa/figures/3', 'salsa')).toEqual({
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
	it('goes only to a tab the level has', () => {
		// Moves is not a tab below Everything: Today instead.
		expect(errorBack('/salsa/figures/3', 'salsa', 'own')).toEqual({
			href: '/salsa',
			label: 'Back to Today'
		});
		expect(errorBack('/salsa/lessons/4', 'salsa', 'follow')).toEqual({
			href: '/salsa',
			label: 'Back to Today'
		});
		expect(errorBack('/salsa/groups/2', 'salsa', 'follow')).toEqual({
			href: '/salsa/groups',
			label: 'Back to My class'
		});
		expect(errorBack('/salsa/lessons/4', 'salsa', 'own')).toEqual({
			href: '/salsa/lessons',
			label: 'Back to Lessons'
		});
	});
});

describe('in Slovenian', () => {
	it('names the page and the way back in Slovenian; 404 has no code line', () => {
		const v = withLocale('sl', () => errorView(404, undefined, false));
		expect([v.title, v.heading, v.code]).toEqual(['Ni najdeno', 'Tu ni ničesar', null]);
		expect(withLocale('sl', () => errorView(0, undefined, true).title)).toBe('Brez povezave');
		expect(withLocale('sl', () => errorBack('/salsa/figures/3', 'salsa').label)).toBe(
			'Nazaj: Figure'
		);
		expect(withLocale('sl', () => errorBack('/salsa/groups', 'salsa', 'follow').label)).toBe(
			'Nazaj: Moj tečaj'
		);
	});
});
