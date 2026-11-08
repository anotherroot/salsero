# Screenshot rig

Shoots every page in `pages.txt` from a throwaway copy of a database, so a change can be compared
with a baseline (the phone must not change) or with a design board.

    scripts/shots/shots.sh <db-copy> <out-dir> <width>x<height> [--theme light|dark] [--pages FILE] [--group ID] [--viewport] [--no-session] [--unnamed] [--scenes NAMES] [--locale en|sl] [--level follow|own|all]
    scripts/shots/shots.py diff <dirA> <dirB>      # run under the Playwright command below

`shots.sh` copies the db to a `mktemp -d` (never `.data`), runs `npx vite dev` on a free port inside
`nix develop` with `DATA_DIR`/`DATABASE_PATH` set there, waits for `/health`, inserts a session
(`shots`, the first admin) and shoots with the cookie `salsa_session=shots`. The server runs in its own
process group and is killed by that group on exit; the temp dir is deleted. If `/health` never
answers it prints the server log and exits 1. It exits 1 too if any page is not `ok`.
`--group ID` also sets the group-mode cookie (`group_<dance>=ID`), so the pages show that group's side
(navy, Mine for Today); the admin must own or edit the group, else the app drops the cookie.
`--viewport` shoots the window only, not the full page: on the desktop the band row and the side are fixed and
a full-page shot draws them once at the top, so desktop pages are compared with their boards (1440×900) this way.
Phone baselines stay full-page.
`SHOTS_DANCE=bachata` (an environment variable) shoots the other dance: `{dance}` and the placeholders use it.
`--no-session` shoots without the cookie (the signed-out pages: `pages-signed-out.txt`); `--unnamed` clears the
admin's name in the copy, so pages send them to `/welcome` (`pages-welcome.txt`). `pages-card.txt` is the
other card pages and the error pages, signed in.
`--locale en|sl` sets the admin's language (`users.locale`) and the rig's invite's in the copy, and, with
`--no-session`, the browser's `lang` cookie, so signed-out pages draw in it too. `--level follow|own|all` sets the
admin's level (`users.level`). Both apply to scenes as well: scenes name English buttons, so with `--locale sl`
`shots.sh` writes a word map (`words.ts`: every catalog string Slovenian says otherwise) and `shots.py scene --words`
looks each `get_by_role` name, `get_by_text`, `get_by_label`, `get_by_placeholder` and `get_by_title` up in it. A name
composed with an argument ("Position menu") is not in the map, so such a scene still fails in Slovenian.
`SHOTS_TIMEOUT` (seconds, default 900) is how long the Playwright side may run: a long scene list under load needs more. Without `--locale` and `--level` the copy keeps what it holds (English, and
the level a migrated db has: Everything).

Each page's line ends in `OVERFLOW <n>px` when the page scrolls sideways (`scrollWidth` past the
window): the phone must have none, and a desktop page none from 1024.

`DELAY_FROM=<path>` (an environment variable, a template line like those in `pages.txt`) shoots each
page while it loads: it opens `<path>`, follows a link to the page with its `__data.json` held unanswered,
and shoots 1.2 s later, skeleton up. Its line then says `SIDE live` when every link of the desktop's
side is what a click at its centre hits, and `SIDE BLOCKED by <element>` (a failure) when the
skeleton covers it; no `SIDE` where no side shows (the phone).

`pages.txt`: one path per line. `{dance}` is salsa; `{yesterday}`, `{figure}`, `{move}`, `{song}`,
`{lesson}`, `{routine}`, `{group}`, `{position}`, `{exercise}` are the admin's first live row of that
kind (a group: the first they are in). `{joincode}` is the code of a live group of the admin's dance they are not in;
`{invite}` the code of an unused invite the rig adds to the copy. A placeholder with no row is a failure. The `does-not-exist` line
must answer 404; every other page must answer < 400 on its own path, or on the one after `->` when the
line names where it lands (`/g/{joincode} -> /login`, signed out). Output: `<out-dir>/<slug>.png`,
full page, one per line; the slug comes from the template line (`salsa_day_yesterday`, `salsa_figures_figure`), so names do not depend on the day or the db. Media files are not in a db copy, so pages that show them show their missing
state.

