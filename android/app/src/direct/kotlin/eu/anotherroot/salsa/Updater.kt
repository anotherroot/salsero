package eu.anotherroot.salsa

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import java.io.File

/**
 * Installs a downloaded update over this app through a [PackageInstaller]
 * session. Ported from the parent app's `UpdaterPlugin.kt`
 * (`~/Projects/parent-workout-app/updater`), which already waits for Android's
 * answer after its Update screen.
 *
 * Android 12+ is asked to update without the "Update?" screen
 * (`USER_ACTION_NOT_REQUIRED`, which needs this app to be its own installer of
 * record); where that is not granted the session asks for the screen and the
 * caller opens it. Direct channel only: Play forbids an app updating itself.
 */
object Updater {
    private const val TAG = "updater"
    private const val ACTION_PREFIX = "eu.anotherroot.salsa.UPDATE_INSTALL_"

    /**
     * Blocking (it copies [apk] into the session): call it off the main thread.
     * [confirm] gets Android's "Update?" screen to open, on the main thread;
     * the caller opens it and says `confirming`. [reply] gets `cancelled` or
     * `failed:install`. A successful update replaces this process, so it never
     * hears back.
     */
    fun install(context: Context, apk: File, confirm: (Intent) -> Unit, reply: (String) -> Unit) {
        val app = context.applicationContext
        val installer = app.packageManager.packageInstaller
        var sessionId = -1
        var receiver: BroadcastReceiver? = null
        try {
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                setAppPackageName(app.packageName)
                if (Build.VERSION.SDK_INT >= 31) {
                    setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
                }
            }
            sessionId = installer.createSession(params)
            installer.openSession(sessionId).use { session ->
                apk.inputStream().use { input ->
                    session.openWrite("update.apk", 0, apk.length()).use { out ->
                        input.copyTo(out)
                        session.fsync(out)
                    }
                }
                val action = "$ACTION_PREFIX$sessionId"
                receiver = listen(app, action, confirm, reply)
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val pending = PendingIntent.getBroadcast(
                    app, sessionId, Intent(action).setPackage(app.packageName), flags,
                )
                session.commit(pending.intentSender)
            }
        } catch (e: Exception) {
            Log.w(TAG, "install failed", e)
            receiver?.let { runCatching { app.unregisterReceiver(it) } }
            if (sessionId >= 0) runCatching { installer.abandonSession(sessionId) }
            reply("failed:install")
        }
    }

    /**
     * Waits for the session's status broadcasts until it is finished. Called
     * from the install thread; the broadcasts arrive on the main thread.
     */
    private fun listen(app: Context, action: String, confirm: (Intent) -> Unit, reply: (String) -> Unit): BroadcastReceiver {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
                    PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                        val screen = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_INTENT, Intent::class.java)
                        if (screen == null) finish("failed:install") else confirm(screen)
                    }
                    PackageInstaller.STATUS_SUCCESS -> finish(null)
                    PackageInstaller.STATUS_FAILURE_ABORTED -> finish("cancelled")
                    else -> {
                        Log.w(TAG, "install status $status: ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)}")
                        finish("failed:install")
                    }
                }
            }

            private fun finish(value: String?) {
                runCatching { app.unregisterReceiver(this) }
                if (value != null) reply(value)
            }
        }
        ContextCompat.registerReceiver(app, receiver, IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED)
        return receiver
    }
}
