import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPickersOnClick, pickerField } from './native-picker';

/** Just enough of an <input> for `instanceof` and the checks. */
class FakeInput {
	constructor(
		public type: string,
		public disabled = false,
		public readOnly = false
	) {}
	showPicker = vi.fn();
}

describe('pickerField', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('opens date and time fields on a mouse click only', () => {
		vi.stubGlobal('HTMLInputElement', FakeInput);
		const time = new FakeInput('time');
		const date = new FakeInput('date');
		expect(pickerField(time as never, 'mouse')).toBe(time);
		expect(pickerField(date as never, 'mouse')).toBe(date);
		// A tap opens the picker by itself: a second open would be one too many.
		expect(pickerField(time as never, 'touch')).toBeNull();
		expect(pickerField(time as never, '')).toBeNull();
	});

	it('leaves other fields, and disabled or read-only ones, alone', () => {
		vi.stubGlobal('HTMLInputElement', FakeInput);
		expect(pickerField(new FakeInput('text') as never, 'mouse')).toBeNull();
		expect(pickerField(new FakeInput('time', true) as never, 'mouse')).toBeNull();
		expect(pickerField(new FakeInput('date', false, true) as never, 'mouse')).toBeNull();
		expect(pickerField(null, 'mouse')).toBeNull();
	});

	it('is null where there is no DOM', () => {
		expect(pickerField({} as never, 'mouse')).toBeNull();
	});
});

describe('openPickersOnClick', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('opens the clicked field and stops listening on cleanup', () => {
		vi.stubGlobal('HTMLInputElement', FakeInput);
		let handler: ((e: unknown) => void) | null = null;
		const doc = {
			addEventListener: (_: string, h: (e: unknown) => void) => (handler = h),
			removeEventListener: () => (handler = null)
		};
		const stop = openPickersOnClick(doc as never);
		const time = new FakeInput('time');
		handler!({ target: time, pointerType: 'mouse' });
		expect(time.showPicker).toHaveBeenCalledOnce();
		time.showPicker.mockImplementation(() => {
			throw new Error('NotAllowedError');
		});
		expect(() => handler!({ target: time, pointerType: 'mouse' })).not.toThrow();
		stop();
		expect(handler).toBeNull();
	});
});
