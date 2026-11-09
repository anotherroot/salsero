import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
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
	portraitBody,
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
			{
				glass: false,
				back: false,
				title: true,
				sub: 'subtitle',
				edit: null,
				sections: false,
				repeat: false
			}
		],
		[
			'portrait',
			'section',
			{
				glass: false,
				back: true,
				title: false,
				sub: 'subtitle',
				edit: 'accent',
				sections: false,
				repeat: false
			}
		],
		[
			'portrait',
			'edit',
			{
				glass: false,
				back: false,
				title: true,
				sub: 'subtitle',
				edit: null,
				sections: false,
				repeat: false
			}
		],
		[
			'overlay',
			'full',
			{
				glass: true,
				back: false,
				title: true,
				sub: 'subtitle',
				edit: null,
				sections: true,
				repeat: false
			}
		],
		[
			'overlay',
			'section',
			{
				glass: true,
				back: true,
				title: true,
				sub: 'looping',
				edit: 'glass',
				sections: false,
				repeat: false
			}
		],
		[
			'panel',
			'edit',
			{
				glass: false,
				back: false,
				title: true,
				sub: 'subtitle',
				edit: null,
				sections: false,
				repeat: false
			}
		],
		[
			'panel',
			'full',
			{
				glass: false,
				back: false,
				title: true,
				sub: 'subtitle',
				edit: null,
				sections: false,
				repeat: false
			}
		],
		[
			'desktop',
			'section',
			{
				glass: false,
				back: false,
				title: true,
				sub: 'subtitle',
				edit: null,
				sections: false,
				repeat: false
			}
		]
	] as const)('top bar in %s at %s', (mode, level, parts) =>
		expect(topBar(mode, level)).toEqual(parts)
	);
	it.each([
		['portrait', 'full', false],
		['portrait', 'section', false],
		['overlay', 'full', true],
		['panel', 'full', false],
		['desktop', 'full', false]
	] as const)(
		'the simple top bar in %s at %s has repeat and nothing to edit',
		(mode, level, glass) => {
			expect(topBar(mode, level, { simple: true })).toEqual({
				glass,
				back: false,
				title: true,
				sub: 'subtitle',
				edit: null,
				sections: false,
				repeat: true
			});
		}
	);
	it('the portrait body is the slim bar only in the simple player', () => {
		for (const level of ['full', 'section', 'edit'] as const)
			for (const listOpen of [false, true])
				for (const hidden of [false, true])
					expect(portraitBody(level, { listOpen, hidden, spot: true, simple: true })).toBe('slim');
		expect(portraitBody('full', { listOpen: false, hidden: false, spot: false })).toBe('full');
		expect(portraitBody('full', { listOpen: false, hidden: true, spot: false })).toBe('slim');
		expect(portraitBody('section', { listOpen: false, hidden: false, spot: true })).toBe('section');
		expect(portraitBody('edit', { listOpen: false, hidden: true, spot: true })).toBe('editor');
		expect(portraitBody('full', { listOpen: true, hidden: true, spot: false })).toBe('list');
	});
	it('without an open spot, the section and edit levels fall back as they always did', () => {
		// Hide on: the slim bar, as before the simple player (not the full bar).
		expect(portraitBody('edit', { listOpen: false, hidden: true, spot: false })).toBe('slim');
		expect(portraitBody('section', { listOpen: false, hidden: true, spot: false })).toBe('slim');
		// Hide off: the full bar.
		expect(portraitBody('edit', { listOpen: false, hidden: false, spot: false })).toBe('full');
		expect(portraitBody('section', { listOpen: false, hidden: false, spot: false })).toBe('full');
	});
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
			text: 'Link to a figure, drill or position',
			label: 'Link to a figure, drill or position',
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
	it('words a point’s link entry for positions (ruling 10)', () => {
		expect(linkEntry([], true, 'editor', true)).toEqual({
			kind: 'open',
			text: 'Link to a position',
			label: 'Link to a position',
			invite: true
		});
		expect(linkEntry([], true, 'badge', true)).toMatchObject({ label: 'Link this point' });
		expect(linkEntry(['Cerrada'], true, 'editor', true)).toEqual({
			kind: 'open',
			text: 'Linked to Cerrada',
			label: 'Links: Cerrada',
			invite: false
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
	it('titles an unlabeled spot by its times in the delete question', () => {
		const c = deleteCopy(sec({ label: null }));
		expect(c.title).toBe('Delete “1:04.0–1:11.2”?');
		expect(c.sub).toBe('1:04.0–1:11.2 · 7.2 s');
	});
	it('places and marks toasts', () => {
		// Landscape's panel is beside the video: its toast goes at the bottom of the screen.
		expect(toastPlace('panel', 'edit', 'saved')).toBe('bottom');
		expect(toastPlace('panel', 'edit', 'failed')).toBe('bottom');
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
		expect(toastPlace('portrait', 'edit', 'saved')).toBe('video');
		expect(toastPlace('portrait', 'full', 'failed')).toBe('video');
		expect(toastPlace('portrait', 'section', 'failed')).toBe('video');
		expect(toastPlace('portrait', 'full', 'saved')).toBe('bottom');
		expect(toastPlace('overlay', 'full', 'failed')).toBe('bottom');
		expect(toastPlace('desktop', 'edit', 'failed')).toBe('bottom');
	});
	it('shows the buffering spinner only while the video waits', () => {
		expect(buffering(false, 'waiting')).toBe(true);
		for (const e of ['playing', 'canplay', 'seeked', 'pause', 'error', 'emptied'] as const)
			expect(buffering(true, e)).toBe(false);
		expect(buffering(false, 'seeked')).toBe(false);
	});
});

describe('chrome in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('says speed with a decimal comma and mirror on the corner badge', () => {
		expect(sl(() => cornerBadge(0.5, true))).toBe('0,5× · Zrcaljeno');
		expect(sl(() => cornerBadge(0.25, false))).toBe('0,25×');
		expect(sl(() => cornerBadge(1, true))).toBe('Zrcaljeno');
	});
	it('words the link entry', () => {
		expect(sl(() => linkEntry([], true, 'badge'))).toEqual({
			kind: 'open',
			text: 'Poveži',
			label: 'Poveži ta odsek',
			invite: true
		});
		expect(sl(() => linkEntry([], true, 'badge', true))).toMatchObject({
			label: 'Poveži to točko'
		});
		expect(sl(() => linkEntry([], true, 'editor'))).toMatchObject({
			text: 'Poveži z figuro, vajo ali položajem'
		});
		expect(sl(() => linkEntry([], true, 'editor', true))).toMatchObject({
			text: 'Poveži s položajem'
		});
		expect(sl(() => linkEntry(['A', 'B'], true, 'editor'))).toEqual({
			kind: 'open',
			text: 'Povezano: A +1',
			label: 'Povezave: A, B',
			invite: false
		});
		expect(sl(() => linkEntry(['A', 'B'], false, 'editor'))).toEqual({
			kind: 'show',
			text: 'Povezano: A, B'
		});
	});
	it('keeps the second lines, times with a decimal comma', () => {
		expect(sl(() => editorSub(sec()))).toBe('1:04,0–1:11,2 · 7,2 s');
		expect(sl(() => editorSub(pt))).toBe('Točka pri 1:38,50');
		expect(sl(() => listMeta(pt))).toBe('1:38,5 · točka');
		expect(sl(() => spotLine(sec({ label: null })))).toBe('1:04,0–1:11,2 · 7,2 s');
	});
	it('asks before a delete, and refuses a linked section', () => {
		expect(sl(() => deleteCopy(sec()))).toEqual({
			title: 'Želite izbrisati »Enchufla doble«?',
			sub: '1:04,0–1:11,2 · 7,2 s',
			body: 'Odsek bo izbrisan iz tega videa. Še nekaj sekund lahko to razveljavite.',
			blocked: null
		});
		expect(sl(() => deleteCopy(pt).body)).toBe(
			'Točka bo izbrisana iz tega videa. Še nekaj sekund lahko to razveljavite.'
		);
		expect(sl(() => deleteCopy(sec({ linkedTo: ['Enchufla · Doble'] })))).toMatchObject({
			body: null,
			blocked: {
				title: 'Povezano: Enchufla · Doble',
				body: 'Povezavo najprej odstranite tam; do takrat ta odsek ostane.'
			}
		});
		expect(sl(() => deleteCopy(sec({ label: null })).title)).toBe(
			'Želite izbrisati »1:04,0–1:11,2«?'
		);
	});
});
