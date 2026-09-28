import type { DanceSlug } from '$lib/dances/dances';
import type { PracticePayload } from '$lib/types';

/** The popup's content. Client-side only — see `practice-content.ts` for why it is not in Today's load. */
export async function fetchPractice(dance: DanceSlug, id: number): Promise<PracticePayload> {
	const res = await fetch(`/${dance}/exercises/${id}/practice`);
	if (!res.ok) throw new Error(String(res.status));
	return (await res.json()) as PracticePayload;
}
