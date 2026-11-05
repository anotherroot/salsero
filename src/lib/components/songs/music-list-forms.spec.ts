import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The Music list lives in the songs layout, so it is on the page beside a song
 * too. A bare `?/retry` would post to whatever page is open (the song's own
 * actions); every form in the list names the list route's action instead.
 * Read as text, as class-rules.spec.ts reads components.
 */
const FILE = 'src/lib/components/songs/MusicList.svelte';

describe('MusicList forms', () => {
	const src = readFileSync(FILE, 'utf8');
	const actions = [...src.matchAll(/\baction=("[^"]*"|\{[^}]*\})/g)].map((m) => m[1]);

	it('posts every form to the list route, never to the open page', () => {
		// Retry, and Add a song through its sheet.
		expect(actions.length).toBeGreaterThanOrEqual(2);
		for (const a of actions) expect(a, a).toMatch(/^"\/\{dance\}\/songs\?\//);
		expect(src).not.toMatch(/action="\?\//);
	});

	it('hands Add a song the list route', () => {
		expect(src).toMatch(/<AddSongSheet\b[^>]*\baction="\/\{dance\}\/songs\?\/addUrl"/);
	});
});
