package eu.anotherroot.salsa

/**
 * A screenshot for Send feedback (`src/lib/feedback/offer.svelte.ts`): after a
 * screenshot (Android 14 and later), the app copies its own screen, shrinks it
 * to [SHOT_LONG_SIDE] on the long side and posts it to the page that asked with
 * [SHOT_LISTEN], as a JPEG data URL. The page's `SHOT_LONG_SIDE` is the same.
 */
const val SHOT_LONG_SIDE = 1280

/** What the page posts to `SalsaShot` to be told about screenshots. */
const val SHOT_LISTEN = "listen"

data class ShotSize(val width: Int, val height: Int)

/** The size that fits inside [max] on the long side, keeping the shape; never larger than it was. */
fun shotSize(width: Int, height: Int, max: Int = SHOT_LONG_SIDE): ShotSize {
    val long = maxOf(width, height)
    if (long <= max) return ShotSize(width, height)
    val k = max.toDouble() / long
    return ShotSize(maxOf(1, Math.round(width * k).toInt()), maxOf(1, Math.round(height * k).toInt()))
}
