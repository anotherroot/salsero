import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import {
	COUNT_PATTERNS,
	PARTNER,
	PRACTICE_MODES,
	SONG_STATUSES,
	SOURCES,
	STYLES
} from '../../labels';

/*
 * Every instant is an INTEGER of epoch milliseconds, never a Date or a string.
 * The pure modules (`day`, `urgency`) take numbers, so rows go in and out of
 * them without conversion, and "which day was this" is always decided by
 * `localDay` in the user's zone — never by SQLite's UTC date functions.
 */
const now = () => Date.now();
const createdAt = () => integer('created_at').notNull().$defaultFn(now);

/* ── Identity ───────────────────────────────────────────────────────────── */

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	/** IANA zone that decides when "today" rolls over. See `src/lib/day/day.ts`. */
	timezone: text('timezone').notNull().default('Europe/Ljubljana'),
	createdAt: createdAt()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull(),
	createdAt: createdAt()
});

/**
 * Failed-login ledger backing the rate limiter. The app's own login is the only
 * thing between the open internet and the data (no Cloudflare Access), so the
 * form is throttled per IP and per account.
 */
export const loginAttempts = sqliteTable(
	'login_attempts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** `ip:<addr>` or `user:<email>` — both are counted, independently. */
		key: text('key').notNull(),
		attemptedAt: integer('attempted_at').notNull().$defaultFn(now)
	},
	(t) => [index('login_attempts_key_time_idx').on(t.key, t.attemptedAt)]
);

/* ── Figures ────────────────────────────────────────────────────────────── */

/**
 * A specific dance move (figura). Creating one creates its exercise in the
 * same transaction — see `src/lib/server/figures.ts`.
 */
export const figures = sqliteTable(
	'figures',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		notes: text('notes'),
		partner: text('partner', { enum: PARTNER }).notNull().default('partner'),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/**
		 * The figure's style tag, validated against `DANCES[dance].styles` in
		 * `figures.ts`. Plain text with no CHECK, on purpose.
		 */
		styleTag: text('style_tag'),
		/**
		 * VESTIGIAL — read by nothing, backfilled into `style_tag` by migration
		 * 0005. It cannot be dropped and `figures_style_ck` cannot be widened,
		 * because either means a table rebuild, and a rebuild is impossible here
		 * for two independent reasons: drizzle-kit's generated rebuild selects
		 * the new columns from the old table and fails at migrate time, AND
		 * `recordings.figure_id` / `lesson_figures.figure_id` reference this
		 * table, so the rebuild's `DROP TABLE` trips `foreign_keys = ON` — which
		 * `openDb` sets and which cannot be turned off inside the migrator's
		 * transaction.
		 *
		 * Leaving it alone is safe: its default is 'salsa', which always passes
		 * its own CHECK, so it can never block a bachata row. Do not "clean this
		 * up" — removing it is the trap.
		 */
		style: text('style', { enum: STYLES }).notNull().default('salsa'),
		/**
		 * VESTIGIAL since the random drill was removed — it was the drill's pool.
		 * Read by nothing, and not dropped for the same reason `style` is not.
		 */
		callable: integer('callable', { mode: 'boolean' }).notNull().default(true),
		/**
		 * VESTIGIAL since the random drill was removed — it was a spoken
		 * override for the name. Read by nothing; the voice says `name`. Not
		 * dropped for the same reason `style` is not.
		 */
		callText: text('call_text'),
		/**
		 * Where the figure LEAVES the hands. Null means the dance's neutral
		 * position — see `src/lib/graph/`. Null rather than a backfill so no
		 * migration has to touch existing rows.
		 */
		endPositionId: integer('end_position_id').references(() => positions.id),
		/**
		 * VESTIGIAL since migration 0010, which copied it into `length_counts`
		 * (`eights * 8`). Read by nothing. It cannot be dropped for the same reason
		 * `style` cannot — dropping a column is a table rebuild, and this table can
		 * never be rebuilt. Do not "clean this up".
		 */
		eights: integer('eights').notNull().default(1),
		/**
		 * The count the figure begins on, 1..8. Null reads as 1 — see
		 * `src/lib/graph/timing.ts`. No CHECK, for the reason above;
		 * `setFigureShape` in `src/lib/server/graph.ts` is the enforcement.
		 */
		startCount: integer('start_count'),
		/**
		 * How many COUNTS the figure takes — counts, not steps, so the unit is the
		 * same in every dance. Null reads as 8. Backfilled from `eights` by
		 * migration 0010; `createFigure` writes 8.
		 */
		lengthCounts: integer('length_counts'),
		/**
		 * Set on a VARIATION: a version of the figure this points at, with its own
		 * directions (`notes`), positions, timing and recordings. Anything unset —
		 * no start rows, a null end, null timing — is the parent's; `buildGraph`
		 * fills it in. One level only, same dance as the parent, never an exercise:
		 * all enforced in `figures.ts`, because this table can never gain a CHECK.
		 * See docs/superpowers/specs/2026-09-29-figure-variations-design.md.
		 */
		parentId: integer('parent_id').references((): AnySQLiteColumn => figures.id),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [
		check('figures_partner_ck', sql`${t.partner} in ('partner', 'solo')`),
		check('figures_style_ck', sql`${t.style} in ('salsa', 'son', 'other')`),
		index('figures_parent_idx').on(t.parentId)
	]
);

