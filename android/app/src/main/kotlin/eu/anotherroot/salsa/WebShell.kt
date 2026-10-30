package eu.anotherroot.salsa

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.LayerDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.Gravity
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
import androidx.core.graphics.Insets
import androidx.core.graphics.createBitmap
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONException
import org.json.JSONObject
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

    /** A colour resource: the page's background, shown under the status bar. */
    protected abstract val barColor: Int

    /**
     * A colour resource for the strip under the navigation bar. The page is
     * padded clear of it, so without this the strip shows [barColor] below a
     * page whose bottom tabs are another colour.
     */
    protected open val navBarColor: Int get() = barColor

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

    /** Android's text-to-speech, started the first time a page speaks. */
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    /** What a page asked to say before the engine was ready. */
    private val unspoken = mutableListOf<JSONObject>()

    /** Tells the page's `speechSynthesis` shim when an utterance starts and ends. */
    private var speechReply: JavaScriptReplyProxy? = null

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
        val color = ContextCompat.getColor(this, barColor)
        // Light bars get dark icons; dark bars (night mode) light ones.
        val bars = if (ColorUtils.calculateLuminance(color) > 0.5) {
            SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        } else {
            SystemBarStyle.dark(Color.TRANSPARENT)
        }
        enableEdgeToEdge(bars, bars)

        // Two layers: the page colour everywhere, and a band at the bottom, as
        // tall as the navigation bar, in the colour of the tabs that sit on it.
        val background = LayerDrawable(
            arrayOf(ColorDrawable(color), ColorDrawable(ContextCompat.getColor(this, navBarColor))),
        ).apply {
            setLayerGravity(1, Gravity.BOTTOM or Gravity.FILL_HORIZONTAL)
            setLayerHeight(1, 0)
        }
        root = FrameLayout(this).apply { this.background = background }
        web = WebView(this).apply { setBackgroundColor(color) }
        root.addView(web, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        setContentView(root)
        // The page stays clear of the bars and the keyboard, as it did in the browser.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val pad = if (fullscreen != null) {
                Insets.NONE
            } else {
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or
                        WindowInsetsCompat.Type.ime(),
                )
            }
            val navBar = if (fullscreen != null) 0 else insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            background.setLayerHeight(1, navBar)
            view.setPadding(pad.left, pad.top, pad.right, pad.bottom)
            WindowInsetsCompat.CONSUMED
        }

        setUp(web)
        onBackPressedDispatcher.addCallback(this) { back() }
        if (savedInstanceState == null || !restoresPage || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(startUrl(intent?.dataString))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUp(web: WebView) {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Sounds the page starts from code (a timer's alarm) play, as they do in the browser.
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
        }
        CookieManager.getInstance().setAcceptCookie(true)
        web.webViewClient = Client()
        web.webChromeClient = Chrome()
        web.setDownloadListener { url, userAgent, disposition, mime, _ -> download(url, userAgent, disposition, mime) }
        wakeLockBridge(web)
        speechBridge(web)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // A notification or the link activity asks for a page; a plain icon tap keeps the one open.
        val data = intent.dataString ?: return
        if (alive) web.loadUrl(startUrl(data))
    }

    override fun onResume() {
        super.onResume()
        if (alive) web.onResume()
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
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
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

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) = keepAwake(false)

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
        Toast.makeText(this, getString(R.string.downloading, name), Toast.LENGTH_SHORT).show()
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
