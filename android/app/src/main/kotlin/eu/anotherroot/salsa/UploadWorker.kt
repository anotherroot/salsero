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
    /** The progress title: the lesson, then the video and the lesson; null = the plain word. */
    private var title: String? = null
    /** The running video's file name, once probed (null = `Words.theVideo`); and how many wait behind it. */
    private var videoName: String? = null
    private var waiting = 0

    /** The app's own words, in the account's language; read as needed, so a change reaches the next line. */
    private val words get() = Prefs.words(ctx)

    /** The running video's name for a notification. */
    private val video get() = videoName ?: words.theVideo

    override suspend fun getForegroundInfo(): ForegroundInfo = Notify.progress(ctx, words.uploading, words.preparing, null)

    override suspend fun doWork(): Result {
        // The updater waits while this is up (UploadRun); a job left queued does not hold it.
        UploadRun.begin()
        try {
            return drain()
        } finally {
            UploadRun.end()
        }
    }

    private suspend fun drain(): Result = withContext(Dispatchers.IO) {
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
            videoName = null
            waiting = jobs.size - 1
            val step = try {
                run(job)
            } catch (e: Unpaired) {
                Step.Unpaired
            } catch (e: UpdateNeeded) {
                Step.UpdateNeeded
            } catch (e: IOException) {
                Step.Retry
            }
            when (step) {
                Step.Done -> finish(job, words.addedTo(job.name), video, ok = true)
                is Step.Fail -> finish(job, words.couldNotAdd(video, job.name), step.reason)
                Step.Unpaired -> {
                    job.original?.let { UploadEvents.waiting(it) }
                    // Kept, all of them: pairing again resumes the queue (LinkActivity kicks it).
                    Prefs.setToken(ctx, null)
                    Notify.unpaired(ctx)
                    return@withContext Result.success()
                }
                Step.Retry -> {
                    if (!givesUp(store.addStall(job.id))) return@withContext Result.retry()
                    finish(job, words.couldNotAdd(video, job.name), words.keptFailing)
                }
                Step.UpdateNeeded -> {
                    job.original?.let { UploadEvents.waiting(it) }
                    // Kept, not stalled: an update (or the site relaxing its minimum) lets it carry on.
                    Notify.updateNeeded(ctx, job.id.hashCode() and 0xffff, ctx.getString(R.string.app_name), video, job.back)
                    return@withContext Result.retry()
                }
                is Step.Send -> error("unreachable")
            }
        }
        Result.success()
    }

    private suspend fun run(job: Job): Step {
        val source = Uri.parse(job.source)
        title = job.name
        show(words.preparing, null)
        val config = Api.config(ctx)
        val info = try {
            VideoProbe.probe(ctx, source)
        } catch (e: Exception) {
            return Step.Fail(words.notAVideo)
        }
        videoName = info.name
        title = "${info.name} → ${job.name}"

        val body: Body = if (needsCompression(info.width, info.height, config.shortSide)) {
            val out = store.compressed(job.id)
            if (!out.exists()) {
                val part = store.compressing(job.id)
                val error = Compressor.compress(ctx, source, info, config.shortSide, part) {
                    show(words.compressing, it)
                    job.original?.let { file -> UploadEvents.progress(file, overallPercent(it, compressing = true, compressed = true)) }
                }
                if (error != null) return Step.Fail(words.couldNotCompress(error))
                if (!part.renameTo(out)) return Step.Fail(words.couldNotKeep)
                // New bytes: a new upload on the server, never a resume of the old one.
                store.freshServerId(job.id)
                store.clearStalls(job.id)
            }
            Body.OfFile(out, "video/mp4", info.name.substringBeforeLast('.') + ".mp4")
        } else {
            Body.OfUri(ctx, source, info.mime, info.name, info.sizeBytes)
        }
        return uploadChunks(job, body)
    }

    /** The lesson protocol, chunk by chunk, from the saved offset. */
    private fun uploadChunks(job: Job, body: Body): Step {
        val total = body.size
        if (total <= 0) return Step.Fail(words.emptyVideo)
        val serverId = store.serverId(job.id)
        var send: Step.Send = firstChunk(store.offset(job.id).coerceIn(0, total - 1), total)
        while (true) {
            if (isStopped) throw CancellationException("stopped")
            show(words.uploading, (send.start * 100 / total).toInt())
            job.original?.let {
                UploadEvents.progress(it, overallPercent((send.start * 100 / total).toInt(), compressing = false, compressed = body is Body.OfFile))
            }
            val (status, received, message) = try {
                putChunk(job, serverId, body, send, total)
            } catch (e: CancellationException) {
                throw e
            } catch (e: IOException) {
                Triple(NETWORK_ERROR, null, e.message ?: "")
            }
            when (val step = nextStep(status, received, send, total, message, words)) {
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
        val conn = Api.open(ctx, uploadPath(job.target, serverId), "PUT")
        try {
            conn.doOutput = true
            conn.setFixedLengthStreamingMode(length)
            conn.setRequestProperty("content-type", body.mime)
            conn.setRequestProperty("content-range", "bytes ${send.start}-${send.end}/$total")
            conn.setRequestProperty("x-filename", encodeName(body.name))
            body.open(send.start).use { input ->
                conn.outputStream.use { out ->
                    copy(input, out, length) { show(words.uploading, ((send.start + it) * 100 / total).toInt()) }
                }
            }
            val status = conn.responseCode
            val received = conn.getHeaderField("x-received-bytes")?.toLongOrNull()
            return Triple(status, received, if (status >= 400) Api.errorBody(conn) else "")
        } finally {
            conn.disconnect()
        }
    }

    /** Posts the outcome and forgets the job: its folder, and the source it no longer needs. */
    private fun finish(job: Job, title: String, text: String?, ok: Boolean = false) {
        Notify.result(ctx, 100 + (job.id.hashCode() and 0xffff), title, text, job.back)
        store.remove(job.id)
        job.original?.let { UploadEvents.ended(it, ok) }
        val source = Uri.parse(job.source)
        if (!releasesSource(job.target)) {
            // A phone-only original (offline phase 4c): the app keeps pointing at it.
        } else if (job.shareKey != null) {
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

    /** At most twice a second: the notification is the only progress there is. */
    private fun show(stage: String, percent: Int?) {
        val now = System.currentTimeMillis()
        if (percent != null && percent in 1..99 && now - lastShown < 500) return
        lastShown = now
        val text = buildString {
            append(stage)
            if (percent != null) append(" · ").append(words.percent(percent))
            if (waiting > 0) append(" · ").append(words.moreWaiting(waiting))
        }
        setForegroundAsync(Notify.progress(ctx, title ?: words.uploading, text, percent))
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
