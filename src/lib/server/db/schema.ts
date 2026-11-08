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
import { mintedId } from './ids';
import { serverNow } from '../server-clock';

/*
 * Every instant is an INTEGER of epoch milliseconds, never a Date or a string.
 * The pure modules (`day`, `schedule`) take numbers, so rows go in and out of
 * them without conversion, and "which day was this" is always decided by
 * `localDay` in the user's zone — never by SQLite's UTC date functions.
 */
const now = () => serverNow();
const createdAt = () => integer('created_at').notNull().$defaultFn(now);

/* ── Identity ───────────────────────────────────────────────────────────── */

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		/** Unique per dance (`users_dance_email_idx`): one email may hold a salsa and a bachata account. */
		email: text('email').notNull(),
		passwordHash: text('password_hash').notNull(),
		/**
		 * The dance this account belongs to (`docs/superpowers/specs/2026-11-06-dance-split-design.md`).
		 * Nullable only for accounts the boot split (`dance-split.ts`) has not placed yet;
		 * such an account signs in nowhere. No CHECK: see CLAUDE.md.
		 */
		dance: text('dance'),
		/** Asked at Join, or on /welcome for an account made before names. Null until then. */
		firstName: text('first_name'),
		lastName: text('last_name'),
		/** IANA zone that decides when "today" rolls over. See `src/lib/day/day.ts`. */
		timezone: text('timezone').notNull().default('Europe/Ljubljana'),
		createdAt: createdAt(),
		/**
		 * The Android app's daily reminder, as a minute of the day in the phone's
		 * local time; null = off. Range-checked in `setReminderMinute`, not by a
		 * CHECK (see CLAUDE.md on CHECKs and existing tables).
		 */
		reminderMinute: integer('reminder_minute'),
		/** What the Android app compresses a video to. One of `VIDEO_SHORT_SIDES`. */
		videoShortSide: integer('video_short_side').notNull().default(480),
		/** The admin invites people and sees their storage. */
		isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
		/** Bytes of recordings, videos, songs and takes the account may keep; null = no limit. */
		storageLimitBytes: integer('storage_limit_bytes'),
		/** How many groups the person may make; null = `TEAMS_MADE_DEFAULT`. */
		groupLimit: integer('group_limit'),
		/** How many exercises Today shows a day, for both dances; null = `DAILY_DEFAULT`. Range-checked in `setDailyCount`. */
		dailyCount: integer('daily_count'),
		/**
		 * How much app the person sees: `follow`, `own` or `all` (`$lib/levels/levels.ts`),
		 * checked in `setLevel`, not by a CHECK. Null until chosen (the first run asks);
		 * accounts made before levels were backfilled to `all` by migration 0031.
		 */
		level: text('level'),
		/**
		 * The language the app speaks to this person: `en` or `sl` (`$lib/i18n/locale.ts`),
		 * checked in `setLocale` (`$lib/server/locale.ts`), not by a CHECK. Null is English.
		 */
		locale: text('locale')
	},
	(t) => [uniqueIndex('users_dance_email_idx').on(t.dance, t.email)]
);

/**
 * What a person chose for one day on Today: an exercise put there by hand
 * (`add`), pulled in by Next N (`next`), or skipped for the day (`skip`).
 * `day` is a local day in the person's zone. See `src/lib/server/today-picks.ts`.
 */
export const todayPicks = sqliteTable(
	'today_picks',
	{
		id: mintedId('today_picks'),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		exerciseId: integer('exercise_id')
			.notNull()
			.references(() => exercises.id),
		day: text('day').notNull(),
		kind: text('kind', { enum: ['next', 'add', 'skip'] }).notNull(),
		createdAt: createdAt()
	},
	(t) => [
		index('today_picks_user_day_idx').on(t.userId, t.day),
		check('today_picks_kind_ck', sql`${t.kind} in ('next', 'add', 'skip')`)
	]
);

/**
 * The style a new figure starts on, per user and dance, as picked in Settings.
 * No row = the registry's `defaultStyle`. Validated against the dance's styles
 * in `setDefaultStyle` and re-checked on read, so a style later removed from
 * the registry falls back instead of pre-selecting nothing.
 */
export const defaultStyles = sqliteTable(
	'default_styles',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		dance: text('dance').notNull(),
		style: text('style').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.dance] })]
);

/**
 * A paired Android app. The token itself is shown once, to the app, and never
 * stored: only its SHA-256, so a copy of the database authenticates nothing.
 * A device token is accepted on `/api/` only — see `request-user.ts`.
 */
export const deviceTokens = sqliteTable('device_tokens', {
	id: mintedId('device_tokens'),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	tokenHash: text('token_hash').notNull().unique(),
	label: text('label').notNull(),
	createdAt: createdAt(),
	lastUsedAt: integer('last_used_at')
});

