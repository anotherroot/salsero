package eu.anotherroot.salsa

import android.content.Context
import java.io.File

/** What every launch does: sweep leftovers, resume uploads, refresh settings. */
object AppStart {
    /** A shared copy younger than this may still be waiting for its lesson to be picked. */
    private const val KEEP_UNCLAIMED_MS = 60 * 60_000L

    fun onLaunch(context: Context) {
        val app = context.applicationContext
        Thread {
            sweep(app)
            // In front right now, so the runner may start as a foreground service.
            if (!UploadQueue.store(app).isEmpty()) UploadQueue.kick(app)
        }.start()
        refreshConfig(app)
    }

    /** Re-reads `/api/device/config` and reschedules the reminder. */
    fun refreshConfig(context: Context) = ConfigWorker.enqueue(context.applicationContext)

    /** Deletes shared copies no queued job needs, once they are old enough not to be mid-pick. */
    private fun sweep(context: Context) {
        val wanted = UploadQueue.store(context).sharedKeys()
        val old = System.currentTimeMillis() - KEEP_UNCLAIMED_MS
        Shared.root(context).listFiles()?.forEach { dir ->
            if (dir.name !in wanted && dir.lastModified() < old) dir.deleteRecursively()
        }
        // The first build kept its state in the cache and an offsets folder.
        context.cacheDir.listFiles { f -> f.name.startsWith("upload-") }?.forEach { it.delete() }
        File(context.filesDir, "offsets").deleteRecursively()
    }
}
