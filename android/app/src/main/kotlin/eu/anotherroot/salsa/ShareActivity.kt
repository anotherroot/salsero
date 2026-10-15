package eu.anotherroot.salsa

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.content.IntentCompat
import java.io.File
import java.util.UUID

/**
 * A video shared from the gallery. The read grant lasts only while this
 * activity does, so it stays open — a small "Getting it ready" dialog — until
 * every file is copied into app storage under a fresh key. Then, still in
 * front (Android lets only a visible app open another screen), it opens the
 * site's `/share?key=` page, whose rows come back as `salsa://upload?…&share=`.
 */
class ShareActivity : ComponentActivity() {
    @Volatile private var gone = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val uris = when (intent.action) {
            Intent.ACTION_SEND -> listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
            Intent.ACTION_SEND_MULTIPLE ->
                IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            else -> emptyList()
        }
        // A rotation re-creates the activity; the first instance's copy is lost with its grant.
        if (uris.isEmpty() || savedInstanceState != null) return finish()

        setFinishOnTouchOutside(false)
        val status = TextView(this).apply { text = "Getting the video ready…" }
        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(48, 48, 48, 48)
                addView(ProgressBar(this@ShareActivity))
                addView(status.apply { setPadding(32, 0, 0, 0) })
            },
        )

        val key = UUID.randomUUID().toString()
        val dir = Shared.dir(this, key).apply { mkdirs() }
        Thread {
            var copied = 0
            uris.forEachIndexed { i, uri ->
                if (gone) return@forEachIndexed
                runOnUiThread { if (uris.size > 1) status.text = "Getting video ${i + 1} of ${uris.size} ready…" }
                val out = File(dir, "%02d-%s".format(i, (displayName(uri) ?: "video-$i.mp4").replace('/', '_')))
                try {
                    contentResolver.openInputStream(uri)?.use { input -> out.outputStream().use { input.copyTo(it) } }
                        ?: error("unreadable")
                    copied++
                } catch (e: Exception) {
                    out.delete() // never queue half a video
                }
            }
            runOnUiThread {
                when {
                    gone -> dir.deleteRecursively()
                    copied > 0 -> startActivity(webIntent(this, "/share?key=$key"))
                    else -> {
                        dir.deleteRecursively()
                        Toast.makeText(applicationContext, "Couldn't read that video.", Toast.LENGTH_LONG).show()
                    }
                }
                finish()
            }
        }.start()
    }

    override fun onDestroy() {
        gone = true
        super.onDestroy()
    }

    private fun displayName(uri: Uri): String? =
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
}
