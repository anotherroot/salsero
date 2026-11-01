package eu.anotherroot.salsa

import android.content.pm.ActivityInfo

/** Whether the page lets the phone turn, as the full-screen video player tells `SalsaTurn`. */
enum class Turning { FREE, PORTRAIT }

/** `"free"` or `"portrait"`; anything else is ignored. */
fun turningFor(message: String?): Turning? = when (message) {
    "free" -> Turning.FREE
    "portrait" -> Turning.PORTRAIT
    else -> null
}

/**
 * The app stands upright: its pages are laid out for a phone held in portrait.
 * Only a video turns with the phone — the page's full-screen player
 * ([pageFree]) or a video WebView shows full screen itself ([fullscreen]) —
 * and then as far as the phone's own rotation lock allows.
 */
fun orientationFor(pageFree: Boolean, fullscreen: Boolean): Int =
    if (pageFree || fullscreen) ActivityInfo.SCREEN_ORIENTATION_FULL_USER else ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
