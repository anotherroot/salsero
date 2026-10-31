/**
 * The shared picker's view rules: what a row ends in, the sentences around the
 * list, which body shows and how tall the sheet is. PURE and client-safe.
 */
import type { PickGroup, PickLine, PickRow } from '$lib/picker/model';

export type PickKind = 'link' | 'field' | 'act';
export type Trail = 'add' | 'pending' | 'linked' | 'chosen' | 'none';

/** What a row ends in: a link picker's +, a field picker's tick, nothing for an act picker. */
export function rowTrail(
	kind: PickKind,
	row: PickRow,
	chosen: string | null,
	pending: ReadonlySet<string>
): Trail {
	if (kind === 'link') {
		if (row.linked) return 'linked';
		return pending.has(row.key) ? 'pending' : 'add';
	}
	if (kind === 'field') return row.key === chosen ? 'chosen' : 'none';
	return 'none';
}

/** The create row's lead-in; `typed` is already trimmed. */
export function createLead(typed: string): string {
	return typed ? `Not in the list? Create “${typed}” as` : 'Not in the list?';
}

export function doneLabel(n: number): string {
	return `Done · ${n} linked`;
}

export function emptyText(typed: string, nothingLeft: string): string {
	return typed ? `Nothing matches “${typed}”.` : nothingLeft;
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
