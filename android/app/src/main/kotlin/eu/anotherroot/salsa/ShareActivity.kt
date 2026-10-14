package eu.anotherroot.salsa

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.content.IntentCompat
import java.io.File
import java.util.UUID

/**
 * A video shared from the gallery. Its read grant ends with this activity, so
 * the file is copied into app storage under a fresh key first; then the site's
 * `/share?key=` page asks which lesson, and its rows come back as
 * `salsa://upload?…&share=<key>`.
 */
class ShareActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val uris = when (intent.action) {
            Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
            Intent.ACTION_SEND_MULTIPLE ->
                IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            else -> emptyList()
        }
        if (uris.isEmpty()) return finish()
        val app = applicationContext
        val key = UUID.randomUUID().toString()
        val dir = Shared.dir(app, key).apply { mkdirs() }
        Toast.makeText(app, "Getting the video ready…", Toast.LENGTH_SHORT).show()
        // Copied on a thread that outlives this activity: a gigabyte takes a while.
        val resolver = contentResolver
        Thread {
            var copied = 0
            uris.forEachIndexed { i, uri ->
                try {
                    val name = displayName(uri) ?: "video-$i.mp4"
                    val out = File(dir, "%02d-%s".format(i, name.replace('/', '_')))
                    resolver.openInputStream(uri)?.use { input -> out.outputStream().use { input.copyTo(it) } }
                    copied++
                } catch (e: Exception) {
                    // Skipped; the others still go.
                }
            }
            if (copied > 0) openWeb(app, "/share?key=$key")
            else android.os.Handler(mainLooper).post { Toast.makeText(app, "Couldn't read that video.", Toast.LENGTH_LONG).show() }
        }.start()
        finish()
    }

    private fun displayName(uri: Uri): String? =
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
}
