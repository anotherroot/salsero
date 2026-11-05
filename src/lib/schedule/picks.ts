/** The person's choices for one day on Today (`today_picks`). Client-safe. */
export type PickKind = 'next' | 'add' | 'skip';

export interface DayPick {
	id: number;
	exerciseId: number;
	kind: PickKind;
	createdAt: number;
}
