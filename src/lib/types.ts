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
	/** The YouTube URL it was saved from; null for an upload. */
	sourceUrl: string | null;
	createdAt: number;
}

/** A link on a lesson, a figure or a drill. See `src/lib/links.ts`. */
export interface LinkRow {
	id: number;
	url: string;
	/** The user's label, or null to show the host. */
	title: string | null;
	createdAt: number;
	/** A YouTube link being saved as a video, if it is. See `src/lib/server/video-downloads.ts`. */
	saving: { status: 'queued' | 'failed'; error: string | null } | null;
}

/** One recording on a figure, as the log popup lists it. */
export interface RecordingRow {
	id: number;
	file: string;
	kind: 'video' | 'audio';
	sizeBytes: number;
	/** The YouTube URL it was saved from; null for an upload. */
	sourceUrl: string | null;
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
			figure: { id: number; name: string; notes: string | null; eights: number };
			links: LinkRow[];
			recordings: RecordingRow[];
			sections: LinkedSection[];
	  }
	| { type: 'drill'; notes: string | null; links: LinkRow[]; sections: LinkedSection[] }
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

/** One variation of a figure, as a picker offers it. */
export interface FigureVersion {
	id: number;
	/** The figure (`figure_groups` row) this is a variation of. */
	groupId: number;
	/** The figure's name — "Enchufla". */
	figure: string;
	/** The variation's own name — "Doble". */
	name: string;
	/** How to show it anywhere else — "Enchufla · Doble". */
	label: string;
}

/** A figure as the library list shows it: one row per figure, not per variation. */
export interface FigureListItem {
	/** The group's id. */
	id: number;
	name: string;
	/** Live variations. */
	variations: number;
	/** Recordings across the live variations. */
	recordings: number;
	/** The lowest-id live variation: where a tap on the row lands. */
	firstVariationId: number;
}

/** A figure a variation can be moved to, with its variations' names. */
export interface MoveTarget {
	id: number;
	name: string;
	variations: string[];
}

/** One live variation of the figure being viewed, as its variations sheet lists it. */
export interface SiblingSummary {
	id: number;
	/** The variation's own name — "Doble". */
	name: string;
	/** "Cross-hand → Open two hands": starts joined with " / ", neutral named. */
	holds: string;
	/** "Starts on 5 · 4 counts". */
	timing: string;
	/** Its recordings, video and audio alike. */
	videos: number;
}

/** A figure a routine can call: how the player shows it, and what the voice says. */
export interface CalledFigure {
	id: number;
	/** The label — "Enchufla · Doble" for a variation. */
	name: string;
	/** The name, or for a variation its figure's name. */
	say: string;
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

/**
 * A saved moment of a video: a point when `endMs` is null, else a section the
 * full-screen player loops. Milliseconds into the file, not instants.
 */
export interface Spot {
	id: number;
	startMs: number;
	endMs: number | null;
	label: string | null;
	/** What this section is linked to, "Enchufla · Doble". Empty for a point. */
	linkedTo: string[];
}

/** The one video a spot belongs to — a figure recording or a lesson video. */
export type SpotOwner = { recordingId: number } | { lessonVideoId: number };

/** What a section can be linked to: a figure version or a drill. */
export type SectionTarget = { figureId: number } | { exerciseId: number };

/** One link of a section, as a chip under it on the lesson page. */
export interface SectionLinkChip {
	id: number;
	label: string;
	archived: boolean;
}

/** A section of one video with its links — the lesson page's list. */
export interface VideoSection {
	id: number;
	startMs: number;
	endMs: number;
	label: string | null;
	links: SectionLinkChip[];
}

/** The video a section lives in: enough to open the player and say where it is from. */
export interface SectionVideo {
	owner: SpotOwner;
	/** `/lesson-videos/<file>` or `/recordings/<file>`. */
	src: string;
	from:
		| { kind: 'lesson'; lessonId: number; title: string; lessonDay: string }
		| { kind: 'recording'; figure: string };
}

/** A section linked to a figure version or a drill — one card. */
export interface LinkedSection {
	linkId: number;
	spot: Spot;
	video: SectionVideo;
}

/** A figure version or drill in the lesson page's Link… picker; `value` is `figure:<id>` or `exercise:<id>`. */
export interface SectionOption {
	value: string;
	label: string;
}

/** The lesson page's Link… picker, in its three groups. */
export interface SectionTargets {
	thisLesson: SectionOption[];
	figures: SectionOption[];
	drills: SectionOption[];
}

/** One video's group in the "+ Link a section" sheet. */
export interface SectionGroup {
	video: SectionVideo;
	/** A lesson the target is taught in. */
	taughtHere: boolean;
	sections: Spot[];
}

/** A paired Android app, as Settings lists it. Never carries the token. */
export interface DeviceRow {
	id: number;
	label: string;
	createdAt: number;
	lastUsedAt: number | null;
}
