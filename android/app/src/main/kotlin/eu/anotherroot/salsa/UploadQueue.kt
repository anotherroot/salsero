package eu.anotherroot.salsa

import android.content.Context
import android.net.Uri
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * The upload queue: jobs on disk (`JobStore`), drained in order by one runner
 * (`UploadWorker`). One runner rather than a job per video because Android 12+
 * lets an app start a foreground service only while it is in front: a runner
 * kicked from LinkActivity, or from a launch, covers the whole batch.
 */
object UploadQueue {
    private const val NAME = "uploads"

    fun store(context: Context) = JobStore(File(context.noBackupFilesDir, "jobs"))

    /** [source] is a picked content URI, or a shared copy's file (then [shareKey] names its folder). */
    fun add(context: Context, source: Uri, link: Link.Upload, shareKey: String? = null) {
        store(context).add(
            Job(
                id = UUID.randomUUID().toString(),
                source = source.toString(),
                shareKey = shareKey,
                target = link.target,
                back = link.back,
                name = link.name,
                queuedAt = System.currentTimeMillis(),
            ),
        )
    }

    /**
     * Makes sure a runner will drain the queue. Call it from the foreground when
     * possible. A runner already running gets one queued behind it, in case it
     * is just finishing; one waiting out a backoff is replaced, so it runs now.
     */
    fun kick(context: Context) {
        val app = context.applicationContext
        Thread { enqueueRunner(app) }.start() // WorkManager's query blocks
    }

    private fun enqueueRunner(context: Context) {
        val wm = WorkManager.getInstance(context)
        val running = try {
            wm.getWorkInfosForUniqueWork(NAME).get().any { it.state == WorkInfo.State.RUNNING }
        } catch (e: Exception) {
            false
        }
        val request = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.LINEAR, 2, TimeUnit.MINUTES)
            .build()
        wm.enqueueUniqueWork(NAME, if (running) ExistingWorkPolicy.APPEND_OR_REPLACE else ExistingWorkPolicy.REPLACE, request)
    }
}

/** Where shared videos wait for the user to pick a lesson: one folder per share. */
object Shared {
    fun root(context: Context) = File(context.filesDir, "shared")

    fun dir(context: Context, key: String) = File(root(context), key)

    fun files(context: Context, key: String): List<File> =
        dir(context, key).listFiles()?.filter { it.isFile }?.sortedBy { it.name }.orEmpty()
}
