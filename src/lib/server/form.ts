/** Small, strict readers for FormData. Each returns `undefined` on bad input so actions can `fail(400)`. */

export function text(form: FormData, key: string, max = 200): string | undefined {
	const v = String(form.get(key) ?? '').trim();
	return v.length > 0 && v.length <= max ? v : undefined;
}

/** Optional free text: empty becomes null, too long is undefined (invalid). */
export function optionalText(form: FormData, key: string, max = 2000): string | null | undefined {
	const v = String(form.get(key) ?? '').trim();
	if (v === '') return null;
	return v.length <= max ? v : undefined;
}

export function int(form: FormData, key: string): number | undefined {
	const v = Number(form.get(key));
	return Number.isInteger(v) ? v : undefined;
}

/** Optional non-negative integer in a range: empty becomes null. */
export function optionalInt(
	form: FormData,
	key: string,
	min: number,
	max: number
): number | null | undefined {
	const raw = String(form.get(key) ?? '').trim();
	if (raw === '') return null;
	const v = Number(raw);
	return Number.isInteger(v) && v >= min && v <= max ? v : undefined;
}

export function oneOf<T extends string>(
	form: FormData,
	key: string,
	options: readonly T[]
): T | undefined {
	const v = String(form.get(key) ?? '');
	return (options as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function checkbox(form: FormData, key: string): boolean {
	return form.get(key) === 'on' || form.get(key) === 'true';
}