/**
 * The newest app version each person has opened, per dance. Written by the
 * request hook (`app-seen.ts`), read by the admin's list of who needs an update.
 */
export const appInstalls = sqliteTable(
	'app_installs',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		dance: text('dance').notNull(),
		versionCode: integer('version_code').notNull(),
		channel: text('channel').notNull(),
		seenAt: integer('seen_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.dance] })]
);

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
		id: mintedId('login_attempts'),
		/** `ip:<addr>` or `user:<email>` — both are counted, independently. */
		key: text('key').notNull(),
		attemptedAt: integer('attempted_at').notNull().$defaultFn(now)
	},
	(t) => [index('login_attempts_key_time_idx').on(t.key, t.attemptedAt)]
);

/* ── Figures ────────────────────────────────────────────────────────────── */

/** A figure: a name and a dance. What it IS lives in its variations (`figures` rows). */
export const figureGroups = sqliteTable(
	'figure_groups',
	{
		id: mintedId('figure_groups'),
		dance: text('dance').notNull(),
		/** The owner. Nullable and without a foreign key on purpose: specs make rows without a user; the data functions keep it whole. */
		userId: text('user_id'),
		/** The team that owns this, instead of a person. Nullable, no foreign key, like `user_id`; exactly one of the two is set (see `integrity.ts`). */
		teamId: integer('team_id'),
		name: text('name').notNull(),
		archivedAt: integer('archived_at'),
		createdAt: createdAt()
	},
	(t) => [
		index('figure_groups_dance_idx').on(t.dance),
		index('figure_groups_user_idx').on(t.userId, t.dance),
		index('figure_groups_team_idx').on(t.teamId, t.dance)
	]
);

/**
 * A `figures` row is a VARIATION of a figure; its figure is its
 * `figure_groups` row (`group_id`). See
 * docs/superpowers/specs/2026-10-29-figures-are-variations-design.md.
 *
 * A specific dance move (figura). Its exercise is opt-in (`addFigureExercise`),
 * not created with it — see `src/lib/server/figures.ts`.
 */
