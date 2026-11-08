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

/** A grid cell as a screen reader hears it: "1:19, beat 1 of Montuno, your 1". */
export function beatLabel(
	at: number,
	count: number | null,
	section: string | null,
	anchor: boolean
): string {
	const w = t().songs.page.grid;
	const base =
		count === null && section !== null
			? w.off(clock(at), section)
			: w.beat(clock(at), count ?? 0, section);
	return anchor ? `${base}, ${w.yours}` : base;
}

/** How many beats the count moved at a tapped beat that was counted `oldCount`: 0–4. */
export function tapShift(oldCount: number): number {
	const d = (((oldCount - 1) % 8) + 8) % 8;
	return Math.min(d, 8 - d);
}

/** "1 set at 1:19. The count from here moved 2 beats." */
export function tapToast(at: number, shift: number): string {
	return t().songs.page.tap.toast(clock(at), shift);
}

/** "2:21 · beat 3 of Mambo": the beat menu's heading. */
export function menuHeading(at: number, count: number | null, section: string | null): string {
	const w = t().songs.page.menu;
	if (count === null && section !== null) return `${clock(at)} · ${section}`;
	return `${clock(at)} · ${w.beat(count ?? 0, section)}`;
}

/** A suggestion's card. */
export function suggestionLine(at: number, shift: number): string {
	return t().songs.page.suggest.line(clock(at), Math.abs(shift), shift > 0);
}
