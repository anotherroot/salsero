import { describe, expect, it } from 'vitest';
import {
	arrive,
	backMove,
	backTarget,
	EMPTY_TRAIL,
	forget,
	hrefOf,
	isRoot,
	isTrailPage,
	keptSearch,
	leave,
	openerFor,
	parseTrail,
	remembered,
	scrollFor,
	tabTarget,
	type Arrival,
	type Trail
} from './trail';

const A = (o: Partial<Arrival>): Arrival => ({
	to: '/salsa/routines',
	search: '',
	title: 'Routines',
	from: null,
	index: 1,
	prevIndex: null,
	kind: 'push',
	intent: null,
	...o
});

const FB = { href: '/salsa/lessons', label: 'Back to Lessons' };

function opening(): Trail {
	let t = EMPTY_TRAIL;
	t = arrive(t, A({ to: '/salsa/routines', kind: 'enter', index: 1 }));
	t = arrive(
		t,
		A({
			to: '/salsa/routines/3',
			title: 'Basic loop',
			from: '/salsa/routines',
			index: 2,
			prevIndex: 1
		})
	);
	t = arrive(
		t,
		A({
			to: '/salsa/figures/12',
			title: 'Enchufla · Doble',
			from: '/salsa/routines/3',
			index: 3,
			prevIndex: 2
		})
	);
	t = arrive(
		t,
		A({
			to: '/salsa/lessons/5',
			title: 'Tue class',
			from: '/salsa/figures/12',
			index: 4,
			prevIndex: 3
		})
	);
	return t;
}

describe('keptSearch', () => {
	it('strips popup flags and session, keeps day, q and chips', () => {
		expect(keptSearch('?q=enc&new=1&style=cuban')).toBe('?q=enc&style=cuban');
		expect(keptSearch('?session=1&day=2026-10-30')).toBe('?day=2026-10-30');
		expect(keptSearch('?log=1')).toBe('');
		expect(keptSearch('')).toBe('');
		expect(keptSearch('?add=1&v=2&x=1')).toBe('?x=1');
	});
});

describe('page classes', () => {
	it('knows trail pages, remembered pages and roots', () => {
		expect(isTrailPage('/salsa/figures/1')).toBe(true);
		expect(isTrailPage('/bachata')).toBe(true);
		expect(isTrailPage('/settings')).toBe(false);
		expect(isTrailPage('/voice')).toBe(false);
		expect(remembered('/salsa/player')).toBe(false);
		expect(remembered('/salsa/share')).toBe(false);
		expect(remembered('/salsa/figures/1')).toBe(true);
		expect(remembered('/settings')).toBe(false);
		for (const p of [
			'/salsa',
			'/salsa/figures',
			'/salsa/routines',
			'/salsa/lessons',
			'/salsa/songs'
		])
			expect(isRoot(p)).toBe(true);
		expect(isRoot('/salsa/figures/1')).toBe(false);
		expect(isRoot('/settings')).toBe(false);
	});
});

describe('openerFor', () => {
	it('gives from on a push, unless to is already up from`s chain', () => {
		const t = opening();
		expect(openerFor(t, '/salsa/songs/9', '/salsa/lessons/5')).toBe('/salsa/lessons/5');
		// figure 12 is on lesson 5's chain: it keeps its opener
		expect(openerFor(t, '/salsa/figures/12', '/salsa/lessons/5')).toBe('/salsa/routines/3');
	});
	it('keeps the existing opener, or null, from outside the dance', () => {
		const t = opening();
		expect(openerFor(t, '/salsa/figures/12', null)).toBe('/salsa/routines/3');
		expect(openerFor(t, '/salsa/figures/99', null)).toBeNull();
	});
	it('survives a loop in the chain', () => {
		const t: Trail = {
			...EMPTY_TRAIL,
			pages: {
				'/salsa/a': { search: '', scrollY: 0, opener: '/salsa/b', title: 'a' },
				'/salsa/b': { search: '', scrollY: 0, opener: '/salsa/a', title: 'b' }
			}
		};
		expect(openerFor(t, '/salsa/c', '/salsa/a')).toBe('/salsa/a');
	});
});

