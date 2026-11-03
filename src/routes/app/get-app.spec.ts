import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const run = (ua: string) =>
	(load as (e: unknown) => Promise<Record<string, unknown>>)({
		request: new Request('https://salsa.example/app', { headers: { 'user-agent': ua } }),
		url: new URL('https://salsa.example/app')
	});

describe('/app load', () => {
	it('an iPhone gets the device and cards, no QR', async () => {
		const d = await run(IPHONE);
		expect(d.device).toBe('ios');
		expect(d.cards).toHaveLength(2);
		expect(d.qr).toBeNull();
	});
	it('a desktop also gets a QR of the page itself', async () => {
		const d = (await run(DESKTOP)) as { device: string; qr: { size: number; cells: boolean[] } };
		expect(d.device).toBe('other');
		expect(d.qr.size).toBeGreaterThan(20);
		expect(d.qr.cells).toHaveLength(d.qr.size * d.qr.size);
	});
});
