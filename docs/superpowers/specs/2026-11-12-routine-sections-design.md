# Routines: sections, nesting, and a calmer editor

Board (every page drawn, with today's screenshots beside it):
https://claude.ai/artifact/A2cJERhq3znfqhXkKNTXYz (version 13, "The design as
decided"). Rounds 1–12 of the same board are where each choice was made. This
spec amends the routines design (2026-09-24), the routine editor
(2026-10-01) and the routine lift (2026-11-11). Where they disagree, this one
wins.

## Why

The editor had grown features one at a time, and some of them no longer made
sense together. The user wants routines to be intuitive. What triggered it:

- **Parts of routines repeat.** The user's own routine "Learning pa ti pa mi
  and adios" has Enchufla · Exhibela · Dile que no twice (slots 4–6 and
  11–13). They want to grab a run of slots, make it a piece, and reuse it,
  without it cluttering the Routines list.
- **Selecting disorients.** A long press on a second slot right next to the
  first makes the page jump, and so does deselecting. Only selections with a
  gap between them are calm. The cause: neighbours join into one piece with a
  "Slots 3–4" header, and a toolbar and a "Tap other slots" line come and go
  between the cards. The heights above the finger change, and the "Nothing
  jumps" fix misses them.
- **Duplicate is invisible.** The copies just appear, with no motion, no
  sign of where they went, and no Undo.
- **Alternatives cost more than they give.** The player calls one of a slot's
  alternatives at random each time through. In the backup of 2026-11-06 only
  one slot in one routine (bachata, "Corner step into closed hipwork") uses
  them, yet most of the editor's rules and visuals exist for them. Added to
  sections, they multiplied. The user decided to drop them.

## Goals

- A **section**: a run of slots grouped into one piece, made from a selection
  in one step, with no name required, and never shown in the Routines list.
- **Nesting** as deep as you like: a section or routine inside a section
  inside a routine, and so on. The one rule is that nothing may end up inside
  itself.
- Clear ways between the three levels: slots → section (Section), section →
  slots (Unpack), section → routine (Make routine), routine → section (Turn
  into a section).
- **Reuse:** a named section can be put in other routines, and stays one
  shared section.
- An editor where nothing jumps under the finger, every change can be undone,
  and you can always see where you are, even deep inside.
- A Routines list that reads like the Figures list.

## Non-goals

- **Alternatives.** They are removed, not redesigned (see "Alternatives go").
  A random "any variation" switch was discussed as a replacement and not
  chosen.
- The player. It keeps calling a routine's figures in order. Sections and
  nesting change only what it walks (it walks the same flattened sequence).
- Grouping the Routines list by start position: saved as an idea in the notes
  for later.
- The band at the top of the pages (back, title, pencil, ⋯) stays as it is
  today. The ✎ in the board's drawings is a stand-in, not a change.

## Anti-goals (would make it a failure even if it works)

- A tap, long press or deselect that moves the card under the finger.
- A deep nesting that turns the screen into a dark red stack, or eats the
  width with indentation.
- A section changed in one routine silently changing another without the
  user being told.
- Losing the user's existing routines, slots or history in the move.

## The concepts

- **Routine**: as today. It's in the Routines list, it can be practised (it
  has its exercise, it comes up on Today), and lessons can link to it.
- **Section**: a building block. It lives only inside routines (and other
  sections). It is never practised on its own: no exercise, no Practise card,
  never on Today, never in the Routines list. It may have a **name** or none.
  - **Unnamed:** belongs to the one place it sits. Never offered in pickers.
    Duplicating a slot that holds it gives an independent copy.
  - **Named:** offered in the picker of every routine. Used in two places it
    is **one shared section**: an edit anywhere shows everywhere.
    **Detach here** gives one place its own copy, which keeps the name, and
    edits stop flowing between the copies.
- **A slot** holds exactly one thing: a figure, a section, or a routine.
  There are no alternatives any more.
- **Nesting**: any depth. Refuse anything that would put a routine or
  section inside itself, directly or further down. That includes the
  picker, a drag, Section, Make routine and Turn into a section.

## Pages

### 1. Moves → Routines (L4)

Each row has three lines:

1. The name.
2. **Start → end** position (end in the accent colour). When it ends where it
   starts, the position shows once, followed by a green **↻**.
