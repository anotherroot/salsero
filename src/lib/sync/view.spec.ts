import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { timeOfDay } from '$lib/day/day';
import {
	discardQuestion,
	labelText,
	lastSyncedText,
	reasonText,
	signOutQuestion,
	statusText
} from './view';

// Tue 2026-11-10 10:04 UTC
const TUE = Date.UTC(2026, 10, 10, 10, 4);
const en = <T>(fn: () => T) => withLocale('en', fn);

describe('the Sync words', () => {
	it('says a log as "Log · Enchufla drill · Tue 10:04"', () => {
		expect(en(() => labelText({ kind: 'log', thing: 'Enchufla drill' }, TUE, 'UTC'))).toBe(
			'Log · Enchufla drill · Tue 10:04'
		);
	});

	it('says a note, a name, and a change with no name', () => {
		expect(en(() => labelText({ kind: 'note', thing: 'Dile que no' }, TUE, 'UTC'))).toBe(
			'Note on Dile que no'
		);
		expect(en(() => labelText({ kind: 'name', thing: 'Basic' }, TUE, 'UTC'))).toBe('Name of Basic');
		expect(en(() => labelText({ kind: 'edit', thing: null }, TUE, 'UTC'))).toBe('A change');
		expect(en(() => labelText({ kind: 'heart', thing: null }, TUE, 'UTC'))).toBe(
			'A heart on a comment'
		);
	});

	it("says why, in the server's own words for a plain refusal", () => {
		expect(
			en(() =>
				reasonText({
					state: 'refused',
					reason: 'refused',
					message: 'Pick a face first.',
					clash: null
				})
			)
		).toBe('Pick a face first.');
		expect(
			en(() => reasonText({ state: 'refused', reason: 'gone', message: null, clash: null }))
		).toBe('It was archived or deleted meanwhile.');
		expect(
			en(() =>
				reasonText({
					state: 'refused',
					reason: 'clash',
					message: null,
					clash: { changed: [], current: {}, by: 'Luka', at: 1 }
				})
			)
		).toBe('Luka changed it meanwhile.');
		expect(en(() => reasonText({ state: 'held', reason: null, message: null, clash: null }))).toBe(
			'Waits for the change above'
		);
		expect(
			en(() => reasonText({ state: 'refused', reason: 'stale', message: 'x', clash: null }))
		).toBe('The app was updated since.');
	});

	it('says last synced as a time today and a weekday before', () => {
		expect(en(() => lastSyncedText(null, TUE, 'UTC'))).toBe('Not synced yet');
		expect(en(() => lastSyncedText(TUE - 3600_000, TUE, 'UTC'))).toBe(
			`Last synced ${timeOfDay(TUE - 3600_000, 'UTC')}`
		);
		expect(en(() => lastSyncedText(TUE - 86_400_000, TUE, 'UTC'))).toBe('Last synced Mon 10:04');
	});

	it('asks before discarding, counting what waits on it', () => {
		expect(en(() => discardQuestion(0))).toEqual({
			title: 'Discard this change?',
			body: 'It was never saved on the server.'
		});
		expect(en(() => discardQuestion(1)).body).toBe(
			'It was never saved on the server. The change waiting for it goes too.'
		);
		expect(en(() => discardQuestion(3)).body).toBe(
			'It was never saved on the server. The 3 changes waiting for it go too.'
		);
		expect(en(() => signOutQuestion(1)).title).toBe("1 change hasn't synced");
		expect(en(() => signOutQuestion(3))).toEqual({
			title: "3 changes haven't synced",
			body: 'Sign out and lose them?',
			confirm: 'Sign out'
		});
		expect(en(() => statusText({ kind: 'waiting', count: 3 }))).toBe('3 waiting');
		expect(en(() => statusText({ kind: 'refused', count: 1 }))).toBe("1 couldn't sync");
		expect(en(() => statusText({ kind: 'none' }))).toBeNull();
	});

	it('speaks Slovenian with the name after a "·"', () => {
		expect(
			withLocale('sl', () =>
				reasonText({
					state: 'refused',
					reason: 'clash',
					message: null,
					clash: { changed: [], current: {}, by: 'Luka', at: 1 }
				})
			)
		).toBe('Medtem spremenjeno · Luka');
		expect(withLocale('sl', () => statusText({ kind: 'signin' }))).toBe(
			'Prijavite se za sinhronizacijo'
		);
	});
});
