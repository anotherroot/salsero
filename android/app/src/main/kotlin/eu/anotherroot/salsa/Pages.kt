package eu.anotherroot.salsa

import java.net.URI
import java.net.URISyntaxException

/** Where a page in the app asks to go. */
enum class Nav {
    /** A page on our own site: it opens in the app. */
    INSIDE,

    /** A `salsa://` link: handed to the app's own LinkActivity. */
    APP_LINK,

    /** Another site, an email address, a phone number: the phone's browser or app for it. */
    OUTSIDE,

    /** Anything else (`javascript:`, `intent:`, `file:` …): dropped. */
    BLOCKED,
}

/**
 * True when [url] is a page on [site]: the same scheme and authority, exactly.
 * A user-info prefix or a look-alike host is someone else's. Pure.
 */
fun isOwnPage(url: String, site: String): Boolean = try {
    val asked = URI(url)
    val ours = URI(site)
    asked.scheme == ours.scheme && asked.rawAuthority == ours.rawAuthority
} catch (e: URISyntaxException) {
    false
}

/**
 * Where a navigation in the app's WebView goes. Only our own pages load in
 * it — it holds the login cookie — and everything else leaves. Pure.
 */
fun navigationFor(url: String, site: String): Nav {
    if (isOwnPage(url, site)) return Nav.INSIDE
    val scheme = try {
        URI(url).scheme?.lowercase()
    } catch (e: URISyntaxException) {
        return Nav.BLOCKED
    }
    return when (scheme) {
        SCHEME -> Nav.APP_LINK
        "http", "https", "mailto", "tel" -> Nav.OUTSIDE
        else -> Nav.BLOCKED
    }
}
