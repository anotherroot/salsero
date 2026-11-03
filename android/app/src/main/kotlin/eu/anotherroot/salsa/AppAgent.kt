package eu.anotherroot.salsa

/**
 * How the app names itself to the site: the WebView's user agent gets a suffix
 * the page reads, and every native request sends the same facts in a header.
 * The site refuses `/api/` requests from an app below its minimum with 426.
 */
fun appUserAgent(base: String, versionCode: Int, dance: String, channel: String): String =
    if ("SalsaApp/" in base) base else "$base SalsaApp/$versionCode ($dance; $channel)"

fun appVersionHeader(versionCode: Int, dance: String, channel: String): String =
    "$versionCode; $dance; $channel"
