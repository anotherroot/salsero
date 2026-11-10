import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { countInAt, countInCues, countInCuesIn, leadAhead, leadLook, leadsOf } from './count-in';
import { aheadLine, placeSections, type Section } from './sections';
import { isQuiet, quietRanges } from '$lib/scheduler/quiet';

// A loose intro (8 uneven beats over 6 s), then the band at 0.5 s a beat from 6.0 s.
const intro = [0, 0.7, 1.2, 2.3, 2.9, 3.4, 4.6, 5.0];
const beats = [...intro, ...Array.from({ length: 40 }, (_, i) => 6 + i * 0.5)];
// The 1 on beat 8 (6.0 s), and every eighth beat from there.
const counts = beats.map((_, i) => ((((i - 8) % 8) + 8) % 8) + 1);
const verse: Section = { at: 6, name: 'Verse', countOff: false };
const leads = (list: Section[]) => leadsOf(placeSections(list, beats, counts), beats);

describe('the count-in before a song’s main beat', () => {
	it('leads into the first section, in that section’s tempo', () => {
		const [lead] = leads([verse]);
		expect(lead).toMatchObject({ from: 0, one: 6, step: 0.5 });
		expect(lead.next.name).toBe('Verse');
	});

	it('leads out of a count-off section into a counted one, not between counted ones', () => {
		const list: Section[] = [
			{ at: 0, name: 'Intro', countOff: true },
			verse,
			{ at: 10, name: 'Mambo', countOff: false },
			{ at: 14, name: 'Break', countOff: true },
			{ at: 18, name: 'Coro', countOff: false }
		];
		expect(leads(list).map((l) => [l.from, l.one, l.next.name])).toEqual([
			[0, 6, 'Verse'],
			[14, 18, 'Coro']
		]);
	});

	it('is none when the first section starts the song', () => {
		const steady = Array.from({ length: 32 }, (_, i) => i * 0.5);
		const c = steady.map((_, i) => (i % 8) + 1);
		const placed = placeSections([{ at: 0, name: 'A', countOff: false }], steady, c);
		expect(leadsOf(placed, steady)).toEqual([]);
	});

	it('counts the beats left at the coming tempo, and 5 6 7 8 on the last four', () => {
		const ls = leads([verse]);
		// 6.0 - 0.1: in the last beat (the 8); 6.0 - 2.1: five beats back, before the count-in.
		expect(countInAt(ls, 5.9)).toMatchObject({ beatsLeft: 1, n: 8, eightsLeft: 1, index: 7 });
		expect(countInAt(ls, 4.0)).toMatchObject({ beatsLeft: 4, n: 5 });
		expect(countInAt(ls, 3.9)).toMatchObject({ beatsLeft: 5, n: null, eightsLeft: 1 });
		// 6 s at 0.5 s a beat is 12 beats: two of the coming tempo's 1s ahead.
		expect(countInAt(ls, 0)).toMatchObject({ beatsLeft: 12, eightsLeft: 2 });
		expect(countInAt(ls, 6)).toBeNull();
	});

	it('says the section in eights of its own tempo, then “on the 1”', () => {
		const ls = leads([verse]);
		expect(aheadLine(leadAhead(ls, 0)!)).toBe('Verse in 2 eights');
		expect(aheadLine(leadAhead(ls, 3)!)).toBe('Verse in 1 eight');
		expect(aheadLine(leadAhead(ls, 4.5)!)).toBe('Verse on the 1');
		withLocale('sl', () => {
			expect(aheadLine(leadAhead(ls, 0)!)).toBe('Verse čez 2 osmici');
			expect(aheadLine(leadAhead(ls, 4.5)!)).toBe('Verse na 1');
		});
		expect(leadAhead(ls, 7)).toBeNull();
	});

	it('speaks 5 6 7 8 on the coming tempo, only inside the lead', () => {
		expect(countInCues(leads([verse]))).toEqual([
			{ at: 4, n: 5 },
			{ at: 4.5, n: 6 },
			{ at: 5, n: 7 },
			{ at: 5.5, n: 8 }
		]);
		// A lead of 1.2 s has room for the 7 and the 8 only.
		const [lead] = leads([verse]);
		expect(countInCues([{ ...lead, from: 4.8 }]).map((c) => c.n)).toEqual([7, 8]);
		expect(countInCuesIn(countInCues(leads([verse])), 4.5, 5.5).map((c) => c.n)).toEqual([6, 7]);
	});

	it('keeps the song’s own count quiet in the lead', () => {
		const ranges = quietRanges([verse], beats, counts);
		expect(ranges).toEqual([{ from: 0, to: 6 }]);
		expect(isQuiet(ranges, 5.9)).toBe(true);
		expect(isQuiet(ranges, 6)).toBe(false);
	});
});

describe('how the lead’s digit looks (B2)', () => {
	const ls = leads([verse]);
	const look = (t: number) => leadLook(countInAt(ls, t));

	it('is still at full size before the last eight beats before the 5', () => {
		expect(look(-0.25)).toBeNull();
		// This lead is 12 beats long: 13 left is a longer one's.
		const early = { ...countInAt(ls, 0)!, beatsLeft: 13 };
		expect(leadLook(early)).toEqual({ scale: 1, push: 0 });
	});

	it('shrinks and pushes harder on each of the dash’s last eight beats', () => {
		const dash = [12, 11, 10, 9, 8, 7, 6, 5].map((left) => look(6 - left * 0.5 + 0.01)!);
		dash.slice(1).forEach((d, i) => {
			expect(d.scale).toBeLessThan(dash[i].scale);
			expect(d.push).toBeGreaterThan(dash[i].push);
		});
		expect(dash[0].scale).toBeCloseTo(1 - 0.45 / 8);
		expect(dash[7]).toEqual({ scale: 0.55, push: 1.2 });
	});

	it('grows 5 6 7 8, each larger than the last, short of the full 1', () => {
		const sizes = [4, 3, 2, 1].map((left) => look(6 - left * 0.5 + 0.01)!.scale);
		expect(sizes).toEqual([0.5, 0.62, 0.74, 0.86]);
		expect(leadLook(null)).toBeNull();
	});
});
