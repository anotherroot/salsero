import { describe, expect, it } from 'vitest';
import { frameView, holdView } from './frame-view.svelte';
import type { GroupMode } from '$lib/types';

/*
 * A group's drill shows the group's view while it is being edited (group view
 * spec, rule 5): the exercise page holds the view, Mine asks it to stop.
 * Catches: the frame staying in the group's look after Save or ×, and an older
 * hold's release clearing a newer one.
 */
const G = (teamId: number): GroupMode => ({
	teamId,
	name: `G${teamId}`,
	role: 'editor',
	people: 2,
	faces: ['AB']
});

describe('the frame’s held view', () => {
	it('holds and releases', () => {
		const release = holdView(G(1), () => {});
		expect(frameView.current?.teamId).toBe(1);
		release();
		expect(frameView.current).toBeNull();
		expect(frameView.stop).toBeNull();
	});

	it('a newer hold replaces an older one, whose release then does nothing', () => {
		const first = holdView(G(1), () => {});
		const second = holdView(G(2), () => {});
		first();
		expect(frameView.current?.teamId).toBe(2);
		second();
		expect(frameView.current).toBeNull();
	});

	it('Mine reaches the holder’s stop', () => {
		let stopped = 0;
		const release = holdView(G(3), () => stopped++);
		frameView.stop?.();
		expect(stopped).toBe(1);
		release();
	});
});
