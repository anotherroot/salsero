# Positions as their own things — design

Agreed with the user on 2026-11-04, while reviewing the desktop boards. The boards
(desktop and phone) are the "Positions (new, a proposal)" area of
<https://claude.ai/artifact/MHiCSgC56gJSrsEsbyXQ4i>; its "Settled so far" box
lists the same decisions in one line each.

## Why

Positions today are a side list: one shared vocabulary per dance, edited only by
the admin, with a "neutral" position every untagged figure is assumed to start
and end in. The user wants them to be things of their own, like figures: their
own page, a type, the hold in detail, notes, a picture, links to video sections
and points and to lessons, and owned by each person and group with copies and
twins. They also want positions to be **optional**: useful to them, not for
everyone, so a person who never adds one must never be bothered by them.

## Goals

- Positions are owned like figures: each person's app and each group has its
  own, with everything clones and twins give a figure.
- Nobody starts with any. Templates (rough positions per type) and a "How
  positions work" explanation are always one tap away.
- A figure has **no position** until it is given one, and then fits anywhere.
  The neutral position goes.
- A figure starts in **any number** of positions and ends in **any number**
  (today it ends in exactly one).
- A position has one **type**, from the same list as a figure's. Timba joins
  salsa's types (Salsa, Son, Timba, Other) for figures too.
- Picking a figure's positions uses the shared picker, with the figure's own
  type first.
- Positions have a page, a place in Moves' switch, and a map.
- Video sections and points, and lessons, link to positions.

## Non-goals

- No desktop layout here. The desktop design
  (`2026-11-03-desktop-design.md`) is agreed separately and built later; build
  the phone screens, the desktop boards only show where things go.
- No "Use positions" switch in Settings: an unused Positions page costs nothing.
- The player does not change: it plays a routine's plan, not positions.

## Anti-goals

- A person who never adds a position sees a warning, a break, a gap or a nag
  anywhere because of positions.
