# The merge sheets and the update bubbles

Two bugs in Compare and Send, the two sheets' look, and the two update
bubbles' look. Picked by the user on 2026-11-06 from mockups beside real
screenshots of the 6 Nov backup. Amends
[clones and twins](2026-11-03-clones-and-twins-design.md) (Compare, Take,
Send, and "Names never travel by default") and
[app updates](2026-11-03-app-updates-design.md) (the "Update available" bar
and the "New version · Reload" bar).

Out of scope: the version tabs, the out-of-sync banner and the ⋯ menu (slot 3,
positions-rework, owns them; they keep opening these sheets as now); a single
"Sync" sheet per copy (parked as an idea in the note).

## The bugs *(user)*

- **Compare would not finish with everything on Yours.** Take stayed grey
  unless something was picked theirs. Now "all yours" is a choice: **Keep
  mine**.
- **Send never listed the name**, so a rename could not be sent and a copy
  that differed only by name read "Nothing to send". Now one rename box sends
  it.

## Compare and Take *(user)*

The look of mockup C: two columns, yours on the left, theirs on the right
(headed by its place's name), one row per difference with the field's label.
Tapping a column's header picks that whole side; tapping a tile picks one.
The picked tile is outlined with a tick; the other fades.

Picked like a merge tool:

- a field only they changed is picked **theirs**, and its line says
  "they changed it" (or "they added it", "they renamed it");
- a field only you changed is picked **yours** ("you changed it");
- a field you **both** changed is left open (both tiles outlined, dashed)
  until a side is tapped; its line says "you both changed it, pick one", and
  the main button waits with "Pick a side for the timing first.";
- *(kept from before, my call)* a removal is never picked: "they removed it"
  starts on yours, so defaults never delete;
- **the name rule** *(user, 2026-11-06)*: a name or title only they changed
  is picked theirs like any field, **except** when theirs is just yours plus
  a copy's " (…)" suffix (the name a copy gets when its place already has
  another row of that name). That one starts on yours. A name you both
  changed is open, like any field. This replaces "Names never travel by
  default" for Compare; Send keeps it (below).

The title is "Merge with Sreda 17:30" ("Merge with yours" when the other is
your own). A long value stops at 3 lines with a "Show all" that opens both
tiles of that row.

The main button says what happens: **Merge · N from theirs** when N fields
are picked theirs, **Keep mine** when none are. Keep mine changes no field: it
writes the pair's snapshot as a Take would (`nextBase`), so afterwards their
member reads as *behind yours* and the "changed since you took it" banner
goes. A hint under it says so: "Nothing changes in yours. Theirs will show as
behind yours." *(My call)* Keep mine writes no History line: no field a
person edits changes.

## Send mine *(user: 2A, one rename box)*

The same list as now (a box per group, your deletes as boxes of their own),
plus one box below the groups when any listed copy is named differently:
**Rename their copies to "Basic with hips"**, unticked, its line saying what
they are called now ("Both are called "Basic"", "Called "Basic", "Basic 2""…).
Ticked, it opens a line per copy with a different name, all ticked, so one can
be left out. A copy whose only difference is the name reads "Only the name
differs" and is ticked when its rename line is. A ticked rename adds "· the
name" to that copy's line. A name that would clash where it lands is refused
there, as any refusal, and the others land.

## "Update available" *(user: 3B)*

One row at the top of Today instead of the tinted box: the app's own icon,
"New version of the app", "Version 1.9 is ready" (the release's name), and a
small Update button on the right; while updating, the second line shows the
Update button's own status ("Downloading… 42%" stays on the button). A ×
hides it until tomorrow (the browser's local day, per device, in
`localStorage`; a newer version shows again). Settings and "Update needed"
keep the full button.

## "New version · Reload" *(user: 4C)*

The app's toast look (dark, rounded, shadow, one action) in place of the
full-width bar, at the toast's place above the tab bar: "The app was
updated" and a second line saying why it did not reload by itself:

- something unsaved or typed, or an upload: "Kept so nothing unsaved is lost."
- a practice run or an upload holding it: "Kept while this runs."
- the player or a sheet open: "Kept while this is open."
- nothing (the check found the build while the page was in use): "Your next
  page loads it."

*(My call)* The words say what happens, not "it reloads when you're done":
a held page loads the new version on the next page change or when it comes
back into view, never on its own the moment the hold ends. The "This page is
out of date" variant is the same toast: "This page is out of date" and
"Reload to continue.". Placement rules stay (not on Practice or My count, not
over an edit's Save bar; on the desktop over the pane, above the run column).
