import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import DrillRecordings from './DrillRecordings.svelte';

/* A drill's Recordings as the server draws it: who gets + Add, and the refusals it shows. */
const form = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('$app/state', () => ({
	page: {
		get form() {
			return form.current;
		},
		data: {},
		params: { dance: 'salsa', id: '7' },
		url: new URL('http://localhost/salsa/exercises/7')
	}
}));

const link = {
	id: 3,
	url: 'https://www.youtube.com/watch?v=abc',
	title: 'Clave 2-3 explained',
	createdAt: 1,
	saving: null
};

const base: ComponentProps<typeof DrillRecordings> = {
	sections: [],
	links: [link],
	canEdit: true,
	editing: false,
	recordings: { label: 'Clave', linkable: [], message: null, entered: '' }
};

const drawn = (props: Partial<ComponentProps<typeof DrillRecordings>> = {}) =>
	render(DrillRecordings, { props: { ...base, ...props } }).body;

describe('DrillRecordings', () => {
	it('an editor gets + Add beside the heading', () => {
		const body = drawn();
		expect(body).toContain('data-focus="recordings-add"');
		expect(body).toContain('Clave 2-3 explained');
	});

	it('a reader and the simple page (no `recordings`) get the rows and no + Add', () => {
		for (const canEdit of [false, true]) {
			const body = drawn({ canEdit, recordings: null });
			expect(body).toContain('Clave 2-3 explained');
			expect(body).not.toContain('data-focus="recordings-add"');
			expect(body).not.toContain('Add to Clave');
		}
	});

	it('a reader with nothing linked sees no Recordings at all', () => {
		expect(drawn({ canEdit: false, recordings: null, links: [] })).not.toContain('Recordings');
	});

	it('while editing: no + Add, and each row its unlink or trash', () => {
		const section: ComponentProps<typeof DrillRecordings>['sections'][number] = {
			linkId: 9,
			spot: { id: 4, startMs: 0, endMs: 4000, label: 'Exchibela', linkedTo: [] },
			video: {
				owner: { lessonVideoId: 2 },
				src: '/lesson-videos/v.mp4',
				from: { kind: 'lesson', lessonId: 1, title: 'Moves', lessonDay: '2026-09-26' }
			}
		};
		const body = drawn({ editing: true, sections: [section] });
		expect(body).not.toContain('data-focus="recordings-add"');
		expect(body).toMatch(/action="\?\/unlinkSection"/);
		expect(body).toContain('data-focus="section-9"');
	});

	it('shows a refused unlink and removal; a section’s link refuses in its own picker', () => {
		for (const action of ['unlinkSection', 'deleteLink']) {
			form.current = { action, message: `Refused ${action}` };
			expect(drawn()).toContain(`Refused ${action}`);
		}
		for (const action of ['linkSection', 'update']) {
			form.current = { action, message: `Not here ${action}` };
			expect(drawn()).not.toContain(`Not here ${action}`);
		}
		form.current = null;
	});

	it('while editing, the card’s last removal falls back to what the page names (`after`)', () => {
		// The fallback is the page's; the card draws nothing of its own for it.
		const body = drawn({ editing: true, after: ['exercise-archive', 'exercise-settings'] });
		expect(body).not.toContain('data-focus="recordings-add"');
	});
});
