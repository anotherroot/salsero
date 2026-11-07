/**
 * Name rules for the clone engine.
 */

/** A name as the uniqueness rules compare it: trimmed, any case. */
export const norm = (name: string) => name.trim().toLowerCase();
