import { describe, expect, it } from 'vitest';
import { PlayerHistory, type HistoryPort } from './player-history';
import { openingStack, type Screen, type Stack } from './screens';

const full: Screen = { kind: 'full' };
const section = (spotId: number): Screen => ({ kind: 'section', spotId });
const edit = (spotId: number): Screen => ({ kind: 'edit', spotId });

function setup() {
	const calls: string[] = [];
	const reports: Stack[] = [];
	let closed = 0;
	const port: HistoryPort = {
		push: (d) => calls.push(`push(${d})`),
		replace: (d) => calls.push(`replace(${d})`),
		go: (d) => calls.push(`go(${d})`)
	};
	const h = new PlayerHistory(
		port,
		(s) => reports.push(s),
		() => closed++
	);
	return { h, calls, reports, closedCount: () => closed };
}

describe('PlayerHistory', () => {
	it('pushes one entry per screen it opens on', () => {
		const { h, calls, reports } = setup();
		h.open(openingStack(4));
		expect(calls).toEqual(['push(1)', 'push(2)']);
		expect(reports.at(-1)).toEqual([full, section(4)]);
	});

	it('shows a pushed screen at once', () => {
		const { h, calls, reports } = setup();
		h.open(openingStack(4));
		h.push(edit(4));
		expect(reports.at(-1)).toEqual([full, section(4), edit(4)]);
		expect(calls.at(-1)).toBe('push(3)');
	});

	it('goes up only when history says so', () => {
		const { h, calls, reports } = setup();
		h.open(openingStack(4));
		h.push(edit(4));
		h.up();
		expect(calls.at(-1)).toBe('go(-1)');
		expect(h.stack).toHaveLength(3);
		h.sync(2);
		expect(reports.at(-1)).toEqual([full, section(4)]);
	});

	it('takes the same depth twice as one move', () => {
		const { h, reports } = setup();
		h.open(openingStack(4));
		const before = reports.length;
		h.sync(1);
		h.sync(1);
		expect(h.stack).toEqual([full]);
		expect(reports.length - before).toBe(1);
	});

	it('closes once, however many times history empties', () => {
		const { h, closedCount } = setup();
		h.open(openingStack());
		h.sync(0);
		h.sync(undefined);
		expect(closedCount()).toBe(1);
	});

	it('undoes a forward move instead of growing', () => {
		const { h, calls } = setup();
		h.open(openingStack(4));
		h.push(edit(4));
		h.sync(4);
		expect(calls.at(-1)).toBe('go(-1)');
		expect(h.stack).toHaveLength(3);
	});

	it('unwinds every entry on close', () => {
		const { h, calls } = setup();
		h.open(openingStack(4));
		h.push(edit(4));
		h.close();
		expect(calls.at(-1)).toBe('go(-3)');
	});

	it('replaces the top screen in place', () => {
		const { h, calls, reports } = setup();
		h.open(openingStack());
		h.push(edit(4));
		h.replaceTop(section(4));
		expect(calls.at(-1)).toBe('replace(2)');
		expect(reports.at(-1)).toEqual([full, section(4)]);
	});

	it('jumps by going back to the common part, then pushing the rest', () => {
		const { h, calls, reports } = setup();
		h.open(openingStack(4));
		h.push(edit(4));
		h.jump([full, section(7)]);
		expect(calls.at(-1)).toBe('go(-2)');
		h.sync(1);
		expect(calls.at(-1)).toBe('push(2)');
		expect(reports.at(-1)).toEqual([full, section(7)]);
	});

	it('jumps forward without going back when the stack is a prefix', () => {
		const { h, calls, reports } = setup();
		h.open(openingStack());
		h.jump([full, section(7)]);
		expect(calls.at(-1)).toBe('push(2)');
		expect(reports.at(-1)).toEqual([full, section(7)]);
	});

	it('moves history once for two ups before it answers', () => {
		const { h, calls } = setup();
		h.open(openingStack());
		h.push(edit(5));
		const before = calls.length;
		h.up();
		h.up();
		expect(calls.slice(before)).toEqual(['go(-1)']);
	});

	it('closes once for two quick ✕', () => {
		const { h, calls } = setup();
		h.open(openingStack(4));
		const before = calls.length;
		h.close();
		h.close();
		expect(calls.slice(before)).toEqual(['go(-2)']);
	});

	it('closes over what is left when an up is already on its way', () => {
		const { h, calls } = setup();
		h.open(openingStack(4));
		h.push(edit(4));
		const before = calls.length;
		h.up();
		h.close();
		expect(calls.slice(before)).toEqual(['go(-1)', 'go(-2)']);
	});

	it('goes up again once history has answered', () => {
		const { h, calls } = setup();
		h.open(openingStack(4));
		h.up();
		h.sync(1);
		h.up();
		expect(calls.slice(-2)).toEqual(['go(-1)', 'go(-1)']);
	});

	it('follows a back made outside the player (the browser button)', () => {
		const { h, calls } = setup();
		h.open(openingStack(4));
		h.push(edit(4));
		h.sync(2);
		h.up();
		expect(calls.at(-1)).toBe('go(-1)');
	});
});