3. **n figures · n eights**, counting the figures inside sections and
   routines all the way down. The break badge only appears when something
   doesn't connect.

Sections never appear here.

### 2. A routine's page

**A closed slot.** Every slot is a white card, as today.
- A **section's card**: the brace icon (board round 4, I3) before its name,
  in the accent colour, then the name, or "Section" in grey italics when
  unnamed. Line 2: from count → to count · ⇥ end, like a figure. Line 3:
  n figures · n eights.
- A **routine inside** reads the same, with today's route icon in place of
  the brace.
- A round **▾ button** on the right of a section's or routine's card opens it
  in place. It is the only control that opens or closes it.

**Opened in place (G2 + H1).**
- An open section or routine becomes a **rounded panel**. Its own card stays
  the panel's first card (white, with ▴), and its slots follow.
- The panel's colour is **light and solid**, mixed with the page colour, never
  see-through, so nesting never darkens.
- One colour per level, repeating every 4: clay, ochre, wine, blue (the board
  uses the app's accent, warn-ish ochre, the bachata wine, and the "easy"
  blue). A **routine inside** is always grey. Each panel has a 1 px edge in
  its colour. The card's number circle and icon take the panel's colour.
- Each level sits **3 px further in** on both sides. Nothing else is
  indented, so the slots inside keep their full width.

**Depth limit for opening in place: 4 levels.**
- A section at level 5 or deeper shows as a closed card. In place of ▾ it has
  a **↗** button, with the line "Level 5: opens on its own page".
- On its own page it counts from level 1 again.
- Nesting itself has no limit.

