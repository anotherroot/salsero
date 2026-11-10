import { describe, expect, it } from 'vitest';
import { placeOf, type PlaceCtx } from './where';

const ROW = {
	file: 'a.mp4',
	serverCopy: false,
	originSlot: 3 as number | null,
	sizeBytes: 500,
	originBytes: 500 as number | null
};
const ctx = (over: Partial<PlaceCtx> = {}): PlaceCtx => ({
	held: () => false,
	slot: 3,
	uploading: () => null,
	devices: { '3': { kind: 'android', model: 'Pixel 8' }, '4': { kind: 'iphone', model: null } },
	iphone: false,
	android: true,
	shortSide: 720,
	...over
});

describe('placeOf: where a video is (offline phase 4c)', () => {
	it('held here, phone-only: only here (an iPhone says so)', () => {
		expect(placeOf(ROW, ctx({ held: () => true }))).toEqual({ state: 'only', iphone: false });
		expect(placeOf(ROW, ctx({ held: () => true, iphone: true, android: false }))).toEqual({
			state: 'only',
			iphone: true
		});
	});

	it('held here but the slot is not known yet: still only here', () => {
		expect(placeOf(ROW, ctx({ held: () => true, slot: null }))).toEqual({
			state: 'only',
			iphone: false
		});
	});

	it('held here and uploading: how far', () => {
		expect(placeOf(ROW, ctx({ held: () => true, uploading: () => 40 }))).toEqual({
			state: 'uploading',
			pct: 40
		});
	});

	it('held here and uploaded: both, with the copy’s size and the setting’s p', () => {
		expect(placeOf({ ...ROW, serverCopy: true, sizeBytes: 80 }, ctx({ held: () => true }))).toEqual(
			{ state: 'both', copyBytes: 80, copyP: 720 }
		);
	});

	it('phone-only, this device’s slot, not held: missing (the gallery on Android)', () => {
		expect(placeOf(ROW, ctx())).toEqual({ state: 'missing', gallery: true });
		expect(placeOf(ROW, ctx({ android: false }))).toEqual({ state: 'missing', gallery: false });
	});

	it('phone-only from another device: elsewhere, with its label', () => {
		expect(placeOf({ ...ROW, originSlot: 4 }, ctx())).toEqual({
			state: 'elsewhere',
			label: { kind: 'iphone', model: null }
		});
		expect(placeOf({ ...ROW, originSlot: null }, ctx({ slot: 3 }))).toEqual({
			state: 'elsewhere',
			label: null
		});
	});

	it('on the server and not held as an original: the server’s (4b keeps it)', () => {
		expect(placeOf({ ...ROW, serverCopy: true }, ctx({ slot: 9 }))).toEqual({ state: 'server' });
	});
});
