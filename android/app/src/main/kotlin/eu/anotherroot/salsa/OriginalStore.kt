package eu.anotherroot.salsa

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * A person's own video left in the gallery (offline phase 4c): the app holds
 * a lasting permission to its content [uri] and serves it under the row's
 * server file name [file]. [owner] is the signed-in person it was added by.
 */
data class Original(val file: String, val uri: String, val mime: String, val size: Long, val owner: String)

/**
 * The originals the app points at, in one small JSON file in the app's own
 * files (no-backup): the gallery holds the bytes, never copied. A file that
 * cannot be read holds none.
 */
class OriginalStore(private val path: File) {
    private val held = LinkedHashMap<String, Original>().apply { read().forEach { put(it.file, it) } }

    @Synchronized fun put(o: Original) {
        held[o.file] = o
        write()
    }

    @Synchronized fun get(file: String): Original? = held[file]

    @Synchronized fun forget(file: String) {
        if (held.remove(file) != null) write()
    }

    @Synchronized fun all(): List<Original> = held.values.toList()

    @Synchronized fun of(owner: String): List<Original> = held.values.filter { it.owner == owner }

    private fun read(): List<Original> = try {
        if (!path.isFile) emptyList()
        else JSONArray(path.readText()).let { a ->
            (0 until a.length()).map { i ->
                val o = a.getJSONObject(i)
                Original(o.getString("file"), o.getString("uri"), o.getString("mime"), o.getLong("size"), o.getString("owner"))
            }
        }
    } catch (e: Exception) {
        emptyList()
    }

    private fun write() {
        val a = JSONArray()
        for (o in held.values)
            a.put(JSONObject().put("file", o.file).put("uri", o.uri).put("mime", o.mime).put("size", o.size).put("owner", o.owner))
        path.parentFile?.mkdirs()
        val tmp = File(path.path + ".tmp")
        tmp.writeText(a.toString())
        tmp.renameTo(path)
    }
}
