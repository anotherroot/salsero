// English plurals: one form or the other. Used only inside `en/*` (a Slovenian
// count goes through `slCount`, `../plural.ts`). `$lib/format` re-exports it for
// the English still inline in areas not translated yet.

/** "1 slot", "4 slots". */
export function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}