describe('arrive', () => {
	it('walks the opening case', () => {
		let t = opening();
		expect(backTarget(t, '/salsa/lessons/5', FB)).toEqual({
			href: '/salsa/figures/12',
			label: 'Back to Enchufla · Doble',
			key: '/salsa/figures/12'
		});
		expect(tabTarget(t, 'moves', 'salsa', '/salsa/lessons/5')).toEqual({
			href: '/salsa/figures/12'
		});
		t = arrive(
			t,
			A({
				to: '/salsa/figures/12',
				from: '/salsa/lessons/5',
				index: 5,
				prevIndex: 4,
				intent: 'tab',
				title: 'Enchufla · Doble'
			})
		);
		expect(
			backTarget(t, '/salsa/figures/12', { href: '/salsa/figures', label: 'Back to Moves' }).href
		).toBe('/salsa/routines/3');
	});

	it('a link back up the chain does not make a loop', () => {
		let t = opening();
		t = arrive(
			t,
			A({
				to: '/salsa/figures/12',
				from: '/salsa/lessons/5',
				index: 5,
				prevIndex: 4,
				title: 'Enchufla · Doble'
			})
		);
		expect(t.pages['/salsa/figures/12'].opener).toBe('/salsa/routines/3');
	});

	it('a main list never has an opener', () => {
		let t = opening();
		t = arrive(
			t,
			A({ to: '/salsa/lessons', title: 'Lessons', from: '/salsa/figures/12', index: 5 })
		);
		expect(t.pages['/salsa/lessons'].opener).toBeNull();
	});

	it('replace carries the opener (variation step) and keeps the search on refilter', () => {
		let t = opening();
		t = arrive(
			t,
			A({
				to: '/salsa/figures/13',
				title: 'Enchufla · Simple',
				from: '/salsa/figures/12',
				index: 3,
				prevIndex: 3,
				kind: 'replace'
			})
		);
		expect(t.pages['/salsa/figures/13'].opener).toBe('/salsa/routines/3');
		t = arrive(t, A({ to: '/salsa/figures', title: 'Moves', index: 6, search: '?q=a' }));
		t = arrive(
			t,
			A({
				to: '/salsa/figures',
				title: 'Moves',
				from: '/salsa/figures',
				index: 6,
				kind: 'replace',
				search: '?q=ab&log=1'
			})
		);
		expect(t.pages['/salsa/figures'].search).toBe('?q=ab');
		expect(t.pages['/salsa/figures'].opener).toBeNull();
	});

	it('reload (enter) keeps the record; a fresh enter has no opener', () => {
		const t = opening();
		const again = arrive(
			t,
			A({ to: '/salsa/figures/12', kind: 'enter', index: 3, title: 'Enchufla · Doble' })
		);
		expect(again.pages['/salsa/figures/12'].opener).toBe('/salsa/routines/3');
		const fresh = arrive(EMPTY_TRAIL, A({ to: '/salsa/figures/12', kind: 'enter', title: 'x' }));
		expect(fresh.pages['/salsa/figures/12'].opener).toBeNull();
	});

	it('pop keeps the opener', () => {
		const t = opening();
		const p = arrive(
			t,
			A({
				to: '/salsa/figures/12',
				kind: 'pop',
				index: 3,
				prevIndex: 4,
				from: '/salsa/lessons/5',
				title: 'Enchufla · Doble'
			})
		);
		expect(p.pages['/salsa/figures/12'].opener).toBe('/salsa/routines/3');
	});

	it('push drops history slots above it', () => {
		let t = opening();
		expect(Object.keys(t.entries)).toHaveLength(4);
		t = arrive(
			t,
			A({ to: '/salsa/songs', title: 'Music', from: '/salsa/figures/12', index: 3, prevIndex: 3 })
		);
		expect(t.entries).toEqual({ 1: '/salsa/routines', 2: '/salsa/routines/3', 3: '/salsa/songs' });
	});

	it("Practice and share are never a tab's last page", () => {
		let t = opening();
		t = arrive(
			t,
			A({ to: '/salsa/player', title: 'Practice', from: '/salsa/lessons/5', index: 5 })
		);
		expect(t.last['salsa:music']).toBeUndefined();
		expect(t.entries[5]).toBe('/salsa/player');
		expect(t.last['salsa:lessons']).toBe('/salsa/lessons/5');
	});

	it('ignores pages outside a dance and does not mutate', () => {
		const t = opening();
		const snapshot = JSON.stringify(t);
		expect(arrive(t, A({ to: '/settings', title: 'Settings' }))).toBe(t);
		arrive(t, A({ to: '/salsa/songs', title: 'Music', index: 9 }));
		expect(JSON.stringify(t)).toBe(snapshot);
	});

	it('sets last and lastRoot per dance and tab', () => {
		const t = opening();
		expect(t.last['salsa:moves']).toBe('/salsa/figures/12');
		expect(t.lastRoot['salsa:moves']).toBe('/salsa/routines');
		expect(t.lastRoot['salsa:lessons']).toBeUndefined();
	});
});

