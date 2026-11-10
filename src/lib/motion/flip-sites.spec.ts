import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Every list that changes under the person's hand folds and opens (spec
 * 2026-11-10-motion-round-1, "Everywhere a list changes"): it uses flipList
 * (or FlipList) and its rows carry `data-flip`. A list redrawn by a search
 * does not.
 */
const SITES = [
	'src/lib/components/today/TodayList.svelte',
	'src/lib/components/today/ComingUpList.svelte',
	'src/lib/components/today/PastDay.svelte',
	'src/lib/components/routines/SlotList.svelte',
	'src/routes/[dance]/(moves)/figures/[id]/+page.svelte',
	'src/routes/[dance]/(moves)/positions/[id]/+page.svelte',
	'src/routes/[dance]/lessons/[id]/+page.svelte',
	'src/lib/components/lessons/SimpleLesson.svelte',
	'src/lib/components/lessons/VideoSections.svelte',
	'src/lib/components/exercises/DrillRecordings.svelte',
	'src/lib/components/songs/MusicList.svelte',
	'src/lib/components/comments/CommentsSheet.svelte',
	'src/routes/[dance]/suggestions/+page.svelte'
];

const read = (f: string) => readFileSync(f, 'utf8');

describe('lists that fold and open', () => {
	it.each(SITES)('%s uses the helper', (f) => {
		expect(read(f)).toMatch(/flipList\(|<FlipList/);
	});

	it.each(SITES)('%s keys its rows', (f) => {
		// A row component may carry the key itself (ExerciseRow, ImportRow).
		expect(read(f)).toMatch(/data-flip|<ExerciseRow|<ImportRow/);
	});

	it('the rows that are components carry their key', () => {
		expect(read('src/lib/components/today/ExerciseRow.svelte')).toContain('data-flip={ex.id}');
		expect(read('src/lib/components/songs/ImportRow.svelte')).toContain('data-flip={row.id}');
	});

	it('a search result list does not fold', () => {
		const music = read('src/lib/components/songs/MusicList.svelte');
		const hits = music.slice(
			music.indexOf('view.hits'),
			music.indexOf('{/each}', music.indexOf('view.hits'))
		);
		expect(hits).not.toContain('data-flip');
		expect(music).not.toMatch(/<FlipList[^>]*aria-label=\{g\.team\.name\}/);
	});
});
