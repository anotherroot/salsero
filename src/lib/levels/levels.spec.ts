import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	LEVELS,
	levelWords,
	addsAtOnce,
	autoAddOn,
	autoAddSwitchShown,
	canMakeGroup,
	fewSettings,
	groupModeShown,
	levelShown,
	parseLevel,
	simple,
	simpleClass,
	simpleLesson,
	litAt,
	sideTabsFor,
	tabsFor,
	youPath
} from './levels';

describe('tabsFor', () => {
	it('gives each level its tabs, in order, You last', () => {
		expect(tabsFor('follow').map((t) => t.id)).toEqual(['today', 'groups', 'you']);
		expect(tabsFor('own').map((t) => t.id)).toEqual(['today', 'lessons', 'music', 'groups']);
		expect(tabsFor('all').map((t) => t.id)).toEqual([
			'today',
			'moves',
			'lessons',
			'music',
			'groups'
		]);
	});

	it('calls Groups "My class" at Follow my class, and "You" above it', () => {
		const groups = (level: 'follow' | 'own' | 'all') =>
			tabsFor(level).find((t) => t.id === 'groups')!;
		expect(groups('follow').label).toBe('My class');
		expect(groups('follow').icon).toBe('group');
		for (const level of ['own', 'all'] as const) {
			expect(groups(level).label).toBe('You');
			expect(groups(level).icon).toBe('solo');
			expect(groups(level).path).toBe('/[dance]/groups');
		}
		// At Follow my class You is a tab of its own, the settings alone.
		expect(tabsFor('follow')[2]).toMatchObject({ label: 'You', path: '/[dance]/you' });
	});
});

describe('sideTabsFor', () => {
	it('is the desktop side: no You, and Groups keeps its name', () => {
		expect(sideTabsFor('follow').map((t) => t.label)).toEqual(['Today', 'My class']);
		expect(sideTabsFor('own').map((t) => t.label)).toEqual(['Today', 'Lessons', 'Music', 'Groups']);
		expect(sideTabsFor('all').map((t) => t.label)).toEqual([
			'Today',
			'Moves',
			'Lessons',
			'Music',
			'Groups'
		]);
		expect(sideTabsFor('all').find((t) => t.id === 'groups')!.icon).toBe('group');
	});
});

describe('youPath', () => {
	it('is the You page at Follow my class, the Groups list above it', () => {
		expect(youPath('follow', 'salsa')).toBe('/salsa/you');
		expect(youPath('own', 'salsa')).toBe('/salsa/groups');
		expect(youPath('all', 'bachata')).toBe('/bachata/groups');
	});
});

describe('litAt', () => {
	it('lights You for /[dance]/you: its own tab at Follow my class, Groups above it', () => {
		expect(litAt('you', 'follow', false)).toBe('you');
		expect(litAt('you', 'own', false)).toBe('groups');
		expect(litAt('you', 'all', false)).toBe('groups');
	});

	it('lights My class for a class’s lesson at Follow my class, a person’s own lights none', () => {
		expect(litAt('lessons', 'follow', true)).toBe('groups');
		expect(litAt('lessons', 'follow', false)).toBe('lessons');
		expect(tabsFor('follow').some((t) => t.id === 'lessons')).toBe(false);
	});

	it('leaves every other tab and level as the path says', () => {
		expect(litAt('lessons', 'own', true)).toBe('lessons');
		expect(litAt('lessons', 'all', true)).toBe('lessons');
		expect(litAt('today', 'follow', true)).toBe('today');
		expect(litAt('groups', 'follow', true)).toBe('groups');
		expect(litAt('settings', 'follow', true)).toBe('settings');
		expect(litAt(null, 'follow', true)).toBeNull();
	});
});

