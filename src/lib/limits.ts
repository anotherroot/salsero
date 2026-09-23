/**
 * Largest recording accepted, in bytes: 95 MiB, just under 100 MB.
 *
 * The ceiling is not ours. The hostname sits behind Cloudflare's proxy, whose
 * free plan rejects any request body over 100 MB at the edge — a bigger upload
 * would die there with a Cloudflare 413 before nginx ever saw it. 95 MiB is
 * about a minute of 1080p phone video, which is plenty for one figure.
 *
 * nginx's `client_max_body_size` and the unit's `BODY_SIZE_LIMIT`
 * (nixos-config modules/services/salsa.nix) sit at 100m, just above this, so
 * the app's own check is the one that answers with a readable message.
 */
export const MAX_RECORDING_BYTES = 95 * 1024 * 1024;

/** `95 MB`, for messages. */
export const MAX_RECORDING_LABEL = `${Math.round(MAX_RECORDING_BYTES / 1024 / 1024)} MB`;

/**
 * Largest count take accepted: 4 MiB.
 *
 * Its own ceiling, not `MAX_RECORDING_BYTES` — that one is sized for a minute
 * of phone video and would wave through anything. A take is a half bar of
 * 16-bit mono WAV: three beats at 120 BPM is 1.5 s, about 290 KB at 96 kHz,
 * and every tempo above that is shorter. 4 MiB is more than an order of
 * magnitude of headroom while still refusing an upload that is obviously not
 * a take.
 */
export const MAX_TAKE_BYTES = 4 * 1024 * 1024;

/** `4 MB`, for messages. */
export const MAX_TAKE_LABEL = `${Math.round(MAX_TAKE_BYTES / 1024 / 1024)} MB`;

/**
 * Most audio a take may keep before its first beat: 250 ms.
 *
 * This is a scheduling constraint, not a storage one. The player starts a take
 * one pre-roll BEFORE its beat, so the pre-roll is a lead time the look-ahead
 * horizon has to cover — `HORIZON_S` in `$lib/scheduler/attach.ts` sits above
 * this. A take allowed a longer pre-roll than the horizon cannot be scheduled
 * on time, and the player would quietly play it late instead. The recorder
 * uses 100 ms; this is the ceiling, not the value.
 */
export const MAX_PRE_ROLL_S = 0.25;