export const recordings = sqliteTable(
	'recordings',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		figureId: integer('figure_id')
			.notNull()
			.references(() => figures.id),
		/** File name under `$DATA_DIR/recordings/`. A random uuid plus extension. */
		file: text('file').notNull().unique(),
		mime: text('mime').notNull(),
		kind: text('kind', { enum: ['video', 'audio'] }).notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		note: text('note'),
		createdAt: createdAt()
	},
	(t) => [index('recordings_figure_idx').on(t.figureId)]
);

/* ── Positions ──────────────────────────────────────────────────────────── */

/**
 * The handhold vocabulary: where a figure's hands are before and after it.
 *
 * Rows rather than a registry entry, unlike `DANCES`. Count and clave positions
 * are code-shaped, so a database row could not carry them; a handhold
 * vocabulary is the opposite — it grows the week a new hold is learned and it
 * differs between schools. Seeded at boot per dance, idempotently.
 *
 * `neutral` is the position an UNTAGGED figure is assumed to start and end at,
 * which is why it is a column and not a constant: salsa's neutral is open with
 * two hands, bachata's is closed. "Exactly one per dance" is cross-row and so
 * cannot be a CHECK — `positions.ts` enforces it.
 *
 * No CHECK constraints at all here, deliberately: this table gains a foreign
 * key from `figures.end_position_id`, so a future drizzle-kit rebuild would
 * fail twice over. See the `figures.style` note above.
 */
export const positions = sqliteTable(
	'positions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/** Stable identifier for the seed; never shown. */
		slug: text('slug').notNull(),
		/** What the user sees. Renameable without breaking the seed. */
		name: text('name').notNull(),
		/** The assumed position of an untagged figure. Exactly one per dance. */
		neutral: integer('neutral', { mode: 'boolean' }).notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('positions_dance_slug_idx').on(t.dance, t.slug)]
);

/**
 * The handholds a figure can START from. Many, because entry is genuinely
 * plural — enchufla works from open or from a cross-hand hold.
 *
 * The END is a single column on `figures` instead: the walk has to know where
 * it landed, so if a figure ends differently depending on how it is finished,
 * that is two figures.
 *
 * A join table rather than a JSON column because "which figures start here" is
 * the graph's main query — unlike `anchors_json`, something reads inside it.
 */
export const figureStartPositions = sqliteTable(
	'figure_start_positions',
	{
		figureId: integer('figure_id')
			.notNull()
			.references(() => figures.id),
		positionId: integer('position_id')
			.notNull()
			.references(() => positions.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.figureId, t.positionId] }),
		index('figure_start_positions_position_idx').on(t.positionId)
	]
);

export type Position = typeof positions.$inferSelect;

/* ── Routines ───────────────────────────────────────────────────────────── */

