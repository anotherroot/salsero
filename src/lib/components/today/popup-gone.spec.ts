import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The log popup is gone everywhere: every practice opens the exercise page. Read as
 * text, as today-forms.spec.ts reads components.
 */
function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(ts|svelte)$/.test(name) ? [path] : [];
	});
}
const SELF = 'src/lib/components/today/popup-gone.spec.ts';
const SOURCES = files('src').filter((f) => f !== SELF);
const BANNED = [/log=1/, /LogShell/, /\blogFor\(/, /\bLogProps\b/, /\bSetList\b/, /fetch-practice/];

describe('the log popup is gone', () => {
	for (const pattern of BANNED)
		it(`nothing under src/ matches ${pattern}`, () => {
			const hits = SOURCES.filter((f) => pattern.test(readFileSync(f, 'utf8')));
			expect(hits).toEqual([]);
		});

	for (const page of ['src/routes/[dance]/(moves)/figures/[id]', 'src/routes/[dance]/lessons/[id]'])
		it(`${page} has no log, deleteSet or restoreSet action`, () => {
			const src = readFileSync(`${page}/+page.server.ts`, 'utf8');
			expect(src).not.toMatch(/^\s*(log|deleteSet|restoreSet):/m);
			expect(src).not.toMatch(/popupData|scheduleAtStart/);
			expect(readFileSync(`${page}/+page.svelte`, 'utf8')).not.toMatch(
				/data\.popup|scheduleAtStart|\blogging\b/
			);
		});

	it('the deleted files are gone', () => {
		for (const f of [
			'src/lib/components/exercises/LogShell.svelte',
			'src/lib/components/exercises/SetList.svelte',
			'src/lib/components/exercises/restore-set.ts',
			'src/lib/components/exercises/fetch-practice.ts',
			'src/lib/components/exercises/kinds/drill/Log.svelte',
			'src/lib/components/exercises/kinds/figure/Log.svelte',
			'src/lib/components/exercises/kinds/lesson/Log.svelte',
			'src/lib/components/exercises/kinds/routine/Log.svelte'
		])
			expect(existsSync(f), f).toBe(false);
	});
});
