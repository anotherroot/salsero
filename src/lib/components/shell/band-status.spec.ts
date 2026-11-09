import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BandHeader from './BandHeader.svelte';
import { sync } from '$lib/offline/device.svelte';
import type { OutboxSummary } from '$lib/offline/protocol';

/*
 * The sync status in the band's subtitle (offline phase 3, look 1D): "every
 * screen with a band shows it, on the phone and the desktop". On the phone every
 * variant is the big header, so a figure's (a pane) says it too; on the desktop
 * only the band row does, since a pane or a card sits under the list's band row.
 */
vi.mock('$app/state', () => ({
	page: {
		data: {},
		params: { dance: 'salsa' },
		route: { id: '/[dance]/(moves)/figures/[id]' },
		url: new URL('http://localhost/salsa/figures/1')
	}
}));

const SUMMARY: OutboxSummary = {
	waiting: 0,
	oldestWaitingAt: null,
	refused: 1,
	held: 0,
	signedOut: false,
	lastSyncedAt: null,
	seq: 1,
	queued: {},
	epochs: []
};

/** The subtitle rows, each with the widths it shows at. */
function subtitles(variant: 'band' | 'pane' | 'card') {
	const { body } = render(BandHeader, {
		props: { title: 'Dile que no', subtitle: 'Figure · 8 counts', variant }
	});
	return [
		...body.matchAll(/<span class="order-last([^"]*)"[^>]*>([\s\S]*?)<\/span>\s*(?=<|$)/g)
	].map(([, cls, inner]) => ({
		phone: !/(^|\s)hidden(\s|$)/.test(cls),
		desk: !/desk:hidden/.test(cls),
		text: inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
	}));
}

describe('the band says what could not sync', () => {
	beforeEach(() => {
		sync.summary = { ...SUMMARY };
		sync.now = 1_000_000;
	});

	it('on the phone, in a pane’s big header too', () => {
		const rows = subtitles('pane');
		expect(rows.filter((r) => r.phone).map((r) => r.text)).toEqual(
			expect.arrayContaining([expect.stringContaining("1 couldn't sync")])
		);
	});

	it('on the desktop, a pane keeps its own subtitle (the band row says it)', () => {
		const desk = subtitles('pane').filter((r) => r.desk);
		expect(desk.map((r) => r.text).join(' ')).toContain('Figure · 8 counts');
		expect(desk.map((r) => r.text).join(' ')).not.toContain("couldn't sync");
	});

	it("never says what waits: that is the offline strip's (look C2)", () => {
		sync.summary = { ...SUMMARY, refused: 0, waiting: 3, oldestWaitingAt: 1 };
		for (const variant of ['band', 'pane'] as const) {
			const text = subtitles(variant)
				.map((r) => r.text)
				.join(' ');
			expect(text).not.toContain('waiting');
			expect(text).toContain('Figure · 8 counts');
		}
	});

	it('the band row says it at both widths', () => {
		const rows = subtitles('band');
		expect(rows.some((r) => r.phone && r.text.includes("couldn't sync"))).toBe(true);
		expect(rows.some((r) => r.desk && r.text.includes("couldn't sync"))).toBe(true);
	});
});
