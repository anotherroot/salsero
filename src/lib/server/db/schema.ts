import { sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { PARTNER, PRACTICE_MODES, SONG_STATUSES, SOURCES, STYLES } from '../../labels';

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
		style: text('style', { enum: STYLES }).notNull().default('salsa'),
		/** Phase 2: whether the player may call this figure by voice. */
		callable: integer('callable', { mode: 'boolean' }).notNull().default(true),
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
		source: text('source', { enum: SOURCES }).notNull(),
		figureId: integer('figure_id').references(() => figures.id),
		practiceMode: text('practice_mode', { enum: PRACTICE_MODES }).notNull().default('none'),
		everyDays: real('every_days').notNull().default(3),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		archivedAt: integer('archived_at'),
		notes: text('notes'),
		createdAt: createdAt()
	},
	(t) => [
		check('exercises_every_days_ck', sql`${t.everyDays} > 0`),
		check('exercises_source_ck', sql`(${t.source} = 'figure') = (${t.figureId} is not null)`),
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
		createdAt: createdAt()
	},
	(t) => [
		check('sets_rating_ck', sql`${t.rating} is null or ${t.rating} between 1 and 5`),
		index('sets_exercise_time_idx').on(t.exerciseId, t.doneAt),
		index('sets_time_idx').on(t.doneAt)
	]
);

export type Figure = typeof figures.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type SetRow = typeof sets.$inferSelect;

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
		artist: text('artist'),
		style: text('style', { enum: STYLES }).notNull().default('salsa'),
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
