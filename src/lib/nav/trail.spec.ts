import { describe, expect, it } from 'vitest';
import {
	arrivalKind,
	arrive,
	backMove,
	backTarget,
	EMPTY_TRAIL,
	forget,
	goneHref,
	hrefOf,
	isGone,
	isRoot,
	isTrailPage,
	keptSearch,
	leave,
	openerFor,
	pageTitle,
	parseTrail,
	remembered,
	removalTarget,
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
	it('uses history when the slot keeps only what a back brings back', () => {
		const e = { 1: '/salsa/figures?q=enc&chip=open', 2: '/salsa/figures/12' };
		expect(backMove(e, 2, '/salsa/figures')).toBe('history');
	});
	it('navigates when the slot below would reopen a popup or a session', () => {
		expect(
			backMove({ 1: '/salsa/figures?new=1', 2: '/salsa/figures/12' }, 2, '/salsa/figures')
		).toBe('goto');
		expect(backMove({ 1: '/salsa?session=1', 2: '/salsa/exercises/4' }, 2, '/salsa')).toBe('goto');
		expect(
			backMove({ 1: '/salsa/exercises/4?log=1', 2: '/salsa/lessons/5' }, 2, '/salsa/exercises/4')
		).toBe('goto');
	});
});

describe('entries', () => {
	it('hold the href each slot was left on, search included', () => {
		const t = arrive(EMPTY_TRAIL, A({ to: '/salsa/figures', search: '?new=1', index: 4 }));
		expect(t.entries[4]).toBe('/salsa/figures?new=1');
		expect(t.pages['/salsa/figures'].search).toBe('');
	});
	it('are forgotten by path, whatever their search', () => {
		let t = arrive(EMPTY_TRAIL, A({ to: '/salsa/routines/3', search: '?add=1', index: 4 }));
		t = forget(t, '/salsa/routines/3');
		expect(t.entries).toEqual({});
	});
});

describe('gone', () => {
	it('is a 404 or a 410 while online', () => {
		expect(isGone(404, true)).toBe(true);
		expect(isGone(410, true)).toBe(true);
	});
	it('is not a server error, a refusal or anything offline', () => {
		expect(isGone(500, true)).toBe(false);
		expect(isGone(403, true)).toBe(false);
		expect(isGone(200, true)).toBe(false);
		expect(isGone(404, false)).toBe(false);
	});
	it("lands on the tab's last main list, with its kept search", () => {
		let t = opening();
		t = arrive(t, A({ to: '/salsa/figures', search: '?q=enc', index: 5, kind: 'push' }));
		t = arrive(t, A({ to: '/salsa/routines', search: '?q=loop', index: 5, kind: 'replace' }));
		expect(goneHref(t, '/salsa/figures/99')).toBe('/salsa/routines?q=loop');
	});
	it("lands on the tab's first main list when none was seen", () => {
		expect(goneHref(EMPTY_TRAIL, '/salsa/lessons/9')).toBe('/salsa/lessons');
		expect(goneHref(EMPTY_TRAIL, '/bachata/figures/9')).toBe('/bachata/figures');
	});
});

describe('arrivalKind', () => {
	it('names the first load and history moves by their type', () => {
		expect(arrivalKind('enter', 7, null)).toBe('enter');
		expect(arrivalKind('popstate', 7, 8)).toBe('pop');
	});
	it('is a replace when the slot index did not move, a push when it did', () => {
		expect(arrivalKind('goto', 7, 7)).toBe('replace');
		expect(arrivalKind('link', 8, 7)).toBe('push');
	});
	it("compares with the slot the navigation left, a sheet's shallow entry included", () => {
		// The page's own entry was 7; a sheet pushed 8; a replace from inside it stays on 8.
		expect(arrivalKind('goto', 8, 8)).toBe('replace');
		// A link from inside that sheet lands on 9.
		expect(arrivalKind('link', 9, 8)).toBe('push');
	});
	it('is a push when the slot it left is unknown', () => {
		expect(arrivalKind('goto', 7, null)).toBe('push');
	});
});

describe('pageTitle', () => {
	it('drops the dance suffix', () => {
		expect(pageTitle('Enchufla · Doble · Salsa')).toBe('Enchufla · Doble');
		expect(pageTitle('Lessons · Bachata')).toBe('Lessons');
	});
	it('leaves a title without one as it is', () => {
		expect(pageTitle('Sign in')).toBe('Sign in');
		expect(pageTitle('Salsa')).toBe('Salsa');
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

describe('removalTarget', () => {
	it('a deleted lesson goes back to the figure that opened it', () => {
		expect(removalTarget(opening(), '/salsa/lessons/5', '/salsa/lessons')).toEqual({
			href: '/salsa/figures/12',
			replace: true,
			intent: 'back',
			carry: false
		});
	});
	it('a deleted page with no opener lands where the server said', () => {
		expect(removalTarget(EMPTY_TRAIL, '/salsa/lessons/5', '/salsa/lessons')).toEqual({
			href: '/salsa/lessons',
			replace: true,
			intent: null,
			carry: false
		});
	});
	it('an archived variation with siblings stays on the figure and keeps its opener', () => {
		expect(removalTarget(opening(), '/salsa/figures/12', '/salsa/figures/13')).toEqual({
			href: '/salsa/figures/13',
			replace: true,
			intent: null,
			carry: true
		});
	});
});
