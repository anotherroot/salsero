/** Row shapes that cross from server to page. Client-safe: no server imports. */
import type {
	CountPattern,
	Partner,
	PracticeMode,
	SongStatus,
	Source as ExerciseSource,
	TempoFactor
} from './labels';
import type { DanceSlug } from './dances/dances';

/** A group, as a list names it. */
export type TeamRef = { id: number; name: string };

/** An exercise as the Today page needs it. Satisfies `PlanExercise`. */
export interface ExerciseItem {
	id: number;
	name: string;
	source: ExerciseSource;
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
	/**
	 * The group whose lesson, routine, variation or drill this entry practises,
	 * through its target; null for a person's own. Today heads its rows by it.
	 */
	team: TeamRef | null;
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
	/** Null unless the song is ready with an audio file. */
	sample: SampleSong | null;
	/** 0 = practised most recently; null otherwise. Ready songs only. */
	recentRank: number | null;
	/** A group song's Share with the class; null for a draft, and for a person's own song. */
	sharedAt: number | null;
}

/** What a play button needs to play a song's sample. */
export interface SampleSong {
	id: number;
	audioFile: string;
	startS: number;
}

/** A ready song as the song popup lists it. */
export interface PickerSong {
	id: number;
	title: string;
	artist: string | null;
	style: string;
	/** As the Songs list shows it: bpm × tempoFactor, rounded; null when unknown. */
	bpm: number | null;
	durationS: number | null;
	sample: SampleSong;
	/** 0 = the song practised with most recently; null = not among the last five. */
	recentRank: number | null;
	/** The group whose shared song this is, by name; null for the person's own. */
	group: string | null;
	/** That group's id, which tells two groups of one name apart; null for the person's own. */
	groupId: number | null;
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
	/** Sections (spots with an end) on its videos. Points do not count. */
	sections: number;
	/** Live routines linked to it. */
	routines: number;
	/** Figures (not variations) it reaches by hand or through a section, live variations only. */
	figures: number;
	createdAt: number;
	/** The group whose lesson this is; null for a person's own. */
	team: { id: number; name: string } | null;
}

