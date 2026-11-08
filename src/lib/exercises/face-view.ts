/** What the four faces show: a tone per feel and a time per column. PURE, client-safe. */
import { FEELS, feelWord, type Feel } from '$lib/schedule/feel';
import type { FacePreview } from '$lib/schedule/schedule';
import { gapWords } from '$lib/schedule/words';

/** Classes per feel; the colour is the feel's token, never a literal. */
export const FEEL_TONE: Record<Feel, { text: string; bg: string; ring: string }> = {
	hard: { text: 'text-danger', bg: 'bg-danger-soft', ring: 'ring-danger' },
	getting: { text: 'text-warn', bg: 'bg-warn-soft', ring: 'ring-warn' },
	gotit: { text: 'text-done', bg: 'bg-done-soft', ring: 'ring-done' },
	easy: { text: 'text-easy', bg: 'bg-easy-soft', ring: 'ring-easy' }
};

export interface FaceColumn {
	feel: Feel;
	word: string;
	/** "Tomorrow", "3 weeks"; null when there is nothing to preview. */
	time: string | null;
	/** Saving this face finishes a learning drill's learning. */
	learnt: boolean;
}

/** The four columns in order, with the time each would set. */
export function faceColumns(preview: (FacePreview & { learnt?: boolean })[] | null): FaceColumn[] {
	return FEELS.map((feel) => {
		const p = preview?.find((x) => x.feel === feel);
		return {
			feel,
			word: feelWord(feel),
			time: p ? gapWords(p.gap) : null,
			learnt: p?.learnt ?? false
		};
	});
}
