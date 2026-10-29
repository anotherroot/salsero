# A figure is its variations — design

> **Status:** approved in brainstorming, 2026-10-29. Changes
> [`2026-09-29-figure-variations-design.md`](2026-09-29-figure-variations-design.md),
> which stays the design for figure timing; its "Data model", "A variation's
> fields", "Rules" and "The figure page" sections are replaced by this
> document. It also absorbs a separate, unbuilt idea ("name the Basic
> version"), which is dropped as its own piece of work.
>
> Mockups: the "Figure versions" canvas,
> https://claude.ai/artifact/L5xC4YFb4v3VazC3cveo2m — **row 3, G to K, is the
> design.** Rows 1 and 2 (A to F) are earlier rounds, kept for the record.

## Purpose

Today a figure is one special version ("Basic", which is the figure row
itself) with variations hanging off it. A variation copies anything it leaves
blank from Basic, and its partner, style, links, lessons and practice are
always Basic's. That causes three problems:

1. **There is no real "basic" version of most figures.** Calling the first
   one "Basic" is wrong, and it cannot be renamed.
2. **A variation cannot leave.** A variation that turns out to be its own
   figure, or a figure that turns out to be a way of dancing another one,
   can only be rebuilt by hand, losing its videos, sections, routine slots
   and practice history.
3. **The version tabs sit at the top**, while everything else on the page is
   used near the bottom of the phone screen.

The new model: **a figure is a name holding one or more variations. Each
variation stands on its own, and a variation can move to another figure or
become a figure of its own.**

## Decisions taken in brainstorming

These are the user's:

- **No variation is special.** There is no "Basic". You are always looking at
  one variation of a figure.
- **Every variation has a name**, and it is required.
- **Nothing is copied or inherited between variations.** Each has its own
  partner, style, start positions, end position, start count, length,
  directions, recordings, sections, **links, "Taught in" lessons and
  practice**.
- **A label always shows both names**: "Enchufla · Doble", and "Setenta ·
  Basic" even when a figure has one variation.
- **"+ New variation" on the figure page copies the variation you are on.**
  A figure created anywhere else (the figures list, a lesson) starts blank.
- **Moving is one action: "Move to…"**, with two destinations: a new figure
  of its own, or another existing figure.
- **A figure with no variations left is gone.** Moving or archiving its last
  variation warns first ("Enchufla Doble will be removed").
- **The version switcher is at the bottom of the screen** (option A from the
  first round, moved down): a bar pinned to the bottom with ‹ › and the
  current variation's name; tapping the name opens a sheet listing every
  variation.
- **"Move … to…" sits at the end of the scrollable page**, not in the sheet
  and not in Edit.

## Non-goals

- No change to timing, the graph's algebra, routines' rules, or the player.
- No nested figures: a figure holds variations, a variation holds nothing.
- No merging two figures in one step. Moving variations one at a time, until
  the old figure empties and goes away, is how two figures become one.
- No new way to delete anything. "Gone" means archived.

## Anti-goals

It fails, however well it works, if:

- **any existing routine changes how it dances, or gains a break** at the
  migration. Every variation must end up with exactly the values it
  effectively had before.
- **a move loses anything**: a recording, a section link, a routine slot, a
  set, a lesson link.
- **a variation becomes invisible**: archived without the user archiving it,
  or reachable from nowhere.

## Vocabulary

On screen: a **figure** has **variations**. In the database, after this
change:

- a `figures` row **is a variation** (the table keeps its name: it cannot be
  rebuilt, see `CLAUDE.md`);
- a new `figure_groups` row **is a figure**: its name and its dance.

Code should say "variation" for a `figures` row and "figure" or "group" for a
`figure_groups` row. Ids stay meaningful: every existing figure id, base or
variation, keeps pointing at the same way of dancing, so routines,
recordings, sections, lessons, links, exercises and old URLs all keep working.

## Approaches considered for storing the figure

- **A — a new `figure_groups` table, each variation points at it (chosen,
  builder's call made in brainstorming).** Moving a variation is changing one
  column. No variation is privileged in storage either, so the screen and the
  data agree.
- **B — keep `parent_id`, the first variation stays the head row.** No new
  table, but moving the head variation away while others stay means promoting
  another row: swapping names, re-pointing every sibling. The head row would
  hold both the figure's name and its own variation name. Rejected as the
  same special case this change removes.

## Data model

All additive, per `CLAUDE.md`: one new table, one `ADD COLUMN`, no CHECK on
an existing table, no rebuild.

```
figure_groups                      -- a figure
  id           integer primary key
  dance        text not null       -- same wall as every other dance-carrying table
  name         text not null
  archived_at  integer             -- null while it has a live variation
  created_at   integer not null

figures                            -- a variation
  + group_id   integer REFERENCES figure_groups(id), nullable in SQL,
               always set by the data layer; indexed
    name       now the VARIATION's own name ("Doble", "Basic")
    parent_id  VESTIGIAL from here on: read by nothing, not dropped
```

A CHECK on the new table is fine (it is new), but there is nothing worth one.
Every invariant below is enforced in the data functions, as the rest of this
table's are.

### Invariants (data layer, each with a test)

- Every live variation has a live group of the same dance.
- Every live group has at least one live variation. Whatever archives or moves
  a group's last live variation archives the group in the same transaction.
- A variation's name is non-empty and unique among its group's live
  variations, compared the way `variationNameTaken` compares today.
- **A figure's name is unique among its dance's live figures**, compared the
  same way (the user's decision). "New figure", "Move to… a new figure" and
  renaming a figure in Edit are refused with "There's already a figure
  called Enchufla." The same name in the other dance is fine.

### The migration

One migration, structure then data, in SQL:

1. Create `figure_groups`; add `figures.group_id` and its index.
2. One group per base figure (`parent_id is null`), with that figure's
   `dance`, `name`, `archived_at` and `created_at`. **Except:** a group stays
   live while any of its variations is live, even when its base figure is
   archived (my call; today's code cannot make such rows, but hand-edited
   data might). The anti-goal wins over the step. **Suggested:** reuse the
   base figure's id as the group's id, so step 3 is
   `group_id = coalesce(parent_id, id)`. The builder may do it another way.
3. Point every row at its group: a base figure at its own, a variation at its
   parent's.
4. **Write the inherited values into each variation**, so nothing reads
   through a parent again:
   - no start-position rows → copy the parent's rows (a parent with none
     leaves the variation with none, which now means neutral, as it did);
   - `end_position_id` null → the parent's (null stays null: neutral);
   - `start_count`, `length_counts` null → the parent's;
   - `partner`, `style_tag` → the parent's, always (a variation's own values
     were never used).
5. **Name every base figure's own variation "Basic"**, its group keeping the
   figure's name. Where a group already has a live variation called "Basic",
   the builder picks another name and says which.
6. **Duplicate figure names get a number.** Where two live groups of one
   dance share a name, every one after the first (by id) gets " 2", " 3"…
   appended, and the builder reports which were renamed so the user can
   tidy them.
7. **Exercise names follow the label**: every `source = 'figure'` exercise is
   renamed "<group name> · <variation name>".

Links, lesson links, exercises, recordings, sections and routine slots need
no data step: they already point at the variation that owns them. A base
figure's links, lessons and practice therefore stay with its "Basic"
variation, and the other variations start with none.

Read the generated SQL before committing it, and run the migration against a
copy of the real database: check that every live variation has a live group,
that no live routine gains a timing or position break (compare
`buildGraph` before and after), and that the "Basic" name never collides.

## Rules

### Creating

- **A new figure** (the figures list's "New figure", a lesson's new-figure
  form) creates a group and its first variation in one transaction. The form
  asks for the figure's name **and** the variation's name, both required,
  plus partner, style and directions, as today. Everything else is blank:
  neutral start and end, starts on 1, 8 counts. From a lesson, the new
  variation is linked to the lesson, as the figure is today.
- **A lesson's "Variation of a figure"**: the lesson's new-figure sheet has a
  switch at the top, "New figure" | "Variation of a figure". The second mode
  picks one of the dance's live figures (a search and the list, as in Move
  to…) and asks for the variation's name, partner, style and directions. It
  makes a **blank** variation in that figure (`createVariationIn`: neutral
  start and end, starts on 1, 8 counts — not a copy of a sibling) and links
  it to the lesson straight away. The name must be free in that figure.
