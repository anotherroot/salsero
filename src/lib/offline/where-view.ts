/** The words a video's line says about where it is (offline phase 4c, look 1B). */
import { t } from '$lib/i18n/catalog';
import type { Place } from './where';

export type PlaceTone = 'ink' | 'muted' | 'done' | 'warn' | 'danger';

export function placeWord(p: Place | null): { text: string; tone: PlaceTone } | null {
	if (!p) return null;
	const w = t().video.place;
	switch (p.state) {
		case 'server':
			return null;
		case 'only':
			return p.iphone ? { text: w.onlyIphone, tone: 'warn' } : { text: w.onlyHere, tone: 'ink' };
		case 'uploading':
			return { text: w.uploading(p.pct), tone: 'muted' };
		case 'both':
			return { text: w.both, tone: 'done' };
		case 'elsewhere':
			return { text: w.on(p.label), tone: 'ink' };
		case 'missing':
			return { text: p.gallery ? w.missingGallery : w.missingHere, tone: 'danger' };
	}
}

/** What Upload sends: the app a smaller copy (compressed there), a browser the original. */
export function uploadNote(app: boolean): string {
	const w = t().video.place;
	return app ? w.sheetNote : w.sheetNoteOriginal;
}
