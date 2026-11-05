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
	/**
	 * A list's path → the filter its list column keeps while an item is open
	 * beside it (desktop, "The list's search and chips survive opening an
	 * item"). Opaque to the trail: each list writes and reads its own. Absent
	 * until a list keeps one.
	 */
	filters?: Record<PageKey, string>;
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

const ROOTS = new Set(['', 'figures', 'routines', 'positions', 'lessons', 'groups', 'songs']);

/** The main lists: /<d>, /<d>/figures, /<d>/routines, /<d>/positions, /<d>/lessons, /<d>/songs. */
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

/** Whether `start`'s back chain (itself included) reaches `key`. */
function chainReaches(t: Trail, start: PageKey | null, key: PageKey): boolean {
	let cur = start;
	for (let i = 0; i < CHAIN_LIMIT && cur !== null; i++) {
		if (cur === key) return true;
		cur = t.pages[cur]?.opener ?? null;
	}
	return false;
}

/**
 * The opener `to` takes over from the page it stands in for (a variation
 * step, an archived variation's sibling): `carried`, unless its chain reaches
 * `to`, which would make a loop; then `to` keeps its own.
 */
function carriedOpener(t: Trail, to: PageKey, carried: PageKey | null): PageKey | null {
	const existing = t.pages[to]?.opener ?? null;
	if (carried === null || chainReaches(t, carried, to)) return existing;
	return carried;
}

/**
 * The history slots after an arrival at `index`: `href` in it, or the slot
 * taken out (null: a page a back must not step into: outside a dance, an
 * error). A push drops every slot above it: they are gone from history.
 */
export function slotted(
	entries: Record<number, string>,
	index: number,
	href: string | null,
	kind: Arrival['kind']
): Record<number, string> {
	const out: Record<number, string> = {};
	for (const [k, v] of Object.entries(entries)) {
		const i = Number(k);
		if (i === index || (kind === 'push' && i > index)) continue;
		out[i] = v;
	}
	if (href !== null) out[index] = href;
	return out;
}

/** An arrival that is no place in the trail (outside a dance, an error page): only its slot goes. */
export function vacate(t: Trail, index: number, kind: Arrival['kind']): Trail {
	return { ...t, entries: slotted(t.entries, index, null, kind) };
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
				: carriedOpener(t, a.to, t.pages[a.from]?.opener ?? null);
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
	const entries = slotted(t.entries, a.index, a.to + a.search, a.kind);

	let last = t.last;
	let lastRoot = t.lastRoot;
	const dance = danceInPath(a.to)!;
	const tab = tabFor(a.to, dance);
	if (tab) {
		const key = `${dance}:${tab}`;
		if (remembered(a.to)) last = { ...last, [key]: a.to };
		if (isRoot(a.to)) lastRoot = { ...lastRoot, [key]: a.to };
	}
	return { ...t, pages, last, lastRoot, entries };
}

/** Store where the page was scrolled to as it is left. Creates no record. */
export function leave(t: Trail, key: PageKey, scrollY: number): Trail {
	const v = t.pages[key];
	if (!v) return t;
	return { ...t, pages: { ...t.pages, [key]: { ...v, scrollY } } };
}

/**
 * A page's search changed without a navigation (Music's search, written into
 * the URL with a shallow replace): keep the new one. Creates no record.
 */
export function searched(t: Trail, key: PageKey, search: string): Trail {
	const v = t.pages[key];
	if (!v) return t;
	return { ...t, pages: { ...t.pages, [key]: { ...v, search: keptSearch(search) } } };
}

/** The filter the list at `listPath` keeps beside an open item; '' for none. */
export function keptFilter(t: Trail, listPath: PageKey): string {
	return t.filters?.[listPath] ?? '';
}

/** Keep `value` as the list's filter ('' drops it). Creates no page record. */
export function keepFilter(t: Trail, listPath: PageKey, value: string): Trail {
	const filters = { ...t.filters };
	if (value) filters[listPath] = value;
	else delete filters[listPath];
	return { ...t, filters };
}

/**
 * The pages entered "fresh" this page-load: the one the app was (re)loaded on,
 * and the pages replaced into it from it (the figure steps). Their opener is
 * not where the user came from, so a list beside them is the route's own.
 */
export function enteredAfter(
	entered: readonly PageKey[],
	a: Pick<Arrival, 'kind' | 'from' | 'to'>
): PageKey[] {
	if (a.kind === 'enter') return [a.to];
	if (a.kind === 'push') return [];
	if (a.kind === 'replace' && a.from !== null && entered.includes(a.from))
		return entered.includes(a.to) ? [...entered] : [...entered, a.to];
	return [...entered];
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
		...t,
		pages,
		last: without(t.last),
		lastRoot: without(t.lastRoot),
		entries: Object.fromEntries(
			Object.entries(t.entries).filter(([, v]) => pathOf(v) !== key)
		) as Record<number, string>
	};
}

/**
 * An archived variation whose figure has siblings: `to`, the sibling the
 * figure stays on, stands in for it. `to` takes its opener (unless that would
 * loop) and the pages it opened, and `gone` leaves the trail. Called before
 * the replace that lands on `to`, which then keeps all of this.
 */
export function carryRemoved(t: Trail, gone: PageKey, to: PageKey): Trail {
	const g = t.pages[gone];
	// Children first go to the gone page's opener, as for any removal.
	const f = forget(t, gone);
	if (!g) return f;
	const pages = { ...f.pages };
	const prev = pages[to];
	pages[to] = {
		search: prev?.search ?? '',
		scrollY: prev?.scrollY ?? 0,
		title: prev?.title ?? g.title,
		opener: carriedOpener(f, to, g.opener)
	};
	// Then to the sibling, unless the sibling's own chain runs through them.
	const next = { ...f, pages };
	for (const [k, v] of Object.entries(t.pages)) {
		if (k === to || k === gone || v.opener !== gone) continue;
		if (!chainReaches(next, to, k)) pages[k] = { ...pages[k], opener: to };
	}
	return next;
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
	const filters = strings(v.filters);
	return {
		pages,
		last: strings(v.last),
		lastRoot: strings(v.lastRoot),
		entries: strings(v.entries) as Record<number, string>,
		...(Object.keys(filters).length ? { filters } : {})
	};
}

/**
 * Where a page that was just removed leaves you. The server's `location` for a
 * figure page is a sibling variation: stay on the figure, keeping its opener
 * (`carry`). Otherwise go back to the removed page's opener, as a back; with
 * none recorded, where the server said. Always a replace: the removed page's
 * own history entry must not stay reachable.
 */
export function removalTarget(
	t: Trail,
	gone: PageKey,
	location: string
): { href: string; replace: true; intent: 'back' | null; carry: boolean } {
	const path = location.split(/[?#]/)[0];
	const dance = danceInPath(path);
	const parts = path.split('/');
	if (dance && parts[2] === 'figures' && parts.length === 4)
		return { href: location, replace: true, intent: null, carry: true };
	const opener = t.pages[gone]?.opener ?? null;
	if (opener) return { href: hrefOf(t, opener), replace: true, intent: 'back', carry: false };
	return { href: location, replace: true, intent: null, carry: false };
}
