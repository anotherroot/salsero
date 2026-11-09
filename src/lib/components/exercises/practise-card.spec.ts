import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import PractiseCard from './PractiseCard.svelte';
import { DANCES } from '$lib/dances/dances';
import { PLAY_ROUND } from '$lib/components/ui/styles';
import type { ExerciseItem } from '$lib/types';

/* The Practise card as the server draws it: both of its ways in, each in words. */
const exercise = {
	id: 7,
	name: 'Warmup',
	source: 'custom',
	figureId: null,
	lessonId: null,
	routineId: null,
	practiceMode: 'none',
	songId: null,
	countBpm: null,
	practiceJson: null
} as unknown as ExerciseItem;

const html = (props: { view?: 'follow' | 'still' | null; routineId?: number | null } = {}) =>
	render(PractiseCard, {
		props: { dance: DANCES.salsa, exercise, songs: [], from: 'from=exercise', ...props }
	}).body;

const links = (body: string) =>
	[...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
		href: (/href="([^"]*)"/.exec(m[1])?.[1] ?? '').replaceAll('&amp;', '&'),
		attrs: m[1],
		text: m[2].replace(/<[^>]*>/g, '').trim()
	}));

describe('PractiseCard', () => {
	it('offers Change, which opens Setup without playing', () => {
		const change = links(html()).filter((l) => l.text === 'Change');
		expect(change).toHaveLength(1);
		expect(change[0].href.endsWith('&from=exercise')).toBe(true);
	});

	it('offers Practise, which opens the player playing', () => {
		const play = links(html()).filter((l) => l.text === 'Practise');
		expect(play).toHaveLength(1);
		expect(play[0].href.endsWith('&play=1')).toBe(true);
	});

	it("runs a routine's exercise on its routine, both ways in", () => {
		const hrefs = links(html({ routineId: 14, view: 'follow' })).map((l) => l.href);
		expect(hrefs).toHaveLength(2);
		for (const href of hrefs) expect(href).toContain('routine=14&exercise=7');
	});

	it('has no bare round play button', () => {
		expect(html()).not.toContain(PLAY_ROUND);
	});
});
