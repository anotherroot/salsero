/*
 * drizzle's migrator on the device: nothing to do. `openDb` calls it on every
 * open, but it reads `drizzle/` from disk, which the device has not got. The
 * worker has already brought the copy to the current schema with
 * `migrateDevice` (from the same migrations, bundled) before the server opens it.
 */
export function migrate(): void {}
