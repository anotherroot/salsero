package eu.anotherroot.salsa

/** Which colour the strip under the navigation bar takes. */
enum class Strip { TABS, PAGE }

/**
 * What the page said about the strip: `"tabs"` (the tab bar, or a bar on its
 * surface, is at the bottom) or `"page"`. Anything else is ignored.
 */
fun stripFor(message: String?): Strip? = when (message) {
    "tabs" -> Strip.TABS
    "page" -> Strip.PAGE
    else -> null
}
