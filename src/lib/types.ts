/** Row shapes that cross from server to page. Client-safe: no server imports. */
import type { Partner, PracticeMode, SongStatus, Source, Style, TempoFactor } from './labels';

/** An exercise as the Today page needs it. Satisfies `PlanExercise`. */
export interface ExerciseItem {
	id: number;
	name: string;
	source: Source;
	figureId: number | null;
	partner: Partner | null;
	practiceMode: PracticeMode;
	songId: number | null;
	countBpm: number | null;
	everyDays: number;
	active: boolean;
	archived: boolean;
	notes: string | null;
	createdAt: number;
}

export interface DaySet {
	id: number;
	exerciseId: number;
	exerciseName: string;
	doneAt: number;
	durationS: number | null;
	reps: number | null;
	rating: number | null;
	note: string | null;
}

export interface SongItem {
	id: number;
	title: string;
	artist: string | null;
	style: Style;
	sourceUrl: string | null;
	status: SongStatus;
	error: string | null;
	durationS: number | null;
	bpm: number | null;
	tempoFactor: TempoFactor;
	createdAt: number;
}

/** A figure the player may call, as the setup screen lists it. */
export interface CallableFigure {
	id: number;
	name: string;
	/** What the voice should say — `callText` if set, else `name`. */
	say: string;
	partner: Partner;
	style: Style;
}
