/**
 * PURE, client-safe: the song page's Edit words (spec 2026-11-08, "Edit").
 * Read at call time, so each draws in the reader's language.
 */
import { clock } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { TEMPO_LABEL, type TempoFactor } from '$lib/labels';

/** The Music starts group's first row: where, and whose. */
export function startRow(start: { at: number; source: 'yours' | 'found' | 'unmeasured' }): {
	title: string;
	meta: string;
} {
	const w = t().songs.page.edit.start;
	if (start.source === 'unmeasured') return { title: w.unmeasured, meta: w.fromZero };
	return { title: w.at(clock(start.at)), meta: start.source === 'yours' ? w.yours : w.found };
}

/** Clear all 1s and Clear all sections: their lines, or null when there is nothing to clear. */
export function clearLines(
	anchors: number,
	sections: number
): { ones: string | null; sections: string | null } {
	const w = t().songs.page.edit.clear;
	return {
		ones: anchors > 0 ? w.onesMeta(anchors) : null,
		sections: sections > 0 ? w.sectionsMeta(sections) : null
	};
}

/** The count speed dialog's question. */
export function tempoAskBody(anchors: number, factor: TempoFactor): string {
	return t().songs.page.edit.speed.ask(anchors, TEMPO_LABEL[factor]);
}
