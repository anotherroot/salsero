package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class UpdatePlanTest {
    private val answer = """
        {"versionCode":3,"versionName":"1.2","minVersionCode":2,
         "sha256":"ABCDEF0123","size":31457280,"commit":"d68d731",
         "url":"/releases/salsa/3.apk"}
    """.trimIndent()

    @Test fun parsesTheCheckAnswer() {
        assertEquals(
            Published(versionCode = 3, versionName = "1.2", sha256 = "abcdef0123", size = 31457280L, url = "/releases/salsa/3.apk"),
            parsePublished(answer),
        )
    }

    @Test fun anAnswerWithoutAHashIsNone() {
        assertNull(parsePublished(answer.replace("\"sha256\":\"ABCDEF0123\",", "")))
    }

    @Test fun anAnswerThatIsNotJsonIsNone() {
        assertNull(parsePublished("<html>"))
    }

    @Test fun newerOnlyWhenTheCodeIsHigher() {
        val published = parsePublished(answer)!!
        assertTrue(isNewer(published, 2))
        assertFalse(isNewer(published, 3))
        assertFalse(isNewer(published.copy(versionCode = 2), 2))
    }

    private fun temp(bytes: ByteArray): File =
        File.createTempFile("update", ".apk").apply {
            deleteOnExit()
            writeBytes(bytes)
        }

    private fun hex(bytes: ByteArray) =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    @Test fun aFileWithTheRightSizeAndHashMatches() {
        val bytes = ByteArray(200_000) { (it * 31).toByte() }
        assertTrue(matches(temp(bytes), bytes.size.toLong(), hex(bytes)))
    }

    @Test fun theRightSizeWithAWrongHashDoesNot() {
        val bytes = ByteArray(200_000) { (it * 31).toByte() }
        val wrong = hex(bytes.copyOf().also { it[0] = (it[0] + 1).toByte() })
        assertFalse(matches(temp(bytes), bytes.size.toLong(), wrong))
    }

    @Test fun aTruncatedFileDoesNot() {
        val bytes = ByteArray(200_000) { (it * 31).toByte() }
        assertFalse(matches(temp(bytes.copyOf(150_000)), bytes.size.toLong(), hex(bytes)))
    }

    @Test fun aMissingFileDoesNot() {
        assertFalse(matches(File("/nonexistent/update.apk"), 1, "00"))
    }

    @Test fun progressInWholePercent() {
        assertEquals("progress:0", progressMessage(0, 0))
        assertEquals("progress:25", progressMessage(50, 200))
        assertEquals("progress:100", progressMessage(200, 200))
        assertEquals("progress:100", progressMessage(300, 200))
        assertEquals("progress:33", progressMessage(100, 300))
    }
}
