/** Row shapes that cross from server to page. Client-safe: no server imports. */
import type {
	CountPattern,
	Partner,
	PracticeMode,
	SongStatus,
	Source as ExerciseSource,
	TempoFactor
} from './labels';
import type { ComesBack } from './schedule/comes-back';
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
	/** How it comes back, effective: its own, else the class drill's, else the faces. */
	comesBack: ComesBack;
	/** The row's own setting, parsed; null when unset. */
	comesBackOwn: ComesBack | null;
	/** An entry's class drill's setting, parsed; null otherwise. */
	comesBackTeacher: ComesBack | null;
	warmup: boolean;
	warmupOrder: number | null;
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
	/** Distinct local days with an entry. */
	times: number;
	/** Every logged duration, summed. Entries with no duration add nothing. */
	totalS: number;
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

/** What holds a Music list (spec Part B): a lesson, a drill or a routine. */
export type MusicParent = { lessonId: number } | { exerciseId: number } | { routineId: number };

/** One song of a Music list, as a page shows it. */
export interface MusicRow {
	/** The `song_links` row. */
	id: number;
	songId: number;
	title: string;
	artist: string | null;
	bpm: number | null;
	durationS: number | null;
	sample: SampleSong;
	note: string | null;
	/** Playable now: false for a group song unshared or archived since (only editors get such rows). */
	shared: boolean;
	/** What a note save saw (the clash check), as the form posts it. */
	seen: string;
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
	/** On the exercise page: one of the row's own Music (spec B), its name and the song's place in it. */
	music?: { label: string; rank: number };
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
	/** The group a person's own lesson was kept or copied from; null otherwise. */
	copyOf: string | null;
	/** Stands for its twins in the Lessons list (board C7): the "Twins" chip. */
	twinned?: boolean;
	/** With `twinned`: the other members of the set, so the open lesson can light the row. */
	twinIds?: number[];
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

/** One recording on a figure, as the exercise page lists it. */
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
	/** Where the music starts: a player seeks here before playing from 0:00 (`playFrom`, `$lib/songs/music-start`). */
	startS: number;
}

/**
 * What the exercise page shows, branched by the exercise's type.
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

/** The page's whole payload: its content, and the exercise's last set. */
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
	/** On a group's lesson: the person's own copy of it, which the card opens; else null. */
	mineId: number | null;
}

/** A routine linked to a lesson, with the exercise that came with it. */
export interface LessonRoutineRow {
	id: number;
	name: string;
	exerciseId: number | null;
	/** On a group's lesson: the person's own copy of it, which the card opens; else null. */
	mineId: number | null;
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
	/** On a group's lesson: the person's own copy of it, which the card opens; else null. */
	mineId: number | null;
}

/**
 * A position on a lesson: linked by hand, or through a section or point of
 * the lesson's videos (ruling 10: a point counts as "via section").
 */
export interface LessonPositionRow {
	id: number;
	name: string;
	styleTag: string | null;
	byHand: boolean;
	viaSections: ViaSection[];
	/** On a group's lesson: the person's own copy of it, which the card opens; else null. */
	mineId: number | null;
	/** On a person's own lesson, a group's position they may use: its group; else null. */
	teamId: number | null;
}

/** An exercise as a picker offers it. */
export interface PickExercise {
	id: number;
	name: string;
	source: ExerciseSource;
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
	/** The person's twins of it that this row stands for in a picker (`clones/twins.ts`). */
	twins?: TwinNote[];
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
	/** The person's twins of it that this row stands for in a picker (`clones/twins.ts`). */
	twins?: TwinNote[];
	/** The place of the copy's source when the viewer reads it; drawn beside a same name. */
	from?: string | null;
}

/**
 * A twin folded behind a picker row: named by its place and its own name.
 * `figure` is null for kinds with no move above them (routines, lessons, songs).
 */
export type TwinNote = { id: number; figure: string | null; name: string; team: TeamRef | null };

