package eu.anotherroot.salsa

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.webkit.WebView
import androidx.lifecycle.Lifecycle
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File
import java.io.IOException
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * The page's Update button, done natively (the app-updates spec, »Pressing
 * Update«): the page posts `start` to `salsaUpdate`; this checks the site,
 * downloads the update into the cache, checks its size and SHA-256 and
 * installs it ([Updater]), replying with what the button shows
 * (`src/lib/app-update/view.ts`): `progress:<0-100>`, `confirming`,
 * `permission`, `busy`, `current`, `failed:offline`, `failed:download`,
 * `failed:check`, `failed:install`, `cancelled`.
 *
 * Direct channel only; `src/play/…/UpdateBridge.kt` registers nothing, so a
 * Play build's page has no `salsaUpdate` and links to the store instead.
 */
@SuppressLint("RequiresFeature") // the listener is only added once WEB_MESSAGE_LISTENER is there
fun installUpdateBridge(shell: WebShell, web: WebView) {
    if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
    WebViewCompat.addWebMessageListener(web, SelfUpdate.OBJECT, setOf(BuildConfig.SITE)) { _, message, _, isMainFrame, reply ->
        if (isMainFrame && message.data == "start") SelfUpdate.start(shell, reply)
    }
}

/**
 * From `WebShell.onResume`: opens Android's "Update?" screen kept while the app
 * was in the background, or installs what waited for "install unknown apps".
 */
fun resumeUpdate(shell: WebShell) = SelfUpdate.resume(shell)

/**
 * One update at a time, for the whole process: it outlives the activity, so a
 * recreated screen's page that asks again is told where the running one is.
 * Every field is read and written on the main thread; the network, the files
 * and the session copy run on [io], whose every task catches what it throws
 * (an exception there would kill the app and leave [running] stuck).
 */
private object SelfUpdate {
    const val OBJECT = "salsaUpdate"
    private const val TAG = "update"

    /** A downloaded file that passed the check, and what it was checked against. */
    private class Checked(val apk: File, val size: Long, val sha256: String)

    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    /** The page that asked last: replies go there. */
    private var reply: JavaScriptReplyProxy? = null

    /** The screen that asked or resumed last, to open the setting and Android's screen from. */
    private var shell: WeakReference<WebShell>? = null

    /** A check, download or install is under way: a second `start` only hears where it is. */
    private var running = false

    /** The last reply of the running update, for a page that asks again mid-way. */
    private var last: String? = null

    /** The checked file waiting for "install unknown apps" to be allowed. */
    private var pending: Checked? = null

    /** Android's "Update?" screen, asked for while the app was in the background ([confirmStep]). */
    private var waitingConfirm: Intent? = null

    fun start(shell: WebShell, reply: JavaScriptReplyProxy) {
        this.reply = reply
        this.shell = WeakReference(shell)
        if (running) {
            last?.let(::post)
            return
        }
        running = true
        last = null
        pending = null
        val app = shell.applicationContext
        io.execute {
            try {
                run(app)
            } catch (e: Exception) {
                Log.w(TAG, "update", e)
                send("failed:download")
            }
        }
    }

    fun resume(shell: WebShell) {
        this.shell = WeakReference(shell)
        val app = shell.applicationContext
        val canInstall = pending != null && app.packageManager.canRequestPackageInstalls()
        when (resumeStep(waitingConfirm != null, pending != null, canInstall)) {
            ResumeStep.CONFIRM -> {
                val screen = waitingConfirm ?: return
                waitingConfirm = null
                launch(shell, screen)
            }
            ResumeStep.INSTALL -> {
                val checked = pending ?: return
                pending = null
                if (running) return
                running = true
                // The button stops offering Update while the file goes to Android.
                send(progressMessage(1, 1))
                installOnIo(app, checked, recheck = true)
            }
            // Asked once: coming back without allowing it ends this try; Update asks again.
            ResumeStep.DROP -> pending = null
            ResumeStep.NOTHING -> Unit
        }
    }

    /**
     * From any thread. Every reply but progress ends this update's part of the
     * work: what follows (Android's screen, a later try) is a new `start`.
     */
    private fun send(message: String) {
        main.post {
            if (!message.startsWith("progress:")) running = false
            last = message
            post(message)
        }
    }

    // A reply proxy only exists once the listener was added (WEB_MESSAGE_LISTENER).
    @SuppressLint("RequiresFeature")
    private fun post(message: String) {
        // A page that has gone (a recreated screen) just misses it.
        try {
            reply?.postMessage(message)
        } catch (e: RuntimeException) {
            Log.w(TAG, "reply", e)
        }
    }