export const figures = sqliteTable(
	'figures',
	{
		id: mintedId('figures'),
		name: text('name').notNull(),
		notes: text('notes'),
		/** The owner. Nullable and without a foreign key on purpose: specs make rows without a user; the data functions keep it whole. */
		userId: text('user_id'),
		/** The team that owns this, instead of a person. Nullable, no foreign key, like `user_id`; exactly one of the two is set (see `integrity.ts`). */
		teamId: integer('team_id'),
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
		 * VESTIGIAL: the figure's one end, before a figure had any number. Copied
		 * into `figure_end_positions` by the boot move
		 * (`src/lib/server/positions-move.ts`); read by nothing. Not dropped, for
		 * the same reason `style` is not.
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
		 * VESTIGIAL since migration 0017 (figures became groups): read by nothing.
		 * Not dropped for the same reason `style` is not.
		 */
		parentId: integer('parent_id').references((): AnySQLiteColumn => figures.id),
		/** The figure this is a variation of. */
		groupId: integer('group_id').references(() => figureGroups.id),
		archivedAt: integer('archived_at'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from')
	},
	(t) => [
		check('figures_partner_ck', sql`${t.partner} in ('partner', 'solo')`),
		check('figures_style_ck', sql`${t.style} in ('salsa', 'son', 'other')`),
		index('figures_parent_idx').on(t.parentId),
		index('figures_group_idx').on(t.groupId),
		index('figures_user_idx').on(t.userId, t.dance),
		index('figures_team_idx').on(t.teamId, t.dance),
		uniqueIndex('figures_gene_user_idx')
			.on(t.geneId, t.userId)
			.where(sql`${t.geneId} is not null`),
		uniqueIndex('figures_gene_team_idx')
			.on(t.geneId, t.teamId)
			.where(sql`${t.geneId} is not null`)
	]
);

export const recordings = sqliteTable(
	'recordings',
	{
		id: mintedId('recordings'),
		figureId: integer('figure_id')
			.notNull()
			.references(() => figures.id),
		/** File name under `$DATA_DIR/recordings/`. A random uuid plus extension. */
		file: text('file').notNull().unique(),
		mime: text('mime').notNull(),
		kind: text('kind', { enum: ['video', 'audio'] }).notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		note: text('note'),
		/** The YouTube URL this was saved from; null for an upload. */
		sourceUrl: text('source_url'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from')
	},
	(t) => [index('recordings_figure_idx').on(t.figureId), index('recordings_gene_idx').on(t.geneId)]
);

/* ── Positions ──────────────────────────────────────────────────────────── */

/**
 * The handhold vocabulary: where a figure's hands are before and after it.
 *
 * Rows rather than a registry entry, unlike `DANCES`. Count and clave positions
 * are code-shaped, so a database row could not carry them; a handhold
 * vocabulary is the opposite — it grows the week a new hold is learned and it
 * differs between schools.
 *
 * Positions are owned like figures: `user_id` or `team_id`, exactly one set
 * (`ownerIntegrity` checks), a `gene_id` and `cloned_from` for the clone
 * families. `neutral`, `slug` and `sort_order` are VESTIGIAL: read by nothing
 * after the positions rewrite, and not dropped, because a rebuild of this table
 * is impossible for the reasons on `figures.style`. So is
 * `figures.end_position_id`, replaced by `figure_end_positions`. New rows get
 * `slug = 'p-' + uuid`; slugs are no longer unique.
 *
 * No CHECK constraints, ever: this table has incoming foreign keys, so a
 * drizzle-kit rebuild would fail twice over. See the `figures.style` note above.
 */
export const positions = sqliteTable(
	'positions',
	{
		id: mintedId('positions'),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/** VESTIGIAL: read by nothing since the positions move; not dropped, see `figures.style`. New rows get `'p-' + uuid`. */
		slug: text('slug').notNull(),
		/** What the user sees. */
		name: text('name').notNull(),
		/** VESTIGIAL: read by nothing since the positions move; not dropped, see `figures.style`. */
		neutral: integer('neutral', { mode: 'boolean' }).notNull().default(false),
		/** VESTIGIAL: read by nothing since the positions move; not dropped, see `figures.style`. */
		sortOrder: integer('sort_order').notNull().default(0),
		archivedAt: integer('archived_at'),
		createdAt: createdAt(),
		userId: text('user_id'),
		teamId: integer('team_id'),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from'),
		/** The figure type (a dance's style tag), or null. */
		styleTag: text('style_tag'),
		/** The hold: 'two' | 'one' | 'none', or null for unknown. */
		hands: text('hands'),
		crossed: integer('crossed', { mode: 'boolean' }),
		/** 'face' | 'side' | 'shadow' | 'back', or null. */
		facing: text('facing'),
		/** 'open' | 'closed', or null. */
		frame: text('frame'),
		notes: text('notes'),
		/** A point (video_spots.id) that pictures it. No foreign key: a spot is hard-deleted and the delete clears this. */
		pictureSpotId: integer('picture_spot_id')
	},
	(t) => [
		index('positions_user_idx').on(t.userId, t.dance),
		index('positions_team_idx').on(t.teamId, t.dance),
		uniqueIndex('positions_gene_user_idx')
			.on(t.geneId, t.userId)
			.where(sql`${t.geneId} is not null`),
		uniqueIndex('positions_gene_team_idx')
			.on(t.geneId, t.teamId)
			.where(sql`${t.geneId} is not null`)
	]
);

/**
 * The handholds a figure can START from. Many, because entry is genuinely
 * plural — enchufla works from open or from a cross-hand hold.
 *
 * The ends live in `figure_end_positions`, any number of them, like the
 * starts (`figures.end_position_id`, the old single end, is vestigial).
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

/** The handholds a figure can END at. Many, like the starts. */
export const figureEndPositions = sqliteTable(
	'figure_end_positions',
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
		index('figure_end_positions_position_idx').on(t.positionId)
	]
);

/** A section or point of a video linked to a position. */
export const spotPositionLinks = sqliteTable(
	'spot_position_links',
	{
		id: mintedId('spot_position_links'),
		spotId: integer('spot_id')
			.notNull()
			.references(() => videoSpots.id),
		positionId: integer('position_id')
			.notNull()
			.references(() => positions.id),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('spot_position_links_unique_idx').on(t.spotId, t.positionId),
		index('spot_position_links_position_idx').on(t.positionId)
	]
);

/** Positions taught in a lesson, by hand: the `lesson_figures` shape. */
export const lessonPositions = sqliteTable(
	'lesson_positions',
	{
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		positionId: integer('position_id')
			.notNull()
			.references(() => positions.id),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.lessonId, t.positionId] }),
		index('lesson_positions_position_idx').on(t.positionId)
	]
);