/** A group's lesson as the group page lists it: a draft until an editor publishes it. */
export interface TeamLessonItem extends LessonItem {
	/** Null while it is a draft, which only the group's editors see. */
	publishedAt: number | null;
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
			figure: { id: number; name: string; say: string; notes: string | null; eights: number };
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

/**
 * A variation taught in a lesson, with the exercise that came with it: linked
 * by hand, through sections of the lesson's videos, or both.
 */
export interface LessonFigureRow {
	id: number;
	name: string;
	partner: Partner;
	style: string | null;
	exerciseId: number | null;
	byHand: boolean;
	viaSections: ViaSection[];
}

/** A routine linked to a lesson, with the exercise that came with it. */
export interface LessonRoutineRow {
	id: number;
	name: string;
	exerciseId: number | null;
	/** How often its exercise comes up; null when it has none. */
	everyDays: number | null;
}

/**
 * An exercise on a lesson: attached by hand, or a drill linked through a section
 * of the lesson's videos. Never a linked figure's or routine's own.
 */
export interface LessonExerciseRow {
	id: number;
	name: string;
	source: ExerciseSource;
	byHand: boolean;
	viaSections: ViaSection[];
	everyDays: number;
}

/** An exercise as a picker offers it. */
export interface PickExercise {
	id: number;
	name: string;
	source: ExerciseSource;
	everyDays: number;
	/** A figure exercise's figure and variation names; null otherwise. */
	figure: string | null;
	variation: string | null;
	linked: boolean;
	/** A group's row a person may use (`usableOf`), offered in their own lists: whose it is. */
	team?: TeamRef;
}

/** A routine as a picker offers it. */
export interface PickRoutine {
	id: number;
	name: string;
	/** Slots, children counted as one. */
	slots: number;
	loops: boolean;
	linked: boolean;
	/** A group's row a person may use (`usableOf`), offered in their own lists: whose it is. */
	team?: TeamRef;
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
	/** A group's row a person may use (`usableOf`), offered in their own lists: whose it is. */
	team?: TeamRef;
}

/** A figure (a `figures` row) as the Figures list shows it, under its move. */
export type FigureRow = {
	id: number;
	/** The figure's own name — "Doble". */
	name: string;
	/** "Enchufla · Doble". */
	label: string;
	startCount: number | null;
	lengthCounts: number | null;
	/** Recordings of this figure. */
	recordings: number;
	/** Linked to a section, on a lesson video or a recording. */
	hasSection: boolean;
	/** A live lesson reaches it, by hand or through a section. */
	hasLesson: boolean;
	/** Group mode only: a published lesson reaches it, so members see it. */
	membersSee?: boolean;
};

/** A move (a `figure_groups` row) with the figures the list shows under it. */
export type MoveRow = { id: number; name: string; figures: FigureRow[] };

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
	/** Group mode only: a published lesson reaches it, so members see it. */
	membersSee?: boolean;
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

/** Something a section can be linked to, as the Link popup lists it. */
export interface LinkOption {
	target: SectionTarget;
	/** "Enchufla · Doble", or a drill's name. */
	label: string;
	drill: boolean;
	/** A variation's figure and own name, for headings; null for a drill. */
	figure: string | null;
	name: string;
	/** A drill's; null for a variation. */
	everyDays: number | null;
	/** Already linked to this section. */
	linked: boolean;
	/** A group's row a person may use (`usableOf`), offered in their own lists: whose it is. */
	team?: TeamRef;
}

/** One of a section's links, in the Link popup. */
export interface LinkedTarget extends LinkOption {
	linkId: number;
	archived: boolean;
	/** Also linked to the section's lesson by hand: unlinking asks whether to take that too. */
	alsoByHand: boolean;
}

/** A figure "New variation" can add to, with its variations' names. */
export interface LinkFigureChoice {
	groupId: number;
	name: string;
	variations: string[];
	/** This lesson's, or the recording's own: offered first. */
	near: boolean;
}

export type LinkContext =
	| { kind: 'lesson'; lessonId: number; title: string }
	| { kind: 'recording'; groupId: number; figure: string };

/** Everything the Link popup shows for one section. */
export interface LinkOptions {
	dance: DanceSlug;
	spot: { id: number; startMs: number; endMs: number; label: string | null };
	context: LinkContext;
	linked: LinkedTarget[];
	/** 'In this lesson' or 'This figure'. */
	nearTitle: string;
	/** Variations then drills of this lesson, or the recording's own figure. */
	near: LinkOption[];
	/** Every other live variation. */
	figures: LinkOption[];
	/** Every other live drill. */
	drills: LinkOption[];
	figureChoices: LinkFigureChoice[];
	/** What "New figure" starts on. */
	defaults: { partner: Partner; style: string };
}

/** A create step's field a refusal of `createAndLink` names, so the popup shows it there. */
export type LinkCreateField = 'name' | 'figureName' | 'groupId' | 'style' | 'everyDays';

/** What the Link popup's create steps send. */
export type LinkCreate =
	| { kind: 'variation'; groupId: number; name: string }
	| { kind: 'figure'; figureName: string; name: string; partner: Partner; style: string }
	| { kind: 'drill'; name: string; everyDays: number };

/** A section of a lesson's video through which a variation or drill is on that lesson. */
export interface ViaSection {
	spotId: number;
	startMs: number;
	endMs: number;
	label: string | null;
}

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
	/** Every section of the video; `linked` when it is already linked to the target. */
	sections: (Spot & { linked: boolean })[];
}

/** A paired Android app, as Settings lists it. Never carries the token. */
export interface DeviceRow {
	id: number;
	label: string;
	createdAt: number;
	lastUsedAt: number | null;
}

/** A deleted set, whole, so Undo can put the same values back. */
export interface SetSnapshot {
	exerciseId: number;
	doneAt: number;
	durationS: number | null;
	reps: number | null;
	rating: number | null;
	note: string | null;
	playerJson: string | null;
}

/** One thing a person has on disk, as the "What uses space" page lists it. */
export type StorageItem = {
	/** `trash` is a group's deleted file waiting in Recently deleted (a group's page only). */
	kind: 'lessonVideo' | 'recording' | 'song' | 'voice' | 'trash';
	/** Null for the count voice, which is one row for all its takes. */
	id: number | null;
	title: string;
	context: string;
	sizeBytes: number;
	archived: boolean;
	href: string | null;
};

/** A person's role in a group. */
export type Role = 'owner' | 'editor' | 'member';

/** A person in a group's people list. */
export interface Person {
	id: string;
	name: string;
	role: Role;
}

/** One group in a person's list. `deletedAt` is only ever set for the owner. */
export interface TeamItem {
	id: number;
	name: string;
	dance: DanceSlug;
	role: Role;
	people: number;
	deletedAt: number | null;
}

/** What a person ticks in a group lesson's Add sheet: what goes on their Today. */
export type AddPicks = {
	lesson: boolean;
	routineIds: number[];
	drillIds: number[];
	figureIds: number[];
};

/** One row of the Add sheet, or of "1 new drill · Add". */
export interface AddItem {
	kind: 'lesson' | 'routine' | 'drill' | 'figure';
	id: number;
	name: string;
	ticked: boolean;
}

/** The Add sheet: what the lesson holds, and what can go on Today. */
export interface AddOffer {
	counts: { videos: number; sections: number; figures: number; routines: number; drills: number };
	items: AddItem[];
}