    /** On [io]; [start] catches what it throws. */
    private fun run(app: Context) {
        if (updateWaits(UploadRun.running)) return send("busy")
        val published = try {
            check()
        } catch (e: IOException) {
            Log.w(TAG, "check", e)
            return send("failed:offline")
        }
        if (published == null || !isNewer(published, BuildConfig.VERSION_CODE)) return send("current")

        val dir = File(app.cacheDir, "updates").apply { mkdirs() }
        val apk = File(dir, "${published.versionCode}.apk")
        // Older updates and broken downloads go; a complete one for this version stays.
        dir.listFiles()?.filter { it.name != apk.name }?.forEach { it.delete() }
        if (!matches(apk, published.size, published.sha256)) {
            apk.delete()
            try {
                download(published, dir, apk)
            } catch (e: IOException) {
                Log.w(TAG, "download", e)
                return send("failed:download")
            }
            if (!matches(apk, published.size, published.sha256)) {
                apk.delete()
                return send("failed:check")
            }
        }
        val checked = Checked(apk, published.size, published.sha256)
        main.post { install(app, checked) }
    }

    /** On the main thread, with a checked file. */
    private fun install(app: Context, checked: Checked) {
        if (app.packageManager.canRequestPackageInstalls()) return installOnIo(app, checked, recheck = false)
        val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${app.packageName}"))
        val screen = shell?.get()?.takeUnless { it.isFinishing || it.isDestroyed }
        try {
            if (screen != null) {
                screen.startActivity(settings)
            } else {
                app.startActivity(settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        } catch (e: Exception) {
            Log.w(TAG, "install setting", e)
            return send("failed:install")
        }
        pending = checked
        send("permission")
    }

    /**
     * The last step, on [io]. Not while an upload is running (installing ends
     * this process, and the upload with it): `busy`, and the page asks again.
     * A job only queued (paused for this update, backing off) does not wait:
     * it is on disk, and the next launch carries on with it.
     * A file that waited for the setting is checked again first.
     */
    private fun installOnIo(app: Context, checked: Checked, recheck: Boolean) {
        io.execute {
            try {
                if (updateWaits(UploadRun.running)) return@execute send("busy")
                if (recheck && !matches(checked.apk, checked.size, checked.sha256)) {
                    checked.apk.delete()
                    return@execute send("failed:check")
                }
                Updater.install(app, checked.apk, ::confirm, ::send)
            } catch (e: Exception) {
                Log.w(TAG, "install", e)
                send("failed:install")
            }
        }
    }

    /** The session wants Android's "Update?" screen. On the main thread (the install broadcast). */
    private fun confirm(screen: Intent) {
        val live = shell?.get()?.takeIf { it.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) }
        when (confirmStep(live != null)) {
            ConfirmStep.LAUNCH -> launch(live ?: return, screen)
            // Android 10+ would silently block it from the background: [resume] opens it.
            ConfirmStep.KEEP -> waitingConfirm = screen
        }
    }

    /** Opens Android's "Update?" screen over [shell]; if it can't, the button comes back. */
    private fun launch(shell: WebShell, screen: Intent) {
        try {
            shell.startActivity(screen)
            send("confirming")
        } catch (e: Exception) {
            Log.w(TAG, "confirm screen", e)
            send("cancelled")
        }
    }

    /** `GET /api/app-update/<dance>`: null when nothing is published (404). Throws [IOException] otherwise. */
    private fun check(): Published? {
        val conn = connect(URL("${BuildConfig.SITE}/api/app-update/${BuildConfig.DANCE}"), "application/json")
        try {
            val status = conn.responseCode
            if (status == 404) return null
            if (status !in 200..299) throw HttpError(status, Api.errorBody(conn))
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            return parsePublished(body) ?: throw IOException("not an update: ${body.take(200)}")
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Into `<code>.apk.part`, then renamed to [apk] once exactly the published
     * size arrived; short or long is a broken download.
     */
    private fun download(published: Published, dir: File, apk: File) {
        val url = URL(URL(BuildConfig.SITE), published.url)
        if (!url.toString().startsWith(BuildConfig.SITE + "/")) throw IOException("update not on the site: $url")
        val part = File(dir, "${published.versionCode}.apk.part")
        val conn = connect(url, "application/vnd.android.package-archive")
        try {
            val status = conn.responseCode
            if (status !in 200..299) throw HttpError(status, Api.errorBody(conn))
            var done = 0L
            var told = progressMessage(0, published.size)
            send(told)
            conn.inputStream.use { input ->
                part.outputStream().use { out ->
                    val buffer = ByteArray(64 * 1024)
                    while (done <= published.size) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        out.write(buffer, 0, n)
                        done += n
                        val now = progressMessage(done, published.size)
                        if (now != told) {
                            told = now
                            send(now)
                        }
                    }
                }
            }
            if (done != published.size) throw IOException("got $done of ${published.size} bytes")
            if (!part.renameTo(apk)) throw IOException("rename ${part.name}")
        } catch (e: IOException) {
            part.delete()
            throw e
        } finally {
            conn.disconnect()
        }
    }

    private fun connect(url: URL, accept: String) = (url.openConnection() as HttpURLConnection).apply {
        connectTimeout = 20_000
        readTimeout = 60_000
        setRequestProperty("accept", accept)
        setRequestProperty("x-app-version", appVersionHeader(BuildConfig.VERSION_CODE, BuildConfig.DANCE, BuildConfig.CHANNEL))
    }
}
