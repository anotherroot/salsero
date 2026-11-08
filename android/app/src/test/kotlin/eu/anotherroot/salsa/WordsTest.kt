package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Test

class WordsTest {
    private val sl = wordsOf("sl")
    private val en = wordsOf("en")

    @Test fun `the account's language picks the words, anything else is English`() {
        assertSame(Words.sl, sl)
        assertSame(Words.en, en)
        assertSame(Words.en, wordsOf(null))
        assertSame(Words.en, wordsOf("xx"))
        assertSame(Words.en, wordsOf(""))
    }

    @Test fun `English is today's text`() {
        assertEquals("1 exercise due", wordsOf(null).reminderTitle(1))
        assertEquals("2 exercises due", wordsOf("xx").reminderTitle(2))
        assertEquals("Uploading to Tuesday in the background", en.uploadingInBackground(1, "Tuesday"))
        assertEquals("Uploading 3 videos to Tuesday in the background", en.uploadingInBackground(3, "Tuesday"))
        assertEquals("Phone paired", en.phonePaired)
        assertEquals("Pair the app again", en.pairAgainTitle)
        assertEquals("The server no longer knows this phone. Tap to pair it.", en.pairAgainBody)
        assertEquals("Update the Salsa app", en.updateAppTitle("Salsa"))
        assertEquals("Update the Salsa app to finish uploading a.mp4.", en.updateAppBody("Salsa", "a.mp4"))
        assertEquals("Couldn't add a.mp4 to Tuesday", en.couldNotAdd("a.mp4", "Tuesday"))
        assertEquals("Added to Tuesday", en.addedTo("Tuesday"))
        assertEquals("2 more waiting", en.moreWaiting(2))
        assertEquals("Downloading a.pdf", en.downloading("a.pdf"))
        assertEquals("No app on this phone can open that link", en.noAppForLink)
        assertEquals("Getting video 2 of 3 ready…", en.gettingVideoReady(2, 3))
        assertEquals("the lesson", en.theLesson)
        assertEquals("the video", en.theVideo)
        assertEquals("42%", en.percent(42))
        assertEquals("42\u00A0%", sl.percent(42))
        assertEquals("Uploads finished", en.channelResults)
        assertEquals("The server refused it (413).", en.serverRefused(413))
    }

    @Test fun `the reminder counts in Slovenian`() {
        assertEquals("1 vaja na vrsti", sl.reminderTitle(1))
        assertEquals("2 vaji na vrsti", sl.reminderTitle(2))
        assertEquals("3 vaje na vrsti", sl.reminderTitle(3))
        assertEquals("5 vaj na vrsti", sl.reminderTitle(5))
        assertEquals("101 vaja na vrsti", sl.reminderTitle(101))
    }

    @Test fun `uploading in the background, the lesson after a colon`() {
        assertEquals("Nalaganje v ozadju: Torek", sl.uploadingInBackground(1, "Torek"))
        assertEquals("Nalaganje 2 videov v ozadju: Torek", sl.uploadingInBackground(2, "Torek"))
        assertEquals("Nalaganje 3 videov v ozadju: Torek", sl.uploadingInBackground(3, "Torek"))
        assertEquals("Nalaganje 5 videov v ozadju: Torek", sl.uploadingInBackground(5, "Torek"))
    }

    @Test fun `pairing and the rest in Slovenian`() {
        assertEquals("Telefon je povezan", sl.phonePaired)
        assertEquals("Znova povežite telefon", sl.pairAgainTitle)
        assertEquals("Strežnik tega telefona ne pozna več. Tapnite, da ga znova povežete.", sl.pairAgainBody)
        assertEquals("Posodobite aplikacijo Salsa", sl.updateAppTitle("Salsa"))
        assertEquals("Posodobite aplikacijo Salsa, da dokončate nalaganje: a.mp4", sl.updateAppBody("Salsa", "a.mp4"))
        assertEquals("Videa ni bilo mogoče dodati: a.mp4 → Torek", sl.couldNotAdd("a.mp4", "Torek"))
        assertEquals("Video je dodan: Torek", sl.addedTo("Torek"))
        assertEquals(listOf("še 1 čaka", "še 2 čakata", "še 3 čakajo", "še 5 čaka"), listOf(1, 2, 3, 5).map(sl::moreWaiting))
        assertEquals("Prenašanje: a.pdf", sl.downloading("a.pdf"))
        assertEquals("Pripravljanje videa 2 od 3 …", sl.gettingVideoReady(2, 3))
        assertEquals("Opomnik za vadenje", sl.channelReminder)
        assertEquals("Strežnik ga je zavrnil (413).", sl.serverRefused(413))
        assertEquals("lekcija", sl.theLesson)
    }

    @Test fun `no Slovenian word is left in English`() {
        val plain: (Words) -> List<String> = { w ->
            listOf(
                w.channelUploading, w.channelResults, w.channelReminder, w.checkingDue, w.preparing,
                w.compressing, w.uploading, w.pairAgainTitle, w.pairAgainBody, w.keptFailing, w.notAVideo,
                w.couldNotKeep, w.emptyVideo, w.tooBigForRecording, w.serverHasAll, w.phonePaired,
                w.sharedGone, w.gettingReady, w.couldNotRead, w.noAppForLink, w.theLesson, w.theVideo,
                w.reminderTitle(2), w.moreWaiting(2), w.updateAppTitle("A"), w.updateAppBody("A", "v"),
                w.addedTo("L"), w.couldNotAdd("v", "L"), w.couldNotCompress("e"), w.serverRefused(404),
                w.uploadingInBackground(2, "L"), w.gettingVideoReady(1, 2), w.downloading("f"),
            )
        }
        plain(en).zip(plain(sl)).forEach { (e, s) -> assertNotEquals(e, s) }
    }
}
