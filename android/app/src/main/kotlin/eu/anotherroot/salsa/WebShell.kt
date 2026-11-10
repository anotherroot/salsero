package eu.anotherroot.salsa

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
import androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.core.graphics.createBitmap
import androidx.core.graphics.scale
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONException
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.Locale

/**
 * The site in the app's own window: a WebView, not a Trusted Web Activity.
 *
 * A TWA shows the page in the browser's own activity, so Android reports the
 * browser as the app in front: a blocker or Digital Wellbeing sees Brave, and
 * an exception made for this app never applies (the Android spec's »A
 * WebView, not a TWA«). In a WebView the page runs inside this package.
 *
 * What the browser did for free and this does by hand: the mic and camera,
 * file pickers, fullscreen video, downloads, keeping the screen on, speech
 * (WebView has no `speechSynthesis`), Back, and sending every other site to
 * the browser. Only pages on [BuildConfig.SITE]
 * load here: the WebView holds the login cookie.
 *
 * Kept the same as guitar's (`~/Projects/guitar`), where it started.
 */
abstract class WebShell : ComponentActivity() {
    /** The page a launch opens; [data] is the intent's address, or null. */
    protected abstract fun startUrl(data: String?): String

    /** A colour resource: the page's background, the WebView's and the window's, before the page paints. */
    protected abstract val pageColor: Int

    /**
     * After Android killed the app in the background, reopen the page that was
     * open (true), or start over at [startUrl] (false: for a page that needs
     * what the start URL carries).
     */
    protected open val restoresPage: Boolean get() = true

    private lateinit var root: FrameLayout
    private lateinit var web: WebView

    /** False once the renderer is gone: that WebView must not be touched again. */
    private var alive = true
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermission: PermissionRequest? = null
    private var fullscreen: View? = null
    private var fullscreenDone: WebChromeClient.CustomViewCallback? = null

    /** The page's full-screen video player is open and lets the phone turn ([turnBridge]). */
    private var pageTurns = false