export type Position = typeof positions.$inferSelect;
export type PositionRow = Position;

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
		id: mintedId('routines'),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/** The owner. Nullable and without a foreign key on purpose: specs make rows without a user; the data functions keep it whole. */
		userId: text('user_id'),
		/** The team that owns this, instead of a person. Nullable, no foreign key, like `user_id`; exactly one of the two is set (see `integrity.ts`). */
		teamId: integer('team_id'),
		name: text('name').notNull(),
		notes: text('notes'),
		archivedAt: integer('archived_at'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from')
	},
	(t) => [
		index('routines_dance_idx').on(t.dance, t.archivedAt),
		index('routines_user_idx').on(t.userId, t.dance),
		index('routines_team_idx').on(t.teamId, t.dance),
		uniqueIndex('routines_gene_user_idx')
			.on(t.geneId, t.userId)
			.where(sql`${t.geneId} is not null`),
		uniqueIndex('routines_gene_team_idx')
			.on(t.geneId, t.teamId)
			.where(sql`${t.geneId} is not null`)
	]
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
		id: mintedId('routine_steps'),
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
		id: mintedId('songs'),
		/** Empty until the user or the worker (from YouTube) names it. */
		title: text('title').notNull().default(''),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		artist: text('artist'),
		/** The owner. Nullable and without a foreign key on purpose: specs make rows without a user; the data functions keep it whole. */
		userId: text('user_id'),
		/** The group that owns this, instead of a person; exactly one of the two is set (see `integrity.ts`). */
		teamId: integer('team_id').references((): AnySQLiteColumn => teams.id),
		/** A group song's Share with the class; null is a draft only its editors see. Null on a person's own. */
		sharedAt: integer('shared_at'),
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
		/**
		 * Raw seconds the user chose for the sample to start at; null = automatic.
		 * Snapped on read by `sampleStart` (`$lib/songs/sample`), never on write.
		 */
		sampleStartS: real('sample_start_s'),
		/** The audio file's size, for the owner's storage count; null until stored. */
		sizeBytes: integer('size_bytes'),
		archivedAt: integer('archived_at'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from')
	},
	(t) => [
		check('songs_tempo_ck', sql`${t.tempoFactor} in (0.5, 1, 2)`),
		check('songs_source_ck', sql`${t.sourceUrl} is not null or ${t.audioFile} is not null`),
		index('songs_status_idx').on(t.status, t.createdAt),
		index('songs_user_idx').on(t.userId, t.dance),
		index('songs_team_idx').on(t.teamId, t.dance),
		uniqueIndex('songs_gene_user_idx')
			.on(t.geneId, t.userId)
			.where(sql`${t.geneId} is not null`),
		uniqueIndex('songs_gene_team_idx')
			.on(t.geneId, t.teamId)
			.where(sql`${t.geneId} is not null`)
	]
);

export type Song = typeof songs.$inferSelect;

/**
 * Which entries lost which group song, and when: a song unshared or deleted
 * falls back to count-only on its members' entries, and Share again or
 * Restore puts it back on exactly these (unless the person picked another
 * song since). No foreign keys: a purge deletes these with their song.
 */
