/** Lowercase, accents stripped: "Dile Qué Nó" and "dile que no" are one search. */
export function fold(s: string): string {
	return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
