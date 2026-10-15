package eu.anotherroot.salsa

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.time.ZonedDateTime

/**
 * The daily reminder's alarm. Inexact, so it needs no exact-alarm permission,
 * but allowed while idle: a phone lying on a table in the evening is in Doze,
 * where a plain alarm — and the job after it — would wait for the next
 * maintenance window. The alarm's brief idle exemption is spent on an
 * expedited job that asks the server right away.
 */
object Reminders {
    /** Sets the next alarm for [minute] of the day, or cancels it when null. */
    fun schedule(context: Context, minute: Int?) {
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(
            context, 0, Intent(context, ReminderReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        if (minute == null) return am.cancel(pi)
        val at = nextFire(ZonedDateTime.now(), minute).toInstant().toEpochMilli()
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }
}

/** The alarm went off: ask the server what is due, and set tomorrow's. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Reminders.schedule(context, Prefs.reminderMinute(context))
        // No network constraint: offline means silent, not a late nudge at 3 am.
        WorkManager.getInstance(context).enqueueUniqueWork(
            "reminder", ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<ReminderWorker>()
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build(),
        )
    }
}

/** Alarms do not survive a reboot; this puts the reminder back from the last known time. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) Reminders.schedule(context, Prefs.reminderMinute(context))
    }
}

class ReminderWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    /** Below Android 12 an expedited job runs as a short foreground service, which needs this. */
    override suspend fun getForegroundInfo(): ForegroundInfo =
        Notify.progress(applicationContext, "Practice reminder", "Checking what is due", null)

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        try {
            val due = Api.today(ctx)
            val (title, body) = reminderText(due) ?: return Result.success()
            Notify.reminder(ctx, title, body, "/${danceToOpen(due) ?: "salsa"}")
        } catch (e: Unpaired) {
            Notify.unpaired(ctx)
        } catch (e: Exception) {
            // Offline or the server is down: no list is better than a stale one.
        }
        return Result.success()
    }
}

/** Re-reads the settings and reschedules: on every launch, and after pairing. */
class ConfigWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val ctx = applicationContext
        return try {
            val config = Api.config(ctx)
            Prefs.setReminderMinute(ctx, config.reminderMinute)
            Reminders.schedule(ctx, config.reminderMinute)
            Result.success()
        } catch (e: Unpaired) {
            Result.success() // not paired yet: nothing to schedule
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        fun enqueue(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                "config", ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<ConfigWorker>()
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .build(),
            )
        }
    }
}
