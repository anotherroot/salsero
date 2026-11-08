import { describe, expect, it } from 'vitest';
import { t } from '$lib/i18n/catalog';
import { locale } from '$lib/i18n/current';
import { runInLocale } from './i18n-request';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('runInLocale', () => {
	it('keeps each request in its own language across awaits', async () => {
		const read = (l: 'en' | 'sl', ms: number) =>
			runInLocale(l, async () => {
				await tick(ms);
				const first = locale();
				await tick(ms);
				return [first, locale(), t().common.save];
			});
		const [en, sl] = await Promise.all([read('en', 15), read('sl', 5)]);
		expect(en).toEqual(['en', 'en', 'Save']);
		expect(sl).toEqual(['sl', 'sl', 'Shrani']);
	});

	it('is English outside any request', () => {
		expect(locale()).toBe('en');
	});
});
