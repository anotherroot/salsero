import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { askedLine, barFraction, itemMeta, usageLine } from './storage-view';

const MB = 1024 * 1024;

describe('storage view', () => {
	it('words the usage', () => {
		expect(usageLine(820 * MB, 1024 * MB)).toBe('Using 820 MB of 1.0 GB');
		expect(usageLine(820 * MB, null)).toBe('Using 820 MB');
	});
	it('fills the bar, capped, and is empty without a limit', () => {
		expect(barFraction(512 * MB, 1024 * MB)).toBe(0.5);
		expect(barFraction(2048 * MB, 1024 * MB)).toBe(1);
		expect(barFraction(5, null)).toBe(0);
		expect(barFraction(5, 0)).toBe(1);
	});
	it('words a row’s meta', () => {
		const base = { context: 'Enchufla · Basic', sizeBytes: 3 * MB };
		expect(itemMeta(base)).toBe('Enchufla · Basic · 3 MB');
	});
	it('words the open request', () => {
		expect(askedLine('2026-11-02')).toBe('Asked on 2 Nov 2026 · waiting');
	});
});

describe('storage view in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('words the usage with a decimal comma', () => {
		expect(sl(() => usageLine(820 * MB, 1229 * MB))).toBe('Uporabljate 820 MB od 1,2 GB');
		expect(sl(() => usageLine(820 * MB, null))).toBe('Uporabljate 820 MB');
	});
	it('words the open request', () => {
		expect(sl(() => askedLine('2026-11-02'))).toBe(
			'Prošnja poslana 2. nov. 2026 · čaka na odgovor'
		);
	});
});
