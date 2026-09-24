import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex
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
		/** Phase 2: whether the player may call this figure by voice. */
		callable: integer('callable', { mode: 'boolean' }).notNull().default(true),
		/**
		 * How to SAY the name, when the browser's voice mangles the written name
		 * ("dile que no" read as English). Null means speak `name`.
		 */
		callText: text('call_text'),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [
		check('figures_partner_ck', sql`${t.partner} in ('partner', 'solo')`),
		check('figures_style_ck', sql`${t.style} in ('salsa', 'son', 'other')`)
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
		 * Set iff `source = 'lesson'`. Deliberately WITHOUT a mirror of
		 * `exercises_source_ck`: a new CHECK on this table makes drizzle-kit rebuild
		 * it, and the rebuild fails at migrate time (see the note below).
		 * `lessons.ts` is the only thing that writes this column, and is the
		 * enforcement.
		 */
		lessonId: integer('lesson_id').references(() => lessons.id),
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
		// `updateExercise` enforces the song/count pairing instead.
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
 * Exercises attached to a lesson by hand. NOT the lesson's own review exercise
 * (that one is `exercises.lesson_id`), and never a linked figure's exercise —
 * those are shown under the figures instead. Enforced in `lessons.ts`, because
 * neither rule is expressible as a CHECK.
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
