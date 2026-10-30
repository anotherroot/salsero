package eu.anotherroot.salsa

import android.content.Context
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** `GET /api/device/config`. [reminderMinute] is a minute of the day, null = off. */
data class Config(val reminderMinute: Int?, val shortSide: Int)

fun parseConfig(json: String): Config {
    val o = JSONObject(json)
    return Config(
        reminderMinute = if (o.isNull("reminderMinute")) null else o.getInt("reminderMinute"),
        shortSide = o.getInt("shortSide"),
    )
}

/** `GET /api/device/today`: per dance slug, the names in Today's due band. */
fun parseToday(json: String): Map<String, List<String>> {
    val o = JSONObject(json)
    return o.keys().asSequence().associateWith { dance ->
        val due = o.getJSONObject(dance).getJSONArray("due")
        (0 until due.length()).map(due::getString)
    }
}

/** No token, or the server no longer accepts it: the app must be paired (again). */
class Unpaired : Exception("not paired")

/** Any other non-2xx answer. */
class HttpError(val status: Int, message: String) : IOException("HTTP $status: $message")

/** The server, as the paired device. Blocking; call it from a worker. */
object Api {
    /** Opens a request to [path] with the device token; throws [Unpaired] without one. */
    fun open(context: Context, path: String, method: String = "GET"): HttpURLConnection {
        val token = Prefs.token(context) ?: throw Unpaired()
        return (URL(BuildConfig.SITE + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20_000
            readTimeout = 60_000
            setRequestProperty("authorization", "Bearer $token")
            setRequestProperty("accept", "application/json")
        }
    }

    fun config(context: Context): Config = parseConfig(get(context, "/api/device/config"))

    /** What is due in this app's dance. */
    fun today(context: Context): List<String> =
        parseToday(get(context, "/api/device/today"))[BuildConfig.DANCE].orEmpty()

    private fun get(context: Context, path: String): String {
        val conn = open(context, path)
        try {
            val status = conn.responseCode
            if (status == 401) throw Unpaired()
            if (status !in 200..299) throw HttpError(status, errorBody(conn))
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    /** The server's `{ message }`, or the raw body, for a failure notification. */
    fun errorBody(conn: HttpURLConnection): String {
        val text = try {
            conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        } catch (e: IOException) {
            ""
        }
        return try {
            JSONObject(text).optString("message", text)
        } catch (e: Exception) {
            text
        }.take(200)
    }
}