**"Where am I" bar (G3's bar).**
- Once you scroll so that the top of the list is inside an open section, a
  bar pins to the top of the scrolling area.
- It has one row per level, each with a dot in that level's colour. It shows
  the deepest three, plus "n more above" when there are more. The deepest
  row is in the accent colour, with "level n" at its right.
- It goes away when the top of the list is outside every section.
- It sits under the band, not at the very top edge of the screen. The
  Android status bar is drawn over the band, so a strip there looks like a
  dev banner.

**Numbers.** Each panel numbers its own slots 1, 2, 3. "Slots · n" in the
heading counts the routine's top-level slots.

**Seams** between slots that don't connect stay as they are today. Inside a
panel they work the same way, between that panel's slots.

### 3. Tapping a slot

A tap lifts what you tapped, and the rest steps back (dims), as in the
routine-lift spec. Long press still selects. The ▾/▴ button only opens and
closes.

The **↗ Open** cell is first in every toolbar, for figures and sections
alike. It goes to the figure's or section's own page. "Open ›" leaves the
card's header.

- **A figure:** Open · then the cells it has today when the slot sets them
  (length: How long?; end: Where does it end?) · Before n · After n.
  + Alternative is gone.
- **A closed section or routine (K1):** its card lifts. Toolbar: Open ·
  Unpack · Before n · After n. A shared one gets the line "Also in
  Social mix · changes show in both" above the toolbar.
- **An open section or routine (K2):** the whole panel lifts with its slots,
  so you can see exactly what Unpack, Before and After act on. The toolbar
  sits under its card, above its slots.
- **A slot inside an open section (T1):** it lifts like any slot. A line
  reads "In Enchufla → Dile · changes show in 2 routines" (the second part
  only when shared). The section's panel dims with the rest.

### 4. Selecting (J1), Section, Duplicate (D1)

- **Nothing changes height.**
  - A selected card gets a shadow and a filled check in place of its number.
    Unselected cards dim, and their number becomes a dashed ring.
  - Neighbours **merge**: the gap between them fills with the card colour,
    the inside corners go square, and a hairline sits on the seam.
  - Gone: the "Slots 3–4" header, the "Tap other slots to add them" line,
    and the toolbar between cards.
- **The toolbar always docks at the foot of the screen** (the tab bar steps
  aside), with a line above it: "1 selected · tap other slots to add them",
  "Slots 3–4 selected", or the reason a greyed action is greyed.
- **Toolbar: Before · After · Duplicate · Section · Delete.**
  - **Section** replaces Make routine.
  - Section, Before and After need slots next to each other. Greyed, they say
    why when tapped, as today.
- **Section:** the selected slots become one **unnamed** section in their
  place, right away. The new card glows (accent wash) and fades over about
  2 s. Toast: "Made a section of 2 slots · Undo".
- **Duplicate (D1):** the copies land right after the last selected slot,
  growing in, tinted, and fading to normal over about 2 s. The page scrolls
  them into view if needed, and the selection ends. Toast: "2 slots copied
  after slot 4 · Undo".
- **Undo appears after changes only:** move, delete, add, rename, duplicate,
  Section, Unpack, Detach. Never after selecting or deselecting.

### 5. Dragging (spring-open)

- Over the top or bottom part of a closed section's card, a drop goes
  before or after it, as today.
- **Holding over the middle of the card for about 0.6 s** fills a ring around
  its ▾. Then the section springs open and the landing gap appears inside the
  panel. Moving off before the ring fills cancels it.
- Inside an open panel, dragging past its top or bottom edge moves the gap
  back out to the parent.
- **After the drop:**
  - Dropped inside, the section stays open.
  - A section that only opened for the drag closes again when you drop
    elsewhere.
  - Dropping into a shared section toasts "Added to Enchufla → Dile · shows
    in 2 routines · Undo".
- **Refused:**
  - It never springs open past level 4.
  - It never springs open when what is dragged would end up inside itself.
  - The card shakes slightly, and a line says why.

### 6. A section's own page

- It opens like a routine page, with the band as today: the title is the
  name, or "Section". The subtitle reads "Section · n figures · n eights".
- **No Practise card.**
- At the top, a tinted pill: "In 2 routines: Learning pa ti pa mi…, Social
  mix". Each one is tappable and goes there. No pill when it's used in only
  one place.
- "Starts from X · ends at Y", then its slots, edited exactly like a
  routine's, nesting included.
- **⋯ menu:**
  - **Rename**, or **Name** when it has none.
  - **Make routine:** it becomes a routine in the Routines list, practisable,
    with its exercise.
  - **Detach here:** only when it's used in more than one place, and only
    when the page was opened from a routine, so "here" is known.
  - **Unpack into <routine>:** its slots go back where it was. An unnamed
    section is then gone. A named one stays wherever else it's used.

### 7. The picker (adding a slot)

The Routines tab lists:

1. **This routine's** named sections first.
2. Then **other routines**, each followed by its named sections. These are
   indented, with the brace icon and "Section of <routine>", so two sections
   with the same name are easy to tell apart.

- Unnamed sections are never offered.
- Anything that would put this routine inside itself is left out.
- The fit rules (start count, hold) apply to sections the same way they
  apply to routines.

### 8. A routine becomes a section

- It's in the routine's ⋯ menu: **Turn into a section**.
- If only other routines use it, the sheet is a plain "Turn Adios drill into
  a section?" with the button and Cancel.
- Otherwise it lists every connection first: "Used in 2 routines (they keep
  it as a section)", "Linked in 1 lesson", "Practised 14 times", plus a
  group's share if there is one.
