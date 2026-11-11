/**
 * The open slot's toolbar (spec 2026-11-11, routine lift, T3): which cells it
 * has. PURE and client-safe. The length only where the routine sets it, + an
 * alternative only where one fits; an embedded routine's slot holds neither.
 */
export type OpenTool = 'length' | 'alternative' | 'before' | 'after';

export function openTools(row: {
	isRoutine: boolean;
	length: unknown | null;
	canAddAlternative: boolean;
}): OpenTool[] {
	const out: OpenTool[] = [];
	if (!row.isRoutine && row.length !== null) out.push('length');
	if (!row.isRoutine && row.canAddAlternative) out.push('alternative');
	out.push('before', 'after');
	return out;
}