export const songDrops = sqliteTable(
	'song_drops',
	{
		exerciseId: integer('exercise_id').notNull(),
		songId: integer('song_id').notNull(),
		droppedAt: integer('dropped_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.exerciseId, t.songId] })]
);

/* ── Exercises & sets ───────────────────────────────────────────────────── */

/**
 * Anything practised and logged. `source` says where it came from; a figure's
 * exercise follows its figure's name and archive state.
 *
 * There is deliberately NO "last done" or "due" column. Both are pure
 * functions of the sets — see `src/lib/schedule/`.
 */
export const exercises = sqliteTable(
	'exercises',
	{
		id: mintedId('exercises'),
		name: text('name').notNull(),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/** The owner. Nullable and without a foreign key on purpose: specs make rows without a user; the data functions keep it whole. */
		userId: text('user_id'),
		/** The team that owns this, instead of a person. Nullable, no foreign key, like `user_id`; exactly one of the two is set (see `integrity.ts`). */
		teamId: integer('team_id'),
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
		/**
		 * Set iff `source = 'added'`: the group drill (a `custom` exercise owned by a team) this
		 * member's practice entry points at. No CHECK, for the reason `lessonId` has none.
		 */
		drillId: integer('drill_id').references((): AnySQLiteColumn => exercises.id),
		everyDays: real('every_days').notNull().default(3),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		archivedAt: integer('archived_at'),
		notes: text('notes'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from'),
		/** JSON of `ComesBack`, null = not set. Read with `parseComesBack`; only drills use it. */
		comesBack: text('comes_back'),
		/** The person's own warm-up flag (never a group row's). */
		warmup: integer('warmup', { mode: 'boolean' }).notNull().default(false),
		/** Position among the warm-ups; null = not placed. */
		warmupOrder: integer('warmup_order')
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
		index('exercises_figure_idx').on(t.figureId),
		index('exercises_user_idx').on(t.userId, t.dance),
		index('exercises_team_idx').on(t.teamId, t.dance),
		// One entry per person per thing: the entry is found, never doubled.
		uniqueIndex('exercises_entry_lesson_idx')
			.on(t.userId, t.lessonId)
			.where(sql`${t.lessonId} is not null`),
		uniqueIndex('exercises_entry_routine_idx')
			.on(t.userId, t.routineId)
			.where(sql`${t.routineId} is not null`),
		uniqueIndex('exercises_entry_figure_idx')
			.on(t.userId, t.figureId)
			.where(sql`${t.figureId} is not null`),
		uniqueIndex('exercises_entry_drill_idx')
			.on(t.userId, t.drillId)
			.where(sql`${t.drillId} is not null`),
		uniqueIndex('exercises_gene_user_idx')
			.on(t.geneId, t.userId)
			.where(sql`${t.geneId} is not null`),
		uniqueIndex('exercises_gene_team_idx')
			.on(t.geneId, t.teamId)
			.where(sql`${t.geneId} is not null`)
	]
);

/** One logged bout. Many per exercise per day. The only thing ever hard-deleted, besides recordings. */
export const sets = sqliteTable(
	'sets',
	{
		id: mintedId('sets'),
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
		id: mintedId('lessons'),
		/** The local day the class happened, `YYYY-MM-DD`. */
		lessonDay: text('lesson_day').notNull(),
		/** Which dance this belongs to. See `src/lib/dances/dances.ts`. */
		dance: text('dance').notNull().default('salsa'),
		/** The owner. Nullable and without a foreign key on purpose: specs make rows without a user; the data functions keep it whole. */
		userId: text('user_id'),
		/** The team that owns this, instead of a person. Nullable, no foreign key, like `user_id`; exactly one of the two is set (see `integrity.ts`). */
		teamId: integer('team_id'),
		title: text('title').notNull(),
		notes: text('notes'),
		/** A team lesson is a draft (null) until an editor publishes it; members see it only after. */
		publishedAt: integer('published_at'),
		archivedAt: integer('archived_at'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from')
	},
	(t) => [
		check('lessons_day_ck', sql`${t.lessonDay} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
		index('lessons_day_idx').on(t.lessonDay),
		index('lessons_user_idx').on(t.userId, t.dance),
		index('lessons_team_idx').on(t.teamId, t.dance),
		uniqueIndex('lessons_gene_user_idx')
			.on(t.geneId, t.userId)
			.where(sql`${t.geneId} is not null`),
		uniqueIndex('lessons_gene_team_idx')
			.on(t.geneId, t.teamId)
			.where(sql`${t.geneId} is not null`)
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
		id: mintedId('lesson_videos'),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		/** File name under `$DATA_DIR/lesson-videos/`. A random uuid plus extension. */
		file: text('file').notNull().unique(),
		mime: text('mime').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		/** The YouTube URL this was saved from; null for an upload. */
		sourceUrl: text('source_url'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from')
	},
	(t) => [
		index('lesson_videos_lesson_idx').on(t.lessonId),
		index('lesson_videos_gene_idx').on(t.geneId)
	]
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
		id: mintedId('video_spots'),
		recordingId: integer('recording_id').references(() => recordings.id),
		lessonVideoId: integer('lesson_video_id').references(() => lessonVideos.id),
		startMs: integer('start_ms').notNull(),
		/** Null for a point; else after `start_ms`. */
		endMs: integer('end_ms'),
		/** The user's name for it; null shows the time. */
		label: text('label'),
		createdAt: createdAt(),
		geneId: text('gene_id'),
		clonedFrom: integer('cloned_from')
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
		index('video_spots_lesson_video_idx').on(t.lessonVideoId),
		index('video_spots_gene_idx').on(t.geneId)
	]
);

/**
 * A section of a video linked to a figure version or a drill. See
 * `docs/superpowers/specs/2026-10-15-video-section-links-design.md`.
 *
 * Exactly one target. The CHECK is safe because this table is NEW. "A
 * section, not a point", "same dance" and "drills only" are cross-row and live
 * in `src/lib/server/spot-links.ts`. The foreign key on `spot_id` is what makes
 * the database itself refuse to delete a linked spot. Hard-deleted on unlink.
 */
export const spotLinks = sqliteTable(
	'spot_links',
	{
		id: mintedId('spot_links'),
		spotId: integer('spot_id')
			.notNull()
			.references(() => videoSpots.id),
		/** A figure or one of its variations. */
		figureId: integer('figure_id').references(() => figures.id),
		/** A drill (`source = 'custom'`). */
		exerciseId: integer('exercise_id').references(() => exercises.id),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'spot_links_target_ck',
			sql`(${t.figureId} is not null) + (${t.exerciseId} is not null) = 1`
		),
		uniqueIndex('spot_links_spot_figure_idx').on(t.spotId, t.figureId),
		uniqueIndex('spot_links_spot_exercise_idx').on(t.spotId, t.exerciseId),
		index('spot_links_figure_idx').on(t.figureId),
		index('spot_links_exercise_idx').on(t.exerciseId)
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
		id: mintedId('links'),
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

/**
 * Music with notes (spec Part B, 2026-11-05): a lesson's, a drill's or a
 * routine's suggested songs, each with an optional note, in the order added.
 * Exactly one parent is set — checked in `src/lib/server/song-links.ts`, not
 * by a CHECK. Owner and dance come through the parent. Hard-deleted on Remove
 * (bookkeeping, like a lesson's hand link); a song link never copies audio.
 */
export const songLinks = sqliteTable(
	'song_links',
	{
		id: mintedId('song_links'),
		songId: integer('song_id')
			.notNull()
			.references(() => songs.id),
		lessonId: integer('lesson_id').references(() => lessons.id),
		exerciseId: integer('exercise_id').references(() => exercises.id),
		routineId: integer('routine_id').references(() => routines.id),
		note: text('note'),
		sortOrder: integer('sort_order').notNull(),
		createdAt: createdAt()
	},
	(t) => [
		index('song_links_song_idx').on(t.songId),
		uniqueIndex('song_links_lesson_song_idx').on(t.lessonId, t.songId),
		uniqueIndex('song_links_exercise_song_idx').on(t.exerciseId, t.songId),
		uniqueIndex('song_links_routine_song_idx').on(t.routineId, t.songId)
	]
);

/**
 * A YouTube link being saved as a video by the home worker. See
 * `docs/superpowers/specs/2026-10-15-youtube-video-save-design.md`.
 *
 * No `done` status: success deletes the row, with its link, in the transaction
 * that inserts the recording or lesson video. The owner is copied from the
 * link so completing does not read a row it is about to delete. The CHECKs
 * are safe because the table is new.
 */
export const videoDownloads = sqliteTable(
	'video_downloads',
	{
		id: mintedId('video_downloads'),
		linkId: integer('link_id')
			.notNull()
			.unique()
			.references(() => links.id),
		figureId: integer('figure_id').references(() => figures.id),
		lessonId: integer('lesson_id').references(() => lessons.id),
		/** Copied from the link. */
		url: text('url').notNull(),
		status: text('status', { enum: ['queued', 'failed'] }).notNull(),
		error: text('error'),
		attempts: integer('attempts').notNull().default(0),
		/** The worker's lease, epoch ms. */
		claimedAt: integer('claimed_at'),
		/** Who pressed Save (or Retry): History's actor when the video lands in a group. */
		requestedBy: text('requested_by'),
		createdAt: createdAt()
	},
	(t) => [
		check(
			'video_downloads_owner_ck',
			sql`(${t.figureId} is not null) + (${t.lessonId} is not null) = 1`
		),
		check('video_downloads_status_ck', sql`${t.status} in ('queued', 'failed')`),
		index('video_downloads_status_idx').on(t.status, t.createdAt)
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

/**
 * The highest id used per table and slot (`src/lib/server/db/ids.ts`). Kept by
 * an `AFTER INSERT` trigger on each id table (migration 0035), read by every
 * id column's default. Each database keeps its own: never synced.
 */
export const idMarks = sqliteTable(
	'id_marks',
	{
		tbl: text('tbl').notNull(),
		slot: integer('slot').notNull(),
		hi: integer('hi').notNull()
	},
	(t) => [primaryKey({ columns: [t.tbl, t.slot] })]
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
		id: mintedId('count_takes'),
		/** The owner. Nullable and without a foreign key on purpose: specs make rows without a user; the data functions keep it whole. */
		userId: text('user_id'),
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
	(t) => [
		uniqueIndex('count_takes_user_slot_idx').on(t.userId, t.pattern, t.bpm, t.phrase),
		index('count_takes_user_idx').on(t.userId)
	]
);

/** An admin-made invite. Only the SHA-256 of the code is kept; it is shown once. */
export const invites = sqliteTable('invites', {
	id: text('id').primaryKey(),
	codeHash: text('code_hash').notNull().unique(),
	createdBy: text('created_by').notNull(),
	createdAt: createdAt(),
	expiresAt: integer('expires_at').notNull(),
	usedAt: integer('used_at'),
	usedBy: text('used_by'),
	/** The dance Join makes the account in. Null on invites from before the split: salsa's. */
	dance: text('dance'),
	/**
	 * The language Join is drawn in and the new account starts with: `en` or `sl`,
	 * read through `parseLocale` (`inviteLocaleOf`), not a CHECK. Null is English.
	 */
	locale: text('locale')
});

/** A request for more storage. `outcome` is 'granted' | 'declined', validated in code. */
export const storageRequests = sqliteTable(
	'storage_requests',
	{
		id: mintedId('storage_requests'),
		userId: text('user_id').notNull(),
		note: text('note'),
		createdAt: createdAt(),
		resolvedAt: integer('resolved_at'),
		outcome: text('outcome'),
		grantedLimitBytes: integer('granted_limit_bytes'),
		/** Set when the request is for a team's space rather than the person's. */
		teamId: integer('team_id')
	},
	(t) => [index('storage_requests_user_idx').on(t.userId, t.resolvedAt)]
);

/* ── Groups (in code, teams: `figure_groups` already means a figure) ───── */

/** A group: a class that shares its lessons. Its rows carry `team_id` instead of `user_id`. */
export const teams = sqliteTable('teams', {
	id: mintedId('teams'),
	dance: text('dance').notNull(),
	name: text('name').notNull(),
	/** What a person types to join. */
	code: text('code').notNull().unique(),
	/** Bytes the group may keep; null = computed. */
	storageLimitBytes: integer('storage_limit_bytes'),
	deletedAt: integer('deleted_at'),
	deletedBy: text('deleted_by'),
	purgedAt: integer('purged_at'),
	createdBy: text('created_by').notNull(),
	createdAt: createdAt()
});

export const teamMembers = sqliteTable(
	'team_members',
	{
		teamId: integer('team_id')
			.notNull()
			.references(() => teams.id),
		userId: text('user_id').notNull(),
		role: text('role').notNull(),
		joinedAt: integer('joined_at').notNull(),
		/**
		 * Whether new class lessons reach the member's Today by themselves: null = the
		 * level's default, 0 or 1 the member's own choice (`autoAddOn`, `setAutoAdd`).
		 */
		autoAdd: integer('auto_add')
	},
	(t) => [
		primaryKey({ columns: [t.teamId, t.userId] }),
		check('team_members_role_ck', sql`${t.role} in ('owner', 'editor', 'member')`),
		uniqueIndex('team_members_owner_idx')
			.on(t.teamId)
			.where(sql`${t.role} = 'owner'`),
		index('team_members_user_idx').on(t.userId)
	]
);

/** A team lesson a person added to their own Lessons; `seen_at` drives "new". */
export const lessonAdds = sqliteTable(
	'lesson_adds',
	{
		userId: text('user_id').notNull(),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		addedAt: integer('added_at').notNull(),
		seenAt: integer('seen_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.lessonId] })]
);

/**
 * A comment on a group's lesson (lesson comments spec). `author_id`, not
 * `user_id`: the owner and the dance come through the lesson, like
 * `lesson_videos`. A reply's `thread_id` is its top comment and `reply_to_id`
 * the comment it answers, both in the same lesson (checked in the data
 * function). The body is 1–1000 characters after trim, also checked there.
 * Delete is soft (`deleted_at`, `deleted_by`).
 */
export const lessonComments = sqliteTable(
	'lesson_comments',
	{
		id: mintedId('lesson_comments'),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lessons.id),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id),
		threadId: integer('thread_id').references((): AnySQLiteColumn => lessonComments.id),
		replyToId: integer('reply_to_id').references((): AnySQLiteColumn => lessonComments.id),
		body: text('body').notNull(),
		createdAt: createdAt(),
		deletedAt: integer('deleted_at'),
		deletedBy: text('deleted_by').references(() => users.id)
	},
	(t) => [index('lesson_comments_lesson_idx').on(t.lessonId, t.createdAt)]
);

/** A heart on a comment: bookkeeping, un-hearting deletes the row. */
export const lessonCommentHearts = sqliteTable(
	'lesson_comment_hearts',
	{
		commentId: integer('comment_id')
			.notNull()
			.references(() => lessonComments.id),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.commentId, t.userId] })]
);

/**
 * When a person last opened a group's lesson or song. "What's new" is derived
 * from it (`whats-new.ts`); no unread flag is ever stored.
 */
export const opens = sqliteTable(
	'opens',
	{
		userId: text('user_id').notNull(),
		/** 'lesson' | 'song' | 'comments' (a lesson's comments, opened separately). */
		kind: text('kind').notNull(),
		itemId: integer('item_id').notNull(),
		openedAt: integer('opened_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })]
);

/** The change log of a team: one row per edit, under the root it belongs to. */
export const teamChanges = sqliteTable(
	'team_changes',
	{
		id: mintedId('team_changes'),
		teamId: integer('team_id').notNull(),
		rootKind: text('root_kind').notNull(),
		rootId: integer('root_id').notNull(),
		actorId: text('actor_id').notNull(),
		at: integer('at').notNull(),
		verb: text('verb').notNull(),
		subject: text('subject').notNull(),
		subjectId: integer('subject_id'),
		beforeJson: text('before_json'),
		afterJson: text('after_json'),
		trashId: integer('trash_id')
	},
	(t) => [
		check(
			'team_changes_root_kind_ck',
			sql`${t.rootKind} in ('lesson', 'figure', 'routine', 'drill', 'song', 'team', 'position')`
		),
		check(
			'team_changes_verb_ck',
			sql`${t.verb} in ('add', 'change', 'remove', 'archive', 'restore', 'publish', 'share', 'unshare', 'delete', 'edit')`
		),
		index('team_changes_root_idx').on(t.teamId, t.rootKind, t.rootId, t.at)
	]
);

/** What a team removed, kept so it can be restored until purged. */
export const teamTrash = sqliteTable(
	'team_trash',
	{
		id: mintedId('team_trash'),
		teamId: integer('team_id').notNull(),
		kind: text('kind').notNull(),
		label: text('label').notNull(),
		rootKind: text('root_kind').notNull(),
		rootId: integer('root_id').notNull(),
		rowsJson: text('rows_json').notNull(),
		filesJson: text('files_json').notNull().default('[]'),
		sizeBytes: integer('size_bytes').notNull().default(0),
		deletedBy: text('deleted_by').notNull(),
		deletedAt: integer('deleted_at').notNull(),
		restoredAt: integer('restored_at'),
		purgedAt: integer('purged_at')
	},
	(t) => [
		check(
			'team_trash_kind_ck',
			sql`${t.kind} in ('video', 'section', 'link', 'spot-link', 'recording', 'position-link')`
		),
		index('team_trash_team_idx').on(t.teamId, t.deletedAt)
	]
);

/**
 * The last agreed state of two members of one family (a_id < b_id), as
 * field key to hash. The three-way compare reads it; Take and Send write it.
 */
export const clonePairs = sqliteTable(
	'clone_pairs',
	{
		kind: text('kind').notNull(),
		aId: integer('a_id').notNull(),
		bId: integer('b_id').notNull(),
		baseJson: text('base_json').notNull(),
		at: integer('at').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.kind, t.aId, t.bId] }),
		check('clone_pairs_order_ck', sql`${t.aId} < ${t.bId}`),
		check(
			'clone_pairs_kind_ck',
			sql`${t.kind} in ('figure', 'routine', 'drill', 'song', 'lesson', 'position')`
		)
	]
);

/** Keep in step, per copy: the switch and the four options (a missing row reads the defaults). */
export const cloneSync = sqliteTable(
	'clone_sync',
	{
		kind: text('kind').notNull(),
		rowId: integer('row_id').notNull(),
		on: integer('on', { mode: 'boolean' }).notNull(),
		names: integer('names', { mode: 'boolean' }).notNull(),
		small: integer('small', { mode: 'boolean' }).notNull(),
		sections: integer('sections', { mode: 'boolean' }).notNull(),
		media: integer('media', { mode: 'boolean' }).notNull(),
		at: integer('at').notNull()
	},
	(t) => [primaryKey({ columns: [t.kind, t.rowId] })]
);

/** What a copy last held per field (hashes), so a save knows which fields it changed. */
export const cloneMarks = sqliteTable(
	'clone_marks',
	{
		kind: text('kind').notNull(),
		rowId: integer('row_id').notNull(),
		fieldsJson: text('fields_json').notNull(),
		at: integer('at').notNull()
	},
	(t) => [primaryKey({ columns: [t.kind, t.rowId] })]
);

/** A person's own "same as": items of one kind that they treat as one. */
export const twins = sqliteTable(
	'twins',
	{
		userId: text('user_id').notNull(),
		kind: text('kind').notNull(),
		setId: text('set_id').notNull(),
		itemId: integer('item_id').notNull(),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.kind, t.itemId] }),
		index('twins_set_idx').on(t.userId, t.setId),
		check('twins_kind_ck', sql`${t.kind} in ('figure', 'routine', 'lesson', 'song', 'position')`)
	]
);

export type Figure = typeof figures.$inferSelect;
export type FigureGroup = typeof figureGroups.$inferSelect;
export type CountTake = typeof countTakes.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type SetRow = typeof sets.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LessonVideo = typeof lessonVideos.$inferSelect;
export type VideoSpot = typeof videoSpots.$inferSelect;

/**
 * What changed, for the device's pull (offline phase 2): one row per change to
 * a synced table, written by triggers (migration 0040), never by code. Keyed on
 * `seq`, so it does not mint ids. Pruned after 30 days.
 */
export const changeLog = sqliteTable('change_log', {
	seq: integer('seq').primaryKey({ autoIncrement: true }),
	tbl: text('tbl').notNull(),
	key: text('key').notNull(),
	op: text('op', { enum: ['i', 'u', 'd'] }).notNull(),
	at: integer('at').notNull()
});
