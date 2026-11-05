import { describe, expect, it } from 'vitest';
import {
	LEVELS,
	LEVEL_WORDS,
	autoAddOn,
	canMakeGroup,
	fewSettings,
	groupModeShown,
	levelShown,
	parseLevel,
	simple,
	simpleLesson,
	tabsFor
} from './levels';

describe('tabsFor', () => {
	it('gives each level its tabs, in order', () => {
		expect(tabsFor('follow').map((t) => t.id)).toEqual(['today', 'groups']);
		expect(tabsFor('own').map((t) => t.id)).toEqual(['today', 'lessons', 'groups', 'music']);
		expect(tabsFor('all').map((t) => t.id)).toEqual([
			'today',
			'moves',
			'lessons',
			'groups',
			'music'
		]);
	});

	it('calls Groups "My class" at Follow my class only', () => {
		const label = (level: 'follow' | 'own' | 'all') =>
			tabsFor(level).find((t) => t.id === 'groups')?.label;
		expect(label('follow')).toBe('My class');
		expect(label('own')).toBe('Groups');
		expect(label('all')).toBe('Groups');
		// Same route and icon: only the word changes.
		expect(tabsFor('follow')[1].path).toBe('/[dance]/groups');
		expect(tabsFor('follow')[1].icon).toBe('group');
	});
});

describe('the words', () => {
	it('are the spec’s, in the order of LEVELS', () => {
		expect(LEVELS).toEqual(['follow', 'own', 'all']);
		expect(LEVELS.map((l) => LEVEL_WORDS[l].title)).toEqual([
			'Follow my class',
			'Practise and keep my own',
			'Everything'
		]);
		expect(LEVEL_WORDS.follow.small).toBe('New class lessons come to Today by themselves.');
		expect(LEVEL_WORDS.own.small).toBe('Videos still just play.');
		expect(LEVEL_WORDS.all.small).toBe('');
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
