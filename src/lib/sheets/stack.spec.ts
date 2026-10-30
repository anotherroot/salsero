import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SheetStack, type SheetEntry, type SheetPort } from './stack';

function setup(depth = 0) {
	const calls: string[] = [];
	let queued: (() => void)[] = [];
	const port: SheetPort = {
		push: (d) => calls.push(`push(${d})`),
		go: (d) => calls.push(`go(${d})`),
		later: (fn) => queued.push(fn)
	};
	const s = new SheetStack(port);
	s.start(depth);
	/** The end of the current task: deferred moves go out. */
	const tick = () => {
		const q = queued;
		queued = [];
		q.forEach((f) => f());
	};
	return { s, calls, tick };
}

/** A sheet that logs its closes; `unsaved` makes it ask and hold on to `leave`. */
function sheet(name: string, log: string[], unsaved = false) {
	const held: { leave: (() => void) | null; asked: number } = { leave: null, asked: 0 };
	const entry: SheetEntry = {
		tryLeave: (leave) => {
			if (!unsaved) return leave();
			held.asked++;
			held.leave = leave;
		},
		close: () => log.push(`close ${name}`)
	};
	return { entry, held };
}

describe('SheetStack', () => {
	it('pushes one entry per sheet it opens', () => {
		const { s, calls } = setup();
		const log: string[] = [];
		s.open(sheet('a', log).entry);
		s.open(sheet('b', log).entry);
		expect(calls).toEqual(['push(1)', 'push(2)']);
	});

	it('one sheet: ✕ goes back one entry, and the next sync closes it', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.requestClose(a);
		tick();
		expect(calls.at(-1)).toBe('go(-1)');
		expect(log).toEqual([]);
		s.sync(0);
		expect(log).toEqual(['close a']);
	});

	it('two sheets: Back closes only the top one', () => {
		const { s, calls } = setup();
		const log: string[] = [];
		s.open(sheet('a', log).entry);
		s.open(sheet('b', log).entry);
		const before = calls.length;
		s.sync(1);
		expect(log).toEqual(['close b']);
		s.sync(0);
		expect(log).toEqual(['close b', 'close a']);
		expect(calls.slice(before)).toEqual([]);
	});

	it('Back with unsaved work re-pushes and asks', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		s.open(sheet('a', log).entry);
		const b = sheet('b', log, true);
		s.open(b.entry);
		s.sync(1);
		expect(b.held.asked).toBe(1);
		expect(calls.at(-1)).toBe('push(2)');
		expect(log).toEqual([]);
		b.held.leave!();
		tick();
		expect(calls.at(-1)).toBe('go(-1)');
		s.sync(1);
		expect(log).toEqual(['close b']);
		expect(b.held.asked).toBe(1);
	});

	it('Back while the question is up asks again and puts the entry back again', () => {
		const { s, calls } = setup();
		const log: string[] = [];
		const a = sheet('a', log, true);
		s.open(a.entry);
		s.sync(0);
		s.sync(0);
		expect(a.held.asked).toBe(2);
		expect(calls).toEqual(['push(1)', 'push(1)', 'push(1)']);
		expect(log).toEqual([]);
	});

	it('Keep editing leaves the sheet and its entry in place', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = sheet('a', log, true);
		const key = s.open(a.entry);
		s.requestClose(key);
		tick();
		expect(a.held.asked).toBe(1);
		expect(calls).toEqual(['push(1)']);
		expect(log).toEqual([]);
	});

	it('a double ✕ goes back once', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.requestClose(a);
		tick();
		s.requestClose(a);
		tick();
		expect(calls).toEqual(['push(1)', 'go(-1)']);
	});

	it('✕ then the owner’s open=false goes back only once', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.requestClose(a);
		tick();
		s.sync(0);
		// The sheet's close made its owner flip `open`.
		s.closedByOwner(a);
		tick();
		expect(calls).toEqual(['push(1)', 'go(-1)']);
		expect(log).toEqual(['close a']);
	});

	it('the owner closing it while its Back is on the way neither goes again nor closes twice', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.requestClose(a);
		tick();
		s.closedByOwner(a);
		tick();
		s.sync(0);
		expect(calls).toEqual(['push(1)', 'go(-1)']);
		expect(log).toEqual([]);
	});

	it('closed by its owner: goes back over its own entry only if it is on top', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		const b = s.open(sheet('b', log).entry);
		s.closedByOwner(a);
		tick();
		expect(calls).toEqual(['push(1)', 'push(2)']);
		// The gap a left goes with b.
		s.closedByOwner(b);
		tick();
		expect(calls.at(-1)).toBe('go(-2)');
		s.sync(0);
		expect(log).toEqual([]);
	});

	it('a Back over a sheet whose owner already closed it goes on past it', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.open(sheet('b', log).entry);
		s.closedByOwner(a);
		s.sync(1);
		tick();
		expect(log).toEqual(['close b']);
		expect(calls.at(-1)).toBe('go(-1)');
	});

	it('one sheet closing as another opens, in one tick, keeps one entry', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.closedByOwner(a);
		const b = s.open(sheet('b', log).entry);
		tick();
		expect(calls).toEqual(['push(1)']);
		s.sync(0);
		expect(log).toEqual(['close b']);
		void b;
	});

	it('a stale entry after the sheet is gone bounces back', () => {
		const { s, calls } = setup();
		s.sync(1);
		expect(calls).toEqual(['go(-1)']);
	});

	it('a stale entry on a reload bounces back', () => {
		const { calls } = setup(2);
		expect(calls).toEqual(['go(-2)']);
	});

	it('Back from the page with no sheets does nothing', () => {
		const { s, calls, tick } = setup();
		s.sync(0);
		tick();
		expect(calls).toEqual([]);
	});

	it('takes the moves on their way as moves, not as a stale entry', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		s.open(sheet('a', log).entry);
		const b = s.open(sheet('b', log).entry);
		const c = s.open(sheet('c', log).entry);
		s.requestClose(c);
		tick();
		s.requestClose(b);
		tick();
		expect(calls.slice(3)).toEqual(['go(-1)', 'go(-1)']);
		s.sync(2);
		expect(log).toEqual(['close c']);
		tick();
		s.sync(1);
		tick();
		expect(log).toEqual(['close c', 'close b']);
		expect(calls.slice(3)).toEqual(['go(-1)', 'go(-1)']);
	});

	it('a sheet left behind by a navigation never moves history', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.navigated(0);
		s.closedByOwner(a);
		tick();
		s.anchor();
		expect(calls).toEqual(['push(1)']);
	});

	it('Back onto the entry of a sheet a navigation unmounted bounces, and a sheet the page reopens gets one entry', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.navigated(0);
		s.closedByOwner(a);
		tick();
		s.anchor();
		s.sync(1);
		expect(calls).toEqual(['push(1)', 'go(-1)']);
		s.sync(0);
		// The page it lands on opens its popup again (a session).
		s.open(sheet('b', log).entry);
		expect(calls).toEqual(['push(1)', 'go(-1)', 'push(1)']);
		s.sync(0);
		expect(log).toEqual(['close b']);
	});

	it('closed by owner, then navigated() before the tick → no go', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		s.closedByOwner(a);
		s.navigated(0);
		tick();
		expect(calls).toEqual(['push(1)']);
	});

	it('closed by its owner as a navigation starts: no go while it is on its way', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		// Finish: the popup closes, then goto() starts.
		s.closedByOwner(a);
		const release = s.hold();
		tick();
		expect(calls).toEqual(['push(1)']);
		s.navigated(0);
		release();
		tick();
		s.anchor();
		expect(calls).toEqual(['push(1)']);
	});

	it('a cancelled navigation releases the hold, and the owed Back goes out', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		const release = s.hold();
		s.requestClose(a);
		tick();
		expect(calls).toEqual(['push(1)']);
		release();
		release();
		tick();
		expect(calls).toEqual(['push(1)', 'go(-1)']);
	});

	it('a hold taken before the close, then the close, then navigated() → no go', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		// A link inside the sheet: the click takes the hold, its onclick closes the sheet.
		const release = s.hold();
		s.closedByOwner(a);
		tick();
		tick();
		expect(calls).toEqual(['push(1)']);
		s.navigated(0);
		release();
		tick();
		s.anchor();
		expect(calls).toEqual(['push(1)']);
	});

	it('a click hold no navigation follows (its fallback releases it) lets the owed Back out', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		const a = s.open(sheet('a', log).entry);
		const release = s.hold();
		s.closedByOwner(a);
		tick();
		expect(calls).toEqual(['push(1)']);
		release();
		tick();
		expect(calls).toEqual(['push(1)', 'go(-1)']);
	});

	it('a navigation that lands clears every hold', () => {
		const { s, calls, tick } = setup();
		const log: string[] = [];
		s.hold();
		s.navigated(0);
		const b = s.open(sheet('b', log).entry);
		s.requestClose(b);
		tick();
		expect(calls).toEqual(['push(1)', 'go(-1)']);
	});

	it('a sheet that stays open across a navigation gets an entry on the new page', () => {
		const { s, calls } = setup();
		const log: string[] = [];
		s.open(sheet('a', log).entry);
		s.navigated(0);
		s.anchor();
		expect(calls).toEqual(['push(1)', 'push(1)']);
		s.sync(0);
		expect(log).toEqual(['close a']);
	});

	it('waits for the router before pushing', () => {
		const calls: string[] = [];
		const s = new SheetStack({
			push: (d) => calls.push(`push(${d})`),
			go: (d) => calls.push(`go(${d})`),
			later: (fn) => fn()
		});
		s.open(sheet('a', []).entry);
		expect(calls).toEqual([]);
		s.start(0);
		expect(calls).toEqual(['push(1)']);
	});
});

describe('SvelteKit history state', () => {
	it('keeps page.state under the key history.svelte.ts reads', () => {
		// history.svelte.ts reads the entry's state straight from history.state,
		// because invalidateAll() resets page.state to {} while the entry keeps it.
		const src = readFileSync('node_modules/@sveltejs/kit/src/runtime/client/constants.js', 'utf8');
		expect(src).toContain("export const STATES_KEY = 'sveltekit:states';");
	});
});
