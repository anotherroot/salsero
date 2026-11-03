package eu.anotherroot.salsa

import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files

/** When Update waits for an upload ("busy"): only while the runner is at work. */
class UploadRunTest {
    @After fun tearDown() {
        while (UploadRun.running) UploadRun.end()
    }

    @Test fun `a paused job does not hold an update back`() {
        // A job kept on disk after a 426 (or waiting out a backoff, or unpaired):
        // it survives the reinstall and the next launch kicks it.
        val root = Files.createTempDirectory("jobs").toFile()
        try {
            val store = JobStore(root)
            store.add(Job("a", "content://media/x/a", null, Target.Lesson(12), "/salsa/lessons/12", "Wednesday class", 1))
            assertFalse(store.isEmpty())
            assertFalse(updateWaits(UploadRun.running))
        } finally {
            root.deleteRecursively()
        }
    }

    @Test fun `a running upload holds it back until it ends`() {
        UploadRun.begin()
        assertTrue(updateWaits(UploadRun.running))
        UploadRun.end()
        assertFalse(updateWaits(UploadRun.running))
    }

    @Test fun `a replaced runner still stopping keeps it held until both end`() {
        UploadRun.begin()
        UploadRun.begin()
        UploadRun.end()
        assertTrue(updateWaits(UploadRun.running))
        UploadRun.end()
        assertFalse(updateWaits(UploadRun.running))
    }
}
