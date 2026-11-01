import { DANCES, danceInPath, type DanceSlug } from '$lib/dances/dances';
import { rootsOf, tabFor, type TabId } from './tabs';

/**
 * The trail: which pages you have seen this session, where each was opened
 * from (its opener), the search and scroll each keeps, and the last page of
 * each tab. PURE — the layout feeds it arrivals and reads targets back.
 */

export type PageKey = string; // a pathname, e.g. '/salsa/figures/12'

export interface Visit {
	search: string;
	scrollY: number;
	opener: PageKey | null;
	title: string;
}

export interface Trail {
	pages: Record<PageKey, Visit>;
	/** `${dance}:${tab}` → the last page seen in that tab (never Practice or share). */
	last: Record<string, PageKey>;
	/** `${dance}:${tab}` → the last main list seen in that tab (Moves: figures or routines). */
	lastRoot: Record<string, PageKey>;
	/**
	 * History slot index → the href in it: the page and its search as the slot
	 * holds it, popup flags and all, since that is what a history step restores.
	 */
	entries: Record<number, string>;
}

/** An entry's page: its href without the search. */
const pathOf = (href: string): PageKey => href.split('?')[0];

export const EMPTY_TRAIL: Trail = { pages: {}, last: {}, lastRoot: {}, entries: {} };

export type Intent = 'tab' | 'back' | null;

export interface Arrival {
	to: PageKey;
	search: string;
	title: string;
	/** null: came from outside the app, or from a page outside a dance. */
	from: PageKey | null;
	index: number;
	prevIndex: number | null;
	kind: 'enter' | 'pop' | 'push' | 'replace';
	intent: Intent;
}

/** Popup flags and the Today session are not a place to come back to. */
const DROPPED = new Set(['log', 'new', 'add', 'session', 'v']);

/** The query worth keeping: day, q and chips stay; popup flags go. */
export function keptSearch(search: string): string {
	const kept = search
		.replace(/^\?/, '')
		.split('&')
		.filter((p) => p !== '' && !DROPPED.has(p.split('=')[0]));
	return kept.length ? `?${kept.join('&')}` : '';
}

/** Under a dance: /salsa/..., /bachata/... */
export function isTrailPage(path: string): boolean {
	return danceInPath(path) !== null;
}

function firstSegment(path: string): string {
	const dance = danceInPath(path);
	if (!dance) return '';
	return path.slice(dance.length + 1).split('/')[1] ?? '';
}

/** A trail page that is not Practice or share: those are never a tab's last page. */
export function remembered(path: string): boolean {
	if (!isTrailPage(path)) return false;
	const first = firstSegment(path);
	return first !== 'player' && first !== 'share';
}

const ROOTS = new Set(['', 'figures', 'routines', 'lessons', 'songs']);

/** The main lists: /<d>, /<d>/figures, /<d>/routines, /<d>/lessons, /<d>/songs. */
export function isRoot(path: string): boolean {
	const dance = danceInPath(path);
	if (!dance) return false;
	const rest = path.slice(dance.length + 1);
	if (rest === '') return true;
	const parts = rest.split('/');
	return parts.length === 2 && ROOTS.has(parts[1]);
}

const CHAIN_LIMIT = 50;

/**
 * Where `to` was opened from. A push from a trail page says `from`, unless
 * `to` is already up `from`'s chain: linking back up must not make a loop.
 */
export function openerFor(t: Trail, to: PageKey, from: PageKey | null): PageKey | null {
	const existing = t.pages[to]?.opener ?? null;
	if (isRoot(to)) return null;
	if (from === null || !isTrailPage(from)) return existing;
	let cur: PageKey | null = from;
	for (let i = 0; i < CHAIN_LIMIT && cur !== null; i++) {
		if (cur === to) return existing;
		cur = t.pages[cur]?.opener ?? null;
	}
	return from;
}

export function arrive(t: Trail, a: Arrival): Trail {
	if (!isTrailPage(a.to)) return t;
	const existing = t.pages[a.to];
	let opener: PageKey | null;
	if (isRoot(a.to)) opener = null;
	else if (a.kind === 'enter') opener = existing?.opener ?? null;
	else if (a.kind === 'pop' || a.intent === 'tab' || a.intent === 'back')
		opener = existing?.opener ?? null;
	else if (a.kind === 'replace') {
		// A variation step or a refilter: the page is the same place in the trail.
		opener =
			a.from === null || a.from === a.to
				? (existing?.opener ?? null)
				: (t.pages[a.from]?.opener ?? existing?.opener ?? null);
	} else opener = openerFor(t, a.to, a.from);

	const pages = {
		...t.pages,
		[a.to]: {
			search: keptSearch(a.search),
			scrollY: existing?.scrollY ?? 0,
			opener,
			title: a.title
		}
	};
	const entries: Record<number, string> = { ...t.entries, [a.index]: a.to + a.search };
	if (a.kind === 'push') {
		for (const k of Object.keys(entries)) if (Number(k) > a.index) delete entries[Number(k)];
	}

	let last = t.last;
	let lastRoot = t.lastRoot;
	const dance = danceInPath(a.to)!;
	const tab = tabFor(a.to, dance);
	if (tab) {
		const key = `${dance}:${tab}`;
		if (remembered(a.to)) last = { ...last, [key]: a.to };
		if (isRoot(a.to)) lastRoot = { ...lastRoot, [key]: a.to };
	}
	return { pages, last, lastRoot, entries };
}

