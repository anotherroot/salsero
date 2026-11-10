package eu.anotherroot.salsa

/**
 * The app's own words: notifications, their channels, toasts and the share
 * dialog. Everything else the app shows is the site, which speaks the
 * account's language itself. The language is the account's, from
 * `/api/device/config` (`Prefs.locale`), never the phone's; an older server
 * sends none, and anything but "sl" is English. Pure, so the words are tested
 * on the JVM. The one native word the app cannot choose is the share sheet's
 * entry (`share_label`): Android draws it in the phone's language, so it has a
 * `values-sl` resource instead.
 *
 * Slovenian follows the site's rules (spec 2026-11-07): vikanje, plurals through
 * [slCount], and a name someone gave (a lesson, a video) after a colon or an
 * arrow, never declined.
 */
interface Words {
    fun reminderTitle(n: Int): String
    val channelUploading: String
    val channelResults: String
    val channelReminder: String
    val checkingDue: String
    val preparing: String
    val compressing: String
    val uploading: String
    /** After the progress line's " · ": how many videos wait behind this one. */
    fun moreWaiting(n: Int): String
    val pairAgainTitle: String
    val pairAgainBody: String
    fun updateAppTitle(app: String): String
    fun updateAppBody(app: String, video: String): String
    fun addedTo(lesson: String): String
    fun couldNotAdd(video: String, lesson: String): String
    val keptFailing: String
    val notAVideo: String
    fun couldNotCompress(error: String): String
    val couldNotKeep: String
    val emptyVideo: String
    val tooBigForRecording: String
    val serverHasAll: String
    fun serverRefused(status: Int): String
    val phonePaired: String
    val sharedGone: String
    fun uploadingInBackground(n: Int, lesson: String): String
    val gettingReady: String
    fun gettingVideoReady(i: Int, n: Int): String
    val couldNotRead: String
    val noAppForLink: String
    fun downloading(name: String): String
    /** What an upload link without a name calls its lesson. */
    val theLesson: String
    /** A phone-only recording's upload names its figure so (offline phase 4c). */
    val theFigure: String
    /** What a video is called before its file name is known. */
    val theVideo: String
    /** The progress line's percentage: Slovenian puts a no-break space before the sign. */
    fun percent(n: Int): String

    companion object {
        val en: Words = En
        val sl: Words = Sl
    }
}

/** The words for an account's language: "sl" is Slovenian, anything else (none included) English. */
fun wordsOf(locale: String?): Words = if (locale == "sl") Words.sl else Words.en

private object En : Words {
    override fun reminderTitle(n: Int) = if (n == 1) "1 exercise due" else "$n exercises due"
    override val channelUploading = "Uploading"
    override val channelResults = "Uploads finished"
    override val channelReminder = "Practice reminder"
    override val checkingDue = "Checking what is due"
    override val preparing = "Preparing"
    override val compressing = "Compressing"
    override val uploading = "Uploading"
    override fun moreWaiting(n: Int) = "$n more waiting"
    override val pairAgainTitle = "Pair the app again"
    override val pairAgainBody = "The server no longer knows this phone. Tap to pair it."
    override fun updateAppTitle(app: String) = "Update the $app app"
    override fun updateAppBody(app: String, video: String) = "Update the $app app to finish uploading $video."
    override fun addedTo(lesson: String) = "Added to $lesson"
    override fun couldNotAdd(video: String, lesson: String) = "Couldn't add $video to $lesson"
    override val keptFailing = "The upload kept failing."
    override val notAVideo = "It is not a video this phone can read."
    override fun couldNotCompress(error: String) = "Couldn't compress it: $error"
    override val couldNotKeep = "Couldn't keep the compressed video."
    override val emptyVideo = "The video is empty."
    override val tooBigForRecording = "Even compressed it is over 95 MB, too big for a figure recording."
    override val serverHasAll = "The server has the whole video but did not finish it. Try again later."
    override fun serverRefused(status: Int) = "The server refused it ($status)."
    override val phonePaired = "Phone paired"
    override val sharedGone = "That shared video is no longer here. Share it again."
    override fun uploadingInBackground(n: Int, lesson: String) =
        if (n == 1) "Uploading to $lesson in the background" else "Uploading $n videos to $lesson in the background"
    override val gettingReady = "Getting the video ready…"
    override fun gettingVideoReady(i: Int, n: Int) = "Getting video $i of $n ready…"
    override val couldNotRead = "Couldn't read that video."
    override val noAppForLink = "No app on this phone can open that link"
    override fun downloading(name: String) = "Downloading $name"
    override val theLesson = "the lesson"
    override val theFigure = "the figure"
    override val theVideo = "the video"
    override fun percent(n: Int) = "$n%"
}

