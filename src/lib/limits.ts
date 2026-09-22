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
