package eu.anotherroot.salsa

import java.net.URI
import java.net.URISyntaxException
import java.net.URLDecoder

/**
 * The `salsa://` links the site hands the app (built by `src/lib/app-mode.ts`).
 * Pure: java.net.URI, not android.net.Uri, so it runs in plain JVM tests.
 */
sealed interface Target {
    val id: Long

    data class Lesson(override val id: Long) : Target
    data class Figure(override val id: Long) : Target
}

sealed interface Link {
    /**
     * Pick (or take the shared files under [share]) and upload them to [target].
     * [back] is the site path to open when done, [name] what the notification calls it.
     */
    data class Upload(val target: Target, val share: String?, val back: String, val name: String) : Link

    /** `/device/pair` minted a token for this app. */
    data class Paired(val token: String) : Link
}

const val SCHEME = "salsa"

/** The key a shared file is kept under: a uuid the app made. Same as the site's SHARE_KEY_RE. */
val SHARE_KEY = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

fun parseLink(uri: String): Link? {
    val parsed = try {
        URI(uri)
    } catch (e: URISyntaxException) {
        return null
    }
    if (parsed.scheme != SCHEME) return null
    val query = parsed.rawQuery.orEmpty().split('&').filter { it.isNotEmpty() }.associate {
        val (k, v) = (it.split('=', limit = 2) + "").take(2)
        k to URLDecoder.decode(v, "UTF-8")
    }
    return when (parsed.host) {
        "upload" -> {
            val lesson = query["lesson"]?.let(::positiveId)
            val figure = query["figure"]?.let(::positiveId)
            val share = query["share"]
            val target = when {
                lesson != null && figure == null -> Target.Lesson(lesson)
                figure != null && lesson == null -> Target.Figure(figure)
                else -> return null
            }
            // A share only ever goes to a lesson (see the spec), and its key names a directory.
            if (share != null && (target !is Target.Lesson || !SHARE_KEY.matches(share))) return null
            Link.Upload(target, share, sitePath(query["back"]), query["name"]?.takeIf { it.isNotBlank() } ?: "the lesson")
        }
        "paired" -> query["token"]?.takeIf { it.isNotEmpty() }?.let(Link::Paired)
        else -> null
    }
}

/** A path on this site only: anything else (another host, `//host`) becomes the start page. */
private fun sitePath(s: String?): String =
    if (s != null && s.startsWith("/") && !s.startsWith("//")) s else "/"

private fun positiveId(s: String): Long? = s.toLongOrNull()?.takeIf { it > 0 }
