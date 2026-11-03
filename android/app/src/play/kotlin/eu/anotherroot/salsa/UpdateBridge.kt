package eu.anotherroot.salsa

import android.webkit.WebView

/*
 * The Play build updates through the store: Play's policy forbids an app
 * updating itself, so this build has no updater, no install permissions and
 * no `salsaUpdate` on the page (the page links to the store instead). The
 * direct build's `src/direct/…/UpdateBridge.kt` is the real one.
 */

@Suppress("UNUSED_PARAMETER")
fun installUpdateBridge(shell: WebShell, web: WebView) = Unit

@Suppress("UNUSED_PARAMETER")
fun resumeUpdate(shell: WebShell) = Unit
