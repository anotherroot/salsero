import { describe, expect, it } from 'vitest';
import { drawnBy, galleryPerson, pagePerson } from './person';
import { SHELL } from './sw-route';

describe('drawnBy', () => {
	it('tells the server from the device and the shell', () => {
		expect(drawnBy(false, '/salsa/figures')).toBe('server');
		expect(drawnBy(true, '/salsa/figures')).toBe('device');
		expect(drawnBy(false, SHELL)).toBe('shell');
		expect(drawnBy(true, SHELL)).toBe('device');
	});
});

describe('pagePerson', () => {
	const ana = { id: 'u1' };
	it("is the server's word: the person, or null signed out", () => {
		expect(pagePerson({ user: ana, drawnBy: 'server' })).toBe('u1');
		expect(pagePerson({ user: null, drawnBy: 'server' })).toBeNull();
	});

	it('is unknown when the copy drew the page, or the shell, or nobody said', () => {
		// The device's person is the copy's own: it proves nothing about who is signed in.
		expect(pagePerson({ user: ana, drawnBy: 'device' })).toBeUndefined();
		// The shell is cached signed out: its null is no sign-out.
		expect(pagePerson({ user: null, drawnBy: 'shell' })).toBeUndefined();
		expect(pagePerson({ user: null })).toBeUndefined();
		expect(pagePerson({})).toBeUndefined();
	});
});

describe('galleryPerson: whose gallery originals the app is asked about (offline 4c, part 2 review C1)', () => {
	it('the server’s or the copy’s person; the empty shell knows none', () => {
		expect(galleryPerson({ user: { id: 'u1' }, drawnBy: 'server' })).toBe('u1');
		expect(galleryPerson({ user: { id: 'u1' }, drawnBy: 'device' })).toBe('u1');
		expect(galleryPerson({ user: null, drawnBy: 'device' })).toBeNull();
		expect(galleryPerson({ user: { id: 'u1' }, drawnBy: 'shell' })).toBeUndefined();
	});
});
