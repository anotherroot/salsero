package eu.anotherroot.salsa

import android.content.Context
import android.content.Intent
import androidx.core.net.toUri

/** Opens [path] on the site in the app. A path under /bachata opens in that dance's task. */
fun webIntent(context: Context, path: String): Intent {
    val launcher = if (path.startsWith("/bachata")) BachataLauncher::class.java else SalsaLauncher::class.java
    return Intent(context, launcher)
        .setData((BuildConfig.SITE + path).toUri())
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}

fun openWeb(context: Context, path: String) = context.startActivity(webIntent(context, path))

/** Sends the user to `/device/pair`, remembering [link] to resume once the token arrives. */
fun startPairing(context: Context, link: String?) {
    Prefs.setPendingLink(context, link)
    openWeb(context, "/device/pair")
}
