/**
 * The open slot's toolbar (spec 2026-11-11, routine lift, T3): which cells it
 * has. PURE and client-safe. The length only where the routine sets it, the
 * end only where there is one to choose (spec 2026-11-11, slot end); an
 * embedded routine's slot holds neither. Alternatives are gone (spec 2026-11-12).
 */
export type OpenTool = 'open' | 'length' | 'end' | 'unpack' | 'before' | 'after';

export function openTools(row: {
	isRoutine: boolean;
	length: unknown | null;
	end?: { state: string } | null;
}): OpenTool[] {
	// Open first, for a figure and a section alike (spec 2026-11-12).
	const out: OpenTool[] = ['open'];
	if (row.isRoutine) out.push('unpack');
	if (!row.isRoutine && row.length !== null) out.push('length');
	if (!row.isRoutine && (row.end?.state === 'chosen' || row.end?.state === 'open')) {
		out.push('end');
	}
	out.push('before', 'after');
	return out;
}
