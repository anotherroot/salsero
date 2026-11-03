package eu.anotherroot.salsa

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.webkit.WebView
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

/** From `WebShell.onResume`: back from the "install unknown apps" setting, install what waited for it. */
fun resumeUpdate(shell: WebShell) = SelfUpdate.resume(shell)

/**
 * One update at a time, for the whole process: it outlives the activity, so a
 * recreated screen's page that asks again is told where the running one is.
 * Every field is read and written on the main thread; the network, the files
 * and the session copy run on [io].
 */
private object SelfUpdate {
    const val OBJECT = "salsaUpdate"
    private const val TAG = "update"

    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    /** The page that asked last: replies go there. */
    private var reply: JavaScriptReplyProxy? = null

    /** The screen that asked last, to open the setting from. */
    private var shell: WeakReference<WebShell>? = null

    /** A check, download or session copy is under way: a second `start` only hears where it is. */
    private var running = false

    /** The last reply of the running update, for a page that asks again mid-way. */
    private var last: String? = null

    /** The checked file waiting for "install unknown apps" to be allowed. */
    private var pending: File? = null

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
        io.execute { run(app) }
    }

    fun resume(shell: WebShell) {
        val apk = pending ?: return
        // Asked once: coming back without allowing it ends this try; Update asks again.
        pending = null
        val app = shell.applicationContext
        if (running || !app.packageManager.canRequestPackageInstalls()) return
        this.shell = WeakReference(shell)
        running = true
        // The button stops offering Update while the file goes to Android.
        send(progressMessage(1, 1))
        io.execute { Updater.install(app, apk, ::send) }
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

    /** On [io]. */
    private fun run(app: Context) {
        if (!UploadQueue.store(app).isEmpty()) return send("busy")
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
        main.post { install(app, apk) }
    }

    /** On the main thread, with a checked file. */
    private fun install(app: Context, apk: File) {
        if (app.packageManager.canRequestPackageInstalls()) {
            io.execute { Updater.install(app, apk, ::send) }
            return
        }
        val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${app.packageName}"))
        val screen = shell?.get()?.takeUnless { it.isFinishing || it.isDestroyed }
        try {
            if (screen != null) {
                screen.startActivity(settings)
            } else {
                app.startActivity(settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        } catch (e: ActivityNotFoundException) {
            Log.w(TAG, "install setting", e)
            return send("failed:install")
        }
        pending = apk
        send("permission")
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

    /** Into `<code>.apk.part`, then renamed to [apk]. Stops past the published size: the check then refuses it. */
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
        } catch (e: IOException) {
            part.delete()
            throw e
        } finally {
            conn.disconnect()
        }
        if (!part.renameTo(apk)) {
            part.delete()
            throw IOException("rename ${part.name}")
        }
    }

    private fun connect(url: URL, accept: String) = (url.openConnection() as HttpURLConnection).apply {
        connectTimeout = 20_000
        readTimeout = 60_000
        setRequestProperty("accept", accept)
        setRequestProperty("x-app-version", appVersionHeader(BuildConfig.VERSION_CODE, BuildConfig.DANCE, BuildConfig.CHANNEL))
    }
}