/** Add on a group lesson's row and page. */
export interface AddState {
	/** In the person's own Lessons ("Added ✓"). */
	added: boolean;
	/**
	 * The sheet: everything, before Add; once added, only what came in since
	 * ("1 new drill · Add"), or null when nothing did.
	 */
	offer: AddOffer | null;
}

/** What a group change is filed under: the thing whose History shows it. */
export type ChangeRootKind = 'lesson' | 'figure' | 'routine' | 'drill' | 'song' | 'team';
/**
 * What a change did. A group song's own: `share` and `unshare` (Share with the
 * class, Stop sharing), `delete` (to Recently deleted) and `edit` (its name,
 * count, tempo or sample start; merged like `change`).
 */
export type ChangeVerb =
	| 'add'
	| 'change'
	| 'remove'
	| 'archive'
	| 'restore'
	| 'publish'
	| 'share'
	| 'unshare'
	| 'delete'
	| 'edit';
/** A value a change keeps from before and after: text, a number, or nothing. */
export type ChangeValues = Record<string, string | number | null>;

/** One line of a group's History, newest first. */
export interface HistoryRow {
	id: number;
	rootKind: ChangeRootKind;
	rootId: number;
	actorId: string;
	at: number;
	verb: ChangeVerb;
	/** The thing (`section`, `link`, …) or, for a change, the one field changed (`notes`). */
	subject: string;
	/** The row the change was to: a section, a link, a variation, a slot. */
	subjectId: number | null;
	before: ChangeValues | null;
	after: ChangeValues | null;
	/** Where a removal can be undone (Recently deleted), once it has a trash entry. */
	trashId: number | null;
}

/** What a group's hard delete keeps for 30 days (`team_trash.kind`). */
export type TrashKind = 'video' | 'section' | 'link' | 'spot-link' | 'recording';
/** What Recently deleted lists: the trash kinds, and the archived ones. */
export type DeletedKind = TrashKind | 'lesson' | 'variation' | 'routine' | 'drill' | 'song';

/** One row of a group's Recently deleted, newest first. */
export interface DeletedItem {
	kind: DeletedKind;
	/** The trash entry's id for a trash kind; the row's own id for an archived one. */
	id: number;
	/** What it was: "Enchufla · Doble", "Video · Class 3". */
	label: string;
	/** Who deleted or archived it, by short name; null when History does not say. */
	by: string | null;
	at: number;
	/** The day (in the viewer's zone) a trash kind goes for good; null for an archived kind. */
	purgeOn: string | null;
}

/** What Make my own copy brings: the bytes it is charged, and how many of each thing. */
export type CopySummary = {
	bytes: number;
	videos: number;
	variations: number;
	routines: number;
	drills: number;
};

/** The group a person has switched the app into (group mode). */
export type GroupMode = { teamId: number; name: string; role: 'owner' | 'editor' };

/** A group a person may switch into: they own or edit it. */
export type GroupChoice = GroupMode & { people: number };

// Clones and twins: the shapes every clone-engine task shares.
export type CloneKind = 'figure' | 'routine' | 'drill' | 'song' | 'lesson'; // 'figure' = a `figures` row
export type TwinKind = 'figure' | 'routine' | 'lesson' | 'song';
export type PieceKind = 'recording' | 'video' | 'spot';
export type PlaceRef = { kind: 'mine' } | { kind: 'team'; teamId: number; name: string };
export type FlatField = {
	key: string; // see Task 7's key grammar
	label: string; // "Timing", "Notes", "Recording · Ana, 3 Nov"
	value: string; // canonical text; equal values mean equal content
	show: string; // what the compare sheet prints
};
export type Flat = Record<string, FlatField>;
export type PairBase = { fields: Record<string, string>; skip: string[] }; // key → hash
export type Side = 'mine' | 'theirs' | 'both';
export type FieldDiff = {
	key: string;
	label: string;
	mine: FlatField | null; // null = absent on that side
	theirs: FlatField | null;
	side: Side; // who changed it since the base; 'both' = must pick
	removal: boolean; // the change on `side` is that the piece/member is gone
};
export type Picks = Record<string, 'mine' | 'theirs'>;
export type Member = {
	kind: CloneKind;
	id: number;
	place: PlaceRef;
	access: 'edit' | 'read';
	archived: boolean;
	clonedFrom: number | null;
};
export type Source = {
	id: number;
	label: string; // 'Yours' or the group's name
	relation: 'self' | 'clone' | 'twin';
	access: 'edit' | 'read';
	status: 'same' | 'behind' | 'newer' | 'differs' | null; // vs the page's own member; null for self and twins
	changed: string[]; // labels of what differs, for the banner
	rejoined?: boolean; // Task 28: last in step before the person's current membership began
};
