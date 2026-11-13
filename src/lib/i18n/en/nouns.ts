// Counted nouns, the number included, in the nominative: "2 figures". A count
// after a verb or preposition takes its own case in Slovenian, so such a phrase
// is an entry of its own area, never one of these.
import { plural } from './plural';

export const nouns = {
	figures: (n: number): string => plural(n, 'figure', 'figures'),
	moves: (n: number): string => plural(n, 'move', 'moves'),
	routines: (n: number): string => plural(n, 'routine', 'routines'),
	drills: (n: number): string => plural(n, 'drill', 'drills'),
	lessons: (n: number): string => plural(n, 'lesson', 'lessons'),
	videos: (n: number): string => plural(n, 'video', 'videos'),
	recordings: (n: number): string => plural(n, 'recording', 'recordings'),
	sections: (n: number): string => plural(n, 'section', 'sections'),
	points: (n: number): string => plural(n, 'point', 'points'),
	positions: (n: number): string => plural(n, 'position', 'positions'),
	songs: (n: number): string => plural(n, 'song', 'songs'),
	people: (n: number): string => plural(n, 'person', 'people'),
	groups: (n: number): string => plural(n, 'group', 'groups'),
	/** A figure's length. */
	counts: (n: number): string => plural(n, 'count', 'counts'),
	slots: (n: number): string => plural(n, 'slot', 'slots'),
	/** A routine's length in eights (spec 2026-11-12). */
	eights: (n: number): string => plural(n, 'eight', 'eights'),
	breaks: (n: number): string => plural(n, 'break', 'breaks'),
	timingBreaks: (n: number): string => plural(n, 'timing break', 'timing breaks'),
	changes: (n: number): string => plural(n, 'change', 'changes'),
	differences: (n: number): string => plural(n, 'difference', 'differences'),
	links: (n: number): string => plural(n, 'link', 'links'),
	copies: (n: number): string => plural(n, 'copy', 'copies'),
	matches: (n: number): string => plural(n, 'match', 'matches')
};
