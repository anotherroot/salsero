/**
 * The shared picker's view rules: what a row ends in, the sentences around the
 * list, which body shows and how tall the sheet is. PURE and client-safe.
 */
import { t } from '$lib/i18n/catalog';
import type { PickGroup, PickLine, PickRow } from '$lib/picker/model';
import { SECTION_LABEL, swap } from '$lib/components/ui/styles';

export type PickKind = 'link' | 'field' | 'act';
export type Trail = 'add' | 'pending' | 'linked' | 'chosen' | 'none';

/** What a row ends in: a link picker's +, a field picker's tick, nothing for an act picker. */
export function rowTrail(
	kind: PickKind,
	row: PickRow,
	chosen: string | ReadonlySet<string> | null,
	pending: ReadonlySet<string>
): Trail {
	if (kind === 'link') {
		if (row.linked) return 'linked';
		return pending.has(row.key) ? 'pending' : 'add';
	}
	if (kind === 'field') {
		// A many-value field passes a Set: every member is ticked.
		const on =
			chosen === null
				? false
				: typeof chosen === 'string'
					? row.key === chosen
					: chosen.has(row.key);
		return on ? 'chosen' : 'none';
	}
	return 'none';
}

/** The create row's lead-in; `typed` is already trimmed. */
export function createLead(typed: string): string {
	return typed ? t().picker.createLead(typed) : t().picker.createLeadBare;
}

/** Done's words: a link picker counts what + linked; a field picker, what it holds. */
export function doneLabel(n: number, kind: 'link' | 'field' = 'link'): string {
	return kind === 'field' ? t().picker.doneField(n) : t().picker.doneLinked(n);
}

export function emptyText(typed: string, nothingLeft: string): string {
	return typed ? t().picker.noMatch(typed) : nothingLeft;
}

export type PickerBody = 'loading' | 'failed' | 'list' | 'empty';

export function pickerBody(s: { loading: boolean; failed: boolean; lines: number }): PickerBody {
	if (s.loading) return 'loading';
	if (s.failed) return 'failed';
	return s.lines > 0 ? 'list' : 'empty';
}

/** Tall while loading or when it opens on rows; judged on the unfiltered groups so typing never resizes it. */
export function pickerTall(s: { loading: boolean; failed: boolean; groups: PickGroup[] }): boolean {
	if (s.loading) return true;
	if (s.failed) return false;
	return s.groups.some((g) => g.entries.length > 0);
}

export interface LineGroup {
	title: string;
	lines: { line: Exclude<PickLine, { kind: 'group' }>; last: boolean }[];
}

/** Splits `shown()`'s flat lines at each group line; the final line of each group draws no hairline. */
export function lineGroups(lines: PickLine[]): LineGroup[] {
	const out: LineGroup[] = [];
	for (const line of lines) {
		if (line.kind === 'group') out.push({ title: line.title, lines: [] });
		else out[out.length - 1]?.lines.push({ line, last: false });
	}
	for (const g of out) if (g.lines.length) g.lines[g.lines.length - 1].last = true;
	return out;
}

/**
 * A refused or failed link's reason, for the picker's "That could not be
 * linked." banner: the server's message when it gave one, else the row it was
 * for, else a plain sentence.
 */
export function linkRefusal(message: unknown, sent: { label: string } | null): string {
	if (typeof message === 'string' && message) return message;
	return sent ? t().picker.notLinked(sent.label) : t().picker.tryAgain;
}

/**
 * A link refused because its target was archived since the picker opened
 * ("Archived by Ana"): Pick another clears it; Restore, for those who may,
 * brings the target back and makes the link.
 */
export interface ArchivedChoice {
	restoring: boolean;
	onrestore?: () => void;
	onpickanother: () => void;
}

/** A picker group's title: muted, or the warn colour for a group you only read. */
export const groupTitle = (tone?: 'warn'): string =>
	tone === 'warn' ? swap(SECTION_LABEL, 'text-muted', 'text-warn') : SECTION_LABEL;