`diff` prints `<slug> <changed-pixels>` per page (a size mismatch prints both sizes, a page in only one
directory `missing-in-A/B`) and exits 1 if any page differs.

Time is fixed: `instant.txt` (UTC, now 2026-11-05 12:00:00) is the one instant every run pretends it is.
The dev server runs under libfaketime (`@` start-at form, `TZ=UTC`, monotonic clocks not faked, so vite is fine) and
the browser context uses `clock.set_fixed_time`; `{yesterday}` is that instant's day minus one in the admin's zone.
Change the file, and re-take every baseline.

Unstable parts are hidden by `shots.py` (CSS `visibility:hidden` on `[data-shots-mask]`, set by the rig):
the QR on `/app` (it encodes the random port) and the admin's "... GB free" line. Animations and the
caret are off. Add new machine-dependent bits to `MASK_JS`.

## Scenes

A scene is a page after some clicks (Running, a popup, a dialog). `shots.sh ... --scenes NAMES` (a comma list, or
`all`) runs `shots.py scene` in place of `shoot`, passing `--group` and `--viewport` on; output is
`<out>/scene-<name>.png`. Scenes live in `ext_*.py` files (`SCENES: dict[str, Scene]`, `Scene` in `scenes.py`:
path, `act(page)`, `masks(page)` returning Playwright locators hidden in the shot, `desk` for scenes shot
only at widths of 1024 or more, `after(page)` run once the shot is taken) with optional `placeholders(db, admin, dance)` that page lines can use too.
A scene whose placeholder has no row prints `skip <name>`; an `act` that throws is a failure.
A db copy with a `<db>.data/` folder beside it (recordings/, audio/ ...) has its files copied into the data dir, so a seeded db can hold real media. Scenes that need a recording or group songs are shot on a seeded copy of the db (not committed).
Chromium gets a fake microphone and may autoplay; the AAC count clips, which its Chromium cannot decode, are served as WAV (converted with ffmpeg at the start). Each plan keeps its own `ext_<name>.py`.

## A class

    scripts/shots/seed.sh <db> <out-db> [<media-dir>]

makes `<out-db>`, a copy of `<db>` with a class seeded into it (`seed-class.ts`, run by vitest with `seed.config.ts`, so
it uses the app's own data functions): a teacher's group the admin is a member of, two published lessons with drills, a
routine, a video with a section, a shared song and comments, the admin at Follow my class with their own exercises
archived, and what pages.txt asks for (a lesson and a routine of their own, a group they are not in). It writes only
`<out-db>` and its `<out-db>.data/` (never under `.data`); the lesson's video is a 12 s VP9 test picture made with
ffmpeg, and `<media-dir>` (the db's data dir) gives the rest of the media and the song. Shoot it like any copy:
`pages-follow.txt` is what a class member sees, and the `follow-*` scenes (`ext_follow.py`: the Done sheet per type, the
comments sheet, the full-screen player, Practice) name both languages' words, so one scene runs with `--locale sl` or `en`:

    scripts/shots/shots.sh <out-db> <dir> 390x844 --pages scripts/shots/pages-follow.txt --level follow --locale sl

## Playwright

The python package and the browsers must come from the same nixpkgs:

    unset LD_LIBRARY_PATH
    export PLAYWRIGHT_BROWSERS_PATH=$(nix build --no-link --print-out-paths nixpkgs#playwright-driver.browsers)
    nix shell --impure --expr 'with (builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux; python3.withPackages (p: [p.playwright p.pillow])' -c python3 -I scripts/shots/shots.py diff A B

## Baseline

The phone baseline is `shots.sh <prod-backup-copy> <dir>/base-390 390x844` and again with `--theme dark`.
The db holds personal data: never commit it or the screenshots.
