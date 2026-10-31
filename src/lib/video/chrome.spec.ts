import { describe, expect, it } from 'vitest';
import type { Spot } from '$lib/types';
import {
	TOAST_ICON,
	buffering,
	cornerBadge,
	deleteCopy,
	editorSub,
	linkEntry,
	listMeta,
	playerMode,
	spotLine,
	toastPlace,
	topBar
} from './chrome';

const sec = (o: Partial<Spot> = {}): Spot =>
	({ id: 1, startMs: 64000, endMs: 71200, label: 'Enchufla doble', linkedTo: [], ...o }) as Spot;
const pt = sec({ startMs: 98500, endMs: null, label: 'Hand change' });

describe('chrome', () => {
	it('picks the mode as the player always has', () => {
		expect(playerMode('portrait', 'edit', true)).toBe('portrait');
		expect(playerMode('landscape', 'full', false)).toBe('overlay');
		expect(playerMode('landscape', 'section', false)).toBe('overlay');
		expect(playerMode('landscape', 'full', true)).toBe('panel');
		expect(playerMode('landscape', 'edit', false)).toBe('panel');
		expect(playerMode('desktop', 'edit', false)).toBe('desktop');
	});
	it.each([
		[
			'portrait',
			'full',
			{ glass: false, back: false, title: true, sub: 'subtitle', edit: null, sections: false }
		],
		[
			'portrait',
			'section',
			{ glass: false, back: true, title: false, sub: 'subtitle', edit: 'accent', sections: false }
		],
		[
			'portrait',
			'edit',
			{ glass: false, back: false, title: true, sub: 'subtitle', edit: null, sections: false }
		],
		[
			'overlay',
			'full',
			{ glass: true, back: false, title: true, sub: 'subtitle', edit: null, sections: true }
		],
		[
			'overlay',
			'section',
			{ glass: true, back: true, title: true, sub: 'looping', edit: 'glass', sections: false }
		],
		[
			'panel',
			'edit',
			{ glass: false, back: false, title: true, sub: 'subtitle', edit: null, sections: false }
		],
		[
			'panel',
			'full',
			{ glass: false, back: false, title: true, sub: 'subtitle', edit: null, sections: false }
		],
		[
			'desktop',
			'section',
			{ glass: false, back: false, title: true, sub: 'subtitle', edit: null, sections: false }
		]
	] as const)('top bar in %s at %s', (mode, level, parts) =>
		expect(topBar(mode, level)).toEqual(parts)
	);
	it('says speed and mirror on the corner badge', () => {
		expect(cornerBadge(0.5, true)).toBe('0.5× · Mirrored');
		expect(cornerBadge(1, true)).toBe('Mirrored');
		expect(cornerBadge(0.75, false)).toBe('0.75×');
		expect(cornerBadge(1, false)).toBe('');
	});
	it('words the link entry', () => {
		expect(linkEntry([], true, 'badge')).toEqual({
			kind: 'open',
			text: 'Link',
			label: 'Link this section',
			invite: true
		});
		expect(linkEntry(['A', 'B'], true, 'badge')).toEqual({
			kind: 'open',
			text: 'A +1',
			label: 'Links: A, B',
			invite: false
		});
		expect(linkEntry(['A', 'B'], false, 'badge')).toEqual({ kind: 'show', text: 'A +1' });
		expect(linkEntry([], false, 'badge')).toEqual({ kind: 'none' });
		expect(linkEntry([], true, 'editor')).toEqual({
			kind: 'open',
			text: 'Link to a figure or drill',
			label: 'Link to a figure or drill',
			invite: true
		});
		expect(linkEntry(['A', 'B'], true, 'editor')).toEqual({
			kind: 'open',
			text: 'Linked to A +1',
			label: 'Links: A, B',
			invite: false
		});
		expect(linkEntry(['A', 'B'], false, 'editor')).toEqual({
			kind: 'show',
			text: 'Linked to A, B'
		});
	});
	it('keeps the second lines', () => {
		expect(editorSub(sec())).toBe('1:04.0–1:11.2 · 7.2 s');
		expect(editorSub(sec({ label: null }))).toBe('7.2 s');
		expect(editorSub(pt)).toBe('Point at 1:38.50');
		expect(listMeta(sec())).toBe('1:04.0–1:11.2 · 7.2 s');
		expect(listMeta(sec({ label: null }))).toBe('7.2 s');
		expect(listMeta(pt)).toBe('1:38.5 · point');
		expect(spotLine(sec({ label: null }))).toBe('1:04.0–1:11.2 · 7.2 s');
		expect(spotLine(pt)).toBe('Point at 1:38.50');
	});
	it('asks before a delete, and refuses a linked section', () => {
		expect(deleteCopy(sec())).toEqual({
			title: 'Delete “Enchufla doble”?',
			sub: '1:04.0–1:11.2 · 7.2 s',
			body: 'The section goes from this video. You can undo it for a few seconds.',
			blocked: null
		});
		expect(deleteCopy(pt).body).toBe(
			'The point goes from this video. You can undo it for a few seconds.'
		);
		expect(deleteCopy(sec({ linkedTo: ['Enchufla · Doble', 'Count drill'] }))).toMatchObject({
			body: null,
			blocked: {
				title: 'Linked to Enchufla · Doble, Count drill',
				body: 'Unlink it there first; until then this section stays.'
			}
		});
	});
	it('places and marks toasts', () => {
		expect(TOAST_ICON).toEqual({
			saved: 'check-circle',
			deleted: 'trash',
			failed: 'warning',
			note: null
		});
		expect(toastPlace('portrait', 'edit')).toBe('video');
		for (const [m, l] of [
			['portrait', 'full'],
			['portrait', 'section'],
			['overlay', 'full'],
			['panel', 'edit'],
			['desktop', 'edit']
		] as const)
			expect(toastPlace(m, l)).toBe('bottom');
	});
	it('shows the buffering spinner only while the video waits', () => {
		expect(buffering(false, 'waiting')).toBe(true);
		for (const e of ['playing', 'canplay', 'seeked', 'pause', 'error', 'emptied'] as const)
			expect(buffering(true, e)).toBe(false);
		expect(buffering(false, 'seeked')).toBe(false);
	});
});
