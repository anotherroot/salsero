import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	destination,
	linkHeading,
	linkRowId,
	linkTitles,
	linkWords,
	loadFailed,
	momentAt,
	momentLabel,
	openingSteps,
	refusalAt,
	stacked,
	nameFromServer,
	targetKey,
	unlinkKind
} from './link-steps';

describe('openingSteps', () => {
	it('openingSteps: no links → pick; some → links', () => {
		expect(openingSteps(0)).toEqual(['pick']);
		expect(openingSteps(1)).toEqual(['links']);
		expect(openingSteps(3)).toEqual(['links']);
	});
});

describe('the popup’s view rules', () => {
	it('knows which levels are stacked', () => {
		expect(stacked(['pick'], 'pick')).toBe(false);
		expect(stacked(['links'], 'links')).toBe(false);
		expect(stacked(['links', 'pick'], 'pick')).toBe(true);
		expect(stacked(['pick', 'variation'], 'variation')).toBe(true);
		expect(stacked(['pick', 'variation', 'variation-figure'], 'variation-figure')).toBe(true);
	});
	it('heads the popup with the range, the name and the length', () => {
		expect(linkHeading({ startMs: 42000, endMs: 55000, label: 'Doble entry' })).toEqual({
			range: '0:42–0:55',
			sub: 'Doble entry · 13.0 s'
		});
		expect(linkHeading({ startMs: 42000, endMs: 55000, label: null }).sub).toBe('13.0 s');
	});
	it('heads a point with its moment, and says it is a point', () => {
		expect(linkHeading({ startMs: 72000, endMs: null, label: 'Hand change' })).toEqual({
			range: '1:12',
			sub: 'Hand change · point'
		});
		expect(linkHeading({ startMs: 72500, endMs: null, label: null })).toEqual({
			range: '1:12.5',
			sub: 'Point'
		});
		const spot = { id: 1, startMs: 72000, endMs: null, label: null };
		expect(destination({ spot, context: { kind: 'recording', groupId: 3, figure: 'X' } })).toBe(
			'Linked to 1:12'
		);
	});
	it('says where a created thing is linked', () => {
		const spot = { id: 1, startMs: 42000, endMs: 55000, label: null };
		expect(
			destination({ spot, context: { kind: 'lesson', lessonId: 2, title: 'Tuesday class' } })
		).toBe('Linked to 0:42–0:55 and to Tuesday class');
		expect(
			destination({ spot, context: { kind: 'recording', groupId: 3, figure: 'Enchufla' } })
		).toBe('Linked to 0:42–0:55');
	});
	it('puts a refusal under the field it names, if the step shows it', () => {
		expect(refusalAt('variation', 'name')).toBe('name');
		expect(refusalAt('variation', 'groupId')).toBe('groupId');
		expect(refusalAt('variation', 'style')).toBe('style');
		expect(refusalAt('figure', 'figureName')).toBe('figureName');
		expect(refusalAt('figure', 'style')).toBe('style');
		expect(refusalAt('drill', 'name')).toBe('name');
		expect(refusalAt('drill', 'figureName')).toBe('banner');
		expect(refusalAt('figure', undefined)).toBe('banner');
		expect(refusalAt('position', 'name')).toBe('name');
		expect(refusalAt('position', 'style')).toBe('style');
		expect(refusalAt('position', 'figureName')).toBe('banner');
	});
});

describe('positions and points (ruling 10)', () => {
	it('words a section’s popup for figures, drills and positions, a point’s for positions only', () => {
		expect(linkWords(false)).toEqual({
			opener: 'Link a figure, drill or position…',
			placeholder: 'Search figures, drills and positions',
			create: [
				{ key: 'variation', label: 'Figure' },
				{ key: 'figure', label: 'Move' },
				{ key: 'drill', label: 'Drill' },
				{ key: 'position', label: 'Position' }
			]
		});
		expect(linkWords(true)).toEqual({
			opener: 'Link a position…',
			placeholder: 'Search positions',
			create: [{ key: 'position', label: 'Position' }]
		});
		// Not known yet (the options are on their way, no hint from the host): neutral, nothing to make.
		expect(linkWords(null)).toEqual({ opener: 'Link…', placeholder: 'Search', create: [] });
	});
	it('titles the levels by the range once known, else by what the spot is', () => {
		const heading = { range: '1:12', sub: 'Point' };
		expect(linkTitles(heading, true)).toEqual({ links: 'Link 1:12', pick: 'Link 1:12 to…' });
		expect(linkTitles(null, true)).toEqual({ links: 'Link a point', pick: 'Link a point to…' });
		expect(linkTitles(null, false)).toEqual({
			links: 'Link a section',
			pick: 'Link a section to…'
		});
		expect(linkTitles(null, null)).toEqual({ links: 'Link', pick: 'Link to…' });
	});
	it('says which links did not load: a section’s, a point’s, or just these', () => {
		expect(loadFailed(false)).toEqual({
			title: 'Couldn’t load this section’s links.',
			body: 'Close and tap the link button again.'
		});
		expect(loadFailed(true).title).toBe('Couldn’t load this point’s links.');
		expect(loadFailed(null).title).toBe('Couldn’t load these links.');
	});
	it('keys a target by its kind, so a position and a variation of one id differ', () => {
		expect(targetKey({ figureId: 3 })).toBe('figure:3');
		expect(targetKey({ exerciseId: 3 })).toBe('exercise:3');
		expect(targetKey({ positionId: 3 })).toBe('position:3');
		const f = { linkId: 1, target: { figureId: 3 } };
		const p = { linkId: 1, target: { positionId: 3 } };
		expect(linkRowId(f)).not.toBe(linkRowId(p));
		expect(linkRowId(p)).toBe('position-link-1');
		expect(linkRowId(f)).toBe('link-1');
	});
	it('unlinks a position link by its kind; the others need none', () => {
		expect(unlinkKind({ positionId: 3 })).toBe('position');
		expect(unlinkKind({ figureId: 3 })).toBeUndefined();
		expect(unlinkKind({ exerciseId: 3 })).toBeUndefined();
	});
	it('offers “Use this moment as a point” on a section’s bottom level, only where there is a playhead', () => {
		expect(momentAt(['links'], false, true)).toBe('links');
		expect(momentAt(['links', 'pick'], false, true)).toBe('links');
		expect(momentAt(['pick'], false, true)).toBe('pick');
		expect(momentAt(['pick', 'drill'], false, true)).toBe('pick');
		expect(momentAt(['links'], false, false)).toBeNull();
		expect(momentAt(['links'], true, true)).toBeNull();
		expect(momentAt([], false, true)).toBeNull();
	});
});

