// The map of positions: the page, its tray and legend, a position's sheet and the walk
// that builds a routine. Spec 2026-11-08-map-walk.
import { plural } from './plural';

export const map = {
	title: 'The map',
	back: 'Back to Positions',
	whole: 'Whole map',
	info: 'How the map works',
	hint: 'Tap a position to see where it leads.',
	/** No positions at all. */
	empty: 'No positions yet. Add some on Positions and tag your figures’ starts and ends.',
	/** Positions, but no figure joins any of them. */
	unjoined: 'Nothing joins your positions yet: tag a figure’s start and end.',
	/** The word under a dead end's or an orphan's pill. */
	mark: { deadEnd: 'dead end', orphan: 'orphan' },
	/** Under a node that stands for twinned positions (Same as…). */
	twins: 'Twins',
	/** The ⓘ sheet's last line. */
	fitsAnywhere: 'Figures without a position fit anywhere.',
	/** The SVG's name for a screen reader. */
	label: (groupMode: boolean): string =>
		groupMode ? 'The map of the group’s positions' : 'The map of your positions',
	/**
	 * "15 positions · 32 figures between them · 10 with none · 4 stranded". Zero parts after the
	 * first are left out.
	 */
	summary: (n: { positions: number; between: number; none: number; stranded: number }): string => {
		const parts = [plural(n.positions, 'position', 'positions')];
		if (n.between > 0) parts.push(`${plural(n.between, 'figure', 'figures')} between them`);
		if (n.none > 0) parts.push(`${n.none} with none`);
		if (n.stranded > 0) parts.push(`${n.stranded} stranded`);
		return parts.join(' · ');
	},
	/** A position's accessible name: "Cerrada · 6 in · 8 out", then its mark, then its twins line. */
	nodeName: (n: {
		name: string;
		ins: number;
		outs: number;
		mark: 'dead end' | 'orphan' | null;
		twins: string | null;
	}): string => {
		const parts = [n.name, `${n.ins} in`, `${n.outs} out`];
		if (n.mark) parts.push(n.mark);
		if (n.twins) parts.push(n.twins);
		return parts.join(' · ');
	},
	chip: {
		orphans: (n: number): string => `${n} nothing gets to`,
		deadEnds: (n: number): string => plural(n, 'dead end', 'dead ends'),
		unused: (n: number): string => `${n} unused`,
		noPosition: (n: number): string => `${n} with no position`
	},
	legend: {
		deadEnd: 'dead end: nothing leaves',
		orphan: 'orphan: nothing gets there',
		island: 'island: cut off from the rest',
		arrows: 'Thicker arrows: more figures · the number: how many',
		out: 'Wine: where it goes',
		in: 'Blue: where it comes from',
		gestures: 'Pinch to zoom · double tap to see it all'
	},
	sheet: {
		insOuts: (i: number, o: number): string => `${plural(i, 'figure', 'figures')} in · ${o} out`,
		open: 'Open',
		stays: 'Stays here:',
		from: 'From',
		nothingIn: 'Nothing leads here yet',
		stepTo: 'Step to',
		anywhere: 'Anywhere',
		noEnd: 'No end set',
		nothingOut: 'Nothing leaves here yet',
		walk: 'Walk from here'
	},
	walk: {
		title: (start: string): string => `Walk from ${start}`,
		status: (n: number, at: string): string =>
			n === 0 ? 'No figures yet' : `${plural(n, 'figure', 'figures')} · now in ${at}`,
		undo: 'Undo',
		clear: 'Clear',
		make: (n: number): string => `Make routine · ${n}`,
		next: (at: string, n: number): string => `Next from ${at} · ${plural(n, 'place', 'places')}`,
		to: (name: string): string => `→ ${name}`,
		stays: (name: string): string => `↻ Stays in ${name}`,
		anywhere: 'Anywhere (no end)',
		fitsAnywhere: (n: number): string => `Fits anywhere · ${n}`,
		carryOn: (fig: string): string =>
			`${fig} has no end, so anything can follow. Tap a position on the map to carry on.`,
		stuck: (name: string): string =>
			`Nothing leads out of ${name}. Undo, or make the routine as it is.`,
		hint: 'Tap a figure below to add it. Each one starts where the last one ended.',
		unsaved: 'Walk on the map',
		defaultName: (start: string): string => `Walk from ${start}`,
		newRoutine: 'New routine',
		name: 'Name',
		nameError: 'Give the routine a name (up to 200 characters).'
	}
};
