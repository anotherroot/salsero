import { describe, expect, it } from 'vitest';
import {
	fullLoadFor,
	mayReloadNow,
	localeStale,
	needsLocaleReload,
	reloadTitle,
	reloadWhy,
	staleLine,
	staleTitle,
	typedFields
} from './fresh';

const QUIET = { playerOpen: false, sheetsOpen: false, unsaved: 0, held: 0 };

describe('fullLoadFor', () => {
	const link = { type: 'link', willUnload: false, fromPath: '/salsa', toPath: '/salsa/moves' };
	const state = { updated: true, asking: false, online: true, ...QUIET };

	it('makes a link to another page a full load once a new version is out', () => {
		expect(fullLoadFor(link, state)).toBe(true);
	});

	it('takes a goto and a form to another page too', () => {
		expect(fullLoadFor({ ...link, type: 'goto' }, state)).toBe(true);
		expect(fullLoadFor({ ...link, type: 'form' }, state)).toBe(true);
	});

	it('leaves navigation alone while the version is current', () => {
		expect(fullLoadFor(link, { ...state, updated: false })).toBe(false);
	});

	it('waits while the unsaved-changes guard is asking', () => {
		expect(fullLoadFor(link, { ...state, asking: true })).toBe(false);
	});

	it('never takes a popstate: a sheet closing or the player stepping up is one', () => {
		expect(fullLoadFor({ ...link, type: 'popstate' }, state)).toBe(false);
	});

	it('leaves a change of search on the same page alone', () => {
		expect(fullLoadFor({ ...link, toPath: '/salsa' }, state)).toBe(false);
	});

	it('leaves a navigation that already unloads alone', () => {
		expect(fullLoadFor({ ...link, willUnload: true }, state)).toBe(false);
	});

	it('leaves a navigation with nowhere to go alone', () => {
		expect(fullLoadFor({ ...link, toPath: null }, state)).toBe(false);
	});

	it('leaves it to the layout when there is no connection (it stops the page and says so)', () => {
		expect(fullLoadFor(link, { ...state, online: false })).toBe(false);
	});

	it('stays in the app while a sheet or the player holds history entries', () => {
		expect(fullLoadFor(link, { ...state, sheetsOpen: true })).toBe(false);
		expect(fullLoadFor(link, { ...state, playerOpen: true })).toBe(false);
	});

	it('stays in the app while anything a reload would lose is on the page', () => {
		expect(fullLoadFor(link, { ...state, unsaved: 1 })).toBe(false);
		expect(fullLoadFor(link, { ...state, held: 1 })).toBe(false);
	});
});

describe('mayReloadNow', () => {
	const clear = { routeId: '/[dance]/(today)', ...QUIET };

	it('reloads a quiet page', () => {
		expect(mayReloadNow(clear)).toBe(true);
	});

	it('never reloads Practice', () => {
		expect(mayReloadNow({ ...clear, routeId: '/[dance]/player' })).toBe(false);
	});

	it('never reloads My count', () => {
		expect(mayReloadNow({ ...clear, routeId: '/voice' })).toBe(false);
	});

	it('never reloads over the full-screen player', () => {
		expect(mayReloadNow({ ...clear, playerOpen: true })).toBe(false);
	});

	it('never reloads over an open sheet', () => {
		expect(mayReloadNow({ ...clear, sheetsOpen: true })).toBe(false);
	});

	it('never reloads over unsaved work', () => {
		expect(mayReloadNow({ ...clear, unsaved: 1 })).toBe(false);
	});

	it('never reloads while something holds it (an upload, a practice run)', () => {
		expect(mayReloadNow({ ...clear, held: 1 })).toBe(false);
	});

	it('reloads a page outside any route (an error page)', () => {
		expect(mayReloadNow({ ...clear, routeId: null })).toBe(true);
	});
});

