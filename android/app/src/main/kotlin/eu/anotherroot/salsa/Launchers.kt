package eu.anotherroot.salsa

import android.os.Bundle
import android.webkit.CookieManager

/**
 * The two home-screen icons, each the app's screen for one dance: the site in
 * a WebView ([WebShell]), in its own task (the manifest's taskAffinity) so both
 * sit in Recents. A launch with a page of ours in its intent (a notification,
 * the share or link activity) opens that page; any other opens the dance's Today.
 *
 * The classes keep their TWA-era names so home-screen icons pinned to them stay.
 */
abstract class DanceLauncher(private val dance: String) : WebShell() {
    override val barColor: Int get() = R.color.plane

    override fun onCreate(savedInstanceState: Bundle?) {
        markAsApp()
        super.onCreate(savedInstanceState)
        AppStart.onLaunch(this)
    }

    override fun startUrl(data: String?): String =
        if (data != null && isOwnPage(data, BuildConfig.SITE)) data else "${BuildConfig.SITE}/$dance?$APP_PARAM"

    /**
     * Every page in this WebView is in the app. The server sets the same cookie
     * from [APP_PARAM] on the start URL (src/lib/app-mode.ts); setting it here
     * too covers a first open from a notification or a share, which carry no
     * parameter.
     */
    private fun markAsApp() {
        CookieManager.getInstance().setCookie(
            BuildConfig.SITE,
            "salsa_app=android; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly",
        )
    }

    private companion object {
        const val APP_PARAM = "app=android"
    }
}

class SalsaLauncher : DanceLauncher("salsa")

class BachataLauncher : DanceLauncher("bachata")
