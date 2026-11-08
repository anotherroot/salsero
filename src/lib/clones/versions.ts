import type { FamilyEntry, FamilyView, PlaceRef, Source } from '$lib/types';
import { memberMeta, possessive, selfMeta, statusChip, THIS_ONE, YOURS } from './view';

/**
 * Whose version (spec 2026-11-06, option D): the row at the top of a family
 * page and the Versions list it opens, as words. PURE, client-safe.
 */

/** The tile's icon: your own, a group's, or a twin. */
export type VersionIcon = 'solo' | 'group' | 'link';

export const ROW_WORDS = {
	yours: 'Your version',
	also: 'Also: ',
	twin: 'Marked the same'
} as const;

export type VersionRowView = {
	title: string;
	meta: string;
	count: number;
	icon: VersionIcon;
};

/**
 * The row: null with one version. "Your version" or "<Place>’s version",
 * then who else has it ("Also: …"), whatever the copies' status: where they
 * disagree is the notice's, under the row (`step-view.ts`).
 */
export function versionRow(i: {
	sources: Source[];
	current: number;
	self: PlaceRef;
}): VersionRowView | null {
	if (i.sources.length < 2) return null;
	const others = i.sources.filter((s) => s.id !== i.current).map((s) => s.label);
	return {
		title: i.self.kind === 'mine' ? ROW_WORDS.yours : `${possessive(i.self.name)} version`,
		meta: ROW_WORDS.also + others.join(', '),
		count: i.sources.length,
		icon: i.self.kind === 'mine' ? 'solo' : 'group'
	};
}

export type VersionLine = {
	id: number;
	label: string;
	meta: string;
	chip: { text: string; tone: 'neutral' | 'accent' | 'warn' } | null;
	icon: VersionIcon;
	/** The page's own row: a check, not a link. */
	current: boolean;
	twin: boolean;
};

const placeName = (p: PlaceRef) => (p.kind === 'mine' ? YOURS : p.name);

/** A source's own place, read from its label when the family view does not say ("Yours", "Yours 2"). */
const looksMine = (label: string) => label === YOURS || label.startsWith(`${YOURS} `);

/**
 * The Versions list: one line per source, in order, with what "Copies you
 * can see" said of it (this one, a copy's role and status, a twin), then any
 * copy the family view lists that is not a source.
 */
export function versionList(i: {
	sources: Source[];
	current: number;
	family: FamilyView | null;
	/** Whose the page's row is: a copy is measured against "yours" or "this one". */
	self?: PlaceRef;
}): VersionLine[] {
	const entries = new Map<number, FamilyEntry>(
		(i.family?.entries ?? []).map((e) => [e.member.id, e])
	);
	const self = entries.get(i.current);
	const mine = self ? self.member.place.kind === 'mine' : (i.self?.kind ?? 'mine') === 'mine';
	const page = mine ? 'yours' : 'this one';

	const lines: VersionLine[] = i.sources.map((s) => {
		const e = entries.get(s.id);
		const current = s.id === i.current;
		const twin = s.relation === 'twin';
		const mine = e ? e.member.place.kind === 'mine' : looksMine(s.label);
		const icon: VersionIcon = twin ? 'link' : mine ? 'solo' : 'group';
		if (current)
			return {
				id: s.id,
				label: s.label,
				meta: e ? selfMeta(e.changed) : THIS_ONE,
				chip: null,
				icon,
				current,
				twin
			};
		if (twin)
			return { id: s.id, label: s.label, meta: ROW_WORDS.twin, chip: null, icon, current, twin };
		const status = e ? e.status : s.status;
		return {
			id: s.id,
			label: s.label,
			meta: e
				? memberMeta(e.role, e.status, e.changed, page)
				: memberMeta(null, s.status, s.changed, page),
			chip: statusChip(status),
			icon,
			current,
			twin
		};
	});

	const listed = new Set(i.sources.map((s) => s.id));
	for (const e of i.family?.entries ?? []) {
		if (listed.has(e.member.id)) continue;
		lines.push({
			id: e.member.id,
			label: placeName(e.member.place),
			meta: memberMeta(e.role, e.status, e.changed, page),
			chip: statusChip(e.status),
			icon: e.member.place.kind === 'mine' ? 'solo' : 'group',
			current: false,
			twin: false
		});
	}
	return lines;
}