/** Store where the page was scrolled to as it is left. Creates no record. */
export function leave(t: Trail, key: PageKey, scrollY: number): Trail {
	const v = t.pages[key];
	if (!v) return t;
	return { ...t, pages: { ...t.pages, [key]: { ...v, scrollY } } };
}

/** A page that no longer exists: out of the trail, its children reattached. */
export function forget(t: Trail, key: PageKey): Trail {
	const gone = t.pages[key];
	const pages: Record<PageKey, Visit> = {};
	for (const [k, v] of Object.entries(t.pages)) {
		if (k === key) continue;
		pages[k] = v.opener === key ? { ...v, opener: gone?.opener ?? null } : v;
	}
	const without = (r: Record<string, PageKey>) =>
		Object.fromEntries(Object.entries(r).filter(([, v]) => v !== key));
	return {
		pages,
		last: without(t.last),
		lastRoot: without(t.lastRoot),
		entries: Object.fromEntries(
			Object.entries(t.entries).filter(([, v]) => pathOf(v) !== key)
		) as Record<number, string>
	};
}

/** The key with its kept search. */
export function hrefOf(t: Trail, key: PageKey): string {
	return key + (t.pages[key]?.search ?? '');
}

export function backTarget(
	t: Trail,
	key: PageKey,
	fallback: { href: string; label: string }
): { href: string; label: string; key: PageKey | null } {
	const opener = t.pages[key]?.opener ?? null;
	if (opener && t.pages[opener]) {
		return { href: hrefOf(t, opener), label: `Back to ${t.pages[opener].title}`, key: opener };
	}
	const path = fallback.href.split(/[?#]/)[0];
	const href = t.pages[path] ? hrefOf(t, path) : fallback.href;
	return { href, label: fallback.label, key: null };
}

/** What a tap on a tab does: scroll its list to the top, or go to a page. */
export function tabTarget(
	t: Trail,
	tab: TabId,
	dance: DanceSlug,
	current: PageKey
): { href: string } | { scrollTop: true } {
	const roots = rootsOf(tab, dance);
	const k = `${dance}:${tab}`;
	if (tab === tabFor(current, dance)) {
		if (roots.includes(current)) return { scrollTop: true };
		return { href: hrefOf(t, t.lastRoot[k] ?? roots[0]) };
	}
	return { href: hrefOf(t, t.last[k] ?? t.lastRoot[k] ?? roots[0]) };
}

/** Where to scroll after an arrival; null leaves it to the browser. */
export function scrollFor(t: Trail, a: Arrival): number | null {
	if (a.kind === 'pop' || a.kind === 'enter') return null;
	if (a.from === a.to) return null;
	return t.pages[a.to]?.scrollY ?? null;
}

/**
 * Whether Back can step the browser's history (the slot before is the target)
 * or has to go to the page. A slot whose search carries a popup flag or a
 * Today session would bring it back, so that one is gone to instead.
 */
export function backMove(
	entries: Record<number, string>,
	index: number,
	target: PageKey | null
): 'history' | 'goto' {
	const below = entries[index - 1];
	if (target === null || below === undefined || pathOf(below) !== target) return 'goto';
	const search = below.slice(target.length);
	return keptSearch(search) === search ? 'history' : 'goto';
}

/** A page that no longer exists: not found or gone, and only while online. */
export function isGone(status: number, online: boolean): boolean {
	return online && (status === 404 || status === 410);
}

/** Where a tab or a back that reached a gone page lands: its tab's last main list. */
export function goneHref(t: Trail, path: PageKey): string {
	const dance = danceInPath(path);
	if (!dance) return '/';
	const tab = tabFor(path, dance) ?? 'today';
	return hrefOf(t, t.lastRoot[`${dance}:${tab}`] ?? rootsOf(tab, dance)[0]);
}

/**
 * What kind of arrival a navigation was. `before` is the history slot the
 * navigation left (read in `beforeNavigate`, so a sheet's shallow entry
 * counts): staying on it is a replace, moving off it a push.
 */
export function arrivalKind(type: string, index: number, before: number | null): Arrival['kind'] {
	if (type === 'enter') return 'enter';
	if (type === 'popstate') return 'pop';
	return before !== null && index === before ? 'replace' : 'push';
}

const SUFFIXES = Object.values(DANCES).map((d) => ` · ${d.label}`);

/** A page's `<title>` without its ` · Salsa` / ` · Bachata`: the name a back label uses. */
export function pageTitle(title: string): string {
	const suffix = SUFFIXES.find((s) => title.endsWith(s));
	return suffix ? title.slice(0, -suffix.length) : title;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function strings(v: unknown): Record<string, string> {
	if (!isObj(v)) return {};
	return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<
		string,
		string
	>;
}

/** Stored text back to a trail; anything bad or missing is an empty trail. */
export function parseTrail(raw: string | null): Trail {
	if (!raw) return EMPTY_TRAIL;
	let v: unknown;
	try {
		v = JSON.parse(raw);
	} catch {
		return EMPTY_TRAIL;
	}
	if (!isObj(v)) return EMPTY_TRAIL;
	const pages: Record<PageKey, Visit> = {};
	if (isObj(v.pages)) {
		for (const [k, p] of Object.entries(v.pages)) {
			if (
				isObj(p) &&
				typeof p.search === 'string' &&
				typeof p.scrollY === 'number' &&
				typeof p.title === 'string' &&
				(p.opener === null || typeof p.opener === 'string')
			)
				pages[k] = { search: p.search, scrollY: p.scrollY, opener: p.opener, title: p.title };
		}
	}
	return {
		pages,
		last: strings(v.last),
		lastRoot: strings(v.lastRoot),
		entries: strings(v.entries) as Record<number, string>
	};
}
