// Slovenian plurals: four forms by the last two digits. PURE.
// 1 vaja, 2 vaji, 3–4 vaje, 5+ vaj; 101 like 1, 102 like 2, 111 like 5.

export type SlForm = 'one' | 'two' | 'few' | 'other';

export function slForm(n: number): SlForm {
	const r = Math.abs(n) % 100;
	if (r === 1) return 'one';
	if (r === 2) return 'two';
	if (r === 3 || r === 4) return 'few';
	return 'other';
}

/** `n` and the noun in the form it takes: `slCount(5, ['vaja', 'vaji', 'vaje', 'vaj'])` is "5 vaj". */
export function slCount(
	n: number,
	forms: [one: string, two: string, few: string, other: string]
): string {
	const [one, two, few, other] = forms;
	const word = { one, two, few, other }[slForm(n)];
	return `${n} ${word}`;
}