private object Sl : Words {
    override fun reminderTitle(n: Int) = slCount(n, "vaja", "vaji", "vaje", "vaj") + " na vrsti"
    override val channelUploading = "Nalaganje"
    override val channelResults = "Končana nalaganja"
    override val channelReminder = "Opomnik za vadenje"
    override val checkingDue = "Preverjanje, kaj je na vrsti"
    override val preparing = "Pripravljanje"
    override val compressing = "Stiskanje"
    override val uploading = "Nalaganje"
    override fun moreWaiting(n: Int) = "še " + slCount(n, "čaka", "čakata", "čakajo", "čaka")
    override val pairAgainTitle = "Znova povežite telefon"
    override val pairAgainBody = "Strežnik tega telefona ne pozna več. Tapnite, da ga znova povežete."
    override fun updateAppTitle(app: String) = "Posodobite aplikacijo $app"
    override fun updateAppBody(app: String, video: String) = "Posodobite aplikacijo $app, da dokončate nalaganje: $video"
    override fun addedTo(lesson: String) = "Video je dodan: $lesson"
    override fun couldNotAdd(video: String, lesson: String) = "Videa ni bilo mogoče dodati: $video → $lesson"
    override val keptFailing = "Nalaganje je znova in znova spodletelo."
    override val notAVideo = "To ni video, ki bi ga ta telefon znal prebrati."
    override fun couldNotCompress(error: String) = "Stiskanje ni uspelo: $error"
    override val couldNotKeep = "Stisnjenega videa ni bilo mogoče shraniti."
    override val emptyVideo = "Video je prazen."
    override val tooBigForRecording = "Tudi stisnjen ima več kot 95 MB, kar je preveč za posnetek figure."
    override val serverHasAll = "Strežnik ima že ves video, a ga ni dokončal. Poskusite znova pozneje."
    override fun serverRefused(status: Int) = "Strežnik ga je zavrnil ($status)."
    override val phonePaired = "Telefon je povezan"
    override val sharedGone = "Deljenega videa ni več. Delite ga znova."
    /** A count after "Nalaganje" is in the genitive: 2, 3 and 5 videov, 101 videa. */
    override fun uploadingInBackground(n: Int, lesson: String) = when {
        n == 1 -> "Nalaganje v ozadju: $lesson"
        slForm(n) == SlForm.ONE -> "Nalaganje $n videa v ozadju: $lesson"
        else -> "Nalaganje $n videov v ozadju: $lesson"
    }
    override val gettingReady = "Pripravljanje videa …"
    override fun gettingVideoReady(i: Int, n: Int) = "Pripravljanje videa $i od $n …"
    override val couldNotRead = "Tega videa ni bilo mogoče prebrati."
    override val noAppForLink = "Te povezave ne more odpreti nobena aplikacija na tem telefonu"
    override fun downloading(name: String) = "Prenašanje: $name"
    override val theLesson = "lekcija"
    override val theFigure = "figura"
    override val theVideo = "video"
    override fun percent(n: Int) = "$n\u00A0%"
}
