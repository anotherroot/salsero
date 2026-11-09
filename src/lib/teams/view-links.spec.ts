import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * The group view lives in the address (`?in=`, group view spec 2026-11-09): every
 * forward step from a list or page in a group's view must keep it, or the person
 * lands in their own list unasked (and a + there makes their own row). So every
 * link, `goto` and form action a component builds to a list whose content follows
 * the view goes through `withView` (or `tabHrefIn`), on its line or the two above
 * (where the formatter breaks a call), or is listed here with the reason it needs none.
 *
 * Catches: a new "back to the list" link, filter goto or create action that drops `in`.
 */
const EXEMPT: Record<string, string> = {
	'src/lib/components/links/LinkPopup.svelte:/[dance]/(moves)/positions':
		'a position page (the id follows): a page of one thing decides by its row',
	'src/lib/components/songs/SongPickSheet.svelte:/songs?add=1':
		'the player’s song picker: the player is personal',
	'src/lib/components/today/TodayList.svelte:/[dance]/(moves)/routines':
		'Today is personal: its link opens your own Routines',
	'src/routes/[dance]/(moves)/+layout.svelte:/[dance]/(moves)/figures':
		'a route id in the segment table; the goto that uses it goes through withView',
	'src/routes/[dance]/(moves)/+layout.svelte:/[dance]/(moves)/routines':
		'a route id in the segment table',
	'src/routes/[dance]/(moves)/+layout.svelte:/[dance]/(moves)/positions':
		'a route id in the segment table',
	// A list's own path: the trail keys its kept filter by it; its links go through withView.
	'src/lib/components/moves/FiguresList.svelte:/[dance]/(moves)/figures':
		'the list’s path (a trail key)',
	'src/lib/components/moves/RoutinesList.svelte:/[dance]/(moves)/routines':
		'the list’s path (a trail key)',
	'src/lib/components/moves/PositionsList.svelte:/[dance]/(moves)/positions':
		'the list’s path (a trail key)',
	'src/lib/components/positions/MapPane.svelte:/[dance]/(moves)/positions':
		'the list’s path; Back wraps it',
	'src/lib/components/songs/MusicList.svelte:/[dance]/songs': 'the list’s path (a trail key)'
};

const LIST =
	/(\$\{[^}]*\}|\[dance\]|\{dance\})\/(\(moves\)\/)?(figures|routines|positions|lessons|songs|coverage)(\/map|\/none|\/imports)?(\?[^'"`\s]*|(?=['"`]))/g;

function svelteFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return svelteFiles(p);
		return p.endsWith('.svelte') ? [p] : [];
	});
}

function unguarded(): string[] {
	const out: string[] = [];
	for (const file of [...svelteFiles('src/lib/components'), ...svelteFiles('src/routes')]) {
		const lines = readFileSync(file, 'utf8').split('\n');
		lines.forEach((line, i) => {
			const near = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
			if (/withView\(|tabHrefIn\(/.test(near)) return;
			for (const m of line.matchAll(LIST)) {
				const path = m[0].replace(/^(\$\{[^}]*\}|\{dance\})/, '');
				const key = `${file}:${m[0].startsWith('[dance]') ? `/${m[0]}` : path}`;
				if (EXEMPT[key] === undefined) out.push(`${file}:${i + 1}: ${m[0]}`);
			}
		});
	}
	return out;
}

describe('links to the viewed lists keep the view', () => {
	it('every one goes through withView or is exempt with a reason', () => {
		expect(unguarded()).toEqual([]);
	});

	it('finds the shapes it guards (the guard itself works)', () => {
		const shapes = [
			"href={resolve('/[dance]/(moves)/figures', { dance })}",
			'action="/{dance}/songs?/addUrl"',
			'action={`/${dance.slug}/figures?/create`}'
		];
		for (const s of shapes) expect([...s.matchAll(LIST)].length, s).toBe(1);
		expect([..."href={resolve('/[dance]/(moves)/figures/[id]', x)}".matchAll(LIST)]).toEqual([]);
	});
});
