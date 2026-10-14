package eu.anotherroot.salsa

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns

/** A source video. Width and height are as displayed, rotation applied. From Shrink, trimmed. */
data class VideoInfo(val name: String, val width: Int, val height: Int, val sizeBytes: Long, val mime: String)

object VideoProbe {
    /** Reads [uri]'s metadata. Blocking; throws when it is not a readable video. */
    fun probe(context: Context, uri: Uri): VideoInfo {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, uri)
            fun meta(key: Int): String? = retriever.extractMetadata(key)
            require(meta(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) == "yes") { "not a video" }
            val width = requireNotNull(meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull())
            val height = requireNotNull(meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull())
            val rotation = meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
            val (name, size) = nameAndSize(context, uri)
            return VideoInfo(
                name = name,
                width = if (rotation % 180 == 0) width else height,
                height = if (rotation % 180 == 0) height else width,
                sizeBytes = size,
                mime = context.contentResolver.getType(uri) ?: "video/mp4",
            )
        } finally {
            retriever.release()
        }
    }

    private fun nameAndSize(context: Context, uri: Uri): Pair<String, Long> {
        if (uri.scheme == "file") {
            val file = java.io.File(requireNotNull(uri.path))
            return file.name to file.length()
        }
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
            ?.use { c ->
                if (c.moveToFirst()) {
                    val name = c.getString(0) ?: "video"
                    val size = if (c.isNull(1)) statSize(context, uri) else c.getLong(1)
                    return name to size
                }
            }
        return (uri.lastPathSegment ?: "video") to statSize(context, uri)
    }

    private fun statSize(context: Context, uri: Uri): Long = try {
        context.contentResolver.openFileDescriptor(uri, "r")?.use { it.statSize } ?: 0
    } catch (e: Exception) {
        0
    }
}
