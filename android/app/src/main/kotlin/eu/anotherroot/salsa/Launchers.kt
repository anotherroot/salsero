package eu.anotherroot.salsa

import android.os.Bundle
import com.google.androidbrowserhelper.trusted.LauncherActivity

/**
 * The two home-screen icons. Each is androidbrowserhelper's TWA launcher with
 * its own start URL (the manifest's DEFAULT_URL); a subclass apiece so the
 * manifest can give each its own icon, label and task.
 */
class SalsaLauncher : LauncherActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppStart.onLaunch(this)
    }
}

class BachataLauncher : LauncherActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppStart.onLaunch(this)
    }
}
