/**
 * Link from other places, the picker's side: the places the server found
 * (`/api/elsewhere`) as picker groups — "Yours", a group by name, a group you
 * only read in the warn colour with a lock — a figure under its move, every
 * other kind a plain row. A row's key says what it is (`elsewhere:<kind>:<id>`),
 * so the page knows a tap here asks for a copy, not a link.
 *
 * PURE and client-safe.
 */
import { t } from '$lib/i18n/catalog';
import type { ElsewhereKind, ElsewherePlace, ElsewhereRow } from '$lib/types';
import type { PickEntry, PickGroup, PickHeading, PickRow } from './model';

const KINDS: readonly ElsewhereKind[] = ['figure', 'routine', 'drill', 'position'];

const keyOf = (r: ElsewhereRow) => `elsewhere:${r.kind}:${r.id}`;

function pickRow(r: ElsewhereRow): PickRow {
	const w = t().picker.elsewhere;
	const meta =
		r.sameName !== null
			? w.hasOwn
			: r.alsoIn.length > 0
				? w.alsoIn(r.alsoIn.join(', '))
				: undefined;
	return {
		key: keyOf(r),
		value: r.id,
		label: r.label,
		...(r.short !== null ? { short: r.short } : {}),
		...(meta ? { meta } : {}),
		...(r.sameName !== null ? { warn: true } : {})
	};
}

/** The places' rows as picker groups, in the server's order. */
export function elsewhereGroups(places: ElsewherePlace[]): PickGroup[] {
	const w = t().picker.elsewhere;
	return places.map((p) => {
		const entries: PickEntry[] = [];
		const moves = new Map<string, PickHeading>();
		for (const r of p.rows) {
			if (r.heading === null) {
				entries.push(pickRow(r));
				continue;
			}
			let h = moves.get(r.heading);
			if (!h) {
				h = { heading: r.heading, rows: [], collapse: true };
				moves.set(r.heading, h);
				entries.push(h);
			}
			h.rows.push(pickRow(r));
		}
		if (p.place.kind === 'mine') return { title: w.yours, icon: 'solo', entries };
		if (p.readOnly) return { title: w.readOnly(p.place.name), icon: 'lock', tone: 'warn', entries };
		return { title: p.place.name, icon: 'group', entries };
	});
}

/** A picker row's key as the kind and id it stands for, or null for a row of the place itself. */
export function elsewhereRow(key: string): { kind: ElsewhereKind; id: number } | null {
	const m = /^elsewhere:([a-z]+):(\d+)$/.exec(key);
	if (!m || !KINDS.includes(m[1] as ElsewhereKind)) return null;
	return { kind: m[1] as ElsewhereKind, id: Number(m[2]) };
}

/** The server's row a picker row stands for. */
export function elsewhereOf(places: ElsewherePlace[], key: string): ElsewhereRow | null {
	for (const p of places) for (const r of p.rows) if (keyOf(r) === key) return r;
	return null;
}

/** The name of the place a row was found in: "Yours" or the group's. */
export function elsewherePlaceOf(places: ElsewherePlace[], key: string): string | null {
	for (const p of places)
		if (p.rows.some((r) => keyOf(r) === key))
			return p.place.kind === 'mine' ? t().picker.elsewhere.yours : p.place.name;
	return null;
}

/** While other places show, the group's own rows sit under its name ("Intenziuci · Drills" when it has several lists). */
export function hereGroups(groups: PickGroup[], here: string): PickGroup[] {
	return groups.map((g) => ({
		...g,
		title: groups.length === 1 ? here : `${here} · ${g.title}`
	}));
}
