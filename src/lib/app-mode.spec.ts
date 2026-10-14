import { describe, expect, it } from 'vitest';
import { SHARE_KEY_RE, pairedLink, uploadLink } from './app-mode';

describe('native links', () => {
	const lesson = { back: '/salsa/lessons/12', name: 'Wednesday class' };

	it('send a lesson or a figure to the uploader, with where to come back to', () => {
		expect(uploadLink({ lesson: 12 }, lesson)).toBe(
			'salsa://upload?lesson=12&back=%2Fsalsa%2Flessons%2F12&name=Wednesday+class'
		);
		expect(uploadLink({ figure: 7 }, { back: '/bachata/figures/7', name: 'Enchufla' })).toBe(
			'salsa://upload?figure=7&back=%2Fbachata%2Ffigures%2F7&name=Enchufla'
		);
	});

	it('carry a shared file by its key', () => {
		const key = '0f8e2a3c-1b2d-4e5f-8a9b-0c1d2e3f4a5b';
		expect(uploadLink({ lesson: 12 }, { ...lesson, share: key })).toBe(
			`salsa://upload?lesson=12&back=%2Fsalsa%2Flessons%2F12&name=Wednesday+class&share=${key}`
		);
	});

	it('hand the token over, encoded', () => {
		expect(pairedLink('a+b/c=')).toBe('salsa://paired?token=a%2Bb%2Fc%3D');
	});

	it('know a share key when they see one', () => {
		expect(SHARE_KEY_RE.test('0f8e2a3c-1b2d-4e5f-8a9b-0c1d2e3f4a5b')).toBe(true);
		expect(SHARE_KEY_RE.test('../etc/passwd')).toBe(false);
		expect(SHARE_KEY_RE.test('')).toBe(false);
	});
});