/**
 * A named sequence of slots — a combo. Creating one creates its exercise in the
 * same transaction, the rule figures and lessons already follow; see
 * `src/lib/server/routines.ts`.
 *
 * There is no separate "block" or "subroutine" table. A block is just a short
 * routine, so a combo built standalone can be embedded later with no
 * conversion, and practising three figures is a good practice unit by itself.
 */
export const routines = sqliteTable(
	'routines',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		name: text('name').notNull(),
		notes: text('notes'),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [index('routines_dance_idx').on(t.dance, t.archivedAt)]
);

/**
 * One slot of a routine, in order. It holds EITHER interchangeable figure
 * options (`routine_step_options`) OR one embedded routine — never both, and
 * never neither. Both rules live in `routines.ts`: "exactly one of two tables"
 * is not expressible as a CHECK at all, and a CHECK here would foreclose
 * adding a column later.
 *
 * A slot needs no length of its own. The plan is built per run after options
 * are resolved, so the chosen figure's `eights` is what counts.
 *
 * `position` is 0-based and contiguous. A slot is structure, not an entity: it
 * is hard-deleted and renumbered freely, the way a song's anchors are.
 */
export const routineSteps = sqliteTable(
	'routine_steps',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		routineId: integer('routine_id')
			.notNull()
			.references(() => routines.id),
		position: integer('position').notNull(),
		/** An embedded routine, or null when this slot holds figure options. */
		childRoutineId: integer('child_routine_id').references((): AnySQLiteColumn => routines.id),
		/** A reminder for this slot — "hand change here". */
		note: text('note'),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('routine_steps_slot_idx').on(t.routineId, t.position),
		index('routine_steps_child_idx').on(t.childRoutineId)
	]
);

/**
 * The interchangeable figures filling one slot — the alternatives.
 *
 * All of them must share ONE end position and ONE next count, enforced on
 * write: that is what interchangeable means. A slot's START positions are the
 * UNION of its options', and a run filters them by where the hands actually
 * are.
 */
export const routineStepOptions = sqliteTable(
	'routine_step_options',
	{
		stepId: integer('step_id')
			.notNull()
			.references(() => routineSteps.id),
		figureId: integer('figure_id')
			.notNull()
			.references(() => figures.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.stepId, t.figureId] }),
		index('routine_step_options_figure_idx').on(t.figureId)
	]
);

export type Routine = typeof routines.$inferSelect;
export type RoutineStep = typeof routineSteps.$inferSelect;

/* ── Songs ──────────────────────────────────────────────────────────────── */

/**
 * A song and its beat analysis. The heavy work (download, Beat This!) happens
 * on the home worker; this row is also the job queue — `status` says what the
 * worker should do next, `claimed_at` is its lease. See `src/lib/server/songs.ts`.
 *
 * `beats_json` is already cleaned (gaps filled). The user's count lives in
 * `anchors_json` and `tempo_factor`, separate from the analysis, so re-analysing
 * never throws away a correction.
 */
export const songs = sqliteTable(
	'songs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Empty until the user or the worker (from YouTube) names it. */
		title: text('title').notNull().default(''),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		artist: text('artist'),
		style: text('style').notNull().default('salsa'),
		sourceUrl: text('source_url'),
		status: text('status', { enum: SONG_STATUSES }).notNull(),
		error: text('error'),
		attempts: integer('attempts').notNull().default(0),
		claimedAt: integer('claimed_at'),
		/** File name under `$DATA_DIR/audio/`. */
		audioFile: text('audio_file').unique(),
		mime: text('mime'),
		durationS: real('duration_s'),
		bpm: real('bpm'),
		beatsJson: text('beats_json'),
		downbeatsJson: text('downbeats_json'),
		anchorsJson: text('anchors_json').notNull().default('[]'),
		tempoFactor: real('tempo_factor').notNull().default(1),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [
		check('songs_tempo_ck', sql`${t.tempoFactor} in (0.5, 1, 2)`),
		check('songs_source_ck', sql`${t.sourceUrl} is not null or ${t.audioFile} is not null`),
		index('songs_status_idx').on(t.status, t.createdAt)
	]
);

export type Song = typeof songs.$inferSelect;

