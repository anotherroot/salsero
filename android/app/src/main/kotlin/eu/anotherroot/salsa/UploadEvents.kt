package eu.anotherroot.salsa

/**
 * A phone-only original's upload, as the page shows it (offline phase 4c):
 * the upload runner reports here, and the screen (if one is open) passes it on
 * to the page on `SalsaVideos` as `{event: "progress" | "done" | "failed", file, pct}`.
 */
object UploadEvents {
    @Volatile var listener: ((event: String, file: String, pct: Int?) -> Unit)? = null

    fun progress(file: String, pct: Int) {
        listener?.invoke("progress", file, pct)
    }

    fun ended(file: String, ok: Boolean) {
        listener?.invoke(if (ok) "done" else "failed", file, null)
    }
}
