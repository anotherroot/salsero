// The rig's word map: every English string of the catalogs that Slovenian says
// otherwise, as JSON `{ "<en>": "<sl>" }`. `shots.sh --locale sl --scenes` writes it,
// and `shots.py scene --words` turns a scene's English locator names into the
// Slovenian ones, so a scene written against English buttons runs in Slovenian too.
// `npx tsx scripts/shots/words.ts <out.json>`: a file, as the dev shell's banner is on
// stdout. The catalogs import nothing but each other.
import { writeFileSync } from 'node:fs';
import { en } from '../../src/lib/i18n/en/index';
import { sl } from '../../src/lib/i18n/sl/index';

const map: Record<string, string> = {};

function walk(a: unknown, b: unknown): void {
	if (typeof a === 'function' && typeof b === 'function' && a.length === 0) {
		walk(a(), b());
		return;
	}
	if (typeof a === 'string' && typeof b === 'string') {
		if (a !== b && !(a in map)) map[a] = b;
		return;
	}
	if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
		for (const key of Object.keys(a)) {
			walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
		}
	}
}

walk(en, sl);
writeFileSync(process.argv[2], JSON.stringify(map));
