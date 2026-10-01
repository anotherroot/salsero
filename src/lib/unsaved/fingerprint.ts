/**
 * A form's contents as one comparable string. PURE.
 *
 * Read from `FormData` rather than from input events, so a value set by code
 * — a start-position chip rewriting hidden inputs, a timing shortcut, a
 * rating button — counts exactly like a typed one. A file is its name and
 * size: reading its bytes to compare would be absurd, and no form here keeps
 * one after picking.
 */
export function fingerprint(data: FormData): string {
	const parts: [string, string][] = [];
	for (const [key, value] of data) {
		parts.push([key, typeof value === 'string' ? value : `file:${value.name}:${value.size}`]);
	}
	return JSON.stringify(parts);
}
