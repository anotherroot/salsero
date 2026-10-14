package eu.anotherroot.salsa

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts.PickMultipleVisualMedia
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
import androidx.activity.result.contract.ActivityResultContracts.RequestPermission
import androidx.core.content.ContextCompat

/**
 * Handles the `salsa://` links the site hands over. Invisible: it opens the
 * photo picker (or takes a shared file), queues the uploads, and finishes,
 * which drops the user back into the page they tapped.
 */
class LinkActivity : ComponentActivity() {
    private var link: Link.Upload? = null

    private val pickMany = registerForActivityResult(PickMultipleVisualMedia()) { queue(it) }
    private val pickOne = registerForActivityResult(PickVisualMedia()) { queue(listOfNotNull(it)) }
    private val askNotifications = registerForActivityResult(RequestPermission()) { proceed() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Recreated while the picker was open: the registered callback delivers the result.
        val raw = savedInstanceState?.getString(KEY_LINK) ?: intent.dataString
        val parsed = raw?.let(::parseLink)
        if (savedInstanceState != null) {
            link = parsed as? Link.Upload
            return
        }
        when (parsed) {
            is Link.Paired -> paired(parsed)
            is Link.Upload -> upload(parsed, raw)
            null -> finish()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(KEY_LINK, intent.dataString)
    }

    private fun paired(paired: Link.Paired) {
        Prefs.setToken(this, paired.token)
        AppStart.refreshConfig(this)
        Toast.makeText(this, "Phone paired", Toast.LENGTH_SHORT).show()
        val pending = Prefs.pendingLink(this)
        Prefs.setPendingLink(this, null)
        val resume = pending?.let(::parseLink) as? Link.Upload
        if (resume != null) upload(resume, pending) else finish()
    }

    private fun upload(upload: Link.Upload, raw: String) {
        if (Prefs.token(this) == null) {
            startPairing(this, raw)
            finish()
            return
        }
        link = upload
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (granted) proceed() else askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun proceed() {
        val upload = link ?: return finish()
        val key = upload.share
        if (key != null) {
            val files = Shared.files(this, key)
            if (files.isEmpty()) toast("That shared video is no longer here. Share it again.")
            files.forEach { UploadQueue.enqueue(this, Uri.fromFile(it), upload, key) }
            if (files.isNotEmpty()) toast(queuedText(files.size, upload.name))
            finish()
            return
        }
        val videos = PickVisualMediaRequest(PickVisualMedia.VideoOnly)
        if (upload.target is Target.Lesson) pickMany.launch(videos) else pickOne.launch(videos)
    }

    private fun queue(uris: List<Uri>) {
        val upload = link ?: return finish()
        for (uri in uris) {
            try {
                // The photo picker's grants can be kept, so a retry hours later can still read it.
                contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (e: SecurityException) {
                // Not persistable: the job reads it while this process's grant lasts.
            }
            UploadQueue.enqueue(this, uri, upload)
        }
        if (uris.isNotEmpty()) toast(queuedText(uris.size, upload.name))
        finish()
    }

    private fun queuedText(n: Int, name: String) =
        if (n == 1) "Uploading to $name in the background" else "Uploading $n videos to $name in the background"

    private fun toast(text: String) = Toast.makeText(applicationContext, text, Toast.LENGTH_LONG).show()

    private companion object {
        const val KEY_LINK = "link"
    }
}
