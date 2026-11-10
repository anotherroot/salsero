import { describe, expect, it } from 'vitest';
import { deviceLabelOf, parseDeviceLabel } from './label';

const ANDROID_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 SalsaApp/10 (salsa; direct)';
const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD_UA =
	'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const WINDOWS_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const REDUCED_UA =
	'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

describe('deviceLabelOf: what a device is, from its user agent (offline phase 4c)', () => {
	it('an Android WebView names its model', () => {
		expect(deviceLabelOf(ANDROID_UA)).toEqual({ kind: 'android', model: 'Pixel 8' });
	});

	it('Chrome’s reduced agent says only K: no model', () => {
		expect(deviceLabelOf(REDUCED_UA)).toEqual({ kind: 'android', model: null });
	});

	it('an iPhone, an iPad, a computer', () => {
		expect(deviceLabelOf(IPHONE_UA)).toEqual({ kind: 'iphone', model: null });
		expect(deviceLabelOf(IPAD_UA)).toEqual({ kind: 'ipad', model: null });
		expect(deviceLabelOf(WINDOWS_UA)).toEqual({ kind: 'computer', model: null });
		expect(deviceLabelOf('')).toEqual({ kind: 'computer', model: null });
	});

	it('reads back what was stored, and nothing from junk', () => {
		expect(parseDeviceLabel(JSON.stringify(deviceLabelOf(ANDROID_UA)))).toEqual({
			kind: 'android',
			model: 'Pixel 8'
		});
		expect(parseDeviceLabel(null)).toBeNull();
		expect(parseDeviceLabel('{"kind":"toaster"}')).toBeNull();
		expect(parseDeviceLabel('not json')).toBeNull();
	});
});
