package eu.anotherroot.salsa

import java.util.Locale

/** The page's theme, as `src/app.html` tells it through `SalsaBars`. */
enum class Scheme { LIGHT, DARK }

/** `"light"` or `"dark"`; anything else is ignored. */
fun schemeFor(message: String?): Scheme? = when (message) {
    "light" -> Scheme.LIGHT
    "dark" -> Scheme.DARK
    else -> null
}

/**
 * How the system bars and the keyboard are shared between the WebView and the
 * page. [pad] is the WebView's padding (left, top, right, bottom, in device px);
 * [safeTop] and [safeBottom] are what the page is told it runs under.
 */
data class InsetSplit(
    val padLeft: Int,
    val padTop: Int,
    val padRight: Int,
    val padBottom: Int,
    val safeTop: Int,
    val safeBottom: Int,
)

/**
 * Under the bars ([underBars]): the page draws under the status bar and the
 * navigation bar and pads itself by `--safe-top` / `--safe-bottom`, so the band
 * fills the status bar and the tab bar runs to the bottom edge. The sides (a
 * cutout, a side navigation bar in landscape) stay padded: the page does not
 * lay out for them.
 *
 * The keyboard is always padded: the WebView shrinks above it, as a browser
 * does, and nothing under it is the page's to pad.
 *
 * Without [underBars] (a WebView too old to hand the page its insets) every
 * bar is padded, as before.
 *
 * In [fullscreen] (a page that asked for it: the video player) the bars are
 * hidden and nothing but the keyboard is padded, so a field in a popup there
 * still sits above it.
 */
fun splitInsets(
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
    keyboard: Int,
    underBars: Boolean,
    fullscreen: Boolean = false,
): InsetSplit {
    val typing = keyboard > 0
    if (fullscreen) return InsetSplit(0, 0, 0, keyboard, safeTop = 0, safeBottom = 0)
    return InsetSplit(
        padLeft = left,
        padTop = if (underBars) 0 else top,
        padRight = right,
        padBottom = when {
            typing -> maxOf(keyboard, if (underBars) 0 else bottom)
            underBars -> 0
            else -> bottom
        },
        safeTop = if (underBars) top else 0,
        safeBottom = if (underBars && !typing) bottom else 0,
    )
}

/**
 * The script that hands the page its insets in CSS px: kept in
 * `window.appInsets` for `src/app.html` to apply before the first paint, and
 * applied at once when the page is already there.
 */
fun insetsScript(top: Int, bottom: Int, density: Float): String {
    fun css(px: Int) = String.format(Locale.ROOT, "%.2f", px / density)
    return "window.appInsets={top:${css(top)},bottom:${css(bottom)},left:0,right:0};" +
        "window.applyAppInsets&&window.applyAppInsets();"
}
