package eu.anotherroot.salsa

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.net.URLEncoder

/**
 * One video: compress it if it is bigger than the user's size, then upload it
 * to its lesson (chunked, resumable) or figure (one request). Runs as a
 * foreground service so it survives the app leaving the screen.
 *
 * The compressed file sits in the cache until the upload succeeds, so a retry
 * never compresses twice; the server's received-byte count is mirrored in an
 * offset file, so a retry resumes rather than restarts.
 */
class UploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    private val ctx = applicationContext
    private val source = Uri.parse(inputData.getString(UploadQueue.KEY_SOURCE))
    private val shared = inputData.getBoolean(UploadQueue.KEY_SHARED, false)
    private val isLesson = inputData.getString(UploadQueue.KEY_TARGET) == "lesson"
    private val targetId = inputData.getLong(UploadQueue.KEY_ID, 0)
    private val uploadId = inputData.getString(UploadQueue.KEY_UPLOAD_ID)!!
    private val back = inputData.getString(UploadQueue.KEY_BACK) ?: "/"
    private val targetName = inputData.getString(UploadQueue.KEY_NAME) ?: "the lesson"

    private val compressed = File(ctx.cacheDir, "upload-$uploadId.mp4")
    private val compressing = File(ctx.cacheDir, "upload-$uploadId.part.mp4")
    private val offsetFile = File(File(ctx.filesDir, "offsets").apply { mkdirs() }, uploadId)

    /** One notification id per video, from its uuid, so outcomes do not replace each other. */
    private val resultId = 100 + (uploadId.hashCode() and 0xffff)

    private var videoName = "video"

    override suspend fun getForegroundInfo(): ForegroundInfo =
        Notify.progress(ctx, "Uploading to $targetName", "Waiting", null)

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            run()
        } catch (e: Unpaired) {
            Notify.unpaired(ctx)
            Result.success() // kept: pairing again and re-adding is the user's call
        } catch (e: IOException) {
            if (runAttemptCount >= MAX_ATTEMPTS) fail(e.message ?: "The network kept failing.") else Result.retry()
        }
    }

    private suspend fun run(): Result {
        show("Preparing", null)
        val config = Api.config(ctx)
        val info = try {
            VideoProbe.probe(ctx, source)
        } catch (e: Exception) {
            return fail("It is not a video this phone can read.")
        }
        videoName = info.name

        val body: Body = if (needsCompression(info.width, info.height, config.shortSide)) {
            if (!compressed.exists()) {
                val error = Compressor.compress(ctx, source, info, config.shortSide, compressing) {
                    show("Compressing", it)
                }
                if (error != null) return fail("Couldn't compress it: $error")
                if (!compressing.renameTo(compressed)) return fail("Couldn't keep the compressed video.")
            }
            Body.OfFile(compressed, "video/mp4", info.name.substringBeforeLast('.') + ".mp4")
        } else {
            Body.OfUri(ctx, source, info.mime, info.name, info.sizeBytes)
        }

        val outcome = if (isLesson) uploadChunks(body) else uploadWhole(body)
        return when (outcome) {
            Step.Done -> {
                cleanUp()
                Notify.result(ctx, resultId, "Added to $targetName", info.name, back)
                Result.success()
            }
            Step.Unpaired -> throw Unpaired()
            is Step.Fail -> fail(outcome.reason)
            is Step.Retry -> if (runAttemptCount >= MAX_ATTEMPTS) fail("The server kept failing.") else Result.retry()
            is Step.Send -> error("unreachable")
        }
    }

    /** The lesson protocol, chunk by chunk, from the saved offset. */
    private fun uploadChunks(body: Body): Step {
        val total = body.size
        if (total <= 0) return Step.Fail("The video is empty.")
        val saved = offsetFile.takeIf { it.exists() }?.readText()?.toLongOrNull() ?: 0
        var send: Step.Send = firstChunk(saved.coerceIn(0, total - 1), total)
        while (true) {
            show("Uploading", (send.start * 100 / total).toInt())
            val (status, received, message) = try {
                putChunk(body, send, total)
            } catch (e: IOException) {
                Triple(NETWORK_ERROR, null, e.message ?: "")
            }
            when (val step = nextStep(status, received, send, total, runAttemptCount, message)) {
                is Step.Send -> {
                    offsetFile.writeText(step.start.toString())
                    send = step
                }
                else -> return step
            }
        }
    }

    private fun putChunk(body: Body, send: Step.Send, total: Long): Triple<Int, Long?, String> {
        val length = send.end - send.start + 1
        val conn = Api.open(ctx, "/api/lessons/$targetId/videos/$uploadId", "PUT")
        try {
            conn.doOutput = true
            conn.setFixedLengthStreamingMode(length)
            conn.setRequestProperty("content-type", body.mime)
            conn.setRequestProperty("content-range", "bytes ${send.start}-${send.end}/$total")
            conn.setRequestProperty("x-filename", encodeName(body.name))
            body.open(send.start).use { input ->
                conn.outputStream.use { out -> copy(input, out, length) { sent -> progressWithin(send, sent, total) } }
            }
            val status = conn.responseCode
            val received = conn.getHeaderField("x-received-bytes")?.toLongOrNull()
            return Triple(status, received, if (status >= 400) Api.errorBody(conn) else "")
        } finally {
            conn.disconnect()
        }
    }

    /** A figure recording: one request, under the 95 MiB edge limit. */
    private fun uploadWhole(body: Body): Step {
        if (!fitsRecording(body.size)) return Step.Fail("Even compressed it is over 95 MB, too big for a figure recording.")
        show("Uploading", 0)
        val conn = Api.open(ctx, "/api/figures/$targetId/recordings", "POST")
        val status = try {
            conn.doOutput = true
            conn.setFixedLengthStreamingMode(body.size)
            conn.setRequestProperty("content-type", body.mime)
            conn.setRequestProperty("x-filename", encodeName(body.name))
            body.open(0).use { input ->
                conn.outputStream.use { out -> copy(input, out, body.size) { show("Uploading", (it * 100 / body.size).toInt()) } }
            }
            conn.responseCode
        } catch (e: IOException) {
            NETWORK_ERROR
        }
        val message = if (status >= 400) Api.errorBody(conn) else ""
        conn.disconnect()
        val whole = Step.Send(0, body.size - 1)
        return when (status) {
            201 -> Step.Done
            else -> nextStep(status, null, whole, body.size, runAttemptCount, message).let {
                if (it is Step.Send) Step.Retry(0) else it
            }
        }
    }

    private fun fail(reason: String): Result {
        cleanUp()
        Notify.result(ctx, resultId, "Couldn't add $videoName to $targetName", reason, back)
        return Result.success()
    }

    private fun cleanUp() {
        compressed.delete()
        compressing.delete()
        offsetFile.delete()
        if (shared) {
            val file = File(requireNotNull(source.path))
            file.delete()
            file.parentFile?.takeIf { it.listFiles().isNullOrEmpty() }?.delete()
        } else {
            try {
                ctx.contentResolver.releasePersistableUriPermission(source, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (e: SecurityException) {
                // Never taken (some pickers do not offer it): nothing to release.
            }
        }
    }

    private var lastShown = 0L

    private fun progressWithin(send: Step.Send, sent: Long, total: Long) =
        show("Uploading", ((send.start + sent) * 100 / total).toInt())

    /** At most twice a second: the notification is the only progress there is. */
    private fun show(stage: String, percent: Int?) {
        val now = System.currentTimeMillis()
        if (percent != null && percent in 1..99 && now - lastShown < 500) return
        lastShown = now
        val waiting = try {
            UploadQueue.waiting(ctx)
        } catch (e: Exception) {
            0
        }
        val text = buildString {
            append(stage)
            if (percent != null) append(" · $percent%")
            if (waiting > 0) append(" · $waiting more waiting")
        }
        setForegroundAsync(Notify.progress(ctx, "$videoName → $targetName", text, percent))
    }

    private fun copy(input: InputStream, out: java.io.OutputStream, length: Long, onSent: (Long) -> Unit) {
        val buffer = ByteArray(64 * 1024)
        var left = length
        var sent = 0L
        while (left > 0) {
            val n = input.read(buffer, 0, minOf(buffer.size.toLong(), left).toInt())
            if (n < 0) throw IOException("The video ended early.")
            out.write(buffer, 0, n)
            left -= n
            sent += n
            onSent(sent)
        }
    }

    /** The server reads it with decodeURIComponent, which does not know '+'. */
    private fun encodeName(name: String) = URLEncoder.encode(name, "UTF-8").replace("+", "%20")

}

/** What is uploaded: the compressed file, or the picked video as it is. */
private sealed interface Body {
    val mime: String
    val name: String
    val size: Long

    /** A stream positioned at [offset]. */
    fun open(offset: Long): InputStream

    class OfFile(val file: File, override val mime: String, override val name: String) : Body {
        override val size get() = file.length()
        override fun open(offset: Long): InputStream =
            FileInputStream(file).also { it.channel.position(offset) }
    }

    class OfUri(
        val context: Context,
        val uri: Uri,
        override val mime: String,
        override val name: String,
        override val size: Long,
    ) : Body {
        override fun open(offset: Long): InputStream {
            val pfd = context.contentResolver.openFileDescriptor(uri, "r") ?: throw IOException("The video is gone.")
            return ParcelFileDescriptor.AutoCloseInputStream(pfd).also { it.channel.position(offset) }
        }
    }
}
