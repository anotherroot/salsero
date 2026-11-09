import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import DetailsBody from './DetailsBody.svelte';
import type { RunClip, RunDetails } from '$lib/types';

/* Two figures in one slot can link the same section: each clip holds the sound on its own. */
const clip: RunClip = {
	kind: 'section',
	src: '/lesson-videos/a.mp4',
	startMs: 42_000,
	endMs: 58_000,
	caption: 'Nadaljevalna · 0:42–0:58'
};
const details: RunDetails = {
	heading: 'Enchufla · Basic',
	facts: [],
	hasPositions: false,
	notes: null,
	clips: [clip, clip],
	links: [],
	figures: []
};

describe('RunClip', () => {
	it('gives each clip on the page its own sound key, even for the same section', () => {
		const body = render(DetailsBody, { props: { details } }).body;
		const keys = [...body.matchAll(/data-sound="([^"]+)"/g)].map((m) => m[1]);
		expect(keys).toHaveLength(2);
		expect(new Set(keys).size).toBe(2);
	});
});

describe("a slot's details in the routine list", () => {
	it('say "Music paused" once, over the first figure only', () => {
		const src = readFileSync(join(__dirname, 'Running.svelte'), 'utf8');
		const slotLayer = /slotDetails\([\s\S]*?\{\/each\}/.exec(src)?.[0] ?? '';
		expect(slotLayer).toMatch(/onresume=\{k === 0 \? togglePause : undefined\}/);
	});
});
