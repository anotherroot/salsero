package eu.anotherroot.salsa

import android.content.Context
import android.content.Intent
import androidx.core.net.toUri

/** Opens [path] on the site in this app's one screen. */
fun webIntent(context: Context, path: String): Intent =
    Intent(context, launcherClass)
        .setData((BuildConfig.SITE + path).toUri())
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

fun openWeb(context: Context, path: String) = context.startActivity(webIntent(context, path))

/** Pairing this app: `/device/pair`, told which dance's app it is so Settings can name it. */
const val PAIR_PATH = "/device/pair?dance=${BuildConfig.DANCE}"

/** Sends the user to [PAIR_PATH], remembering [link] to resume once the token arrives. */
fun startPairing(context: Context, link: String?) {
    Prefs.setPendingLink(context, link)
    openWeb(context, PAIR_PATH)
}
