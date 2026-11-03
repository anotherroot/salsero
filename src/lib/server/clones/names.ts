/**
 * Names a copy takes where its own is taken. Shared by the clone engine and
 * Make my own copy (`copy-lesson.ts`), which must not import each other's
 * helpers: copy-lesson becomes a wrapper around `clone.ts`.
 */
import { NAME_MAX } from '../form';

/** A name as the uniqueness rules compare it: trimmed, any case. */
export const norm = (name: string) => name.trim().toLowerCase();

/**
 * "Doble (Salsa nadaljevalna)", cut so it still fits a variation name's form
 * field: the base is shortened, the suffix kept whole.
 */
export function suffixed(base: string, suffix: string): string {
	return `${base.slice(0, Math.max(0, NAME_MAX - suffix.length)).trimEnd()}${suffix}`;
}
