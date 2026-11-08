import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import DoneSheet from './DoneSheet.svelte';
import FaceRating from './FaceRating.svelte';
import type { ComponentProps } from 'svelte';
import type { DoneFace } from '$lib/schedule/schedule';

/* The Done sheet as the server draws it: what it shows and what its form posts. */
const faces: DoneFace[] = [
	{ feel: 'hard', gap: 1, learnt: false },
	{ feel: 'getting', gap: 10, learnt: false },
	{ feel: 'gotit', gap: 12, learnt: false },
	{ feel: 'easy', gap: 16, learnt: false }
];

const base: ComponentProps<typeof DoneSheet> = {
	open: true,
	onclose: () => {},
	action: '?/done',
	exerciseId: 41,
	subtitle: '4:12',
	faces,
	seconds: 252,
	run: null,
	day: null,
	simple: false,
	current: null,
	onsaved: () => {}
};

const sheet = (props: Partial<ComponentProps<typeof DoneSheet>> = {}) =>
	render(DoneSheet, { props: { ...base, ...props } }).body;

describe('DoneSheet', () => {
	it('asks how it went, under the time, and says a face saves it', () => {
		const body = sheet();
		expect(body).toContain('How did it go?');
		expect(body).toContain('4:12');
		expect(body).toContain('Tap a face to save it');
		expect(body).toContain('12 days');
	});

	it('posts the exercise to its action, with the note first', () => {
		const body = sheet();
		expect(body).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/done"/);
		expect(body).toMatch(/name="exerciseId" value="41"/);
		expect(body).toContain('What went well, what to fix');
		expect(body).toContain('Note');
		expect(body.indexOf('name="note"')).toBeLessThan(body.indexOf('aria-pressed'));
		// No run, no day: nothing posted for them.
		expect(body).not.toMatch(/name="run"/);
		expect(body).not.toMatch(/name="day"/);
	});

	it("a past day posts its day to Today's done, and a run its player_json", () => {
		const body = sheet({ action: '/salsa?/done', day: '2026-11-05', run: '{"bpm":120}' });
		expect(body).toMatch(/action="\/salsa\?\/done"/);
		expect(body).toMatch(/name="day" value="2026-11-05"/);
		expect(body).toMatch(/name="run" value="\{&quot;bpm&quot;:120\}"/);
	});

	it('the simple sheet has no note', () => {
		const body = sheet({ simple: true });
		expect(body).not.toContain('name="note"');
		expect(body).toContain('Tap a face to save it');
	});

	it('Done today: that face lit, that note filled', () => {
		const body = sheet({ current: { rating: 4, note: 'Left hand late' } });
		expect(body).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?I've got it/);
		expect(body.match(/aria-pressed="true"/g)?.length).toBe(1);
		expect(body).toContain('Left hand late</textarea>');
	});

	it('without times the faces say none', () => {
		const body = sheet({ faces: null });
		expect(body).not.toContain('12 days');
		expect(body).toContain('Tap a face to save it');
	});
});

describe('FaceRating while a face is saving', () => {
	it('lights the tapped face with a spinner, dims the others, disables all', () => {
		const body = render(FaceRating, {
			props: { question: 'How did it go?', value: null, onchange: () => {}, busy: 'gotit' }
		}).body;
		const cards = body.match(/<button[\s\S]*?<\/button>/g) ?? [];
		expect(cards).toHaveLength(4);
		for (const c of cards) expect(c).toMatch(/\sdisabled/);
		const busy = cards.filter((c) => c.includes('aria-busy="true"'));
		expect(busy).toHaveLength(1);
		expect(busy[0]).toContain("I've got it");
		expect(busy[0]).toContain('animate-spin');
		expect(busy[0]).toContain('ring-[3px]');
		for (const c of cards.filter((c) => !c.includes('aria-busy')))
			expect(c).toContain('opacity-55');
	});
});
