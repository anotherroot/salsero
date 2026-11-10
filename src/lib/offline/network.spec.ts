import { describe, expect, it } from 'vitest';
import {
	canTellWifi,
	fits,
	freeOf,
	isLow,
	linkOf,
	onLinkChange,
	LOW_SPACE_BYTES,
	videosMayCome
} from './network';

const on = (type?: string) => ({ connection: { type } });

describe('Wi-Fi or mobile data (offline phase 4b)', () => {
	it('reads the connection type', () => {
		expect(linkOf(on('wifi'))).toBe('unmetered');
		expect(linkOf(on('ethernet'))).toBe('unmetered');
		expect(linkOf(on('cellular'))).toBe('metered');
		expect(linkOf(on('bluetooth'))).toBe('metered');
		expect(linkOf(on('wimax'))).toBe('metered');
		expect(linkOf(on('none'))).toBe('unknown');
		expect(linkOf(on(undefined))).toBe('unknown');
		expect(linkOf({})).toBe('unknown');
	});

	it('can tell only where the type is there (not on a desktop, not on the iPhone)', () => {
		expect(canTellWifi(on('cellular'))).toBe(true);
		expect(canTellWifi({ connection: { effectiveType: '4g' } as { type?: string } })).toBe(false);
		expect(canTellWifi({})).toBe(false);
	});

	it('videos wait on mobile data only while Only on Wi-Fi is on', () => {
		expect(videosMayCome('metered', true)).toBe(false);
		expect(videosMayCome('metered', false)).toBe(true);
		expect(videosMayCome('unmetered', true)).toBe(true);
		expect(videosMayCome('unknown', true)).toBe(true);
	});
});

describe('free space', () => {
	it('is quota minus usage, or null', () => {
		expect(freeOf({ quota: 10, usage: 4 })).toBe(6);
		expect(freeOf({ quota: 10 })).toBe(10);
		expect(freeOf({})).toBeNull();
		expect(freeOf(null)).toBeNull();
	});

	it('is low under LOW_SPACE_BYTES, and a file fits when it leaves that much', () => {
		expect(isLow(LOW_SPACE_BYTES - 1)).toBe(true);
		expect(isLow(LOW_SPACE_BYTES)).toBe(false);
		expect(isLow(null)).toBe(false);
		expect(fits(LOW_SPACE_BYTES + 10, 10)).toBe(true);
		expect(fits(LOW_SPACE_BYTES + 10, 11)).toBe(false);
		expect(fits(null, 1e12)).toBe(true);
	});
});

describe('onLinkChange (final review 2)', () => {
	it('tells only when Wi-Fi turns to mobile data or back, not when the speed estimate moves', () => {
		const nav: { connection: { type?: string } } = { connection: { type: 'wifi' } };
		const told: string[] = [];
		const handler = onLinkChange(nav, (l) => told.push(l));
		handler(); // rtt or downlink moved: still Wi-Fi
		expect(told).toEqual([]);
		nav.connection.type = 'cellular';
		handler();
		handler();
		nav.connection.type = 'wifi';
		handler();
		expect(told).toEqual(['metered', 'unmetered']);
	});
});
