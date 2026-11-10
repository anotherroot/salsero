package eu.anotherroot.salsa

/**
 * Serving a gallery original to the page (offline phase 4c): the WebView asks
 * for `/recordings/<file>` or `/lesson-videos/<file>`, and when the app holds
 * that file's original ([OriginalStore]) it answers from the gallery with HTTP
 * Range, as the server and the service worker do. PURE: the parts here are
 * tested; [WebShell] opens the file.
 */
sealed interface Span {
    data object Whole : Span
    data class Part(val start: Long, val end: Long) : Span {
        val length get() = end - start + 1
    }
    data object Unsatisfiable : Span
}

/** What a `Range` header asks of a file of [size] bytes (one range: what video elements send). */
fun spanOf(header: String?, size: Long): Span {
    if (header.isNullOrBlank()) return Span.Whole
    val m = Regex("""^bytes=(\d*)-(\d*)$""").matchEntire(header.trim()) ?: return Span.Unsatisfiable
    val (a, b) = m.destructured
    if (a.isEmpty() && b.isEmpty()) return Span.Unsatisfiable
    if (a.isEmpty()) {
        val n = b.toLongOrNull() ?: return Span.Unsatisfiable
        if (n <= 0 || size == 0L) return Span.Unsatisfiable
        return Span.Part(maxOf(0, size - n), size - 1)
    }
    val start = a.toLongOrNull() ?: return Span.Unsatisfiable
    val end = if (b.isEmpty()) size - 1 else minOf(b.toLongOrNull() ?: return Span.Unsatisfiable, size - 1)
    if (start >= size || end < start) return Span.Unsatisfiable
    return Span.Part(start, end)
}

fun contentRange(part: Span.Part, size: Long) = "bytes ${part.start}-${part.end}/$size"

private val ORIGINAL_PATH = Regex(
    """^/(recordings|lesson-videos)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5})$"""
)

/** The file name a video path asks for, or null: only the site's video paths with a server name. */
fun originalPathFile(path: String): String? = ORIGINAL_PATH.matchEntire(path)?.groupValues?.get(2)

/** [length] bytes of [input] from [start] on: what a 206 answers with. */
fun sliceOf(input: java.io.InputStream, start: Long, length: Long): java.io.InputStream {
    var skipped = 0L
    while (skipped < start) {
        val n = input.skip(start - skipped)
        if (n <= 0) {
            if (input.read() == -1) break
            skipped++
        } else skipped += n
    }
    return object : java.io.FilterInputStream(input) {
        private var left = length
        override fun read(): Int {
            if (left <= 0) return -1
            val b = super.read()
            if (b >= 0) left--
            return b
        }
        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (left <= 0) return -1
            val n = super.read(b, off, minOf(len.toLong(), left).toInt())
            if (n > 0) left -= n
            return n
        }
    }
}

/** A picked video's file extension, from its type (the server's file rule: a short one). */
fun extensionOf(mime: String?): String = when (mime?.substringBefore(';')?.trim()?.lowercase()) {
    "video/quicktime" -> "mov"
    "video/webm" -> "webm"
    "video/3gpp" -> "3gp"
    "video/x-matroska" -> "mkv"
    else -> "mp4"
}