- **What happens (the user's decision):**
  - Its **exercise is archived, with its history kept**. It leaves Today.
    Make routine later gives it a fresh exercise, as a new routine gets one.
  - **Lessons lose the link**, and the warning names each lesson.
  - A group member's own copy of it stays a routine in their space: it's
    theirs.
- **Only offered when at least one routine uses it** (my call). A routine
  used nowhere would become a section no routine holds, which would be
  archived at once (see "A named section used nowhere").

### A named section used nowhere

When a named section's last use goes (its last slot deleted, or Unpack from
its last place), the section is **archived** (the user's decision). It goes
to Recently deleted like an archived routine and can be restored from there,
and pickers stop offering it. An unnamed section has only one place, so it is
simply gone with it.

### Which place is "here", and what counts (my calls)

- **Detach here** and **Unpack** act on **the one slot** the section was
  opened or tapped from, even when the same section sits in that routine
  twice (the user's own routine would, at slots 4–6 and 11–13). The section
  page therefore knows the slot it came from (`routine_steps` id), not only
  the routine.
- "In 2 routines" and "changes show in 2 routines" count **real routines**
  (not sections) that hold the section **at any depth**, each routine once.

### Groups and copies (my calls)

A section travels exactly as a routine inside a routine does today:

- Copying a routine (Copy to…, Keep, the rescue) copies its sections along,
  the way children are copied today, at any depth.
- Only a group's editors change a group's section. Inside a member's own
  routine it is read-only, as an embedded group routine is today.
- Reach runs through the group routines that hold it.
- **Detach here makes a plain copy**, not a clone-family member. In code it
  must not be confused with the clones' own "Detach" (`clone_pairs`).

### Routines made earlier with Make routine

They **stay routines** (the user's decision). Inside their parent they show
as grey routine panels. The user can turn any of them into a section.

## Alternatives go

- The editor stops offering them: + Alternative, the OR rows, the "or …"
  line on a card, How long? on an alternative, alternatives in the picker
  context. So does the AI connector: any tool or proposal that adds a slot
  option beyond the first. Check `src/lib/server/mcp/`.
- **Existing data.** A slot with several options keeps its **main figure**:
  its first option by `created_at`, then `rowid`, the same rule as today's
  "main". The other options are removed. Today that is one slot in one
  bachata routine.
- `routine_step_options` stays as a table (no drops). A slot still has one
  option row. Its `length_counts` keeps working.
- The player's `choose` among options simply always has one.

## Constraints (from the hard rules; read docs/hard-rules.md)

- **Schema changes** are additive `ADD COLUMN` only, with no CHECK on
  existing tables. `routines.name` is NOT NULL: an unnamed section stores the
  empty string, or the builder finds another additive way. Read the
  generated SQL.
- **Every insert** mints its id (`mintedId`). A new table gets a mark
  trigger.
- **Offline:**
  - Every table is classified in `src/lib/sync/tables.ts`.
  - A newly synced table, or a column that must sync, needs its triggers in a
    new custom migration (`scripts/sync-triggers.ts`). Never edit 0042.
  - Every new action and endpoint is classified in `src/lib/offline/routes.ts`
    (`ACTIONS`, `ENDPOINT_WRITES`), runs on the device first and replays via
    `/api/sync/push`.
- **Groups and walls:**
  - Sections live in a person's space or a group's, like routines (`scope.ts`,
    `usableOf`, `mayHold`).
  - A group mutation calls `logChange` in its transaction and is listed in
    `MUTATIONS`. Group saves carry `seen`.
  - Clones and copies (`flowing`, `flowAfter`, gene ids) apply to sections as
    they do to routines.
  - A person's routine may hold a group's named section the way it may hold a
    group's routine today.
- **Archive, don't delete.** Unpacking an unnamed section, and undoing a
  Section, must go through the listed hard-delete rules or archive. Check the
  list in docs/hard-rules.md before choosing.
- **Words** go through `t()` in en and sl. In Slovenian a section is
  **»sklop«** (the user's choice; »odsek« is a video's section and »del« a
  song's part). Add it to the glossary in `sl/index.ts`.
- **Raise `PAGE_EPOCH`** in the commit that breaks older open pages.
- **Screens** get real screenshots before and after (scripts/shots), and the
  routine-lift scenes (`ext_routine_lift.py`) are updated for J1: no jumps,
  no header.
- **Today's code** that knows "one level":
  - `canEmbed` refuses a child that embeds and a parent that is embedded.
  - `routines.ts` (the pure algebra: `flatten`, starts, ends, seams, breaks)
    assumes one level.
  - `coverage`, `plan.ts`, `snapshot`, `fit`, `end.ts`, the picker's
    embeddable list.
  - All of these must recurse instead, with a cycle check.

## Left to the builder

- **How a section is stored.** One idea: a `routines` row with an additive
  flag (say `is_section`) and no exercise, embedded through today's
  `routine_steps.child_routine_id`. This reuses the embedding machinery,
  walls, groups and sync. Any design that meets the rules above is fine.
- **Which routine a named section is listed under in the picker** when it is
  used in several: each routine that uses it, or the one it was made in.
- The exact colours of the four panel levels, from the existing tokens, in
  both themes.
- The spring-open timing, ring drawing and animations, within the numbers
  above.
- Where "Detach here" sits when a shared section is opened from somewhere
  other than a routine.
- How the editor's lift, selection and drag code changes to meet "nothing
  changes height", and the scenes that prove it.

## Calls made while writing this (check these)

- Turn into a section is only offered when a routine uses it.
- Detach here and Unpack act on the one slot, not every use in the routine.
- "In n routines" counts real routines at any depth.
- Sections follow today's rules for a routine inside a routine in groups and
  copies. Detach here is a plain copy.
- How a named section is listed in the picker when several routines use it
  is left to the builder.
