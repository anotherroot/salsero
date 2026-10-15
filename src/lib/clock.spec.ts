import { describe, expect, it } from 'vitest';
import { clockLabel, minuteOfDay } from './clock';

describe('minuteOfDay', () => {
	it('reads an <input type="time"> value', () => {
		expect(minuteOfDay('00:00')).toBe(0);
		expect(minuteOfDay('18:30')).toBe(1110);
		expect(minuteOfDay('23:59')).toBe(1439);
	});

	it('is null for an empty field, and undefined for nonsense', () => {
		expect(minuteOfDay('')).toBeNull();
		expect(minuteOfDay('24:00')).toBeUndefined();
		expect(minuteOfDay('7:5')).toBeUndefined();
		expect(minuteOfDay('12:60')).toBeUndefined();
		expect(minuteOfDay('noon')).toBeUndefined();
	});
});

describe('clockLabel', () => {
	it('writes a minute back as HH:MM', () => {
		expect(clockLabel(0)).toBe('00:00');
		expect(clockLabel(1110)).toBe('18:30');
		expect(clockLabel(null)).toBe('');
	});
});