    /**
     * The page runs under the system bars and is told their heights (`--safe-top`,
     * `--safe-bottom`; [splitInsets]). Needs a document-start script, so the heights
     * are there before the first paint; without one, the bars pad the WebView.
     */
    private val underBars = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)

    /** The last [insetsScript] sent, and the document-start copy of it every new page runs. */
    private var insets: String? = null
    private var insetsAtStart: ScriptHandler? = null

    /** Android's text-to-speech, started the first time a page speaks. */
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    /** What a page asked to say before the engine was ready. */
    private val unspoken = mutableListOf<JSONObject>()

    /** Tells the page's `speechSynthesis` shim when an utterance starts and ends. */
    private var speechReply: JavaScriptReplyProxy? = null

    /** The page that asked to be told about screenshots ([shotBridge]); a new page asks again. */
    private var shotReply: JavaScriptReplyProxy? = null

    /** Android 14's screenshot callback, made once ([watchScreenshots]). */
    private var screenshotCallback: Any? = null

    private val pickFiles = registerForActivityResult(StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }

    private val askAndroid = registerForActivityResult(RequestMultiplePermissions()) {
        pendingPermission?.let(::answer)
        pendingPermission = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        turn()
        val page = ContextCompat.getColor(this, pageColor)
        // Light icons on the status bar: the band under it is dark in every theme.
        // The navigation bar's follow the page's theme once it says ([barsBridge]).
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), barStyle(page))
        root = FrameLayout(this).apply { setBackgroundColor(page) }
        web = WebView(this).apply { setBackgroundColor(page) }
        root.addView(web, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        setContentView(root)
        // The page runs under the status and navigation bars and pads itself by
        // what it is told ([splitInsets]); the keyboard and the sides pad the WebView.
        // In full screen (the video player) only the keyboard pads: without it a
        // popup's field there sat under the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val full = fullscreen != null
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
            val split = splitInsets(bars.left, bars.top, bars.right, bars.bottom, keyboard, underBars, full)
            view.setPadding(split.padLeft, split.padTop, split.padRight, split.padBottom)
            if (underBars && !full) tellInsets(split.safeTop, split.safeBottom)
            WindowInsetsCompat.CONSUMED
        }

        setUp(web)
        onBackPressedDispatcher.addCallback(this) { back() }
        if (savedInstanceState == null || !restoresPage || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(startUrl(intent?.dataString))
        }
    }

    /**
     * Hands the page the bars' heights: for the page already open, and for every
     * page after it (a document-start script, replaced when they change).
     */
    private fun tellInsets(top: Int, bottom: Int) {
        val script = insetsScript(top, bottom, resources.displayMetrics.density)
        if (script == insets || !alive) return
        insets = script
        insetsAtStart?.remove()
        insetsAtStart = WebViewCompat.addDocumentStartJavaScript(web, script, setOf(BuildConfig.SITE))
        web.evaluateJavascript(script, null)
    }

    /** Light bars get dark icons; dark bars (the bands, night mode) light ones. */
    private fun barStyle(color: Int) = if (ColorUtils.calculateLuminance(color) > 0.5) {
        SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
    } else {
        SystemBarStyle.dark(Color.TRANSPARENT)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUp(web: WebView) {
        // The page scrolls without a bar of its own, as a native screen does: WebView's
        // ran the full height, over the band and the tab bar.
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Sounds the page starts from code (a timer's alarm) play, as they do in the browser.
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = appUserAgent(userAgentString, BuildConfig.VERSION_CODE, BuildConfig.DANCE, BuildConfig.CHANNEL)
        }
        CookieManager.getInstance().setAcceptCookie(true)
        web.webViewClient = Client()
        web.webChromeClient = Chrome()
        web.setDownloadListener { url, userAgent, disposition, mime, _ -> download(url, userAgent, disposition, mime) }
        wakeLockBridge(web)
        speechBridge(web)
        barsBridge(web)
        turnBridge(web)
        shotBridge(web)
        // The Update button (direct build; the Play build's does nothing).
        installUpdateBridge(this, web)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // A notification or the link activity asks for a page; a plain icon tap keeps the one open.
        val data = intent.dataString ?: return
        if (alive) web.loadUrl(startUrl(data))
    }

    override fun onStart() {
        super.onStart()
        watchScreenshots(true)
    }

    override fun onStop() {
        watchScreenshots(false)
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        if (alive) web.onResume()
        // Back from allowing "install unknown apps": the update that waited for it installs.
        resumeUpdate(this)
    }

    override fun onPause() {
        if (alive) web.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (alive) web.saveState(outState)
    }

    override fun onDestroy() {
        tts?.shutdown()
        if (alive) web.destroy()
        super.onDestroy()
    }

    private fun back() {
        when {
            fullscreen != null -> leaveFullscreen()
            alive && web.canGoBack() -> web.goBack()
            // The first page: leave the app the way Home does, keeping the page.
            else -> moveTaskToBack(true)
        }
    }

    private fun open(intent: Intent) {
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, Prefs.words(this).noAppForLink, Toast.LENGTH_SHORT).show()
        }
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            // Frames inside a page (a YouTube embed) load as the page asks.
            if (!request.isForMainFrame) return false
            return when (navigationFor(request.url.toString(), BuildConfig.SITE)) {
                Nav.INSIDE -> false
                Nav.APP_LINK -> {
                    open(Intent(Intent.ACTION_VIEW, request.url).setPackage(packageName))
                    true
                }
                Nav.OUTSIDE -> {
                    open(Intent(Intent.ACTION_VIEW, request.url))
                    true
                }
                Nav.BLOCKED -> true
            }
        }

        // A new page starts with the screen free to dim, and upright: its player asks again.
        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            keepAwake(false)
            shotReply = null
            pageTurns = false
            turn()
        }

        // A page that started before the first insets arrived still gets them.
        override fun onPageCommitVisible(view: WebView, url: String?) {
            insets?.let { view.evaluateJavascript(it, null) }
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // The page's renderer crashed or was killed for memory: start the screen over
            // rather than let the whole app crash.
            alive = false
            root.removeView(view)
            view.destroy()
            recreate()
            return true
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            if (navigationFor(request.origin.toString(), BuildConfig.SITE) != Nav.INSIDE) return request.deny()
            val missing = request.resources.mapNotNull(ANDROID_PERMISSION::get).filterNot(::granted)
            if (missing.isEmpty()) return answer(request)
            pendingPermission?.deny()
            pendingPermission = request
            askAndroid.launch(missing.toTypedArray())
        }

        override fun onPermissionRequestCanceled(request: PermissionRequest) {
            if (pendingPermission == request) pendingPermission = null
        }

        override fun onShowFileChooser(
            view: WebView,
            callback: ValueCallback<Array<Uri>>,
            params: FileChooserParams,
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            val pick = params.createIntent()
            if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            return try {
                fileCallback = callback
                pickFiles.launch(pick)
                true
            } catch (e: ActivityNotFoundException) {
                fileCallback = null
                false
            }
        }

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (fullscreen != null) return callback.onCustomViewHidden()
            val frame = FrameLayout(this@WebShell).apply {
                setBackgroundColor(Color.BLACK)
                addView(view, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            }
            fullscreen = frame
            fullscreenDone = callback
            root.addView(frame, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            systemBars(show = false)
            turn()
        }

        override fun onHideCustomView() = leaveFullscreen()

        // Without this a <video> with no poster shows WebView's grey placeholder.
        override fun getDefaultVideoPoster(): Bitmap = createBitmap(1, 1)
    }

    private fun leaveFullscreen() {
        val frame = fullscreen ?: return
        fullscreen = null
        root.removeView(frame)
        systemBars(show = true)
        turn()
        fullscreenDone?.onCustomViewHidden()
        fullscreenDone = null
    }

    private fun systemBars(show: Boolean) {
        val controller = WindowCompat.getInsetsController(window, root)
        if (show) {
            controller.show(WindowInsetsCompat.Type.systemBars())
        } else {
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        }
        ViewCompat.requestApplyInsets(root)
    }

    /** Passes on the page permissions whose Android permission the app holds; refuses the rest. */
    private fun answer(request: PermissionRequest) {
        val allowed = request.resources.filter { ANDROID_PERMISSION[it]?.let(::granted) == true }
        if (allowed.isEmpty()) request.deny() else request.grant(allowed.toTypedArray())
    }

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    /** A download from our site goes to Downloads, carrying the login cookie. Others open in the browser. */
    private fun download(url: String, userAgent: String, disposition: String?, mime: String?) {
        when (navigationFor(url, BuildConfig.SITE)) {
            Nav.INSIDE -> Unit
            Nav.OUTSIDE -> return open(Intent(Intent.ACTION_VIEW, url.toUri()))
            else -> return
        }
        val name = URLUtil.guessFileName(url, disposition, mime)
        val request = DownloadManager.Request(url.toUri())
            .setTitle(name)
            .setMimeType(mime)
            .addRequestHeader("User-Agent", userAgent)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
        CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
        getSystemService(DownloadManager::class.java).enqueue(request)
        Toast.makeText(this, Prefs.words(this).downloading(name), Toast.LENGTH_SHORT).show()
    }

    /**
     * `navigator.wakeLock` for our pages, backed by the window's keep-screen-on
     * flag. WebView's own support for the Screen Wake Lock API is not something
     * to count on, so the page always gets this one. Old WebViews without the
     * two features keep whatever they have.
     */
    private fun wakeLockBridge(web: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        val origin = setOf(BuildConfig.SITE)
        WebViewCompat.addWebMessageListener(web, WAKE_LOCK_OBJECT, origin) { _, message, _, isMainFrame, _ ->
            if (isMainFrame) keepAwake(message.data == "on")
        }
        WebViewCompat.addDocumentStartJavaScript(web, WAKE_LOCK_SHIM, origin)
    }

    /**
     * The navigation bar's icons follow the page's theme, which Settings may set
     * apart from the phone's: `src/app.html` says `light` or `dark` ([schemeFor]).
     */
    private fun barsBridge(web: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        val origin = setOf(BuildConfig.SITE)
        WebViewCompat.addWebMessageListener(web, BARS_OBJECT, origin) { _, message, _, isMainFrame, _ ->
            if (!isMainFrame) return@addWebMessageListener
            val scheme = schemeFor(message.data) ?: return@addWebMessageListener
            runOnUiThread {
                WindowCompat.getInsetsController(window, root).isAppearanceLightNavigationBars = scheme == Scheme.LIGHT
            }
        }
    }

    /**
     * The app stands upright; the page's full-screen video player posts `free`
     * while it is open and `portrait` when it closes ([turningFor], [orientationFor]).
     */
    private fun turnBridge(web: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        val origin = setOf(BuildConfig.SITE)
        WebViewCompat.addWebMessageListener(web, TURN_OBJECT, origin) { _, message, _, isMainFrame, _ ->
            if (!isMainFrame) return@addWebMessageListener
            val turning = turningFor(message.data) ?: return@addWebMessageListener
            runOnUiThread {
                pageTurns = turning == Turning.FREE
                turn()
            }
        }
    }

    private fun turn() {
        requestedOrientation = orientationFor(pageTurns, fullscreen != null)
    }

    /**
     * Send feedback ([Shot.kt]): the page posts [SHOT_LISTEN] to `SalsaShot` and
     * is told, from then on, about each screenshot taken while it shows.
     */
    private fun shotBridge(web: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(web, SHOT_OBJECT, setOf(BuildConfig.SITE)) { _, message, _, isMainFrame, reply ->
            if (isMainFrame && message.data == SHOT_LISTEN) shotReply = reply
        }
    }

    /** Android 14 and later say when a screenshot is taken while this screen shows; earlier ones never do. */
    private fun watchScreenshots(on: Boolean) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        val callback = (screenshotCallback as? Activity.ScreenCaptureCallback)
            ?: Activity.ScreenCaptureCallback { captureShot() }.also { screenshotCallback = it }
        try {
            if (on) registerScreenCaptureCallback(mainExecutor, callback) else unregisterScreenCaptureCallback(callback)
        } catch (e: RuntimeException) {
            // Not registered (a stop before a start) or not allowed: no offer, nothing else changes.
        }
    }

    /**
     * Copies this window as it is now (the system's own screenshot is its own
     * window, not in it), shrinks it and posts the page a JPEG data URL. The
     * page's video shows only when the WebView draws it; a full-screen video
     * may come out black.
     */
    private fun captureShot() {
        val reply = shotReply ?: return
        val view = window.decorView
        if (!alive || view.width == 0 || view.height == 0) return
        val full = createBitmap(view.width, view.height)
        PixelCopy.request(window, full, { result ->
            if (result != PixelCopy.SUCCESS) {
                full.recycle()
                return@request
            }
            Thread {
                val url = try {
                    jpegDataUrl(full)
                } catch (e: RuntimeException) {
                    null
                } finally {
                    full.recycle()
                }
                if (url != null) runOnUiThread { if (shotReply === reply && alive) reply.postMessage(url) }
            }.start()
        }, Handler(Looper.getMainLooper()))
    }

    private fun jpegDataUrl(bitmap: Bitmap): String {
        val size = shotSize(bitmap.width, bitmap.height)
        val small = if (size.width == bitmap.width) bitmap else bitmap.scale(size.width, size.height)
        val out = ByteArrayOutputStream()
        small.compress(Bitmap.CompressFormat.JPEG, 75, out)
        if (small !== bitmap) small.recycle()
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    /**
     * `speechSynthesis` for our pages, spoken by Android's TextToSpeech: the
     * engine Chrome on Android speaks with, so rate, pitch, volume and the
     * default voice behave as they did there. No voice list: a page gets the
     * phone's default voice, or [lang]'s.
     */
    private fun speechBridge(web: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        val origin = setOf(BuildConfig.SITE)
        WebViewCompat.addWebMessageListener(web, SPEECH_OBJECT, origin) { _, message, _, isMainFrame, reply ->
            if (!isMainFrame) return@addWebMessageListener
            speechReply = reply
            val asked = try {
                JSONObject(message.data ?: return@addWebMessageListener)
            } catch (e: JSONException) {
                return@addWebMessageListener
            }
            when (asked.optString("op")) {
                "speak" -> if (ttsReady) say(asked) else wakeSpeech(asked)
                "cancel" -> {
                    unspoken.clear()
                    tts?.stop()
                }
            }
        }
        WebViewCompat.addDocumentStartJavaScript(web, SPEECH_SHIM, origin)
    }

    /** Starts the engine and keeps [first] (and anything after it) until it is ready. */
    private fun wakeSpeech(first: JSONObject) {
        unspoken += first
        if (tts != null) return
        tts = TextToSpeech(applicationContext) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.setOnUtteranceProgressListener(Progress())
                unspoken.forEach(::say)
            } else {
                // No engine on this phone, or it failed: say so, and try again next time.
                unspoken.forEach { tellSpeech("error", it.optString("id")) }
                tts?.shutdown()
                tts = null
            }
            unspoken.clear()
        }
    }

    private fun say(asked: JSONObject) {
        val engine = tts ?: return
        engine.setSpeechRate(asked.optDouble("rate", 1.0).toFloat())
        engine.setPitch(asked.optDouble("pitch", 1.0).toFloat())
        asked.optString("lang").takeIf { it.isNotBlank() }?.let { engine.language = Locale.forLanguageTag(it) }
        val params = Bundle().apply {
            putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, asked.optDouble("volume", 1.0).toFloat())
        }
        engine.speak(asked.optString("text"), TextToSpeech.QUEUE_ADD, params, asked.optString("id"))
    }

    /** Posts `start:<id>`, `end:<id>` or `error:<id>` back to the page, on the main thread. */
    // A reply proxy only exists once speechBridge found WEB_MESSAGE_LISTENER.
    @SuppressLint("RequiresFeature")
    private fun tellSpeech(event: String, id: String?) {
        if (id.isNullOrEmpty()) return
        runOnUiThread { speechReply?.postMessage("$event:$id") }
    }

    private inner class Progress : UtteranceProgressListener() {
        override fun onStart(id: String?) = tellSpeech("start", id)
        override fun onDone(id: String?) = tellSpeech("end", id)

        @Deprecated("Deprecated in Java")
        override fun onError(id: String?) = tellSpeech("error", id)
        override fun onError(id: String?, errorCode: Int) = tellSpeech("error", id)
    }

    private fun keepAwake(on: Boolean) {
        if (on) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private companion object {
        /** The Android permission behind each page permission the app passes on. Others are refused. */
        val ANDROID_PERMISSION = mapOf(
            PermissionRequest.RESOURCE_AUDIO_CAPTURE to Manifest.permission.RECORD_AUDIO,
            PermissionRequest.RESOURCE_VIDEO_CAPTURE to Manifest.permission.CAMERA,
        )

        const val BARS_OBJECT = "SalsaBars"

        const val TURN_OBJECT = "SalsaTurn"

        /** Send feedback's screenshots ([shotBridge]); the page's `offer.svelte.ts` reads the same name. */
        const val SHOT_OBJECT = "SalsaShot"

        const val WAKE_LOCK_OBJECT = "appWakeLock"

        /** Screen wake locks as the spec has them, released when the page is hidden. */
        val WAKE_LOCK_SHIM = """
            (() => {
              const held = new Set();
              const tell = () => $WAKE_LOCK_OBJECT.postMessage(held.size ? 'on' : 'off');
              class WakeLockSentinel extends EventTarget {
                type = 'screen';
                released = false;
                onrelease = null;
                async release() {
                  if (this.released) return;
                  this.released = true;
                  held.delete(this);
                  tell();
                  const e = new Event('release');
                  this.dispatchEvent(e);
                  if (typeof this.onrelease === 'function') this.onrelease(e);
                }
              }
              const wakeLock = {
                async request(type = 'screen') {
                  if (type !== 'screen') throw new TypeError('Only screen wake locks');
                  if (document.visibilityState !== 'visible') {
                    throw new DOMException('The page is not visible', 'NotAllowedError');
                  }
                  const sentinel = new WakeLockSentinel();
                  held.add(sentinel);
                  tell();
                  return sentinel;
                },
              };
              Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true });
              document.addEventListener('visibilitychange', () => {
                if (document.hidden) for (const s of [...held]) s.release();
              });
            })();
        """.trimIndent()

        const val SPEECH_OBJECT = "appSpeech"

        /**
         * `speechSynthesis` and `SpeechSynthesisUtterance`, passed to the app.
         * speak, cancel, and start / end / error events; an utterance that
         * cancel drops gets no event. pause and resume do nothing.
         */
        val SPEECH_SHIM = """
            (() => {
              const live = new Map();
              let next = 0;
              class SpeechSynthesisUtterance extends EventTarget {
                constructor(text = '') {
                  super();
                  this.text = String(text);
                  this.lang = '';
                  this.voice = null;
                  this.volume = 1;
                  this.rate = 1;
                  this.pitch = 1;
                  this.onstart = null;
                  this.onend = null;
                  this.onerror = null;
                }
              }
              const fire = (u, type) => {
                const e = new Event(type);
                u.dispatchEvent(e);
                const handler = u['on' + type];
                if (typeof handler === 'function') handler.call(u, e);
              };
              const synth = {
                speaking: false,
                pending: false,
                paused: false,
                onvoiceschanged: null,
                speak(u) {
                  const id = String(++next);
                  live.set(id, u);
                  $SPEECH_OBJECT.postMessage(JSON.stringify({
                    op: 'speak', id, text: String(u.text), lang: u.lang || '',
                    rate: Number(u.rate) || 1, pitch: Number(u.pitch) || 1,
                    volume: u.volume == null ? 1 : Number(u.volume),
                  }));
                },
                cancel() {
                  live.clear();
                  synth.speaking = false;
                  $SPEECH_OBJECT.postMessage(JSON.stringify({ op: 'cancel' }));
                },
                pause() {},
                resume() {},
                getVoices() { return []; },
                addEventListener() {},
                removeEventListener() {},
              };
              $SPEECH_OBJECT.onmessage = (event) => {
                const [type, id] = String(event.data).split(':');
                const u = live.get(id);
                if (!u) return;
                if (type === 'start') {
                  synth.speaking = true;
                } else {
                  live.delete(id);
                  synth.speaking = live.size > 0;
                }
                fire(u, type);
              };
              Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
              Object.defineProperty(window, 'SpeechSynthesisUtterance', {
                value: SpeechSynthesisUtterance, configurable: true, writable: true,
              });
            })();
        """.trimIndent()
    }
}
