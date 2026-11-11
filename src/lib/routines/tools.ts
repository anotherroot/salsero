/**
 * The open slot's toolbar (spec 2026-11-11, routine lift, T3): which cells it
 * has. PURE and client-safe. The length only where the routine sets it, the
 * end only where there is one to choose (spec 2026-11-11, slot end), + an
 * alternative only where one fits; an embedded routine's slot holds none.
 */
export type OpenTool = 'length' | 'end' | 'alternative' | 'before' | 'after';

export function openTools(row: {
	isRoutine: boolean;
	length: unknown | null;
	canAddAlternative: boolean;
	end?: { state: string } | null;
}): OpenTool[] {
	const out: OpenTool[] = [];
	if (!row.isRoutine && row.length !== null) out.push('length');
	if (!row.isRoutine && (row.end?.state === 'chosen' || row.end?.state === 'open')) {
		out.push('end');
	}
	if (!row.isRoutine && row.canAddAlternative) out.push('alternative');
	out.push('before', 'after');
	return out;
}
