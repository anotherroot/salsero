/** Row shapes that cross from server to page. Client-safe: no server imports. */
import type {
	CountPattern,
	Partner,
	PracticeMode,
	SongStatus,
	Source,
	Style,
	TempoFactor
} from './labels';

/** An exercise as the Today page needs it. Satisfies `PlanExercise`. */
export interface ExerciseItem {
	id: number;
	name: string;
	source: Source;
	figureId: number | null;
	/** Set iff `source === 'lesson'`: which lesson this reviews. */
	lessonId: number | null;
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

/**
 * One recorded half-bar of the count, as the player needs it. Mirrors the
 * `count_takes` row minus what only the server cares about — components never
 * import from `$lib/server`.
 */
export interface CountTakeRow {
	id: number;
	pattern: CountPattern;
	bpm: number;
	phrase: 'a' | 'b';
	file: string;
	preRollS: number;
	lengthS: number;
}

/** A lesson as the library lists it, with what its videos cost on disk. */
export interface LessonItem {
	id: number;
	/** The local day the class happened, `YYYY-MM-DD`. */
	lessonDay: string;
	title: string;
	videos: number;
	videoBytes: number;
	createdAt: number;
}

/** One video from a lesson, as the page plays it. */
export interface LessonVideoRow {
	id: number;
	file: string;
	mime: string;
	sizeBytes: number;
	createdAt: number;
}

/** A figure taught in a lesson, with the exercise that came with it. */
export interface LessonFigureRow {
	id: number;
	name: string;
	partner: Partner;
	style: string | null;
	exerciseId: number | null;
}

/** An exercise attached to a lesson by hand. Never a linked figure's own. */
export interface LessonExerciseRow {
	id: number;
	name: string;
	source: Source;
}

/** A figure the player may call, as the setup screen lists it. */
export interface CallableFigure {
	id: number;
	name: string;
	/** What the voice should say — `callText` if set, else `name`. */
	say: string;
	partner: Partner;
	style: string | null;
}
