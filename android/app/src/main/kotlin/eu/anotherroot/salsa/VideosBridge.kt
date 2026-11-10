package eu.anotherroot.salsa

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.StatFs
import android.provider.OpenableColumns
import android.webkit.WebResourceResponse
import androidx.webkit.JavaScriptReplyProxy
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.UUID

/** The page's name for this bridge (`window.SalsaVideos`, `src/lib/offline/app-videos.ts`). */
const val VIDEOS_OBJECT = "SalsaVideos"

/**
 * A person's own videos left in the gallery (offline phase 4c): the page asks
 * on `SalsaVideos` with JSON `{op, id, ...}` and is answered with the same `id`.
 *
 * - `pick` `{multiple, userId}`: the photo picker; each video kept with a
 *   lasting read permission under a new server file name, `{files: [{file, mime, size, name}]}`.
 * - `held` `{userId}`: the person's originals here, `{files: [{file, size, readable}]}`.
 * - `forget` `{file, gallery}`: let go of it (after its video was deleted), and
 *   on Android 11+ ask to delete it from the gallery too: `{ok, deleted}`.
 * - `space`: `{free, gallery}`, the phone's free bytes and the originals' bytes.
 * - `upload` `{kind, rowId, file}`: a server copy, through the upload queue ([UploadQueue]).
 *
 * The activity owns the pickers (they are registered before it starts) and calls
 * back [picked] and [galleryAnswer]; [serve] answers the WebView's requests.
 */