describe('nameFromServer', () => {
	// The server names an unnamed section after its first link (spec A3): the
	// player asks for that name instead of offering the Rename sheet.
	it('asks for the name of an unnamed section that now has a link', () => {
		expect(nameFromServer(null, ['Cradle exit · With turn'])).toBe(true);
		expect(nameFromServer(null, ['A · B', 'C · D'])).toBe(true);
	});
	it('asks nothing for a section with a name of its own, or with no link', () => {
		expect(nameFromServer('Madrid', ['Paso Madrid · Basic'])).toBe(false);
		expect(nameFromServer(null, [])).toBe(false);
	});
});

describe('the heading’s range in Slovenian', () => {
	it('drops a whole second’s tenth, with a decimal comma', () => {
		expect(
			withLocale('sl', () => linkHeading({ startMs: 42_000, endMs: 55_500, label: null }).range)
		).toBe('0:42–0:55,5');
	});
});

describe('the popup’s words in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('heads a point as a point, and a section by its length', () => {
		expect(sl(() => linkHeading({ startMs: 72000, endMs: null, label: 'Menjava' }).sub)).toBe(
			'Menjava · točka'
		);
		expect(sl(() => linkHeading({ startMs: 72000, endMs: null, label: null }).sub)).toBe('Točka');
		expect(sl(() => linkHeading({ startMs: 42000, endMs: 55000, label: 'Doble' }).sub)).toBe(
			'Doble · 13,0 s'
		);
	});
	it('says where a created thing is linked, the lesson’s title after a colon', () => {
		const section = { id: 1, startMs: 42000, endMs: 55000, label: null };
		const point = { id: 2, startMs: 72000, endMs: null, label: null };
		const lesson = { kind: 'lesson' as const, lessonId: 2, title: 'Torek' };
		const recording = { kind: 'recording' as const, groupId: 3, figure: 'Enchufla' };
		expect(sl(() => destination({ spot: section, context: lesson }))).toBe(
			'Povezano z odsekom 0:42–0:55 in z lekcijo: Torek'
		);
		expect(sl(() => destination({ spot: section, context: recording }))).toBe(
			'Povezano z odsekom 0:42–0:55'
		);
		expect(sl(() => destination({ spot: point, context: recording }))).toBe(
			'Povezano s točko 1:12'
		);
	});
	it('words the opener, the search and the create row', () => {
		expect(sl(() => linkWords(false))).toEqual({
			opener: 'Poveži z različico, vajo ali položajem …',
			placeholder: 'Iskanje različic, vaj in položajev',
			create: [
				{ key: 'variation', label: 'Različica' },
				{ key: 'figure', label: 'Figura' },
				{ key: 'drill', label: 'Vaja' },
				{ key: 'position', label: 'Položaj' }
			]
		});
		expect(sl(() => linkWords(true))).toEqual({
			opener: 'Poveži s položajem …',
			placeholder: 'Iskanje položajev',
			create: [{ key: 'position', label: 'Položaj' }]
		});
		expect(sl(() => linkWords(null))).toEqual({
			opener: 'Poveži …',
			placeholder: 'Iskanje',
			create: []
		});
	});
	it('titles the levels without a preposition that depends on the next word', () => {
		expect(sl(() => linkTitles({ range: '1:12' }, true))).toEqual({
			links: 'Poveži 1:12',
			pick: 'S čim povezati 1:12?'
		});
		expect(sl(() => linkTitles(null, true))).toEqual({
			links: 'Poveži točko',
			pick: 'S čim povezati točko?'
		});
		expect(sl(() => linkTitles(null, false))).toEqual({
			links: 'Poveži odsek',
			pick: 'S čim povezati odsek?'
		});
		expect(sl(() => linkTitles(null, null))).toEqual({ links: 'Poveži', pick: 'S čim povezati?' });
	});
	it('says which links did not load', () => {
		expect(sl(() => loadFailed(false))).toEqual({
			title: 'Povezav tega odseka ni bilo mogoče naložiti.',
			body: 'Zaprite in znova tapnite gumb za povezave.'
		});
		expect(sl(() => loadFailed(true).title)).toBe('Povezav te točke ni bilo mogoče naložiti.');
		expect(sl(() => loadFailed(null).title)).toBe('Povezav ni bilo mogoče naložiti.');
	});
	it('words “Use this moment as a point”, in either language', () => {
		expect(momentLabel()).toBe('Use this moment as a point');
		expect(sl(() => momentLabel())).toBe('Ta trenutek uporabi kot točko');
	});
});
