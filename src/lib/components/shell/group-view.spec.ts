import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupMode } from '$lib/types';

/*
 * The group view's look (spec 2026-11-09, round 3): the band's first row is the
 * group's (today's people icon in a round badge, the name, the others' faces and
 * the count), never a striped edge; the slim band takes the badge before the
 * title; the tab bar is filled with the band's colour and has Mine for Today;
 * the desktop's side opens with a cream card. Rendered on the server.
 */
const state = vi.hoisted(() => ({
	data: {} as Record<string, unknown>,
	url: new URL('http://localhost/salsa/lessons?in=1')
}));
vi.mock('$app/state', () => ({
	page: {
		get data() {
			return state.data;
		},
		params: { dance: 'salsa' },
		route: { id: '/[dance]/lessons' },
		get url() {
			return state.url;
		}
	},
	navigating: { to: null }
}));

import BandHeader from './BandHeader.svelte';
import BottomNav from './BottomNav.svelte';
import Side from './Side.svelte';
import Screen from '$lib/components/ui/Screen.svelte';

/** The markup from `marker` on, as far as `chars`: the piece a test reads. */
const from = (body: string, marker: string, chars = 1500) => {
	const at = body.indexOf(marker);
	return at < 0 ? '' : body.slice(at, at + chars);
};

const GROUP: GroupMode = {
	teamId: 1,
	name: 'Kubanska Salsa 2',
	role: 'owner',
	people: 2,
	faces: ['TK']
};

beforeEach(() => {
	state.data = { groupMode: GROUP, user: { level: 'all' } };
});

describe('the band in a group’s view', () => {
	it('opens with the group’s row: badge, name, faces and the count', () => {
		const { body } = render(BandHeader, { props: { title: 'Lessons' } });
		const row = from(body, 'data-group-row', 1200).split('data-band-title')[0];
		expect(row).toContain('Kubanska Salsa 2');
		expect(row).toContain('2 people');
		expect(row).toContain('TK');
		expect(body).toContain('data-group-badge');
		expect(body).not.toContain('data-group-edge');
		expect(body).not.toContain('· group');
	});

	it('hides the row on the desktop: the side’s card says it there', () => {
		const { body } = render(BandHeader, { props: { title: 'Lessons' } });
		expect(/<div[^>]*data-group-row[^>]*>/.exec(body)?.[0]).toMatch(/desk:hidden/);
	});

	it('has no group row on your own pages', () => {
		state.data = { groupMode: null };
		const { body } = render(BandHeader, { props: { title: 'Lessons' } });
		expect(body).not.toContain('data-group-row');
	});
});

describe('the slim band', () => {
	it('puts the group’s badge before the title', () => {
		const children = createRawSnippet(() => ({ render: () => '<p>x</p>' }));
		const { body } = render(Screen, { props: { title: 'Test', children } });
		const slim = from(body, 'data-slim-band').split('Test')[0];
		expect(slim).toContain('data-group-badge');
	});
});

describe('the tab bar in a group’s view', () => {
	it('is filled with the band’s colour, Mine in Today’s place', () => {
		const { body } = render(BottomNav, { props: { dance: 'salsa', path: '/salsa/lessons' } });
		expect(/<nav[^>]*data-tab-bar[^>]*>/.exec(body)?.[0]).toMatch(/bg-band\b/);
		expect(body).toMatch(/href="\/salsa\/lessons"[^>]*>[\s\S]*?Mine/);
		expect(body).not.toMatch(/href="\/salsa"/);
	});

	it('keeps its own colours on your own pages', () => {
		state.data = { groupMode: null, user: { level: 'all' } };
		const { body } = render(BottomNav, { props: { dance: 'salsa', path: '/salsa/lessons' } });
		expect(/<nav[^>]*data-tab-bar[^>]*>/.exec(body)?.[0]).toMatch(/bg-tab-bg/);
	});
});

describe('the side in a group’s view', () => {
	it('opens with the cream card: the group and its people', () => {
		const { body } = render(Side, { props: { dance: 'salsa', path: '/salsa/lessons' } });
		const card = from(body, 'data-group-card', 900).split('<ul')[0];
		expect(card).toContain('Kubanska Salsa 2');
		expect(card).toContain('2 people');
	});

	it('has no card on your own pages', () => {
		state.data = { groupMode: null, user: { level: 'all' } };
		const { body } = render(Side, { props: { dance: 'salsa', path: '/salsa/lessons' } });
		expect(body).not.toContain('data-group-card');
	});
});