- **"+ New variation"** on the figure page copies the variation being viewed:
  partner, style, start positions, end position, start count, length and
  directions. It copies **no** recordings, sections, links, lesson links or
  practice. The sheet asks only for the name, required and unique in the
  figure. Success opens the new variation.

### Editing

- One Edit form per variation, one Save, `use:guarded` as now. Fields:
  **figure name** (renames the figure for all its variations), **variation
  name**, partner, style, directions, start positions, end position, start
  count, length. "Same as Basic" choices and "(as Basic)" marks are gone. A
  blank position means neutral; blank timing means 1 and 8.
- Renaming the figure or a variation renames the matching exercises, so
  `exercises.name` always equals the label.

### Moving

- **`moveVariation(db, id, target)`**, the target being an existing live
  group of the same dance, or a new figure name.
- To an existing figure: refused when the target has a live variation of the
  same name ("Enchufla already has a Doble. Rename one first."), or when the
  target is the variation's own figure.
- **Joining a figure can rename the variation on the way in**: the target may
  carry a `name`, and the variation is renamed in the same transaction. The
  target's names are checked against the new name, and the exercise takes the
  new label.
- To a new figure: creates the group with the given name and moves the
  variation into it; the variation keeps its own name.
- Everything the variation owns goes with it, because it all points at the
  variation's id: recordings, sections, links, lesson links, its exercise and
  sets, routine slots. Its exercise is renamed to the new label.
