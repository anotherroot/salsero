/** Row shapes that cross from server to page. Client-safe: no server imports. */
import type {
	CountPattern,
	Partner,
	PracticeMode,
	SongStatus,
	Source,
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
	/** Set iff `source === 'routine'`: which routine this practises. */
	routineId: number | null;
	partner: Partner | null;
	practiceMode: PracticeMode;
	songId: number | null;
	countBpm: number | null;
	/** The panel's remembered count/clave/speed/cue. Read with `parsePracticeConfig`. */
	practiceJson: string | null;
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

/** One set as an exercise's own history lists it. */
export interface HistorySet {
	id: number;
	doneAt: number;
	durationS: number | null;
	reps: number | null;
	rating: number | null;
	note: string | null;
}

/** The latest set, with how many calendar days ago it was in the user's zone. */
export interface LastSet extends HistorySet {
	daysAgo: number;
}

/** The line on top of an exercise's history. */
export interface ExerciseSummary {
	sets: number;
	/** Every logged duration, summed. Sets with no duration add nothing. */
	totalS: number;
	/** Mean of the latest five rated sets, to one decimal; null when none is rated. */
	recentRating: number | null;
}

export interface SongItem {
	id: number;
	title: string;
	artist: string | null;
	/** Widened to plain text: validated against `DANCES[dance].styles`, not the vestigial `Style` enum. */
	style: string;
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

/** A link on a lesson, a figure or a drill. See `src/lib/links.ts`. */
export interface LinkRow {
	id: number;
	url: string;
	/** The user's label, or null to show the host. */
	title: string | null;
	createdAt: number;
}

/** One recording on a figure, as the log popup lists it. */
export interface RecordingRow {
	id: number;
	file: string;
	kind: 'video' | 'audio';
	sizeBytes: number;
	createdAt: number;
}

/** A song's beats and its 1–8, for the practice panel. See `src/lib/server/grid.ts`. */
export interface SongGrid {
	audioFile: string;
	beats: number[];
	counts: number[];
}

/**
 * What the log popup shows above its form, branched by the exercise's type.
 * See `src/lib/server/practice-content.ts`, the one place that branches on it.
 */
export type PracticeContent =
	| {
			type: 'lesson';
			lesson: { id: number; title: string; lessonDay: string; notes: string | null };
			links: LinkRow[];
			videos: LessonVideoRow[];
			figures: { id: number; name: string }[];
	  }
	| {
			type: 'figure';
			figure: { id: number; name: string; notes: string | null; say: string; eights: number };
			links: LinkRow[];
			recordings: RecordingRow[];
	  }
	| { type: 'drill'; notes: string | null; links: LinkRow[] }
	| {
			type: 'routine';
			routine: { id: number; name: string; notes: string | null };
			slots: { note: string | null; names: string[] }[];
	  };

/** The popup's whole payload: its content, and the exercise's last set. */
export interface PracticePayload {
	content: PracticeContent;
	last: LastSet | null;
}

/** A figure taught in a lesson, with the exercise that came with it. */
export interface LessonFigureRow {
	id: number;
	name: string;
	partner: Partner;
	style: string | null;
	exerciseId: number | null;
}

/** A routine linked to a lesson, with the exercise that came with it. */
export interface LessonRoutineRow {
	id: number;
	name: string;
	exerciseId: number | null;
}

/** An exercise attached to a lesson by hand. Never a linked figure's or routine's own. */
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

/** A routine as the library list shows it. */
export interface RoutineItem {
	id: number;
	name: string;
	notes: string | null;
	/** Slots, children counted as one. */
	slots: number;
	createdAt: number;
}

/**
 * One slot as the editor renders it: the ids and names the pure `Slot`
 * deliberately does without.
 */
export interface SlotRow {
	id: number;
	position: number;
	note: string | null;
	/** The embedded routine, or null when this slot holds figure options. */
	childId: number | null;
	childName: string | null;
	/** Empty for a child slot. */
	figureIds: number[];
}
