import { describe, expect, it } from 'vitest';
import { catalogOf, t } from './catalog';
import { locale, withLocale } from './current';
import { LOCALE_NAME, LOCALES, parseLocale, requestLocale } from './locale';
import { slCount, slForm } from './plural';

describe('slForm', () => {
	it.each([
		[1, 'one'],
		[2, 'two'],
		[3, 'few'],
		[4, 'few'],
		[5, 'other'],
		[0, 'other'],
		[11, 'other'],
		[12, 'other'],
		[101, 'one'],
		[102, 'two'],
		[103, 'few'],
		[111, 'other']
	] as const)('%i is %s', (n, form) => {
		expect(slForm(n)).toBe(form);
	});
});

describe('slCount', () => {
	const forms: [string, string, string, string] = ['vaja', 'vaji', 'vaje', 'vaj'];
	it('puts the number before the form it takes', () => {
		expect(slCount(5, forms)).toBe('5 vaj');
		expect(slCount(2, forms)).toBe('2 vaji');
		expect(slCount(1, forms)).toBe('1 vaja');
		expect(slCount(3, forms)).toBe('3 vaje');
	});
});

describe('the current language', () => {
	it('is English with no source set', () => {
		expect(locale()).toBe('en');
		expect(t().common.save).toBe('Save');
	});

	it('withLocale draws in that language, and only inside it', () => {
		expect(withLocale('sl', () => t().common.save)).toBe('Shrani');
		expect(withLocale('sl', () => locale())).toBe('sl');
		expect(t().common.save).toBe('Save');
		expect(locale()).toBe('en');
	});

	it('withLocale restores the language when fn throws', () => {
		expect(() =>
			withLocale('sl', () => {
				throw new Error('boom');
			})
		).toThrow('boom');
		expect(locale()).toBe('en');
	});

	it('withLocale nests', () => {
		expect(withLocale('sl', () => withLocale('en', () => t().common.save) + t().common.save)).toBe(
			'SaveShrani'
		);
	});
});

describe('common', () => {
	it('writes a decimal with a dot in English and a comma in Slovenian', () => {
		expect(t().common.decimal(1.5, 1)).toBe('1.5');
		expect(withLocale('sl', () => t().common.decimal(1.5, 1))).toBe('1,5');
		expect(withLocale('sl', () => t().common.decimal(0.25, 2))).toBe('0,25');
		expect(t().common.decimal(2, 1)).toBe('2.0');
	});

	it('has every English word in Slovenian, and none left in English', () => {
		const en = catalogOf('en').common;
		const sl = catalogOf('sl').common;
		expect(Object.keys(sl).sort()).toEqual(Object.keys(en).sort());
		for (const [key, word] of Object.entries(en)) {
			if (typeof word !== 'string') continue;
			// ⋯ is a symbol in both languages.
			if (key === 'more') continue;
			expect(sl[key as keyof typeof sl], key).not.toBe(word);
		}
	});
});

describe('parseLocale', () => {
	it('takes only a known language', () => {
		expect(parseLocale('en')).toBe('en');
		expect(parseLocale('sl')).toBe('sl');
		expect(parseLocale('xx')).toBeNull();
		expect(parseLocale(undefined)).toBeNull();
		expect(parseLocale(null)).toBeNull();
		expect(parseLocale(1)).toBeNull();
	});

	it('names each language in its own words', () => {
		expect(LOCALES).toEqual(['en', 'sl']);
		expect(LOCALE_NAME).toEqual({ en: 'English', sl: 'Slovenščina' });
	});
});

describe('requestLocale', () => {
	it("a signed-in person's language beats the cookie", () => {
		expect(requestLocale({ user: { locale: 'sl' }, cookie: 'en', invite: null })).toBe('sl');
	});

	it('a signed-in person with none is English, whatever the cookie says', () => {
		expect(requestLocale({ user: { locale: null }, cookie: 'sl', invite: 'sl' })).toBe('en');
	});

	it("signed out, the invite's language beats the cookie", () => {
		expect(requestLocale({ user: null, cookie: 'en', invite: 'sl' })).toBe('sl');
	});

	it('signed out, the cookie alone decides', () => {
		expect(requestLocale({ user: null, cookie: 'sl', invite: null })).toBe('sl');
	});

	it('an unknown cookie is English', () => {
		expect(requestLocale({ user: null, cookie: 'xx', invite: null })).toBe('en');
		expect(requestLocale({ user: null, cookie: undefined, invite: null })).toBe('en');
	});
});

describe('admin', () => {
	it('has every English word in Slovenian, and none left in English', () => {
		const en = catalogOf('en').admin;
		const sl = catalogOf('sl').admin;
		expect(Object.keys(sl).sort()).toEqual(Object.keys(en).sort());
		for (const [key, word] of Object.entries(en)) {
			expect(sl[key as keyof typeof sl], key).not.toBe(word);
		}
	});
});

/** Every string in an area, by its path ("tabs.today"); arrays by index. */
function leaves(o: unknown, at = ''): [string, string][] {
	if (typeof o === 'string') return [[at, o]];
	if (o === null || typeof o !== 'object') return [];
	return Object.entries(o).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k));
}

describe.each([
	'format',
	'shell',
	'entry',
	'today',
	'exercise',
	'songs',
	'lesson',
	'comments',
	'video'
] as const)('%s', (area) => {
	it('has every English word in Slovenian, and none left in English', () => {
		const en = leaves(catalogOf('en')[area]);
		const sl = new Map(leaves(catalogOf('sl')[area]));
		expect([...sl.keys()].sort()).toEqual(en.map(([k]) => k).sort());
		for (const [key, word] of en) expect(sl.get(key), key).not.toBe(word);
	});
});
