package eu.anotherroot.salsa

import com.google.androidbrowserhelper.trusted.LauncherActivity

/**
 * The two home-screen icons. Each is androidbrowserhelper's TWA launcher with
 * its own start URL (the manifest's DEFAULT_URL); a subclass apiece only so the
 * manifest can give each its own icon, label and task.
 */
class SalsaLauncher : LauncherActivity()

class BachataLauncher : LauncherActivity()
