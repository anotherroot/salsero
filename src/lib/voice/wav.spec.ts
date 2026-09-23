import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

const ascii = (b: Uint8Array, at: number, n: number) =>
	String.fromCharCode(...b.subarray(at, at + n));
const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer).getUint32(at, true);
const u16 = (b: Uint8Array, at: number) => new DataView(b.buffer).getUint16(at, true);
const i16 = (b: Uint8Array, at: number) => new DataView(b.buffer).getInt16(at, true);

describe('encodeWav', () => {
	const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 48000);

	it('writes a RIFF/WAVE header for 16-bit mono PCM', () => {
		expect(ascii(wav, 0, 4)).toBe('RIFF');
		expect(ascii(wav, 8, 4)).toBe('WAVE');
		expect(ascii(wav, 12, 4)).toBe('fmt ');
		expect(u16(wav, 20)).toBe(1); // PCM
		expect(u16(wav, 22)).toBe(1); // mono
		expect(u32(wav, 24)).toBe(48000);
		expect(u16(wav, 34)).toBe(16); // bits
	});

	it('declares byte rate and block align consistently with the format', () => {
		expect(u16(wav, 32)).toBe(2); // 1 channel × 16 bits
		expect(u32(wav, 28)).toBe(48000 * 2);
	});

	it('sizes both length fields against the sample count', () => {
		expect(ascii(wav, 36, 4)).toBe('data');
		expect(u32(wav, 40)).toBe(5 * 2);
		expect(u32(wav, 4)).toBe(36 + 5 * 2);
		expect(wav.length).toBe(44 + 5 * 2);
	});

	it('scales full-scale samples to the ends of the 16-bit range', () => {
		expect(i16(wav, 44 + 0 * 2)).toBe(0);
		expect(i16(wav, 44 + 3 * 2)).toBe(32767);
		expect(i16(wav, 44 + 4 * 2)).toBe(-32768);
	});

	/** Wrapping would turn an overshoot into a loud spike of the opposite sign. */
	it('clips out-of-range samples instead of wrapping them', () => {
		const hot = encodeWav(new Float32Array([1.5, -1.5]), 48000);
		expect(i16(hot, 44)).toBe(32767);
		expect(i16(hot, 46)).toBe(-32768);
	});

	it('refuses a nonsense sample rate rather than writing an unplayable file', () => {
		expect(() => encodeWav(new Float32Array([0]), 0)).toThrow();
		expect(() => encodeWav(new Float32Array([0]), NaN)).toThrow();
	});
});