/** A figure (a `figures` row) as the Figures list shows it, under its move. */
export type FigureRow = {
	id: number;
	/** Copies of it that differ (Moves lists; 0 or absent when in step). */
	differ?: number;
	/** The figure's own name — "Doble". */
	name: string;
	/** "Enchufla · Doble". */
	label: string;
	/** How it is danced and its style: the list's filters read them. */
	partner: Partner;
	style: string | null;
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
	/** The place of the copy's source when the viewer reads it ("Sreda 17:30"); drawn beside a same name. */
	from: string | null;
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
	/** "Cross-hand → Open two hands": each side joined with " / ", an untagged side empty; "No position" when both are. */
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
	/** Copies of it that differ (Moves lists; 0 or absent when in step). */
	differ?: number;
	name: string;
	notes: string | null;
	/** Slots, children counted as one. */
	slots: number;
	createdAt: number;
	/** Group mode only: a published lesson reaches it, so members see it. */
	membersSee?: boolean;
	/** The latest class it is from, as shown ("Tue 3 Nov"); null when in no lesson (spec A5). */
	classDay?: string | null;
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
	/**
	 * What this section or point is linked to: variations and drills
	 * ("Enchufla · Doble") and positions by name. A point links positions only.
	 */
	linkedTo: string[];
}

/** The one video a spot belongs to — a figure recording or a lesson video. */
export type SpotOwner = { recordingId: number } | { lessonVideoId: number };

/** What a section can be linked to: a figure version or a drill. */
export type SectionTarget = { figureId: number } | { exerciseId: number };

/**
 * What the Link popup links a spot to: a section links a variation, a drill
 * or a position; a point, a position only (ruling 10). Position links live in
 * their own table (`spot_position_links`), so a link id means nothing without
 * its kind.
 */
export type LinkTarget = SectionTarget | { positionId: number };

/** Something a section or point can be linked to, as the Link popup lists it. */
export interface LinkOption {
	target: LinkTarget;
	/** "Enchufla · Doble", or a drill's name. */
	label: string;
	drill: boolean;
	/** A variation's figure and own name, for headings; null for a drill. */
	figure: string | null;
	name: string;
	/** Already linked to this section. */
	linked: boolean;
	/** A group's row a person may use (`usableOf`), offered in their own lists: whose it is. */
	team?: TeamRef;
	/** A variation's twins folded behind it (`clones/twins.ts`). */
	twins?: TwinNote[];
	/** A position's hold: its picker row's second line. Absent for a variation or a drill. */
	hold?: Hold;
	/** A variation's place of origin when it is a copy the viewer can trace; drawn beside a same name. */
	from?: string | null;
}

/** One of a section's or point's links, in the Link popup. */
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
	/** What a new figure in this move starts on: its first figure's Danced and Style. */
	partner: Partner;
	style: string | null;
}

export type LinkContext =
	| { kind: 'lesson'; lessonId: number; title: string }
	| { kind: 'recording'; groupId: number; figure: string };

/** Everything the Link popup shows for one section, or one point (`endMs` null: positions only). */
export interface LinkOptions {
	dance: DanceSlug;
	spot: { id: number; startMs: number; endMs: number | null; label: string | null };
	context: LinkContext;
	linked: LinkedTarget[];
	/** 'In this lesson' or 'This figure'. */
	nearTitle: string;
	/**
	 * Variations, drills, then positions of this lesson, or the recording's own
	 * figure and the positions it is tagged with. A point's: positions only.
	 */
	near: LinkOption[];
	/** Every other live variation. */
	figures: LinkOption[];
	/** Every other live drill. */
	drills: LinkOption[];
	/** Every other live position (own first, then a group's a person may use). */
	positions: LinkOption[];
	figureChoices: LinkFigureChoice[];
	/** What "New figure" starts on. */
	defaults: { partner: Partner; style: string };
}

/** A create step's field a refusal of `createAndLink` names, so the popup shows it there. */
export type LinkCreateField = 'name' | 'figureName' | 'groupId' | 'style';

/** What the Link popup's create steps send. */
export type LinkCreate =
	/** Danced and Style both or neither; neither (an older page): the move's first figure's. */
	| {
			kind: 'variation';
			groupId: number;
			name: string;
			partner?: Partner;
			style?: string;
	  }
	| { kind: 'figure'; figureName: string; name: string; partner: Partner; style: string }
	| { kind: 'drill'; name: string }
	/** `styleTag` null: no type. Refused for its type under 'style'. */
	| { kind: 'position'; name: string; styleTag: string | null };