- **The last live variation leaving archives its old figure** in the same
  transaction. The screen warns before (mockup J).
- Moving across dances is impossible: the target is looked up within the
  variation's dance, behind the existing dance-wall guards (`scope.ts`).

### Archiving

- **"Archive <variation>"** at the end of the page archives that variation
  and its exercise, as today. If it is the figure's last live variation, the
  same warning as a move shows, and the figure is archived with it.
- **There is no "Archive figure" any more** (my call): a figure is archived
  by archiving its variations. Say so if this should come back.

### Practice, lessons, links

- **Practice is per variation.** `addFigureExercise` works on any live
  variation. Today, the exercise page and the log popup show the label.
- **Lessons link variations.** A lesson's figure picker lists every live
  variation by label; `linkFigure` accepts any live variation of the lesson's
  dance (the variation refusal goes). "Taught in" on a variation's page lists
  the lessons linked to that variation only.
- **Links are per variation**, shown and added on each variation's page.

### Everywhere else

- **Labels**: `figureLabels` and `listVersions` return "Figure · Variation"
  for every variation.
- **The graph**: `buildGraph` no longer resolves anything; every live
  variation is a graph figure with its own values. The positions page, the
  gap report and coverage count variations exactly as they do now.
- **The routine editor's picker** keeps its single list (my call, so the
  routine-editor spec's "Grouping and search" still holds). Variations are
  grouped by `group_id` where they were grouped by `parent_id`
  (`src/lib/routines/fit.ts`). A figure with several variations is a heading
  that cannot be picked, with its variations as rows under it. A figure with
  one variation is a single row with its label. There is no second step.
- **Bare names**: every place that prints a variation's `name` alone (the
  practice content, a lesson's figure list, and any other the builder finds)
  prints the label instead. Otherwise "Basic" shows everywhere.
- **The player** keeps saying what it says today.
- **The positions page's "tagged x/y" count** counts variations.
- **Section links** stop falling back to the parent's sections
  (`spot-links.ts`): a variation shows its own.
- **Every list "excluding variations"** now lists groups or variations
  explicitly, whichever it means. Each place that filtered on
  `parent_id is null` is reviewed, not just flipped.

## The screens

From the canvas, row 3.

### The figures list

