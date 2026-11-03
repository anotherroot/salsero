package eu.anotherroot.salsa

import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * The update the site offers (`GET /api/app-update/<dance>`): what the direct
 * build's updater downloads, checks and installs (`src/direct/…/UpdateBridge.kt`).
 * PURE; in main so every variant's tests run it.
 */
data class Published(val versionCode: Int, val versionName: String, val sha256: String, val size: Long, val url: String)

/** The check's answer; null when it is not one (a field missing, not JSON). [Published.sha256] is lower-case. */
fun parsePublished(json: String): Published? = try {
    val o = JSONObject(json)
    Published(
        versionCode = o.getInt("versionCode"),
        versionName = o.getString("versionName"),
        sha256 = o.getString("sha256").lowercase(),
        size = o.getLong("size"),
        url = o.getString("url"),
    )
} catch (e: JSONException) {
    null
}

fun isNewer(published: Published, installed: Int): Boolean = published.versionCode > installed

/** The size first (a truncated download fails fast), then the SHA-256, streamed. */
fun matches(file: File, size: Long, sha256: String): Boolean {
    if (!file.isFile || file.length() != size) return false
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            digest.update(buffer, 0, n)
        }
    }
    val hex = digest.digest().joinToString("") { "%02x".format(it) }
    return hex == sha256.lowercase()
}

/** `progress:<0-100>`, whole percent, rounded down; nothing to download is 0. */
fun progressMessage(done: Long, total: Long): String {
    val percent = if (total <= 0) 0 else (done.coerceAtLeast(0) * 100 / total).coerceAtMost(100)
    return "progress:$percent"
}

/** What to do with Android's "Update?" screen when the session asks for it. */
enum class ConfirmStep { LAUNCH, KEEP }

/**
 * Open it now over a resumed app; otherwise keep it for the next resume:
 * Android 10+ silently blocks an activity started from the background.
 */
fun confirmStep(resumed: Boolean): ConfirmStep = if (resumed) ConfirmStep.LAUNCH else ConfirmStep.KEEP

/** What coming back to the app does with an update that waited for it. */
enum class ResumeStep { NOTHING, CONFIRM, INSTALL, DROP }

/**
 * A kept "Update?" screen opens first. A file waiting for "install unknown
 * apps" installs once that is allowed; coming back without allowing it drops
 * it (Update asks again), so it never installs by surprise on a later resume.
 */
fun resumeStep(confirmWaiting: Boolean, pendingFile: Boolean, canInstall: Boolean): ResumeStep = when {
    confirmWaiting -> ResumeStep.CONFIRM
    pendingFile && canInstall -> ResumeStep.INSTALL
    pendingFile -> ResumeStep.DROP
    else -> ResumeStep.NOTHING
}
