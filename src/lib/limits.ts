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
 * Largest lesson video accepted: 1 GiB.
 *
 * Far above `MAX_RECORDING_BYTES` because it is not bound by the same thing. A
 * figure recording is one request, so Cloudflare's 100 MB edge limit IS its
 * ceiling; a lesson video arrives in chunks, so no single request approaches
 * that and the real constraint becomes the server's disk — shared with four
 * other services and around 80% full. 1 GiB is roughly a quarter-hour of 1080p
 * phone video, enough for a class, and low enough that a few lessons cannot
 * quietly fill the box.
 */
export const MAX_LESSON_VIDEO_BYTES = 1024 * 1024 * 1024;

/** `1 GB`, for messages. The MB formula above cannot say this. */
export const MAX_LESSON_VIDEO_LABEL = '1 GB';

/**
 * What the browser slices a lesson video into: 8 MiB.
 *
 * Comfortably under the edge limit, small enough that a dropped mobile
 * connection costs almost nothing to retry, and few enough requests that a
 * full 1 GiB file is ~128 of them.
 */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Largest single chunk the server will accept: 16 MiB.
 *
 * Headroom above what the client sends, so a future change to the slice size
 * does not need a matching deploy, while still refusing a request that tried to
 * put a whole video in one body.
 */
export const MAX_UPLOAD_CHUNK_BYTES = 16 * 1024 * 1024;

/**
 * How long an abandoned partial upload survives before the boot sweep removes
 * it: 24 hours. Long enough to outlive a bad connection, short enough that a
 * failed 1 GiB upload does not squat on the disk.
 */
export const UPLOAD_PARTIAL_TTL_MS = 24 * 60 * 60 * 1000;

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
