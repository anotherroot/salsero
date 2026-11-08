# Development

Moved out of CLAUDE.md on 2026-11-08: the commands and running things locally.

Toolchain comes from the nix flake — `nix develop`, or `direnv allow` once.
Sister project with the same conventions: `~/Projects/muscle_model`.

```sh
npm run dev           # DATA_DIR/DATABASE_PATH come from the flake (.data/)
npm run check         # prettier + eslint + svelte-check + build + vitest — must pass
# ESLint lints .svelte without types (no projectService): ~1 min, not ~4 (eslint.config.js)
npm run db:generate   # after editing src/lib/server/db/schema.ts
./scripts/deploy.sh   # see docs/deployment.md
# slots: C-1…C-9 in tmux; prefix C-a for reset-db and close slot (tmux_project)
./scripts/make-clips.sh   # regenerate static/clips/ — only when the voice changes
./scripts/make-icons.sh   # regenerate static/icons/ — only when an icon SVG changes
nix develop .#android -c ./android/gradlew -p android test assembleDebug   # the APK; see docs/deployment.md
npm run test:device  # the whole suite on the device's SQLite WASM shim (slow; not in check)
scripts/offline/serve.sh <db> &   # a production build on a copy of <db>; then walk.py (README there)
```

The dev database has no songs and the home worker does not run against it, so
the player's song mode has nothing to open. To exercise it locally, insert a
song row by hand with `status='ready'`, an `audio_file` under `.data/audio/`,
and a `beats_json` array — a click track from ffmpeg plus evenly spaced beats is
enough to check the count, the clave and a routine's Follow. Set `dance` too: it defaults
to `'salsa'`, so a row inserted without it is invisible from `/bachata/player`.

In dev, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first run; an admin is
created at boot in each dance that has no account. `DANCE_HOSTS` is unset in dev,
so the path decides the dance; sign in to bachata at `/login?dance=bachata`.
