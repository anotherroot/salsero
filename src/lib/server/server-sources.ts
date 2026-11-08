/**
 * Specs only: the server code, read from disk with its comments stripped, for
 * the scans that keep a rule everywhere (`ids.spec.ts`: no raw insert into an
 * id table; `server-clock.spec.ts`: the time only through `serverNow`).
 *
 * Server code is every `.ts` under `src/lib/` but `*.svelte.ts` and specs,
 * every `+page.server.ts`, `+layout.server.ts` and `+server.ts` under
 * `src/routes/`, and `src/hooks.server.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Source {
	path: string;
	code: string;
}

const ROUTE_FILES = new Set(['+page.server.ts', '+layout.server.ts', '+server.ts']);

function serverFile(path: string): boolean {
	if (path.endsWith('.spec.ts') || path.endsWith('.svelte.ts')) return false;
	if (path.startsWith('src/lib/')) return path.endsWith('.ts');
	if (path.startsWith('src/routes/')) return ROUTE_FILES.has(path.split('/').pop()!);
	return path === 'src/hooks.server.ts';
}

/** `/* … *\/` blocks, and `//` to the end of a line when it starts the line or follows a space. */
export function stripComments(code: string): string {
	return code
		.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
		.replace(/(^|\s)\/\/.*$/gm, '$1');
}

export function serverSources(): Source[] {
	const all = readdirSync('src', { recursive: true, withFileTypes: true })
		.filter((d) => d.isFile())
		.map((d) => join(d.parentPath, d.name));
	return all
		.filter(serverFile)
		.sort()
		.map((path) => ({ path, code: stripComments(readFileSync(path, 'utf8')) }));
}

/** Every line of the server code matching `pattern`, as `path:line`. */
export function findInServer(pattern: RegExp, except: string[] = []): string[] {
	const hits: string[] = [];
	for (const { path, code } of serverSources()) {
		if (except.includes(path)) continue;
		code.split('\n').forEach((line, i) => {
			if (pattern.test(line)) hits.push(`${path}:${i + 1}`);
		});
	}
	return hits;
}