class VideosBridge(
    private val context: Context,
    private val launchPick: (multiple: Boolean) -> Unit,
    private val launchDelete: (uri: Uri) -> Boolean,
) {
    val store = OriginalStore(File(context.noBackupFilesDir, "originals.json"))
    private val resolver: ContentResolver get() = context.contentResolver
    private var reply: JavaScriptReplyProxy? = null
    private var pending: Pair<String, String>? = null // the pick's id and owner
    private var deleting: Pair<String, String>? = null // the forget's id and file

    fun onMessage(data: String?, from: JavaScriptReplyProxy) {
        reply = from
        val asked = try {
            JSONObject(data ?: return)
        } catch (e: Exception) {
            return
        }
        val id = asked.optString("id")
        when (asked.optString("op")) {
            "pick" -> {
                pending = id to asked.optString("userId")
                launchPick(asked.optBoolean("multiple"))
            }
            "held" -> answer(id, JSONObject().put("files", heldJson(asked.optString("userId"))))
            "forget" -> forget(id, asked.optString("file"), asked.optBoolean("gallery"))
            "space" -> answer(id, JSONObject().put("free", freeBytes()).put("gallery", store.all().sumOf { it.size }))
            "upload" -> {
                val file = asked.optString("file")
                val o = store.get(file)
                val queued = o != null && UploadQueue.addOriginal(
                    context,
                    Uri.parse(o.uri),
                    if (asked.optString("kind") == "recording") Target.Recording(asked.optLong("rowId"))
                    else Target.LessonVideo(asked.optLong("rowId")),
                    file,
                )
                answer(id, JSONObject().put("queued", queued))
            }
        }
    }

    /** The picker's answer: each video kept, its permission held, named as the server will know it. */
    fun picked(uris: List<Uri>) {
        val (id, owner) = pending ?: return
        pending = null
        val files = JSONArray()
        for (uri in uris) {
            try {
                resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (e: SecurityException) {
                // Not persistable: it plays while this process's grant lasts, then reads as missing.
            }
            val mime = resolver.getType(uri) ?: "video/mp4"
            val size = sizeOf(uri)
            val name = displayName(uri) ?: ""
            val file = "${UUID.randomUUID()}.${extensionOf(mime)}"
            store.put(Original(file, uri.toString(), mime, size, owner))
            files.put(JSONObject().put("file", file).put("mime", mime).put("size", size).put("name", name))
        }
        answer(id, JSONObject().put("files", files))
    }

    /** The system's delete question answered (Android 11+). */
    fun galleryAnswer(deleted: Boolean) {
        val (id, file) = deleting ?: return
        deleting = null
        release(file)
        answer(id, JSONObject().put("ok", true).put("deleted", deleted))
    }

    private fun forget(id: String, file: String, gallery: Boolean) {
        val o = store.get(file)
        if (o == null) return answer(id, JSONObject().put("ok", true).put("deleted", false))
        if (gallery) {
            deleting = id to file
            // A picker's URI may not be one the system deletes from: then only let go.
            if (launchDelete(Uri.parse(o.uri))) return
            deleting = null
        }
        release(file)
        answer(id, JSONObject().put("ok", true).put("deleted", false))
    }

    private fun release(file: String) {
        val o = store.get(file) ?: return
        try {
            resolver.releasePersistableUriPermission(Uri.parse(o.uri), Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (e: SecurityException) {
            // Never held, or already gone.
        }
        store.forget(file)
    }

    private fun heldJson(owner: String): JSONArray {
        val out = JSONArray()
        for (o in store.of(owner))
            out.put(JSONObject().put("file", o.file).put("size", o.size).put("readable", readable(o)))
        return out
    }

    private fun readable(o: Original): Boolean = try {
        resolver.openAssetFileDescriptor(Uri.parse(o.uri), "r")?.use { true } ?: false
    } catch (e: Exception) {
        false
    }

    private fun freeBytes(): Long = try {
        StatFs(context.filesDir.path).availableBytes
    } catch (e: Exception) {
        -1
    }

    private fun sizeOf(uri: Uri): Long = try {
        resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: 0
    } catch (e: Exception) {
        0
    }

    private fun displayName(uri: Uri): String? = try {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    } catch (e: Exception) {
        null
    }

    /** Tells the page: `{event, ...}` (an upload's progress) on the last channel it asked on. */
    fun tell(event: JSONObject) {
        try {
            reply?.postMessage(event.toString())
        } catch (e: Exception) {
            // The page went: it reads the state again when it comes back.
        }
    }

    private fun answer(id: String, body: JSONObject) = tell(body.put("id", id))

    /**
     * A GET for `/recordings/<file>` or `/lesson-videos/<file>` whose original the
     * app holds: the gallery's bytes, with Range. Null for anything else (the
     * request goes on as usual); 404 when the gallery file is gone.
     */
    fun serve(path: String, method: String, headers: Map<String, String>): WebResourceResponse? {
        if (method != "GET") return null
        val file = originalPathFile(path) ?: return null
        val o = store.get(file) ?: return null
        val uri = Uri.parse(o.uri)
        val size = sizeOf(uri)
        val stream = try {
            resolver.openInputStream(uri)
        } catch (e: Exception) {
            null
        } ?: return WebResourceResponse(o.mime, null, 404, "Not Found", mapOf(FROM_DEVICE), ByteArrayInputStream(ByteArray(0)))
        val range = headers.entries.firstOrNull { it.key.equals("range", ignoreCase = true) }?.value
        val base = mapOf("Accept-Ranges" to "bytes", FROM_DEVICE, "Cache-Control" to "no-store")
        return when (val span = spanOf(range, size)) {
            Span.Whole -> WebResourceResponse(o.mime, null, 200, "OK", base + ("Content-Length" to "$size"), stream)
            is Span.Part -> WebResourceResponse(
                o.mime, null, 206, "Partial Content",
                base + mapOf("Content-Range" to contentRange(span, size), "Content-Length" to "${span.length}"),
                sliceOf(stream, span.start, span.length),
            )
            Span.Unsatisfiable -> {
                stream.close()
                WebResourceResponse(o.mime, null, 416, "Range Not Satisfiable", base + ("Content-Range" to "bytes */$size"), ByteArrayInputStream(ByteArray(0)))
            }
        }
    }

    private companion object {
        /** As the service worker marks an answer from the phone (`X-Salsa-From: device`). */
        val FROM_DEVICE = "X-Salsa-From" to "device"
    }
}
