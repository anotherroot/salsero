# Screenshot rig

Shoots every page in `pages.txt` from a throwaway copy of a database, so a change can be compared
with a baseline (the phone must not change) or with a design board.

    scripts/shots/shots.sh <db-copy> <out-dir> <width>x<height> [--theme light|dark] [--pages FILE] [--group ID] [--viewport]
    scripts/shots/shots.py diff <dirA> <dirB>      # run under the Playwright command below

`shots.sh` copies the db to a `mktemp -d` (never `.data`), runs `npx vite dev` on a free port inside
`nix develop` with `DATA_DIR`/`DATABASE_PATH` set there, waits for `/health`, inserts a session
(`shots`, the first admin) and shoots with the cookie `salsa_session=shots`. The server runs in its own
process group and is killed by that group on exit; the temp dir is deleted. If `/health` never
answers it prints the server log and exits 1. It exits 1 too if any page is not `ok`.
`--group ID` also sets the group-mode cookie (`group_salsa=ID`), so the pages show that group's side
(navy, Mine for Today); the admin must own or edit the group, else the app drops the cookie.
`--viewport` shoots the window only, not the full page: on the desktop the band row and the side are fixed and
a full-page shot draws them once at the top, so desktop pages are compared with their boards (1440×900) this way.
Phone baselines stay full-page.

`pages.txt`: one path per line. `{dance}` is salsa; `{yesterday}`, `{figure}`, `{move}`, `{song}`,
`{lesson}`, `{routine}`, `{group}`, `{position}`, `{exercise}` are the admin's first live row of that
kind (a group: the first they are in). A placeholder with no row is a failure. The `does-not-exist` line
must answer 404; every other page must answer < 400 on its own path. Output: `<out-dir>/<slug>.png`,
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

## Playwright

The python package and the browsers must come from the same nixpkgs:

    unset LD_LIBRARY_PATH
    export PLAYWRIGHT_BROWSERS_PATH=$(nix build --no-link --print-out-paths nixpkgs#playwright-driver.browsers)
    nix shell --impure --expr 'with (builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux; python3.withPackages (p: [p.playwright p.pillow])' -c python3 -I scripts/shots/shots.py diff A B

## Baseline

The phone baseline is `shots.sh <prod-backup-copy> <dir>/base-390 390x844` and again with `--theme dark`.
The db holds personal data: never commit it or the screenshots.
