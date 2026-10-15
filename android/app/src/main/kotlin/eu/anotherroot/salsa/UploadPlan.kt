package eu.anotherroot.salsa

import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The client half of the lesson-video protocol (lessons spec, "Videos, and why
 * the upload is chunked"), as pure decisions: given what the server answered,
 * what the uploader does next. The partial file on the server is the state; a
 * 409 with `x-received-bytes` says where it ends.
 */

/** 8 MiB, as `UPLOAD_CHUNK_BYTES` in src/lib/limits.ts. */
const val CHUNK_BYTES = 8L * 1024 * 1024

/**
 * Each run opens with a small chunk. The saved offset can be stale (the server
 * swept the partial, or took a chunk whose answer was lost); a stale guess then
 * costs a 64 KiB request and a 409, not an 8 MiB one.
 */
const val PROBE_BYTES = 64L * 1024

/** `MAX_RECORDING_BYTES`: a figure recording is one request, under Cloudflare's 100 MB. */
const val MAX_RECORDING_BYTES = 95L * 1024 * 1024

/** The status [nextStep] is given when the request never got an answer. */
const val NETWORK_ERROR = -1

/**
 * Runs in a row that may end without progress before a video is given up.
 * Counted per video and cleared by any progress (`JobStore`), so a long upload
 * over a patchy connection is not failed for drops it recovered from.
 */
const val MAX_STALLS = 12

fun givesUp(stalls: Int) = stalls >= MAX_STALLS

sealed interface Step {
    /** PUT bytes [start]..[end] inclusive. */
    data class Send(val start: Long, val end: Long) : Step
    data object Done : Step
    /** Not now: wait (WorkManager's backoff) and try again. */
    data object Retry : Step
    data class Fail(val reason: String) : Step
    data object Unpaired : Step
}

fun firstChunk(offset: Long, total: Long): Step.Send = Step.Send(offset, min(offset + PROBE_BYTES, total) - 1)

private fun chunkFrom(start: Long, total: Long) = Step.Send(start, min(start + CHUNK_BYTES, total) - 1)

/**
 * What to do after [status] for the chunk [sent]. [received] is the server's
 * `x-received-bytes`, and [message] the server's own words, kept for a
 * failure notification.
 */
fun nextStep(status: Int, received: Long?, sent: Step.Send, total: Long, message: String): Step =
    when {
        status == 201 -> Step.Done
        status == 204 -> chunkFrom(received ?: (sent.end + 1), total).let {
            if (it.start >= total) Step.Retry else it
        }
        // With a count: the client was wrong about the offset. Without: another
        // request for this upload is still being written, so wait for it.
        status == 409 && received != null ->
            if (received >= total) Step.Fail("The server has the whole video but did not finish it. Try again later.")
            else chunkFrom(received, total)
        status == 401 -> Step.Unpaired
        status in listOf(404, 413, 415) -> Step.Fail(message.ifBlank { "The server refused it ($status)." })
        else -> Step.Retry
    }

fun fitsRecording(bytes: Long) = bytes <= MAX_RECORDING_BYTES

/** A video is re-encoded only when its short side is above the target; never upscaled. */
fun needsCompression(width: Int, height: Int, shortSide: Int) = min(width, height) > shortSide

/**
 * The output size of a [width]×[height] video (as displayed) with its short side
 * scaled to [shortSide]: aspect kept, each dimension even. From Shrink.
 */
fun outputSize(width: Int, height: Int, shortSide: Int): Pair<Int, Int> {
    val long = maxOf(width, height).toDouble() * shortSide / minOf(width, height)
    val evenLong = 2 * (long / 2).roundToInt()
    return if (width <= height) shortSide to evenLong else evenLong to shortSide
}

/** Video bitrate per target short side, bits per second (Shrink's "balanced"). */
fun videoBitrate(shortSide: Int): Int = when {
    shortSide <= 480 -> 750_000
    shortSide <= 720 -> 1_500_000
    else -> 3_000_000
}