describe('the words', () => {
	it('are the spec’s, in the order of LEVELS', () => {
		expect(LEVELS).toEqual(['follow', 'own', 'all']);
		expect(LEVELS.map((l) => levelWords(l).title)).toEqual([
			'Follow my class',
			'Practise and keep my own',
			'Everything'
		]);
		expect(levelWords('follow').small).toBe('New class lessons come to Today by themselves.');
		expect(levelWords('own').small).toBe('Videos still just play.');
		expect(levelWords('all').small).toBe('');
	});

	// Catches: the level names left in English, or not the glossary's.
	it('are the glossary’s in Slovenian, Everything still without a small line', () => {
		withLocale('sl', () => {
			expect(LEVELS.map((l) => levelWords(l).title)).toEqual([
				'Sledim svojemu tečaju',
				'Vadim in imam svoje',
				'Vse'
			]);
			expect(levelWords('follow').small).toBe('Nove lekcije s tečaja pridejo pod Danes same.');
			expect(levelWords('all').small).toBe('');
		});
		expect(levelWords('follow').title).toBe('Follow my class');
	});
});

describe('simple and simpleLesson', () => {
	it('is simple at the two lower levels', () => {
		expect(simple('follow')).toBe(true);
		expect(simple('own')).toBe(true);
		expect(simple('all')).toBe(false);
	});

	it('draws a group lesson the person edits in full, at every level', () => {
		const table: ['follow' | 'own' | 'all', 'read' | 'edit', boolean, boolean][] = [
			['follow', 'read', true, true],
			['follow', 'read', false, true],
			['follow', 'edit', true, false], // a teacher on their own group's lesson
			['follow', 'edit', false, true], // a person's own lesson
			['own', 'read', true, true],
			['own', 'read', false, true],
			['own', 'edit', true, false],
			['own', 'edit', false, true],
			['all', 'read', true, false],
			['all', 'read', false, false],
			['all', 'edit', true, false],
			['all', 'edit', false, false]
		];
		for (const [level, access, group, want] of table) {
			expect(simpleLesson(level, access, group), `${level} ${access} ${group}`).toBe(want);
		}
	});

	it('draws a class as My class for a member at Follow my class only', () => {
		expect(simpleClass('follow', 'member')).toBe(true);
		expect(simpleClass('own', 'member')).toBe(false);
		expect(simpleClass('all', 'member')).toBe(false);
		// A teacher keeps the full group page at every level: drafts, New lesson, the code.
		expect(simpleClass('follow', 'editor')).toBe(false);
		expect(simpleClass('follow', 'owner')).toBe(false);
	});
});

describe('autoAddOn', () => {
	it('is always on at Follow my class, the toggle elsewhere, its default by level', () => {
		expect(autoAddOn('follow', null)).toBe(true);
		expect(autoAddOn('follow', 0)).toBe(true); // a stored 0 is kept for later, not read
		expect(autoAddOn('follow', 1)).toBe(true);
		expect(autoAddOn('own', null)).toBe(true);
		expect(autoAddOn('own', 0)).toBe(false);
		expect(autoAddOn('own', 1)).toBe(true);
		expect(autoAddOn('all', null)).toBe(false);
		expect(autoAddOn('all', 0)).toBe(false);
		expect(autoAddOn('all', 1)).toBe(true);
	});
});

describe('a group page’s auto-add switch and Add', () => {
	it('draws the switch at the two upper levels; Add is one tap below Everything', () => {
		expect(LEVELS.filter(autoAddSwitchShown)).toEqual(['own', 'all']);
		expect(LEVELS.filter(addsAtOnce)).toEqual(['follow', 'own']);
	});
});

describe('parseLevel', () => {
	it('takes the three and nothing else', () => {
		expect(parseLevel('follow')).toBe('follow');
		expect(parseLevel('own')).toBe('own');
		expect(parseLevel('all')).toBe('all');
		for (const v of ['x', null, undefined, '', 'ALL', 1, {}]) expect(parseLevel(v)).toBeNull();
	});
});

describe('levelShown', () => {
	it('draws a level not chosen yet as Everything', () => {
		expect(levelShown(null)).toBe('all');
		expect(levelShown(undefined)).toBe('all');
		expect(levelShown('follow')).toBe('follow');
	});
});

describe('group mode and New group', () => {
	it('are Everything’s only', () => {
		expect(LEVELS.filter(groupModeShown)).toEqual(['all']);
		expect(LEVELS.filter(canMakeGroup)).toEqual(['all']);
	});
});

describe('fewSettings', () => {
	it('is Follow my class’s only', () => {
		expect(LEVELS.filter(fewSettings)).toEqual(['follow']);
	});
});
