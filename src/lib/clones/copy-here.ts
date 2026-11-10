/**
 * Link from other places, the Copy and link card's words: what is asked,
 * what comes along (Copy to…'s plan), what stays behind (links from lesson
 * videos, never copied; none for a routine), a storage refusal when the copy
 * would not fit the group's space, and the warning when the group already
 * has its own of that name. PURE and client-safe.
 */
import { t } from '$lib/i18n/catalog';
import { byteSize } from '$lib/format';
import type { CopyHereView, ElsewhereKind } from '$lib/types';

export type CopyHereLines = {
	title: string;
	lead: string;
	goes: string;
	already: string[];
	behind: string | null;
	room: string | null;
	sameName: string | null;
};

export function copyHereLines(
	view: CopyHereView,
	o: {
		kind: ElsewhereKind;
		label: string;
		/** The place it is copied from; null for the person's own app. */
		from: string | null;
		/** The group's name. */
		into: string;
		sameName?: boolean;
	}
): CopyHereLines {
	const w = t().clones.copyHere;
	const n = view.staysBehind;
	const behind =
		o.kind === 'routine' || n === 0
			? null
			: o.kind === 'position'
				? w.sectionsOrPoints(n)
				: w.sections(n);
	const full = view.limitBytes > 0 && view.usedBytes + view.bytes > view.limitBytes;
	return {
		title: w.title(o.label, o.into),
		lead: w.lead(o.from),
		goes: view.goes,
		already: view.already,
		behind,
		room: full
			? t().settings.storage.noRoomGroup(byteSize(view.usedBytes), byteSize(view.limitBytes))
			: null,
		sameName: o.sameName ? w.sameName(o.into, o.label, o.from) : null
	};
}