/* ── Exercises & sets ───────────────────────────────────────────────────── */

/**
 * Anything practised and logged. `source` says where it came from; a figure's
 * exercise follows its figure's name and archive state.
 *
 * There is deliberately NO "last done" or "urgency" column. Both are pure
 * functions of the sets — see `src/lib/urgency/`.
 */
export const exercises = sqliteTable(
	'exercises',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		source: text('source', { enum: SOURCES }).notNull(),
		figureId: integer('figure_id').references(() => figures.id),
		practiceMode: text('practice_mode', { enum: PRACTICE_MODES }).notNull().default('none'),
		/** Practice mode 'song': which song the player opens. */
		songId: integer('song_id').references(() => songs.id),
		/** Practice mode 'count': the BPM of the synthetic grid. */
		countBpm: integer('count_bpm'),
		/**
		 * What the practice panel last played for this exercise, beyond the mode,
		 * song and tempo above: `{ count, clave, speed, callEvery }`. Read through
		 * `parsePracticeConfig` in `$lib/exercises/practice`, which is total — so
		 * no value here, however odd, can stop a popup from opening. Nullable and
		 * added by plain ADD COLUMN: no CHECK on this table, ever (see below).
		 */
		practiceJson: text('practice_json'),
		/**
		 * Set iff `source = 'lesson'`. Deliberately WITHOUT a mirror of
		 * `exercises_source_ck`: a new CHECK on this table makes drizzle-kit rebuild
		 * it, and the rebuild fails at migrate time (see the note below).
		 * `lessons.ts` is the only thing that writes this column, and is the
		 * enforcement.
		 */
		lessonId: integer('lesson_id').references(() => lessons.id),
		/**
		 * Set iff `source = 'routine'`. Deliberately WITHOUT a mirror of
		 * `exercises_source_ck`, for the same reason `lessonId` has none: a new
		 * CHECK on this table makes drizzle-kit rebuild it and the rebuild fails
		 * at migrate time. `routines.ts` is the only thing that writes this
		 * column, and is the enforcement.
		 */
		routineId: integer('routine_id').references(() => routines.id),
		everyDays: real('every_days').notNull().default(3),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		archivedAt: integer('archived_at'),
		notes: text('notes'),
		createdAt: createdAt()
	},
	(t) => [
		check('exercises_every_days_ck', sql`${t.everyDays} > 0`),
		check('exercises_source_ck', sql`(${t.source} = 'figure') = (${t.figureId} is not null)`),
		// No `exercises_practice_ck`: drizzle-kit's rebuild migration for a new
		// CHECK on this table selects the new columns from the OLD table (which
		// doesn't have them) and fails at migrate time — see task-1-report.md.
		// `parsePracticeInput` (src/lib/exercises/practice.ts) and
		// `setPracticeSettings` (src/lib/server/exercises.ts) enforce the
		// song/count pairing instead.
		index('exercises_figure_idx').on(t.figureId)
	]
);

/** One logged bout. Many per exercise per day. The only thing ever hard-deleted, besides recordings. */
export const sets = sqliteTable(
	'sets',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		exerciseId: integer('exercise_id')
			.notNull()
			.references(() => exercises.id),
		doneAt: integer('done_at').notNull(),
		durationS: integer('duration_s'),
		reps: integer('reps'),
		rating: integer('rating'),
		note: text('note'),
		/**
		 * Phase 2b: what the player run looked like —
		 * `{speed, count, clave, callEvery, called:[figureId…]}`. Free-form on
		 * purpose; nothing queries inside it.
		 */
		playerJson: text('player_json'),
		createdAt: createdAt()
	},
	(t) => [
		check('sets_rating_ck', sql`${t.rating} is null or ${t.rating} between 1 and 5`),
		index('sets_exercise_time_idx').on(t.exerciseId, t.doneAt),
		index('sets_time_idx').on(t.doneAt)
	]
);

/* ── Lessons ────────────────────────────────────────────────────────────── */

