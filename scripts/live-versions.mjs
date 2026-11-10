#!/usr/bin/env node
/*
 * What is live, for the end of scripts/deploy.sh: the website's version and
 * build time (from /health), and each dance's Android release with the day its
 * APK went up. The same numbers Settings → About shows.
 *
 * stdin: the /health JSON on the first line, then one line per dance:
 *   <dance> TAB <current.json on one line> TAB <the APK's mtime in epoch seconds>
 */
import { readFileSync } from 'node:fs';

const ZONE = 'Europe/Ljubljana';

/** `10 Nov 2026, 19:26`, in Ljubljana (a script: the UI builds its dates by hand). */
function when(ms) {
	const p = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: ZONE,
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(new Date(ms))
			.map((x) => [x.type, x.value])
	);
	return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

const [first = '', ...rest] = readFileSync(0, 'utf8').split('\n');
try {
	const h = JSON.parse(first);
	console.log(`Website: version ${h.version}, built ${when(h.builtAt)}`);
} catch {
	console.log('Website: /health gave no version');
}
for (const line of rest) {
	if (!line.trim()) continue;
	const [dance, json, at] = line.split('\t');
	try {
		const r = JSON.parse(json);
		const date = Number(at) > 0 ? `, published ${when(Number(at) * 1000)}` : '';
		console.log(`Android app (${dance}): ${r.versionName} (${r.versionCode})${date}`);
	} catch {
		console.log(`Android app (${dance}): no readable release`);
	}
}
