package eu.anotherroot.salsa

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.ServiceInfo
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.ForegroundInfo

/** The app's notifications: the running upload, each upload's outcome, and the daily reminder. */
object Notify {
    private const val UPLOADING = "uploading"
    private const val RESULTS = "results"
    private const val REMINDERS = "reminders"

    /** The ongoing upload notification; one id, so each video replaces the last. */
    const val PROGRESS_ID = 1
    const val REMINDER_ID = 2
    const val UNPAIRED_ID = 3

    fun channels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(UPLOADING, "Uploading", NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(RESULTS, "Uploads finished", NotificationManager.IMPORTANCE_DEFAULT))
        nm.createNotificationChannel(NotificationChannel(REMINDERS, "Practice reminder", NotificationManager.IMPORTANCE_DEFAULT))
    }

    fun progress(context: Context, title: String, text: String, percent: Int?): ForegroundInfo {
        channels(context)
        val n = NotificationCompat.Builder(context, UPLOADING)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, percent ?: 0, percent == null)
            .build()
        return ForegroundInfo(PROGRESS_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    }

    /** One per video, so three finished uploads read as three lines. Tapping opens [path]. */
    fun result(context: Context, id: Int, title: String, text: String?, path: String) =
        post(context, id, RESULTS, title, text, path)

    fun unpaired(context: Context) = post(
        context, UNPAIRED_ID, RESULTS, "Pair the app again",
        "The server no longer knows this phone. Tap to pair it.", "/device/pair",
    )

    fun reminder(context: Context, title: String, text: String, path: String) =
        post(context, REMINDER_ID, REMINDERS, title, text, path)

    private fun post(context: Context, id: Int, channel: String, title: String, text: String?, path: String) {
        // Also false when the user has turned this app's notifications off; true below Android 13 otherwise.
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        channels(context)
        val tap = PendingIntent.getActivity(
            context, id, webIntent(context, path), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(context, channel)
            .setSmallIcon(if (channel == REMINDERS) android.R.drawable.ic_popup_reminder else android.R.drawable.stat_sys_upload_done)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(text?.let { NotificationCompat.BigTextStyle().bigText(it) })
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(id, n)
    }
}
