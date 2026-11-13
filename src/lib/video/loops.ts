/**
 * A figure's loop for the pickers (spec 2026-11-12-picker-preview): its file
 * names come from the section itself, so a page or a phone builds the URL from
 * synced columns alone. PURE and client-safe.
 */
import { t } from '$lib/i18n/catalog';
import type { FigureLook, Picture } from '$lib/types';

export { loopName, parseLoopName, type LoopSpan } from './loop-names';
import { loopName, type LoopSpan } from './loop-names';

/** A section's picture: its clip and its still, or null without a section. */
export const pictureOf = (spot: LoopSpan | null): Picture =>
	spot ? { clip: `/loops/${loopName(spot)}`, still: `/loops/${loopName(spot, true)}` } : null;

/** A figure row's second line: "Abierta (una mano) → Cerrada · 8 counts", either part alone, or "". */
export const lookLine = (look: FigureLook): string =>
	[look.hands, look.length === null ? '' : t().nouns.counts(look.length)]
		.filter((p) => p !== '')
		.join(' · ');
