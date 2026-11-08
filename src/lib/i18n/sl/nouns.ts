// Counted nouns in the nominative, the number included: 1 različica, 2 različici,
// 3 različice, 5 različic. Another case is another entry, in its own area.
import type { Catalog } from '../catalog';
import { slCount } from '../plural';

export const nouns: Catalog['nouns'] = {
	figures: (n) => slCount(n, ['različica', 'različici', 'različice', 'različic']),
	moves: (n) => slCount(n, ['figura', 'figuri', 'figure', 'figur']),
	routines: (n) => slCount(n, ['kombinacija', 'kombinaciji', 'kombinacije', 'kombinacij']),
	drills: (n) => slCount(n, ['vaja', 'vaji', 'vaje', 'vaj']),
	lessons: (n) => slCount(n, ['lekcija', 'lekciji', 'lekcije', 'lekcij']),
	videos: (n) => slCount(n, ['video', 'videa', 'videi', 'videov']),
	recordings: (n) => slCount(n, ['posnetek', 'posnetka', 'posnetki', 'posnetkov']),
	sections: (n) => slCount(n, ['odsek', 'odseka', 'odseki', 'odsekov']),
	points: (n) => slCount(n, ['točka', 'točki', 'točke', 'točk']),
	positions: (n) => slCount(n, ['položaj', 'položaja', 'položaji', 'položajev']),
	songs: (n) => slCount(n, ['skladba', 'skladbi', 'skladbe', 'skladb']),
	people: (n) => slCount(n, ['oseba', 'osebi', 'osebe', 'oseb']),
	groups: (n) => slCount(n, ['skupina', 'skupini', 'skupine', 'skupin']),
	/** A figure's length: "8 dob". */
	counts: (n) => slCount(n, ['doba', 'dobi', 'dobe', 'dob']),
	slots: (n) => slCount(n, ['mesto', 'mesti', 'mesta', 'mest']),
	breaks: (n) => slCount(n, ['prekinitev', 'prekinitvi', 'prekinitve', 'prekinitev']),
	timingBreaks: (n) =>
		slCount(n, [
			'časovna prekinitev',
			'časovni prekinitvi',
			'časovne prekinitve',
			'časovnih prekinitev'
		]),
	changes: (n) => slCount(n, ['sprememba', 'spremembi', 'spremembe', 'sprememb']),
	differences: (n) => slCount(n, ['razlika', 'razliki', 'razlike', 'razlik']),
	links: (n) => slCount(n, ['povezava', 'povezavi', 'povezave', 'povezav']),
	copies: (n) => slCount(n, ['kopija', 'kopiji', 'kopije', 'kopij']),
	matches: (n) => slCount(n, ['zadetek', 'zadetka', 'zadetki', 'zadetkov'])
};
