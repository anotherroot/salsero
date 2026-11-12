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

/** The "suggested" tag over a face a hearing round's score suggests (phase 2): the face's colour, solid. */
export const SUGGEST_TAG: Record<Feel, string> = {
	hard: 'bg-danger text-on-danger',
	getting: 'bg-warn text-on-accent',
	gotit: 'bg-done text-on-done',
	easy: 'bg-easy text-on-accent'
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

/** A hearing round's score against the one before, as a chip beside it (+14 / −6). */
export const GAIN_CHIP: Record<'up' | 'down', string> = {
	up: 'ml-1.5 inline-block rounded-full bg-done-soft px-2 align-[3px] font-sans text-[13px] font-bold text-done',
	down: 'ml-1.5 inline-block rounded-full bg-danger-soft px-2 align-[3px] font-sans text-[13px] font-bold text-danger'
};
