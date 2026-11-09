import type { ToolHost } from '$lib/mcp/protocol';
import { TOOL_MODULES, type Impl, type ToolCtx, type ToolModule } from './modules';

/** One host per request. Throws if two modules define one tool name, or a def has no impl. */
export function toolHostFor(ctx: ToolCtx, modules: ToolModule[] = TOOL_MODULES): ToolHost {
	const impls = new Map<string, Impl>();
	const tools = [];
	for (const m of modules) {
		for (const d of m.defs) {
			if (impls.has(d.name)) throw new Error(`Two MCP tools are named ${d.name}`);
			const impl = m.impls[d.name];
			if (!impl) throw new Error(`MCP tool ${d.name} has no implementation`);
			impls.set(d.name, impl);
			tools.push(d);
		}
	}
	return { tools, call: (name, args) => impls.get(name)!(args, ctx) };
}
