package eu.anotherroot.salsa

import java.util.concurrent.atomic.AtomicInteger

/**
 * Whether the upload runner ([UploadWorker]) is at work in this process, for
 * the updater: installing ends the process, and a compression under way would
 * start over. A count rather than a flag, because a replaced runner may still
 * be stopping while its successor starts.
 *
 * Kept here rather than read from WorkManager's RUNNING state: the runner runs
 * in this process, the count changes exactly around its work, and reading it
 * neither blocks nor lags behind WorkManager's database. A job that is only
 * queued (paused by a 426, waiting out a backoff, unpaired) is not running:
 * it is on disk, survives the reinstall, and the next launch kicks it
 * ([AppStart.onLaunch]). Pure.
 */
object UploadRun {
    private val count = AtomicInteger()

    val running: Boolean get() = count.get() > 0

    fun begin() {
        count.incrementAndGet()
    }

    fun end() {
        count.decrementAndGet()
    }
}

/**
 * Whether Update waits for an upload (`busy`): only while the runner is at
 * work. A queued job is no reason: one paused because the site wants this very
 * update would otherwise hold it back for ever.
 */
fun updateWaits(uploadRunning: Boolean): Boolean = uploadRunning
