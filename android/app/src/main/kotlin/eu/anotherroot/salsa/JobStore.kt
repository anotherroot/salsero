package eu.anotherroot.salsa

import org.json.JSONObject
import java.io.File
import java.util.UUID

/** One video waiting to go up. [source] is a picked content URI or a shared copy's `file://`. */
data class Job(
    val id: String,
    val source: String,
    val shareKey: String?,
    val target: Target,
    val back: String,
    val name: String,
    val queuedAt: Long,
    /** A phone-only original's server file name (offline phase 4c): its page is told how far. */
    val original: String? = null,
)

/**
 * The upload queue, on disk: one folder per job, holding the job, its
 * compressed video, the server's upload id and the offset it has reached.
 *
 * Lives in no-backup files, not the cache: Android evicts the cache under
 * storage pressure, and a compressed video lost mid-upload would be encoded
 * again — not byte for byte the same — and spliced onto the first one's bytes.
 * For the same reason a fresh compression always gets a fresh server id.
 */
class JobStore(private val root: File) {
    private fun dir(id: String) = File(root, id)

    fun add(job: Job) {
        val d = dir(job.id).apply { mkdirs() }
        val o = JSONObject()
            .put("id", job.id)
            .put("source", job.source)
            .put("shareKey", job.shareKey ?: JSONObject.NULL)
            .put("target", targetName(job.target))
            .put("targetId", job.target.id)
            .put("back", job.back)
            .put("name", job.name)
            .put("queuedAt", job.queuedAt)
            .put("original", job.original ?: JSONObject.NULL)
        File(d, "job.json.tmp").apply { writeText(o.toString()) }.renameTo(File(d, "job.json"))
    }

    /** Oldest first. A folder whose job cannot be read is skipped. */
    fun jobs(): List<Job> =
        root.listFiles()?.mapNotNull { read(it) }?.sortedWith(compareBy({ it.queuedAt }, { it.id })).orEmpty()

    fun isEmpty() = jobs().isEmpty()

    fun remove(id: String) {
        dir(id).deleteRecursively()
    }

    fun compressed(id: String) = File(dir(id).apply { mkdirs() }, "video.mp4")

    fun compressing(id: String) = File(dir(id).apply { mkdirs() }, "video.part.mp4")

    /** The upload id the server knows these bytes by; made on first use. */
    fun serverId(id: String): String = text(id, "server-id") ?: freshServerId(id)

    /** New bytes, new upload: a new id and offset 0. */
    fun freshServerId(id: String): String {
        val fresh = UUID.randomUUID().toString()
        write(id, "server-id", fresh)
        write(id, "offset", "0")
        return fresh
    }

    fun offset(id: String): Long = text(id, "offset")?.toLongOrNull() ?: 0

    /** Moving forward is progress, and clears the stall count. */
    fun setOffset(id: String, offset: Long) {
        if (offset > offset(id)) clearStalls(id)
        write(id, "offset", offset.toString())
    }

    /** Runs in a row that ended without progress. */
    fun stalls(id: String): Int = text(id, "stalls")?.toIntOrNull() ?: 0

    fun addStall(id: String): Int = (stalls(id) + 1).also { write(id, "stalls", it.toString()) }

    fun clearStalls(id: String) = write(id, "stalls", "0")

    /** Share keys a queued job still needs. */
    fun sharedKeys(): Set<String> = jobs().mapNotNull { it.shareKey }.toSet()

    private fun text(id: String, name: String): String? = File(dir(id), name).takeIf { it.exists() }?.readText()

    private fun write(id: String, name: String, value: String) {
        File(dir(id).apply { mkdirs() }, name).writeText(value)
    }

    private fun read(d: File): Job? = try {
        val o = JSONObject(File(d, "job.json").readText())
        val targetId = o.getLong("targetId")
        Job(
            id = o.getString("id"),
            source = o.getString("source"),
            shareKey = if (o.isNull("shareKey")) null else o.getString("shareKey"),
            target = targetOf(o.getString("target"), targetId),
            back = o.getString("back"),
            name = o.getString("name"),
            queuedAt = o.getLong("queuedAt"),
            original = if (o.isNull("original") || !o.has("original")) null else o.getString("original"),
        )
    } catch (e: Exception) {
        null
    }
}

private fun targetName(t: Target) = when (t) {
    is Target.Lesson -> "lesson"
    is Target.Figure -> "figure"
    is Target.Recording -> "recording"
    is Target.LessonVideo -> "lesson-video"
}

private fun targetOf(name: String, id: Long): Target = when (name) {
    "lesson" -> Target.Lesson(id)
    "recording" -> Target.Recording(id)
    "lesson-video" -> Target.LessonVideo(id)
    else -> Target.Figure(id)
}
