import { describe, expect, it } from 'vitest';
import { toolHostFor } from './host';
import type { ToolModule } from './modules';
import type { ToolDef } from '$lib/mcp/protocol';

const def = (name: string): ToolDef => ({
	name,
	title: name,
	description: name,
	inputSchema: { type: 'object' },
	annotations: {
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false
	}
});
const mod = (name: string): ToolModule => ({
	defs: [def(name)],
	impls: { [name]: async () => ({ isError: false, text: name }) }
});
const ctx = { db: {} as never, userId: 'p', dance: 'salsa' as const, grantId: 1, now: 0 };

describe('toolHostFor', () => {
	it('lists every module tool and routes a call to its impl', async () => {
		const host = toolHostFor(ctx, [mod('a'), mod('b')]);
		expect(host.tools.map((t) => t.name)).toEqual(['a', 'b']);
		expect(await host.call('b', {})).toEqual({ isError: false, text: 'b' });
	});
	it('two modules with one tool name throw', () => {
		expect(() => toolHostFor(ctx, [mod('a'), mod('a')])).toThrow(/a/);
	});
	it('a def without an impl throws', () => {
		expect(() => toolHostFor(ctx, [{ defs: [def('x')], impls: {} }])).toThrow(/x/);
	});
	it('the shipped modules have no clashes', () => {
		expect(() => toolHostFor(ctx)).not.toThrow();
	});
});