describe('tabTarget', () => {
	it('lit tab: on a root scrolls to top, on a pushed page goes to the last root with its search', () => {
		let t = EMPTY_TRAIL;
		t = arrive(t, A({ to: '/salsa/figures', title: 'Moves', search: '?q=enc', kind: 'enter' }));
		t = arrive(
			t,
			A({ to: '/salsa/figures/12', title: 'E', from: '/salsa/figures', index: 2, prevIndex: 1 })
		);
		expect(tabTarget(t, 'moves', 'salsa', '/salsa/figures')).toEqual({ scrollTop: true });
		expect(tabTarget(t, 'moves', 'salsa', '/salsa/figures/12')).toEqual({
			href: '/salsa/figures?q=enc'
		});
	});
	it('other tab: last page, else last root, else the first root', () => {
		let t = opening();
		expect(tabTarget(t, 'lessons', 'salsa', '/salsa/figures/12')).toEqual({
			href: '/salsa/lessons/5'
		});
		expect(tabTarget(t, 'music', 'salsa', '/salsa/figures/12')).toEqual({ href: '/salsa/songs' });
		t = arrive(t, A({ to: '/salsa/player', title: 'P', index: 5, from: '/salsa/figures/12' }));
		expect(tabTarget(t, 'moves', 'salsa', '/salsa/lessons/5')).toEqual({
			href: '/salsa/figures/12'
		});
		expect(tabTarget(EMPTY_TRAIL, 'moves', 'salsa', '/salsa')).toEqual({ href: '/salsa/figures' });
	});
});

describe('backTarget', () => {
	it('uses the fallback, with its kept search, when there is no opener', () => {
		let t = EMPTY_TRAIL;
		expect(backTarget(t, '/salsa/lessons/5', FB)).toEqual({ ...FB, key: null });
		t = arrive(t, A({ to: '/salsa/lessons', title: 'Lessons', search: '?q=x', kind: 'enter' }));
		expect(backTarget(t, '/salsa/lessons/5', FB)).toEqual({
			href: '/salsa/lessons?q=x',
			label: 'Back to Lessons',
			key: null
		});
	});
	it('falls back when the opener has no record', () => {
		const t: Trail = {
			...EMPTY_TRAIL,
			pages: { '/salsa/a': { search: '', scrollY: 0, opener: '/salsa/gone', title: 'a' } }
		};
		expect(backTarget(t, '/salsa/a', FB).key).toBeNull();
	});
});

describe('leave and hrefOf', () => {
	it('stores the scroll on an existing record only', () => {
		const t = opening();
		expect(leave(t, '/salsa/lessons/5', 300).pages['/salsa/lessons/5'].scrollY).toBe(300);
		expect(leave(t, '/salsa/nowhere', 300)).toEqual(t);
		expect(hrefOf(t, '/salsa/nowhere')).toBe('/salsa/nowhere');
	});
});

describe('forget', () => {
	it("reattaches children to the removed page's opener and clears tab memory", () => {
		let t = opening();
		t = forget(t, '/salsa/figures/12');
		expect(t.pages['/salsa/figures/12']).toBeUndefined();
		expect(t.pages['/salsa/lessons/5'].opener).toBe('/salsa/routines/3');
		expect(t.last['salsa:moves']).toBeUndefined();
		expect(Object.values(t.entries)).not.toContain('/salsa/figures/12');
		expect(t.last['salsa:lessons']).toBe('/salsa/lessons/5');
	});
});

describe('scrollFor', () => {
	it('restores on push/tab/back, not on pop, enter or same path', () => {
		let t = opening();
		t = leave(t, '/salsa/figures/12', 420);
		const a = A({ to: '/salsa/figures/12', from: '/salsa/lessons/5', index: 5, prevIndex: 4 });
		expect(scrollFor(t, a)).toBe(420);
		expect(scrollFor(t, { ...a, intent: 'tab' })).toBe(420);
		expect(scrollFor(t, { ...a, intent: 'back' })).toBe(420);
		expect(scrollFor(t, { ...a, kind: 'pop' })).toBeNull();
		expect(scrollFor(t, { ...a, kind: 'enter' })).toBeNull();
		expect(scrollFor(t, { ...a, from: '/salsa/figures/12', kind: 'replace' })).toBeNull();
		expect(scrollFor(t, { ...a, to: '/salsa/songs' })).toBeNull();
	});
});

describe('backMove', () => {
	it('uses history when the slot before holds the target', () => {
		const e = { 1: '/salsa/routines', 2: '/salsa/routines/3' };
		expect(backMove(e, 2, '/salsa/routines')).toBe('history');
		expect(backMove(e, 2, '/salsa/figures')).toBe('goto');
		expect(backMove(e, 2, null)).toBe('goto');
		expect(backMove(e, 1, '/salsa/routines')).toBe('goto');
	});
});

describe('parseTrail', () => {
	it('survives junk', () => {
		expect(parseTrail('{oops')).toEqual(EMPTY_TRAIL);
		expect(parseTrail(null)).toEqual(EMPTY_TRAIL);
		expect(parseTrail('[1]')).toEqual(EMPTY_TRAIL);
		expect(parseTrail('{"pages":5}')).toEqual(EMPTY_TRAIL);
	});
	it('round-trips', () => {
		const t = opening();
		expect(parseTrail(JSON.stringify(t))).toEqual(t);
	});
});
