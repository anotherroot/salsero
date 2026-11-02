import { describe, expect, it } from 'vitest';
import { cleanName, fullName, needsName, shortNames } from './names';

const p = (id: string, firstName: string | null, lastName: string | null) => ({
	id,
	firstName,
	lastName,
	email: `${id}@example.com`
});

describe('cleanName', () => {
	it('trims, and refuses empty and over 60 characters', () => {
		expect(cleanName('  Ana ')).toBe('Ana');
		expect(cleanName('  ')).toBeNull();
		expect(cleanName(null)).toBeNull();
		expect(cleanName('x'.repeat(60))).toBe('x'.repeat(60));
		expect(cleanName('x'.repeat(61))).toBeNull();
	});
});

describe('fullName', () => {
	it('is both names, or the email without any', () => {
		expect(fullName(p('a', 'Ana', 'Kranjc'))).toBe('Ana Kranjc');
		expect(fullName(p('a', 'Ana', null))).toBe('Ana');
		expect(fullName(p('a', null, null))).toBe('a@example.com');
	});
});

describe('shortNames', () => {
	it('is the first name when it is alone', () => {
		expect(shortNames([p('1', 'Ana', 'Kranjc'), p('2', 'Bor', 'Novak')]).get('1')).toBe('Ana');
	});
	it('adds the last initial when two share a first name', () => {
		const m = shortNames([p('1', 'Ana', 'Kranjc'), p('2', 'ana', 'Petek'), p('3', 'Bor', 'N')]);
		expect(m.get('1')).toBe('Ana K.');
		expect(m.get('2')).toBe('ana P.');
		expect(m.get('3')).toBe('Bor');
	});
	it('falls back to the email', () => {
		expect(shortNames([p('1', null, null)]).get('1')).toBe('1@example.com');
	});
});

describe('needsName', () => {
	const anon = { firstName: null };
	it('sends a nameless person asking for a page', () => {
		expect(needsName('/salsa', anon)).toBe(true);
		expect(needsName('/settings', anon)).toBe(true);
	});
	it('leaves welcome, logout, the API and the media servers alone', () => {
		for (const path of [
			'/welcome',
			'/logout',
			'/api/songs',
			'/recordings/a.mp4',
			'/audio/a.mp3',
			'/count/a.wav',
			'/lesson-videos/a.mp4'
		]) {
			expect(needsName(path, anon)).toBe(false);
		}
	});
	it('leaves a named person and a visitor alone', () => {
		expect(needsName('/salsa', { firstName: 'Ana' })).toBe(false);
		expect(needsName('/login', null)).toBe(false);
	});
});