/**
 * A class you attended. Creating one creates its "review" exercise in the same
 * transaction, the same rule figures follow — see `src/lib/server/lessons.ts`.
 *
 * `lesson_day` is a DAY, not an instant, so it is stored as the `YYYY-MM-DD`
 * string `localDay` produces rather than epoch ms. A class belongs to the day
 * it happened on in the user's zone; converting through an instant on every
 * read is how that day would eventually shift by one.
 */
export const lessons = sqliteTable(
	'lessons',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** The local day the class happened, `YYYY-MM-DD`. */
		lessonDay: text('lesson_day').notNull(),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		title: text('title').notNull(),
		notes: text('notes'),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [
		check('lessons_day_ck', sql`${t.lessonDay} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
		index('lessons_day_idx').on(t.lessonDay)
	]
);

/**
 * A video from a class. Unlike `recordings`, these arrive in chunks: phone
 * footage of a whole class is far past the 95 MiB a single request can carry.
 * See `src/routes/api/lessons/[id]/videos/[uploadId]/+server.ts`.
 */
export const lessonVideos = sqliteTable(
	'lesson_videos',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		/** File name under `$DATA_DIR/lesson-videos/`. A random uuid plus extension. */
		file: text('file').notNull().unique(),
		mime: text('mime').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('lesson_videos_lesson_idx').on(t.lessonId)]
);

/**
 * A saved moment of a video — a point, or a section the full-screen player
 * loops. See `docs/superpowers/specs/2026-10-01-video-player-design.md`.
 *
 * Exactly one owner, a recording or a lesson video. The CHECKs are safe
 * because this table is NEW: the "never add a CHECK" rule is about drizzle-kit
 * rebuilding an EXISTING table.
 *
 * `start_ms` and `end_ms` are positions inside the media file, not instants,
 * so they are not epoch ms — but integers for the same reason. No `dance`
 * column: a spot is the dance of its video, resolved through the owner like a
 * link. Hard-deleted, and deleted with its video (`deleteRecording`,
 * `deleteLessonVideo`).
 */
export const videoSpots = sqliteTable(
	'video_spots',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		recordingId: integer('recording_id').references(() => recordings.id),
		lessonVideoId: integer('lesson_video_id').references(() => lessonVideos.id),
		startMs: integer('start_ms').notNull(),
		/** Null for a point; else after `start_ms`. */
		endMs: integer('end_ms'),
		/** The user's name for it; null shows the time. */
		label: text('label'),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'video_spots_owner_ck',
			sql`(${t.recordingId} is not null) + (${t.lessonVideoId} is not null) = 1`
		),
		check(
			'video_spots_span_ck',
			sql`${t.startMs} >= 0 and (${t.endMs} is null or ${t.endMs} > ${t.startMs})`
		),
		index('video_spots_recording_idx').on(t.recordingId),
		index('video_spots_lesson_video_idx').on(t.lessonVideoId)
	]
);

/** Figures taught in a lesson. Many-to-many; neither side owns the other. */
export const lessonFigures = sqliteTable(
	'lesson_figures',
	{
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		figureId: integer('figure_id')
			.notNull()
			.references(() => figures.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.lessonId, t.figureId] }),
		index('lesson_figures_figure_idx').on(t.figureId)
	]
);

/**
 * Routines taught in a lesson. The `lesson_figures` shape, for the same reason:
 * a routine owns its exercise the way a figure does, so linking one carries its
 * exercise along and the "never in both places" rule applies to it too.
 */
export const lessonRoutines = sqliteTable(
	'lesson_routines',
	{
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		routineId: integer('routine_id')
			.notNull()
			.references(() => routines.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.lessonId, t.routineId] }),
		index('lesson_routines_routine_idx').on(t.routineId)
	]
);

/**
 * Exercises attached to a lesson by hand. NOT the lesson's own review exercise
 * (that one is `exercises.lesson_id`), and never a linked figure's or routine's
 * exercise — those are shown under the figure or routine instead. Enforced in
 * `lessons.ts`, because neither rule is expressible as a CHECK.
 */
export const lessonExercises = sqliteTable(
	'lesson_exercises',
	{
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		exerciseId: integer('exercise_id')
			.notNull()
			.references(() => exercises.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.lessonId, t.exerciseId] }),
		index('lesson_exercises_exercise_idx').on(t.exerciseId)
	]
);

/* ── Links ──────────────────────────────────────────────────────────────── */

/**
 * A URL attached to a lesson, a figure or a drill (a custom exercise). A
 * YouTube URL renders as an embed; anything else as a plain link. See
 * `src/lib/links.ts` for what is accepted — only http and https.
 *
 * Exactly one owner. The CHECK is safe here because this table is NEW: the
 * "never add a CHECK" rule is about drizzle-kit rebuilding an EXISTING table.
 * "Drills only" for `exercise_id` is not expressible as a CHECK and lives in
 * `src/lib/server/links.ts`.
 *
 * No `dance` column: a link is the dance of its owner, resolved through the
 * owner the same way sets and recordings are. Hard-deleted, like a recording.
 */
export const links = sqliteTable(
	'links',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		lessonId: integer('lesson_id').references(() => lessons.id),
		figureId: integer('figure_id').references(() => figures.id),
		exerciseId: integer('exercise_id').references(() => exercises.id),
		url: text('url').notNull(),
		/** The user's label; null shows the host. */
		title: text('title'),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'links_owner_ck',
			sql`(${t.lessonId} is not null) + (${t.figureId} is not null) + (${t.exerciseId} is not null) = 1`
		),
		index('links_lesson_idx').on(t.lessonId),
		index('links_figure_idx').on(t.figureId),
		index('links_exercise_idx').on(t.exerciseId)
	]
);

/* ── One-off steps ──────────────────────────────────────────────────────── */

/**
 * Markers for boot steps that must run once EVER, not once per boot — the
 * first is copying the URLs out of lesson notes into `links`
 * (`importNoteLinks`). A migration cannot do that job (SQLite has no regex),
 * and "run when the target is empty" would re-import a link the user deleted.
 */
export const appFlags = sqliteTable('app_flags', {
	key: text('key').primaryKey(),
	doneAt: integer('done_at').notNull()
});

/* ── The count voice ────────────────────────────────────────────────────── */

/**
 * One recorded half-bar of the user counting: phrase `a` is the first half of
 * the pattern (salsa 1-2-3, son 2-3-4), `b` the second. See
 * `docs/superpowers/specs/2026-09-23-count-voice-design.md`.
 *
 * A half bar, not a whole one and not a loop: the silent 4 and 8 give each
 * phrase's tail a beat to ring out, so there is no seam, and dropping phrase
 * `b` is how the player still gets out of the way for a figure call.
 *
 * `pre_roll_s` is audio kept BEFORE the phrase's first beat. A word's
 * perceived beat is its vowel, and the /s/ of "cinco" starts ~80 ms earlier;
 * playback starts the buffer at `beatTime − preRoll` so that consonant is not
 * thrown away.
 *
 * No CHECK constraints, deliberately — drizzle-kit's rebuild migration for a
 * new CHECK selects new columns from the old table and fails at migrate time.
 * The upload route validates instead.
 */
export const countTakes = sqliteTable(
	'count_takes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		pattern: text('pattern', { enum: COUNT_PATTERNS }).notNull(),
		/** The click tempo it was counted against. */
		bpm: integer('bpm').notNull(),
		phrase: text('phrase', { enum: ['a', 'b'] }).notNull(),
		/** File name under `$DATA_DIR/count/`. A random uuid plus `.wav`. */
		file: text('file').notNull().unique(),
		sampleRate: integer('sample_rate').notNull(),
		preRollS: real('pre_roll_s').notNull(),
		/** The phrase itself: its first beat to the end of its last. */
		lengthS: real('length_s').notNull(),
		/** The whole file, pre-roll and ring-out included. */
		durationS: real('duration_s').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('count_takes_slot_idx').on(t.pattern, t.bpm, t.phrase)]
);

export type Figure = typeof figures.$inferSelect;
export type CountTake = typeof countTakes.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type SetRow = typeof sets.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LessonVideo = typeof lessonVideos.$inferSelect;
export type VideoSpot = typeof videoSpots.$inferSelect;
