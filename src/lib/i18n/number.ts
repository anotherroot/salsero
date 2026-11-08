// A decimal someone typed: "1,5" (Slovenian) or "1.5" (English). PURE, client-safe.

const DECIMAL = /^\d+(?:[.,]\d+)?$/;

/** The number in `raw`: digits, at most one "," or "." between digits, spaces around trimmed. Else null. */
export function readDecimal(raw: string): number | null {
	const s = raw.trim();
	if (!DECIMAL.test(s)) return null;
	return Number(s.replace(',', '.'));
}
