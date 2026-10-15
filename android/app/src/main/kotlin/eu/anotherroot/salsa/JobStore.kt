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
            .put("target", if (job.target is Target.Lesson) "lesson" else "figure")
            .put("targetId", job.target.id)
            .put("back", job.back)
            .put("name", job.name)
            .put("queuedAt", job.queuedAt)
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
            target = if (o.getString("target") == "lesson") Target.Lesson(targetId) else Target.Figure(targetId),
            back = o.getString("back"),
            name = o.getString("name"),
            queuedAt = o.getLong("queuedAt"),
        )
    } catch (e: Exception) {
        null
    }
}
