package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UploadPlanTest {
    private val mib = 1024L * 1024
    private val total = 20 * mib
    private val sent = Step.Send(0, 8 * mib - 1)

    @Test fun `a run opens with a small probe from the saved offset`() {
        assertEquals(Step.Send(0, PROBE_BYTES - 1), firstChunk(0, total))
        assertEquals(Step.Send(5 * mib, 5 * mib + PROBE_BYTES - 1), firstChunk(5 * mib, total))
        assertEquals(Step.Send(0, 99), firstChunk(0, 100))
    }

    @Test fun `204 continues from what the server holds`() =
        assertEquals(Step.Send(8 * mib, 16 * mib - 1), nextStep(204, 8 * mib, sent, total, 0, ""))

    @Test fun `the last chunk ends at the last byte`() =
        assertEquals(Step.Send(16 * mib, total - 1), nextStep(204, 16 * mib, sent, total, 0, ""))

    @Test fun `204 without a count assumes the chunk landed`() =
        assertEquals(Step.Send(8 * mib, 16 * mib - 1), nextStep(204, null, sent, total, 0, ""))

    @Test fun `201 is done`() = assertEquals(Step.Done, nextStep(201, null, sent, total, 0, ""))

    @Test fun `409 with a count resumes there`() =
        assertEquals(Step.Send(3, 3 + CHUNK_BYTES - 1), nextStep(409, 3, sent, total, 0, ""))

    @Test fun `409 without a count is another writer, so wait`() =
        assertTrue(nextStep(409, null, sent, total, 0, "") is Step.Retry)

    @Test fun `server and network trouble retry`() {
        assertTrue(nextStep(500, null, sent, total, 0, "") is Step.Retry)
        assertTrue(nextStep(503, null, sent, total, 0, "") is Step.Retry)
        assertTrue(nextStep(NETWORK_ERROR, null, sent, total, 0, "") is Step.Retry)
    }

    @Test fun `retrying gives up eventually`() =
        assertEquals(Step.Fail("Bad gateway"), nextStep(502, null, sent, total, MAX_ATTEMPTS, "Bad gateway"))

    @Test fun `401 means pair again`() = assertEquals(Step.Unpaired, nextStep(401, null, sent, total, 0, ""))

    @Test fun `a gone target or a refused file fails for good`() {
        assertEquals(Step.Fail("No such lesson."), nextStep(404, null, sent, total, 0, "No such lesson."))
        assertEquals(Step.Fail("Too big"), nextStep(413, null, sent, total, 0, "Too big"))
        assertEquals(Step.Fail("No"), nextStep(415, null, sent, total, 0, "No"))
    }

    @Test fun `a server that holds everything but never finished cannot be resumed`() =
        assertTrue(nextStep(409, total, sent, total, 0, "") is Step.Fail)

    @Test fun `backoff grows and is capped`() {
        val waits = (0..10).map { (nextStep(500, null, sent, total, it, "") as Step.Retry).afterMs }
        assertTrue(waits.zipWithNext().all { (a, b) -> b >= a })
        assertTrue(waits.last() <= 5 * 60_000)
    }

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
