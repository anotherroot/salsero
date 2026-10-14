package eu.anotherroot.salsa

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.URLEncoder

/**
 * Drains the upload queue, oldest video first: compress it if it is bigger
 * than the user's size, then upload it to its lesson (chunked, resumable) or
 * figure (one request). Runs as a foreground service when Android allows it —
 * always when kicked from the app in front, not always on a retry.
 *
 * A video's state lives in its `JobStore` folder: the compressed file, the
 * server's upload id and the offset reached, so a retry neither compresses nor
 * uploads twice. Stopping is honoured between buffers, so a stopped run never
 * keeps writing beside its replacement.
 */
class UploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    private val ctx = applicationContext
    private val store = UploadQueue.store(ctx)
    private var lastShown = 0L
    private var title = "Uploading"
    /** The running video's file name, once probed; and how many wait behind it. */
    private var videoName = "the video"
    private var waiting = 0

    override suspend fun getForegroundInfo(): ForegroundInfo = Notify.progress(ctx, "Uploading", "Preparing", null)

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            setForeground(getForegroundInfo())
        } catch (e: Exception) {
            // Started from the background (a retry): Android 12+ refuses a
            // foreground service then. Carry on as a plain job; whatever it
            // gets done is kept, and the next launch runs the rest in front.
        }
        while (true) {
            val jobs = store.jobs()
            val job = jobs.firstOrNull() ?: return@withContext Result.success()
            videoName = "the video"
            waiting = jobs.size - 1
            val step = try {
                run(job)
            } catch (e: Unpaired) {
                Step.Unpaired
            } catch (e: IOException) {
                Step.Retry
            }
            when (step) {
                Step.Done -> finish(job, "Added to ${job.name}", videoName)
                is Step.Fail -> finish(job, "Couldn't add ${videoName} to ${job.name}", step.reason)
                Step.Unpaired -> {
                    // Kept, all of them: pairing again resumes the queue (LinkActivity kicks it).
                    Prefs.setToken(ctx, null)
                    Notify.unpaired(ctx)
                    return@withContext Result.success()
                }
                Step.Retry -> {
                    if (!givesUp(store.addStall(job.id))) return@withContext Result.retry()
                    finish(job, "Couldn't add ${videoName} to ${job.name}", "The upload kept failing.")
                }
                is Step.Send -> error("unreachable")
            }
        }
        Result.success()
    }

    private suspend fun run(job: Job): Step {
        val source = Uri.parse(job.source)
        title = job.name
        show("Preparing", null)
        val config = Api.config(ctx)
        val info = try {
            VideoProbe.probe(ctx, source)
        } catch (e: Exception) {
            return Step.Fail("It is not a video this phone can read.")
        }
        videoName = info.name
        title = "${info.name} → ${job.name}"

        val body: Body = if (needsCompression(info.width, info.height, config.shortSide)) {
            val out = store.compressed(job.id)
            if (!out.exists()) {
                val part = store.compressing(job.id)
                val error = Compressor.compress(ctx, source, info, config.shortSide, part) { show("Compressing", it) }
                if (error != null) return Step.Fail("Couldn't compress it: $error")
                if (!part.renameTo(out)) return Step.Fail("Couldn't keep the compressed video.")
                // New bytes: a new upload on the server, never a resume of the old one.
                store.freshServerId(job.id)
                store.clearStalls(job.id)
            }
            Body.OfFile(out, "video/mp4", info.name.substringBeforeLast('.') + ".mp4")
        } else {
            Body.OfUri(ctx, source, info.mime, info.name, info.sizeBytes)
        }
        return if (job.target is Target.Lesson) uploadChunks(job, body) else uploadWhole(job, body)
    }

    /** The lesson protocol, chunk by chunk, from the saved offset. */
    private fun uploadChunks(job: Job, body: Body): Step {
        val total = body.size
        if (total <= 0) return Step.Fail("The video is empty.")
        val serverId = store.serverId(job.id)
        var send: Step.Send = firstChunk(store.offset(job.id).coerceIn(0, total - 1), total)
        while (true) {
            if (isStopped) throw CancellationException("stopped")
            show("Uploading", (send.start * 100 / total).toInt())
            val (status, received, message) = try {
                putChunk(job, serverId, body, send, total)
            } catch (e: CancellationException) {
                throw e
            } catch (e: IOException) {
                Triple(NETWORK_ERROR, null, e.message ?: "")
            }
            when (val step = nextStep(status, received, send, total, message)) {
                is Step.Send -> {
                    store.setOffset(job.id, step.start)
                    send = step
                }
                else -> return step
            }
        }
    }

    private fun putChunk(job: Job, serverId: String, body: Body, send: Step.Send, total: Long): Triple<Int, Long?, String> {
        val length = send.end - send.start + 1
        val conn = Api.open(ctx, "/api/lessons/${job.target.id}/videos/$serverId", "PUT")
        try {
            conn.doOutput = true
            conn.setFixedLengthStreamingMode(length)
            conn.setRequestProperty("content-type", body.mime)
            conn.setRequestProperty("content-range", "bytes ${send.start}-${send.end}/$total")
            conn.setRequestProperty("x-filename", encodeName(body.name))
            body.open(send.start).use { input ->
                conn.outputStream.use { out ->
                    copy(input, out, length) { show("Uploading", ((send.start + it) * 100 / total).toInt()) }
                }
            }
            val status = conn.responseCode
            val received = conn.getHeaderField("x-received-bytes")?.toLongOrNull()
            return Triple(status, received, if (status >= 400) Api.errorBody(conn) else "")
        } finally {
            conn.disconnect()
        }
    }

    /** A figure recording: one request, under the 95 MiB edge limit. */
    private fun uploadWhole(job: Job, body: Body): Step {
        if (!fitsRecording(body.size)) return Step.Fail("Even compressed it is over 95 MB, too big for a figure recording.")
        show("Uploading", 0)
        val conn = Api.open(ctx, "/api/figures/${job.target.id}/recordings", "POST")
        try {
            val status = try {
                conn.doOutput = true
                conn.setFixedLengthStreamingMode(body.size)
                conn.setRequestProperty("content-type", body.mime)
                conn.setRequestProperty("x-filename", encodeName(body.name))
                body.open(0).use { input ->
                    conn.outputStream.use { out -> copy(input, out, body.size) { show("Uploading", (it * 100 / body.size).toInt()) } }
                }
                conn.responseCode
            } catch (e: CancellationException) {
                throw e
            } catch (e: IOException) {
                NETWORK_ERROR
            }
            val message = if (status >= 400) Api.errorBody(conn) else ""
            return when (val step = nextStep(status, null, Step.Send(0, body.size - 1), body.size, message)) {
                is Step.Send -> Step.Retry // a 204 or 409 cannot happen here; try again
                else -> step
            }
        } finally {
            conn.disconnect()
        }
    }

    /** Posts the outcome and forgets the job: its folder, and the source it no longer needs. */
    private fun finish(job: Job, title: String, text: String?) {
        Notify.result(ctx, 100 + (job.id.hashCode() and 0xffff), title, text, job.back)
        store.remove(job.id)
        val source = Uri.parse(job.source)
        if (job.shareKey != null) {
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

    private fun nameOf(job: Job) = Uri.parse(job.source).lastPathSegment?.substringAfter("-") ?: "the video"

    /** At most twice a second: the notification is the only progress there is. */
    private fun show(stage: String, percent: Int?) {
        val now = System.currentTimeMillis()
        if (percent != null && percent in 1..99 && now - lastShown < 500) return
        lastShown = now
        val text = buildString {
            append(stage)
            if (percent != null) append(" · $percent%")
            if (waiting > 0) append(" · $waiting more waiting")
        }
        setForegroundAsync(Notify.progress(ctx, title, text, percent))
    }

    /** Copies [length] bytes, giving up between buffers once the run is stopped. */
    private fun copy(input: InputStream, out: OutputStream, length: Long, onSent: (Long) -> Unit) {
        val buffer = ByteArray(64 * 1024)
        var left = length
        var sent = 0L
        while (left > 0) {
            if (isStopped) throw CancellationException("stopped")
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