describe('localeStale: the page draws in another language than its data names', () => {
	it('is stale when the data names another language', () => {
		expect(localeStale('en', 'sl')).toBe(true);
		expect(localeStale('sl', 'en')).toBe(true);
	});

	it('is not stale in the same language, or when the data names none', () => {
		expect(localeStale('sl', 'sl')).toBe(false);
		expect(localeStale('en', undefined)).toBe(false);
	});
});

describe('needsLocaleReload: after sign-in, or an admin changing the language', () => {
	const clear = {
		drawn: 'en' as const,
		wanted: 'sl' as const,
		routeId: '/[dance]/(today)',
		...QUIET
	};

	it('reloads a quiet page drawn in the wrong language', () => {
		expect(needsLocaleReload(clear)).toBe(true);
	});

	it('never reloads a page already in its language', () => {
		expect(needsLocaleReload({ ...clear, drawn: 'sl' })).toBe(false);
		expect(needsLocaleReload({ ...clear, wanted: undefined })).toBe(false);
	});

	it('never cuts a hold (an upload, a run), unsaved work, a sheet or the player', () => {
		expect(needsLocaleReload({ ...clear, held: 1 })).toBe(false);
		expect(needsLocaleReload({ ...clear, unsaved: 1 })).toBe(false);
		expect(needsLocaleReload({ ...clear, sheetsOpen: true })).toBe(false);
		expect(needsLocaleReload({ ...clear, playerOpen: true })).toBe(false);
	});

	it('never reloads Practice or My count', () => {
		expect(needsLocaleReload({ ...clear, routeId: '/[dance]/player' })).toBe(false);
		expect(needsLocaleReload({ ...clear, routeId: '/voice' })).toBe(false);
	});
});

describe('typedFields', () => {
	const field = (o: Partial<Parameters<typeof typedFields>[0][number]> = {}) => ({
		tag: 'input',
		type: 'email',
		focused: false,
		value: '',
		defaultValue: '',
		...o
	});
	it('counts nothing on an untouched form', () =>
		expect(typedFields([field(), field({ type: 'password' })])).toBe(0));
	// Signing in: the keyboard is up on the email field, nothing typed yet.
	it('counts a field with focus', () => expect(typedFields([field({ focused: true })])).toBe(1));
	// Typed or autofilled, then the page went out of view (an autofill popup).
	it('counts a field whose value is not the one the page drew', () =>
		expect(typedFields([field({ value: 'a@b.c' })])).toBe(1));
	it('counts a textarea', () =>
		expect(typedFields([field({ tag: 'textarea', type: 'textarea', value: 'x' })])).toBe(1));
	it('does not count a value the page drew itself', () =>
		expect(typedFields([field({ value: 'a@b.c', defaultValue: 'a@b.c' })])).toBe(0));
	it('ignores hidden fields, checkboxes and buttons', () =>
		expect(
			typedFields([
				field({ type: 'hidden', value: 'x' }),
				field({ type: 'checkbox', focused: true }),
				field({ type: 'submit', focused: true })
			])
		).toBe(0));
});

describe('reloadWhy: the toast says why the page did not reload by itself', () => {
	const q = { playerOpen: false, sheetsOpen: false, unsaved: 0, held: 0 };
	it('names what kept the page, the unsaved first', () => {
		expect(reloadWhy({ ...q, unsaved: 1, held: 1, sheetsOpen: true })).toBe(
			'Kept so nothing unsaved is lost.'
		);
		expect(reloadWhy({ ...q, held: 1, sheetsOpen: true })).toBe('Kept while this runs.');
		expect(reloadWhy({ ...q, sheetsOpen: true })).toBe('Kept while this is open.');
		expect(reloadWhy({ ...q, playerOpen: true })).toBe('Kept while this is open.');
	});
	it('with nothing holding it, says when it comes', () => {
		expect(reloadWhy(q)).toBe('Your next page loads it.');
		expect([reloadTitle(), staleTitle(), staleLine()]).toEqual([
			'The app was updated',
			'This page is out of date',
			'Reload to continue.'
		]);
	});
});
