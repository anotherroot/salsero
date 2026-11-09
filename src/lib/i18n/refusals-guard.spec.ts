// No refusal a person reads is a bare English literal: every `message`, `fail`,
// `error(4xx)` and `failJson` on the server goes through `t()`. Machines keep
// English (the worker's queue, the media servers, /releases, /api/app-update),
// so their files are not scanned.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTE_FILE = /^\+(page\.server|server|layout\.server)\.ts$/;

/** Paths a machine reads, not a person: their bodies stay English. */
const MACHINES = [
	/^src\/routes\/api\/worker\//,
	/^src\/routes\/(recordings|audio|count|lesson-videos)\/\[file\]\//,
	/^src\/routes\/releases\//,
	/^src\/routes\/api\/app-update\//,
	// The device worker's pull: read by code, never shown.
	/^src\/routes\/api\/sync\//,
	// The AI's queue: one-line messages to the AI app (MCP), English like every tool text.
	// What the person reads is a refusal code worded by `t().suggestions` on the page.
	/^src\/lib\/server\/ai-queue\/(kinds\/|store\.ts)/
];

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

function scanned(): string[] {
	const routes = walk('src/routes').filter((p) => ROUTE_FILE.test(p.split('/').pop()!));
	const server = walk('src/lib/server').filter(
		(p) => p.endsWith('.ts') && !p.endsWith('.spec.ts') && !/\/test-[^/]*\.ts$/.test(p)
	);
	return [...routes, ...server].filter((p) => !MACHINES.some((m) => m.test(p)));
}

// A literal that starts with a capital letter: a sentence a person would read. One
// alternative per quote, so the other quotes may sit inside it ("Can't …", 'a "b"').
const LITERAL = String.raw`(?:'[A-Z][^'\n]*'|"[A-Z][^"\n]*"|\`[A-Z][^\`]*\`)`;
const PATTERNS = [
	new RegExp(String.raw`message:\s*${LITERAL}`, 'g'),
	new RegExp(String.raw`\bfail\(\s*\d+\s*,\s*\{[^}]*?${LITERAL}`, 'g'),
	// `failJson` imported as `fail` (the lesson video's chunk route).
	new RegExp(String.raw`\bfail\(\s*\d+\s*,\s*${LITERAL}`, 'g'),
	new RegExp(String.raw`\berror\(\s*4\d\d\s*,\s*${LITERAL}`, 'g'),
	new RegExp(String.raw`\bfailJson\(\s*\d+\s*,\s*${LITERAL}`, 'g')
];

/** Each line holding an English refusal in `src`: "12: error(404, 'Not found'". */
function englishRefusals(src: string): string[] {
	// Comments go, their lines stay, so a line number is the file's.
	const code = src
		.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ''))
		.replace(/^\s*\/\/.*$/gm, '');
	const byLine = new Map<number, string>();
	for (const p of PATTERNS) {
		for (const m of code.matchAll(p)) {
			const line = code.slice(0, m.index).split('\n').length;
			if (!byLine.has(line)) byLine.set(line, `${line}: ${m[0].replace(/\s+/g, ' ')}`);
		}
	}
	return [...byLine].sort(([a], [b]) => a - b).map(([, found]) => found);
}

describe('englishRefusals', () => {
	it('finds each shape of an English refusal', () => {
		expect(
			englishRefusals(
				[
					"return fail(400, { message: 'No name.' });",
					"return fail(409, { field: 'name', error: 'Taken.' });",
					"error(404, 'Not found');",
					"return failJson(409, 'Wrong place.');",
					'/* a comment',
					'   over two lines */',
					"return fail(404, 'Bad upload id.');",
					'return fail(400, { message: "Can\'t do that." });'
				].join('\n')
			)
		).toEqual([
			"1: message: 'No name.'",
			"2: fail(409, { field: 'name', error: 'Taken.'",
			"3: error(404, 'Not found'",
			"4: failJson(409, 'Wrong place.'",
			"7: fail(404, 'Bad upload id.'",
			'8: message: "Can\'t do that."'
		]);
	});

	it('passes the catalog, a lower-case code and a 5xx', () => {
		expect(
			englishRefusals(
				[
					'return fail(400, { message: t().refusals.notFound() });',
					"return fail(400, { kind: 'clash', message: words.x });",
					"error(500, 'Boom');",
					"// error(404, 'In a comment')"
				].join('\n')
			)
		).toEqual([]);
	});
});

describe('server refusals', () => {
	it('are all in the catalog', () => {
		const found = Object.fromEntries(
			scanned()
				.map((path) => [path, englishRefusals(readFileSync(path, 'utf8'))] as const)
				.filter(([, lines]) => lines.length > 0)
		);
		expect(found).toEqual({});
	});
});
