// The word catalogs: English is the source, Slovenian is typed against it.
// Client-safe. Read through `t()` at call time, never into a top-level constant.
import { locale } from './current';
import { en } from './en';
import type { Locale } from './locale';
import { sl } from './sl';

export type Catalog = typeof en;

const CATALOGS: Record<Locale, Catalog> = { en, sl };

export function catalogOf(l: Locale): Catalog {
	return CATALOGS[l];
}

/** The current language's catalog. */
export function t(): Catalog {
	return catalogOf(locale());
}