One row per live figure: its name and how many variations it has.
Filters (my call): the search matches the figure's name or any of its
variations' names; style and partner match a figure if any live variation
matches. Tapping a figure opens its first live variation (lowest id).

### The figure page (G, K)

- **URL**: `/[dance]/figures/[variationId]`. A variation id is the only id in
  a URL. Old links with `?v=<id>` redirect to `/figures/<id>`; old base-figure
  ids already are variation ids (their "Basic").
- **Header**: back, the figure's name with the variation's name under it,
  Edit.
- **Body**, all the variation's own: partner and style, timing, handholds,
  directions, Practice, Follows from / Leads to, Recordings with "+ Add video
  or audio", Sections, Links, Taught in.
- **End of the page**: a full-width "Move <variation> to…" row ("A new figure
  of its own, or another figure"), then "Archive <variation>" in red.
- **The bottom bar**, pinned, safe-area aware, with bottom padding on the
  page so it never hides the last row: ‹ and › step through the figure's live
  variations in id order (wrapping), and the middle shows "<variation>" over
  "2 of 3 variations". It is shown when the figure has one variation too, so
  "+ New variation" is always one tap away.

### The variations sheet (H)

Opened from the bar's middle. "Variations of <figure>": one row per live
variation with its handholds, timing and video count, the current one
marked; tapping a row opens it. "+ New variation" at the bottom opens the
name sheet. No move or archive actions here.

### Move to… (I)

A sheet. First choice "A new figure of its own", which shows a figure-name
field prefilled "<figure> <variation>" (e.g. "Enchufla Doble"). Below, "Or
join a figure": a search and the dance's live figures with their variation
names. Picking one shows a "Name in <figure>" field under the list,
prefilled with the variation's name. It is checked live against that
figure's variation names (trimmed, case-insensitive): a clash shows
"<figure> already has a <name>. Pick another name." and the button stays
disabled until the name is free and not empty. The button reads "Make it its
own figure" or "Move to <figure>".

### The last-variation warning (J)

Shown instead of moving or archiving straight away when the variation is its
figure's last: a red box "<figure> will be removed. <variation> is its last
variation", then what goes with the variation and how it will be labelled.
The button is red: "Move and remove figure" (or "Archive and remove figure").

## Testing

Test-first, pure and data layers, as the rest of the repo.

- **Migration**, against a fixture built with the pre-migration schema: base
  figures become groups; variations land in their parent's group; every
  inherited value is written (start rows, end, start count, length, partner,
  style); base variations are named "Basic"; exercise names follow; the graph
  of every routine is identical before and after.
- **Invariants**: name required and unique per figure; figure names unique
  per dance (refused on create, move to a new figure and rename; allowed
  across dances; duplicates numbered by the migration); same dance as the
  group; a group's last variation leaving or being archived archives the
  group; never a live variation in an archived group.
- **`moveVariation`**: to a new figure; to another figure; name clash
  refused; own figure refused; cross-dance refused; everything owned stays
  attached (recordings, sections, links, lesson links, exercise, routine
  slots).
- **New variation**: copies exactly the listed fields and nothing else.
- **Lists**: figures list one row per group with the filters above; lesson
  picker lists variations; labels always "Figure · Variation".

## Documentation this changes

- `2026-09-29-figure-variations-design.md`: a status note pointing here;
  inheritance, "Basic" and version tabs marked replaced.
- `2026-09-22-salsa-app-design.md`: a pointer here.
- `CLAUDE.md`: the live line; the hard rule "A variation is a `figures` row
  with `parent_id`…" is replaced by "A `figures` row is a variation; a
  `figure_groups` row is a figure. Every live variation has a live group of
  its dance; `parent_id` is vestigial." The rule that a figure's exercise is
  renamed and archived with it now speaks of the variation.

## Left to the builder

- How to split this into deployable slices, if at all. The migration and the
  data rules must ship together; the bottom bar could ship separately.
- The exact SQL of the migration (the id-reuse suggestion included).
- What to call the base variation when "Basic" collides.
- Component structure of the bottom bar and sheets.
