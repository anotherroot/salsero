package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UploadPlanTest {
    private val mib = 1024L * 1024
    private val total = 20 * mib
    private val sent = Step.Send(0, 8 * mib - 1)
    private val en = Words.en

    @Test fun `a run opens with a small probe from the saved offset`() {
        assertEquals(Step.Send(0, PROBE_BYTES - 1), firstChunk(0, total))
        assertEquals(Step.Send(5 * mib, 5 * mib + PROBE_BYTES - 1), firstChunk(5 * mib, total))
        assertEquals(Step.Send(0, 99), firstChunk(0, 100))
    }

    @Test fun `204 continues from what the server holds`() =
        assertEquals(Step.Send(8 * mib, 16 * mib - 1), nextStep(204, 8 * mib, sent, total, "", en))

    @Test fun `the last chunk ends at the last byte`() =
        assertEquals(Step.Send(16 * mib, total - 1), nextStep(204, 16 * mib, sent, total, "", en))

    @Test fun `204 without a count assumes the chunk landed`() =
        assertEquals(Step.Send(8 * mib, 16 * mib - 1), nextStep(204, null, sent, total, "", en))

    @Test fun `201 is done`() = assertEquals(Step.Done, nextStep(201, null, sent, total, "", en))

    @Test fun `409 with a count resumes there`() =
        assertEquals(Step.Send(3, 3 + CHUNK_BYTES - 1), nextStep(409, 3, sent, total, "", en))

    @Test fun `409 without a count is another writer, so wait`() =
        assertEquals(Step.Retry, nextStep(409, null, sent, total, "", en))

    @Test fun `server and network trouble wait and try again`() {
        assertEquals(Step.Retry, nextStep(500, null, sent, total, "", en))
        assertEquals(Step.Retry, nextStep(503, null, sent, total, "", en))
        assertEquals(Step.Retry, nextStep(NETWORK_ERROR, null, sent, total, "", en))
    }

    @Test fun `only a run of stalls in a row gives up`() {
        assertFalse(givesUp(MAX_STALLS - 1))
        assertTrue(givesUp(MAX_STALLS))
    }

    @Test fun `426 means the app must update`() = assertEquals(Step.UpdateNeeded, nextStep(426, null, Step.Send(0, 9), 10, "", en))
    @Test fun `401 means pair again`() = assertEquals(Step.Unpaired, nextStep(401, null, sent, total, "", en))

    @Test fun `a refusal without words says so, in the account's language`() {
        assertEquals(Step.Fail("The server refused it (413)."), nextStep(413, null, sent, total, "", Words.en))
        assertEquals(Step.Fail("Strežnik ga je zavrnil (413)."), nextStep(413, null, sent, total, "", Words.sl))
        assertEquals(Step.Fail(Words.sl.serverHasAll), nextStep(409, total, sent, total, "", Words.sl))
    }

@Test fun `a gone target or a refused file fails for good`() {
        assertEquals(Step.Fail("No such lesson."), nextStep(404, null, sent, total, "No such lesson.", en))
        assertEquals(Step.Fail("Too big"), nextStep(413, null, sent, total, "Too big", en))
        assertEquals(Step.Fail("No"), nextStep(415, null, sent, total, "No", en))
    }

    @Test fun `a server that holds everything but never finished cannot be resumed`() =
        assertTrue(nextStep(409, total, sent, total, "", en) is Step.Fail)

    @Test fun `a figure recording must fit one request`() {
        assertTrue(fitsRecording(95 * mib))
        assertTrue(!fitsRecording(95 * mib + 1))
    }

    @Test fun `only a video larger than the target is compressed`() {
        assertTrue(needsCompression(1920, 1080, 480))
        assertTrue(needsCompression(1080, 1920, 720))
        assertTrue(!needsCompression(854, 480, 480))
        assertTrue(!needsCompression(640, 360, 480))
    }

    @Test fun `output keeps the aspect, even-sized`() {
        assertEquals(854 to 480, outputSize(1920, 1080, 480))
        assertEquals(720 to 1280, outputSize(1080, 1920, 720))
    }
}
