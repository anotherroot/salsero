import { describe, expect, it } from 'vitest';
import { deviceLine } from './device';

describe('deviceLine', () => {
	it('reads the system and the browser', () => {
		const cases: [string, string][] = [
			[
				'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
				'Android 14 · Chrome 131'
			],
			[
				'Mozilla/5.0 (Linux; Android 16; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 SalsaApp/9 (salsa; direct)',
				'Android 16 · WebView 140'
			],
			[
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
				'iOS 17.1 · Safari 17'
			],
			[
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
				'Windows · Edge 130'
			],
			[
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:132.0) Gecko/20100101 Firefox/132.0',
				'Mac · Firefox 132'
			],
			[
				'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
				'Android 14 · Samsung Internet 25'
			]
		];
		for (const [ua, line] of cases) expect(deviceLine(ua)).toBe(line);
	});

	it('leaves out what it does not know', () => {
		expect(deviceLine(null)).toBeNull();
		expect(deviceLine('')).toBeNull();
		expect(deviceLine('curl/8.4.0')).toBeNull();
		expect(deviceLine('Mozilla/5.0 (X11; Linux x86_64) Something/1')).toBe('Linux');
	});
});