- A figure's position tags pointing at a position its owner cannot read
  (another person's, a group they are not in).

## The model

### Positions

`positions` gains, additively (no CHECKs, no rebuild; `figures.end_position_id`
has a foreign key into it):

- `user_id`, `team_id`: exactly one set, as on every root table
  (`ownerIntegrity` covers positions too).
- `gene_id`, `cloned_from`: families, as on figures (unique per owner where the
  gene is not null).
- `style_tag`: the type, one of the dance's styles (`dances.ts`); null reads as
  the person's "New figures" type.
- `hands` ('two' | 'one' | 'none'), `crossed` (boolean), `facing` ('face' |
  'side' | 'shadow' | 'back'), `frame` ('open' | 'closed'): the hold, all
  nullable. Shown as chips ("Two hands · Crossed, right on top · Face to face ·
  Open") and as the picker's second line.
- `notes`.
- `picture_spot_id`: a video spot that is a point (`end_ms` null) used as its
  picture. Null: the first linked point, else no picture.

`neutral` and `slug` become vestigial (read by nothing, not dropped, like
`figures.style`). Drop the unique `positions_dance_slug_idx` (a DROP INDEX, not
a rebuild) and give new rows a unique slug of the builder's choosing. Names are
unique per owner among live positions, compared folded (`fold.ts`), as figure
names are.

Positions are archived, never deleted (Archive, Restore; a group's go to
Recently deleted). Archiving one leaves its figures' tags alone in the database
but they stop showing; a figure left with none has no position.

### A figure's positions

- `figure_start_positions` stays.
- New `figure_end_positions` (figure_id, position_id, primary key on both,
  indexed by position), filled from `figures.end_position_id` by the migration;
  `end_position_id` becomes vestigial.
- A figure's tags only point at positions of its own owner, or at a group's
  position the person may use (`usableOf`), as slots may use a group's figure.
  `crossRefs` checks it.

### No position

A figure with no start positions **can follow anything**; a figure with no end
positions **can be followed by anything**. That replaces "untagged reads as
neutral" in `src/lib/graph/graph.ts` and everything that reads it (the fit in
the routine picker, the seams and breaks in the routine editor, whether a
routine loops, the gap report, coverage). A person with no positions sees no
break anywhere.

### Any number of ends

The next figure fits after this one when one of its starts is one of this
one's ends, or either side has none. A routine slot's alternatives today must
share one end position; now they must share the same **set** of ends (compared
by family, below). A routine "starts in" the first slot's starts and "ends in"
the last slot's ends; it loops when the last slot's ends fit the first slot.

### Comparing positions across owners

A person's routine can mix their own figures with a group's (`usableOf`), each
tagged with its own owner's positions. The graph compares positions by
**family** (`gene_id`, falling back to the row id), not by row id: a group's
Hammerlock and your copy of it are the same hold. *Open question for the user,
do not build until answered:* should twins (Same as…) also count as the same
position in the graph? The boards said so, but "Twins are views" (CLAUDE.md)
says the graph reads rows as they are.

### Types

Add `timba` to salsa's styles in `dances.ts` (Salsa, Son, Timba, Other), for
figures and positions. Bachata's stay as they are.

### Links

- Video sections and points: a new table `spot_position_links` (spot_id,
  position_id, unique on both). Not a column on `spot_links`: its target CHECK
  would need a rebuild with a new column, which the CHECK rule forbids. A
  linked spot refuses to delete until unlinked, as `assertUnlinked` does for
  figure links.
- Lessons: a new `lesson_positions` join table for hand links, like
  `lesson_figures`. A lesson also reaches the positions its sections link to,
  derived as `lesson-links.ts` derives figures (the "via section" badge).
- Group rows only link group rows of their own group; a person's lesson may
  link a group's position they may use.

### Templates

A code registry (`src/lib/positions/templates.ts`), per dance and type: rough
positions with a name, a one-line description and the hold fields. Salsa has
Salsa, Son and Timba sets; the user's boards have the names. Bachata's sets are
the builder's draft, for the user to review. Adding a template's positions
skips the names the owner already has (folded) and gives each the template's
type.

## Ownership, clones and twins

Positions join the root tables everywhere figures are:

- **Wall and access.** `ownedBy`, `inSpace`, `spaceOfRow`; a
  `requirePositionAccess` guard and `positionAccess` in `access.ts`. What a
  member reads of a group's positions: those that a published lesson reaches,
  through its figures' tags, its hand links or its sections' links.
- **Group mode.** Inside a group, Positions shows only the group's, and new
  ones are the group's. A group's figures are tagged only with the group's own
  positions.
- **Every group mutation is logged** (`logChange`, `MUTATIONS` in
  `changes.spec.ts`); `team_changes.root_kind` needs 'position'. That is a CHECK
  on an existing table: the same rebuild migration `0025` did, safe only while
  the columns are identical and nothing has a foreign key in or out. Check
  that again before writing it; otherwise ask the user.
- **The clash check:** a save on a group's position carries `seen` over every
  field it writes.
- **Clones.** Copy to…, Make it mine (Edit on a group's position: your figures
  tagged with theirs move to your copy), Compare, Take, Send, Drop my copy,
  Detach, Move to… a group, `flat.ts` fields for Compare. **The copy engine
  carries positions with figures:** copying a figure into another place tags the
  copy with that place's member of each position's family (`memberIn`), and
  copies the position there when the place has none. The rescue and Keep do the
  same.
- **Twins.** Same as… for positions. `twins.kind` has a CHECK listing the
  kinds: adding 'position' is the same rebuild question as `team_changes`.

## Moving today's data

Once, at boot, idempotent (an `app_flags` marker), in one transaction:

1. The shared positions become the admin's own (`user_id` = the admin). The
   admin's figures keep their tags.
2. Every other owner (person or group) whose figures use a shared position gets
   their own copy of each one they use (its own gene, no `cloned_from`), and
   their figures' start and end tags are repointed to the copies.
3. `figures.end_position_id` is copied into `figure_end_positions`.
4. Untagged figures stay untagged and now have no position.

Report counts in the boot log, as the integrity checks do.

## Screens (phone; the desktop boards show the same at 1440)

- **Moves' switch** is Figures | Routines | Positions. The Positions and
  Coverage tiles on Figures become Coverage alone. + on the band is New
  position when Positions is showing.
- **The list:** a line "31 of 41 figures have positions", Templates and How
  positions work, search, a chip per type and Gaps (dead ends, orphans and
  islands), then **No position · N figures** (opens the figures with none, then
  those with only a start or only an end, each with + Positions), then Yours,
  then each group's under its heading.
- **Nobody has any:** an empty state with Start from a template, New position
  and How positions work.
- **A position's page:** the picture, the hold chips, notes, Figures from here
  (+ New figure from it) and Figures into here, then linked video (sections and
  points), lessons, routines through it. Copy to… and Same as… as a figure has.
  A dead end or orphan says so, with New figure from it.
- **Edit / New position:** name, type (one), the hold, notes, the picture,
  Archive.
- **Templates:** a sheet with Salsa | Son | Timba, the positions ticked, the
  ones you have marked "You have it", Add N positions.
- **How positions work:** a sheet: a small example (Cerrada → Dile que no →
  Abierta), what a position is, why figures are tagged, types, optional, where
  to start.
- **A figure:** Starts in and Ends in are field pickers that take any number;
  empty reads "No position · fits anywhere". On the figure's page the positions
  are links to their pages.
- **The position picker** is the shared picker (`2026-10-30-unified-pickers-design.md`),
  a field picker that takes any number: search; groups No position, "<type> ·
  this figure's type", the other types, each group's; the hold as the second
  line; a tap toggles ✓; No position clears; Not in the list? + Position (a New
  position step on top, type preset to the figure's, then chosen); Done · N.
  This is a new kind of field picker (many values): add it to the pickers spec.
  The New position step posts JSON to `POST /api/positions`, which makes the
  position in the figure's owner's space (a group's figure: the group's), not
  to a page action: the picker sits inside the figure's form. A person's
  figure offers their own positions and the group positions they may use
  ("Salsa Tuesdays’", each "<type> · tag with it as it is"); a group's figure
  only the group's. Every chosen live tag is offered, so it can be removed.
- **Lessons:** a Positions group after Figures, Routines and Exercises (linked
  by hand or via a section). The Link popup offers positions with figures and
  drills, and Use this moment as a point.
- **The map** (Positions' nothing-open view on desktop, a page from the list on
  the phone): a force layout computed in the browser, a small pure module
  (no new dependency): Fruchterman–Reingold over the main connected part,
  400 steps from the same start (a circle in name order) so it never jumps
  between visits, then a pass that pushes circles and labels apart. Circles
  sized by how many figures go through, coloured by type; arrows by how many
  figures. Dead ends (solid red ring) and orphans (dashed) are marked in place;
  islands (cut off from the rest), positions with no figures and No position · N
  sit in a tray under it. A tap lights a position's figures in and out and fades
  the rest; a second tap opens it. Pinch to zoom on the phone.

## Left to the builder

The migration's exact SQL, slugs for new rows, the bachata templates (for the
user to review), the map module's maths beyond what is above, where the
template registry lives, and the order of the work. Keep the hard rules in
CLAUDE.md: additive migrations, archive don't delete, data functions take `db`
first, raise `PAGE_EPOCH` when a form changes, and keep this spec and the main
design spec current.
