// A word table kept as a constant but read at call time. Client-safe.
import { catalogOf, t, type Catalog } from './catalog';

/**
 * An object with the keys of `pick(English)`, each a getter into the current
 * catalog: `HANDS_LABEL.two` is looked up when it is read, so a table imported
 * once still speaks the reader's language.
 */
export function lazyWords<T extends object>(pick: (c: Catalog) => T): T {
	const out = {} as T;
	for (const key of Object.keys(pick(catalogOf('en')))) {
		Object.defineProperty(out, key, {
			enumerable: true,
			get: () => pick(t())[key as keyof T]
		});
	}
	return out;
}
