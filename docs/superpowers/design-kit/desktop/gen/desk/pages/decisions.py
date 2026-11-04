"""What the review has settled so far, shown at the top of the boards page. One line each, newest round last.
When the review is done this list is what goes into the desktop spec."""

ROUND = ('Round 9 · Every board now follows what is settled: Moves has Figures | Routines | Positions and only the Coverage tile; '
         'figures say Positions, with any number each side, edited with the new fields; Timba is a type everywhere; lessons have a Positions group; '
         'the old position boards are gone. Positions are being built in slot 3 (branch positions). The band patterns are still open (Band switcher).')

SETTLED = [
    ('Frame', 'from 1024 px wide; one short band row (title left, toggles in the middle, actions on the right) and a band-coloured side.'),
    ('Side', 'the five tabs at the top, Settings at the bottom; in group mode it turns navy and Today becomes Mine.'),
    ('Side', 'the buttons are 144 px wide and centred in the 188 px side; the rest is band colour around them (round 3).'),
    ('Lists', 'a list and the item you open from it side by side (2A).'),
    ('Pages', 'figure and lesson pages in two columns (3A).'),
    ('Sheets', 'every phone bottom sheet becomes a dialog in the middle of the window (4B).'),
    ('Today', 'Custom exercise is a + on the band’s right (round 3).'),
    ('Today', 'the list on the left (Due, Done today, Not yet due, Inactive) and the open exercise on the right; one is always open, '
              'the first due when you arrive; the exercise page and the log dialog become that pane, with the log form in it and Log set pinned; '
              'rows lose their +; all done shows the day so far (round 4, Option A).'),
    ('Moves', 'a figure opened from a routine keeps the switch on Routines and the routines on the left (round 4).'),
    ('Positions', 'their own part of Moves (Figures | Routines | Positions) with a page each; linked to video sections and points, and to lessons (round 4).'),
    ('Positions', 'owned like figures: each person and group has their own, with copies, Make it mine, Compare, twins and group mode (round 5).'),
    ('Positions', 'nobody starts with any: templates (Salsa, Son, Timba) and How positions work are always at the top of the list (round 5).'),
    ('Positions', 'one type, from the same list as a figure’s; picking a figure’s positions shows its own type first, then the rest (round 5).'),
    ('Types', 'Timba joins salsa’s types (Salsa, Son, Timba, Other), for figures and positions alike (round 6).'),
    ('Positions', 'optional: a figure has no position until you give it one, and then fits anywhere (the routine editor checks nothing for it); '
                  'no neutral position any more; the list, the map and the picker show No position with its count (round 6).'),
    ('Figures', 'a figure starts in any number of positions and ends in any number; in a routine the next figure fits when it starts in any '
                'of the ends (round 7).'),
    ('Positions', 'picked with the shared picker: search, groups (No position, the figure’s type, other types, a group’s), the hold as the second line, '
                  '✓ toggles, Not in the list? + Position, Done (round 7).'),
    ('Positions', 'the map is the Web layout: a small force simulation, the same start every time, sized by figures and coloured by type; '
                  'dead ends and orphans marked in place, islands, unused positions and No position in a tray under it; a tap lights a position’s figures (round 8).'),
    ('Positions', 'twins (Same as…) count as one position on the map and in routines, marked as a twin (round 9).'),
]
