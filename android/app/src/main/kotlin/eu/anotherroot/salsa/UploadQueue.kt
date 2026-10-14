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
import androidx.work.workDataOf
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Uploads run one at a time, in the order they were queued: one unique chain.
 * The lesson protocol's premise is one stream per file at a time, and a phone's
 * uplink wants that anyway. A worker never fails — it posts its outcome and
 * succeeds — because a failed link in an APPEND chain would cancel the rest.
 */
object UploadQueue {
    const val NAME = "uploads"
    const val KEY_SOURCE = "source"
    const val KEY_SHARED = "shared"
    const val KEY_TARGET = "target"
    const val KEY_ID = "id"
    const val KEY_UPLOAD_ID = "uploadId"
    const val KEY_BACK = "back"
    const val KEY_NAME = "name"
    const val TAG_UPLOAD = "upload:"
    const val TAG_SHARE = "share:"

    /** [source] is a picked content URI, or a shared copy's file (then [shareKey] names its folder). */
    fun enqueue(context: Context, source: Uri, link: Link.Upload, shareKey: String? = null) {
        val uploadId = UUID.randomUUID().toString()
        val request = OneTimeWorkRequestBuilder<UploadWorker>()
            .setInputData(
                workDataOf(
                    KEY_SOURCE to source.toString(),
                    KEY_SHARED to (shareKey != null),
                    KEY_TARGET to if (link.target is Target.Lesson) "lesson" else "figure",
                    KEY_ID to link.target.id,
                    KEY_UPLOAD_ID to uploadId,
                    KEY_BACK to link.back,
                    KEY_NAME to link.name,
                ),
            )
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag(TAG_UPLOAD + uploadId)
            .apply { if (shareKey != null) addTag(TAG_SHARE + shareKey) }
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    /** Tags of uploads not yet finished. Blocking. */
    fun pendingTags(context: Context): List<String> =
        WorkManager.getInstance(context).getWorkInfosForUniqueWork(NAME).get()
            .filter { !it.state.isFinished }
            .flatMap { it.tags }

    /** How many uploads wait behind the running one. Blocking. */
    fun waiting(context: Context): Int =
        WorkManager.getInstance(context).getWorkInfosForUniqueWork(NAME).get()
            .count { it.state == WorkInfo.State.ENQUEUED || it.state == WorkInfo.State.BLOCKED }
}

/** Where shared videos wait for the user to pick a lesson: one folder per share. */
object Shared {
    fun root(context: Context) = File(context.filesDir, "shared")

    fun dir(context: Context, key: String) = File(root(context), key)

    fun files(context: Context, key: String): List<File> =
        dir(context, key).listFiles()?.filter { it.isFile }?.sortedBy { it.name }.orEmpty()
}
