# The desktop boards

The source of the desktop boards the user reviewed and settled (rounds 1–9,
2026-11-03/04), published at https://claude.ai/artifact/MHiCSgC56gJSrsEsbyXQ4i.
They are the target for every desktop page; the spec is
[`docs/superpowers/specs/2026-11-03-desktop-design.md`](../../specs/2026-11-03-desktop-design.md).

Pure Python 3 stdlib, built on the redesign's kit (a copy in `gen/kit/`, with
the phone screens it reuses in `gen/screens/`).

```sh
cd gen/desk/pages
# every board as a standalone page, for screenshots: out/boards/<theme>/<area>--<id>.html
nix shell nixpkgs#python3 -c python3 -I book.py boards [area ...] [--theme salsa-light]
# the whole book (every board, every theme, one page): out/index.html
nix shell nixpkgs#python3 -c python3 -I book.py book
```

Areas (`gen/desk/pages/<area>.py`): today, moves, pos (positions), lessons,
groups, music, practice, settings, system. Each has `SECTION` and `BOARDS`;
a board's `note` says what it shows and which calls were made. Every board is
1440 × 900. Themes: salsa-light, salsa-dark, bachata-light, bachata-dark.
`decisions.py` is what the review settled, shown at the top of the book.
`frame.py` holds the frame's measures (side 188, buttons 144, band row 88, list
column 360, Today's list 400).

`art/` is the band-pattern experiment (the Band switcher in the book's viewer).
No pattern was chosen; the app ships the plain band.

To compare a built page with its board, open `out/boards/<theme>/<area>--<id>.html`
at 1440 × 900 next to the page.
