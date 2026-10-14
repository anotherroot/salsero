package eu.anotherroot.salsa

import android.content.Context
import java.io.File

/** What every launch does, off the main thread: sweep leftovers, refresh settings. */
object AppStart {
    /** A shared copy younger than this may still be waiting for its lesson to be picked. */
    private const val KEEP_UNCLAIMED_MS = 60 * 60_000L

    fun onLaunch(context: Context) {
        val app = context.applicationContext
        Thread { sweep(app) }.start()
        refreshConfig(app)
    }

    /** Re-reads `/api/device/config` and reschedules the reminder. */
    fun refreshConfig(context: Context) = ConfigWorker.enqueue(context.applicationContext)

    /**
     * Deletes compressed files, offsets and shared copies that no queued upload
     * owns: a job that was cancelled, or a share whose lesson was never picked.
     */
    private fun sweep(context: Context) {
        val tags = try {
            UploadQueue.pendingTags(context).toSet()
        } catch (e: Exception) {
            return // cannot tell what is live; sweep next time
        }
        val live = { id: String -> UploadQueue.TAG_UPLOAD + id in tags }
        context.cacheDir.listFiles { f -> f.name.startsWith("upload-") }?.forEach { f ->
            val id = f.name.removePrefix("upload-").removeSuffix(".mp4").removeSuffix(".part")
            if (!live(id)) f.delete()
        }
        File(context.filesDir, "offsets").listFiles()?.forEach { if (!live(it.name)) it.delete() }
        val old = System.currentTimeMillis() - KEEP_UNCLAIMED_MS
        Shared.root(context).listFiles()?.forEach { dir ->
            if (UploadQueue.TAG_SHARE + dir.name !in tags && dir.lastModified() < old) dir.deleteRecursively()
        }
    }
}