/**
 * A section of a lesson's video through which a variation or drill is on that
 * lesson; for a position, a point too (`endMs` null).
 */
export interface ViaSection {
	spotId: number;
	startMs: number;
	endMs: number | null;
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

/** A section or a point linked to a position: one card. */
export type LinkedSpot = LinkedSection & { point: boolean };

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

/** What saving a day answers (Today's `done`, the player's `save`): the row, what it held before (a JSON `SetSnapshot`, null for a new day) and the days until it is due, null for a past day. */
export interface DoneResult {
	ok: true;
	setId: number;
	before: string | null;
	backDays: number | null;
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

/**
 * My class's list of classes (Follow my class): each class's last class day by
 * group id (a class with none left out) and today.
 */
export interface MyClassInfo {
	lastDays: Record<number, string>;
	today: string;
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
export type ChangeRootKind =
	'lesson' | 'figure' | 'routine' | 'drill' | 'song' | 'team' | 'position';
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
export type TrashKind = 'video' | 'section' | 'link' | 'spot-link' | 'recording' | 'position-link';
/** What Recently deleted lists: the trash kinds, and the archived ones. */
export type DeletedKind =
	TrashKind | 'lesson' | 'variation' | 'routine' | 'drill' | 'song' | 'position';

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

/** The group a person has switched the app into (group mode). */
export type GroupMode = { teamId: number; name: string; role: 'owner' | 'editor' };

/** A group a person may switch into: they own or edit it. */
export type GroupChoice = GroupMode & { people: number };

// Clones and twins: the shapes every clone-engine task shares.
export type CloneKind = 'figure' | 'routine' | 'drill' | 'song' | 'lesson' | 'position'; // 'figure' = a `figures` row
export type TwinKind = 'figure' | 'routine' | 'lesson' | 'song' | 'position';
export type PieceKind = 'recording' | 'video' | 'spot';
export type PlaceRef = { kind: 'mine' } | { kind: 'team'; teamId: number; name: string };
export type FlatField = {
	key: string; // see Task 7's key grammar
	label: string; // "Timing", "Notes", "Recording · Ana, 3 Nov"
	value: string; // canonical text; equal values mean equal content
	show: string; // what the Sync sheet prints
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

/** A Take or a Send into one member: written, or refused with words for the sheet. */
export type SyncResult =
	| { ok: true }
	| {
			ok: false;
			reason: 'denied' | 'stale' | 'pick' | 'name' | 'linked' | 'room' | 'failed';
			message: string;
	  };

/** Detach on a member page (`detachOffer`): the place it stops following, and whether the row is a group's. */
export type DetachOffer = { place: string; group: boolean };

/** A place Copy to… can copy into (`copyTargets`): the person's app or a group they own or edit. */
export type CopyTarget = {
	place: PlaceRef;
	/** The person's role in the group; null for their own app. */
	role: 'owner' | 'editor' | null;
	usedBytes: number;
	limitBytes: number | null;
	/** The family's member already there (archived included), and when it was made. */
	existing: { id: number; archived: boolean; at: number } | null;
};

/** Copy to… on an item page: what the sheet names, and where it can go. */
export type CopyOffer = {
	kind: CloneKind;
	/** "Week 3", "Enchufla · Doble". */
	title: string;
	/** The page's row is the person's own. */
	fromMine: boolean;
	targets: CopyTarget[];
};

/** One version a twins question offers: "Rueda club’s", "Last changed 2 Nov". */
export type TwinChoice = { id: number; place: PlaceRef; changedAt: number; meta: string };

/** What a copy into one place would do (`copyPlan`): the sheet's grey cards and its questions. */
export type CopyPlanView = {
	/** "3 figures · 2 videos (420 MB, charged to the group) · notes". */
	goes: string;
	bytes: number;
	/** One line per thing the place holds already, reused. */
	already: string[];
	/** Per family with twins: which one goes (`gene` is the `use` key; `from` goes unless another is picked). */
	twins: {
		gene: string;
		/** The family's kind: "You see two versions of this routine." */
		kind: TwinKind;
		label: string;
		from: number;
		choices: TwinChoice[];
	}[];
};

/** One thing a moved lesson brings (board C4 p3): keep yours as well, or use the group's. */
export type MoveItem = {
	kind: 'figure' | 'routine' | 'drill';
	id: number;
	/** "Enchufla · Doble", "Week 4 loop". */
	label: string;
	/** "Used by 2 other lessons", "Used by Week 4 loop", "You practise it", "Only this lesson". */
	why: string;
	/** "Keep mine as well" preselected: all but "Only this lesson" (ruling 11). */
	keepByDefault: boolean;
	/** Live practice on it, which stays with the archived copy when it is dropped. */
	practised: boolean;
};

/** What moving a lesson into one group would do: Copy to…'s plan, and what it brings. */
export type MovePreview = CopyPlanView & { items: MoveItem[] };

/** Move to… on the person's own lesson: its title and the groups it can go to. */
export type MoveOffer = { title: string; targets: CopyTarget[] };

/** One row of "Copies you can see" (board C3 p1): a member of the page's family. */
export type FamilyEntry = {
	member: Member;
	/** The person's role in the member's group; null for their own. */
	role: 'owner' | 'editor' | 'member' | null;
	/** Against the page's row; null for the page itself. */
	status: Source['status'];
	/**
	 * What differs (`changedLabels`); for the page itself, what it changed
	 * that some copy lacks (`ownChanges`: "Notes", "+1 recording").
	 */
	changed: string[];
	/** What the copy changed that the page lacks: the differs banner's words. */
	theirs: string[];
	/** The person edits it: Send can reach it. */
	editable: boolean;
};

/** The page's family as the Versions list draws it; null when no other member is editable. */
export type FamilyView = {
	entries: FamilyEntry[];
};

/** One thing a person could keep of a group when they leave (Keep, `keepPreview`). */
export type KeepItem = {
	kind: CloneKind;
	id: number;
	name: string;
	meta: string;
	/** What keeping it charges the person: its own files, 0 when they have a copy already. */
	bytes: number;
	/** The person's routine or lesson (or figure, for a section on its recording) that uses it. */
	used: string | null;
	/** What `used` is, for the locked row's words. */
	usedBy: 'routine' | 'lesson' | 'figure' | null;
	/** The kept lesson that brings it. */
	inLesson: number | null;
	/** Whether the person may tick it: a lesson only if they added it (a practised one is not choosable). */
	choosable: boolean;
};
export type KeepPreview = {
	lessons: KeepItem[];
	figures: KeepItem[];
	positions: KeepItem[];
	routines: KeepItem[];
	songs: KeepItem[];
	drills: KeepItem[];
	allBytes: number;
	usedBytes: number;
	usedNames: string[];
	limitBytes: number | null;
	nowBytes: number;
};
export type KeepChoice =
	| { mode: 'all' }
	| { mode: 'used' }
	| { mode: 'chosen'; lessons: number[]; figures: number[]; routines: number[]; songs: number[] };

/** What of a person's own moves onto another row (`repoint`'s report, as a screen reads it). */
export type SwitchReport = {
	routines: { id: number; name: string }[];
	lessons: { id: number; title: string }[];
	sections: number;
	entries: number;
	/** A position's: the person's figures tagged with it (start or end), by label. */
	figures: { id: number; label: string }[];
};

/**
 * Edit on a class's thing the person only reads: what Make it mine would do
 * (`makeMinePreview`), for its sheet. `existing` is the person's own copy
 * already there (archived: it comes back).
 */
export type MakeMineOffer = {
	kind: CloneKind;
	/** "Setenta · Básico", a routine's or drill's name, a song's or lesson's title. */
	label: string;
	/** The group whose it is. */
	team: string;
	repoint: SwitchReport;
	/** The person practises it (an entry, or a song pick), so their practice switches too. */
	practised: boolean;
	/** What the copy charges the person (a lesson's videos, a song's audio); 0 when reused. */
	bytes: number;
	existing: { id: number; archived: boolean } | null;
};

/**
 * One version Drop my copy can go back to (board C5): a group's member of the
 * family the person reads. `practiceFollows` is false for a group's figure,
 * routine or drill no lesson they added holds (R8); `addLesson` is then the
 * group's newest published lesson that holds it, which Drop can add so
 * practice follows. `onlyInMine` is what the person's copy has that this one
 * lacks (`changedLabels`); `label` is this version's own name.
 */
export type DropChoice = {
	id: number;
	place: PlaceRef;
	label: string;
	access: 'edit' | 'read';
	clonedFrom: boolean;
	practiceFollows: boolean;
	addLesson: { id: number; title: string } | null;
	onlyInMine: string[];
};

/**
 * Drop my copy on the person's own member (`dropOptions`): the versions they
 * can go back to, the one preselected (the one they copied from, while they
 * read it), what only theirs has against it, and the choices they edit (Send
 * mine first).
 */
export type DropOptions = {
	kind: CloneKind;
	choices: DropChoice[];
	preselected: number;
	onlyInMine: string[];
	sendable: number[];
};

/** Same as… on an item page: the sheet's title and what it offers (`twinCandidates`). */
export type TwinCandidate = { id: number; label: string; place: PlaceRef; ticked: boolean };
export type TwinOffer = { kind: TwinKind; title: string; candidates: TwinCandidate[] };

export type Hands = 'two' | 'one' | 'none';
export type Facing = 'face' | 'side' | 'shadow' | 'back';
export type Frame = 'open' | 'closed';
/** How two dancers hold each other at a position; every part may be unknown (null). */
export interface Hold {
	hands: Hands | null;
	crossed: boolean | null;
	facing: Facing | null;
	frame: Frame | null;
}

/** A position as lists, pickers and pages see it. */
export interface PositionSummary {
	id: number;
	name: string;
	styleTag: string | null;
	hold: Hold;
	teamId: number | null; // null: the viewer's own (or the group's own in group mode)
	archived: boolean;
	/** The place of the copy's source when the viewer reads it; drawn beside a same name. */
	copiedFrom?: string | null;
}

/** One row of the Positions list. */
export interface PositionListRow extends PositionSummary {
	/** Copies of it that differ (0 or absent when in step). */
	differ?: number;
	inCount: number;
	outCount: number;
	deadEnd: boolean;
	orphan: boolean;
	island: boolean;
	unused: boolean;
	from: string | null; // a group's: the lesson it came from ("from Week 6")
	twins: boolean;
}

export interface PositionInput {
	name: string;
	styleTag: string | null;
	hold: Hold;
	notes: string | null;
	pictureSpotId: number | null;
}

/* ── Comments on a group's lessons ─────────────────────────────────────── */

/** One comment as a person sees it. `body` is null when it was deleted. */
export type CommentRow = {
	id: number;
	/** A top comment's own thread is null; a reply's is its top comment. */
	threadId: number | null;
	/** Null for a deleted comment: its author is not shown. */
	authorName: string | null;
	/** The author is the group's owner or an editor right now. */
	teacher: boolean;
	mine: boolean;
	body: string | null;
	at: number;
	hearts: number;
	hearted: boolean;
	canDelete: boolean;
	/** Set only for a reply to another reply: drawn as "@Maja". */
	replyToName: string | null;
};

export type CommentThread = { top: CommentRow; replies: CommentRow[] };

export type CommentList = {
	threads: CommentThread[];
	/** Posting, hearting and deleting are allowed (false in a deleted group). */
	open: boolean;
	groupName: string;
};

/** The card at the end of a lesson page. */
export type CommentCard = {
	count: number;
	newCount: number;
	newest: { name: string; teacher: boolean; text: string; at: number } | null;
};

/** What a page needs to draw the card and open the sheet: the lesson, its group and the card. */
export type CommentsOn = {
	lessonId: number;
	/** The sheet's subtitle. */
	lessonTitle: string;
	groupName: string;
	card: CommentCard;
	/** The load's clock: the card's "2 days ago" reads it, so SSR and hydration agree. */
	now: number;
};

/**
 * The You page's settings (`YouSettings.svelte`): the few rows changed most,
 * read by `youSettingsOf` (`$lib/server/you.ts`). The theme is the root layout's
 * (`data.theme`, a cookie per browser), not here.
 */
export type YouSettingsData = {
	/** `users.level`; null (not chosen) draws as Everything. */
	level: 'follow' | 'own' | 'all' | null;
	dailyCount: number;
	/** My count's line: "3 of 21 tempos in your own voice". */
	ownVoice: string;
	/** The Android app's daily reminder, minutes into the day; null is off. */
	reminderMinute: number | null;
};

/** A copy's Keep in step settings: the switch and the four options. */
export type SyncSettings = {
	on: boolean;
	names: boolean;
	small: boolean;
	sections: boolean;
	media: boolean;
};

/**
 * Sync's N-way merge (`$lib/clones/merge.ts`): one distinct value of a field
 * across the copies, `hash` null and `field` null meaning the key is absent
 * there. `holders` are the copies holding it, in the members' order;
 * `changed` says a copy holding it moved away from what it last agreed.
 */
export type MergeValue = {
	hash: string | null;
	field: FlatField | null;
	holders: number[];
	changed: boolean;
};
/**
 * A field the copies do not agree on. `pick` is a value's `hash`, null meaning
 * "absent", undefined meaning open (the person must pick). `add` and `remove`
 * are a box ("add here too?", "remove here too?"): ticked, `pick` is the
 * change's value; unticked, it is the other value and nothing lands.
 */
export type MergeRow = {
	key: string;
	label: string;
	values: MergeValue[];
	pick: string | null | undefined;
	kind: 'field' | 'add' | 'remove';
};

/**
 * The Sync sheet (`syncView`): the merge's rows across every live copy the
 * person reads (the page's first), the copies they edit to land it on
 * ("Sync to", the page's first, each with its digest for `seen`), and every
 * copy by name, for the tiles' holders. `mode 'update'`: they edit only their
 * own copy and read the others, so the sheet is "Update from <club>".
 */
export type SyncView = {
	title: string;
	rows: MergeRow[];
	targets: { id: number; label: string; role: string; seen: string; ticked: boolean }[];
	mode: 'sync' | 'update';
	/** Update mine: the club the sheet reads from ("Update from Sreda 17:30"); absent in sync mode. */
	from?: string;
	/** Every copy shown, with its digest: `syncAll` refuses when one not ticked changed since. */
	members: { id: number; label: string; seen: string }[];
};

/** A Sync's answer: landed, less the copies refused alone; or refused as a whole. */
export type SyncAllResult =
	| { ok: true; refused: { id: number; message: string }[] }
	| { ok: false; reason: 'pick' | 'denied' | 'stale'; message: string };

/**
 * One other copy against the page's: how it stands, and what differs in the
 * notice's words (`changedLabels`: "Timing", "1 recording"). A `held` line
 * says whether the copy added or removed what the options keep from flowing.
 */
export type StepLine = {
	id: number;
	place: string;
	state: 'behind' | 'changed' | 'both' | 'held';
	fields: string[];
	how?: 'added' | 'removed';
};
/** Where a page's copies stand (`stepStatus`); empty `lines` when they agree. */
export type StepView = { lines: StepLine[] };

/**
 * Keep in step on a page (`keepView`): the page row's settings, whether the
 * person may change them, and how Sync opens from it: `sync`, `update` (a
 * reader's Update mine), or null when there is no Sync (no other copy the
 * person reads, or none they edit).
 */
export type KeepView = {
	settings: SyncSettings;
	editable: boolean;
	mode: 'sync' | 'update' | null;
};

/** A video in the player's details: a linked section (its range loops) or a figure's own recording. */
export interface RunClip {
	kind: 'section' | 'recording';
	src: string;
	startMs: number;
	endMs: number | null;
	caption: string;
}

/**
 * What the player's About shows for an exercise or a routine's figure, read-only
 * (one-player design). Each part only when it has something; `hasDetails` in
 * `$lib/player/view` decides whether there is an About at all.
 */
export interface RunDetails {
	/** The exercise's name, or a figure's label ("Pa ti, pa mi · Basic"). */
	heading: string;
	/** A figure's timing, then its positions; [] for a drill. */
	facts: string[];
	hasPositions: boolean;
	/** Trimmed; empty is null. */
	notes: string | null;
	/** Linked sections, then a figure's own video recordings. */
	clips: RunClip[];
	links: { url: string; title: string | null }[];
}
