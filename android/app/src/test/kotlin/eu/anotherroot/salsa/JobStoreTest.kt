package eu.anotherroot.salsa

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files

class JobStoreTest {
    private lateinit var root: File
    private lateinit var store: JobStore

    private fun job(id: String, at: Long, target: Target = Target.Lesson(12), share: String? = null) =
        Job(id, "content://media/picker/0/x/media/$id", share, target, "/salsa/lessons/12", "Wednesday class", at)

    @Before fun setUp() {
        root = Files.createTempDirectory("jobs").toFile()
        store = JobStore(root)
    }

    @After fun tearDown() {
        root.deleteRecursively()
    }

    @Test fun `a job reads back as it was queued`() {
        val figure = job("a", 1, Target.Figure(7), share = "0f8e2a3c-1b2d-4e5f-8a9b-0c1d2e3f4a5b")
        store.add(figure)
        assertEquals(listOf(figure), store.jobs())
    }

    @Test fun `jobs come out in the order they were queued, not by id`() {
        store.add(job("z", 1))
        store.add(job("a", 2))
        store.add(job("m", 3))
        assertEquals(listOf("z", "a", "m"), store.jobs().map { it.id })
    }

    @Test fun `removing a job takes its files and leaves the rest`() {
        store.add(job("a", 1))
        store.add(job("b", 2))
        store.compressed("a").writeText("video")
        store.remove("a")
        assertEquals(listOf("b"), store.jobs().map { it.id })
        assertFalse(File(root, "a").exists())
    }

    @Test fun `a job that cannot be read is skipped, not fatal`() {
        store.add(job("a", 1))
        File(root, "broken").mkdirs()
        File(root, "broken/job.json").writeText("{not json")
        assertEquals(listOf("a"), store.jobs().map { it.id })
    }

    @Test fun `the server id is stable until the video is compressed again`() {
        store.add(job("a", 1))
        val first = store.serverId("a")
        assertEquals(first, store.serverId("a"))
        store.setOffset("a", 5_000)
        val fresh = store.freshServerId("a")
        assertNotEquals(first, fresh)
        assertEquals(fresh, store.serverId("a"))
        assertEquals(0L, store.offset("a"))
    }

    @Test fun `stalls count runs without progress, and progress clears them`() {
        store.add(job("a", 1))
        assertEquals(1, store.addStall("a"))
        assertEquals(2, store.addStall("a"))
        store.setOffset("a", 0) // no progress
        assertEquals(2, store.stalls("a"))
        store.setOffset("a", 8_000)
        assertEquals(0, store.stalls("a"))
        store.addStall("a")
        store.clearStalls("a")
        assertEquals(0, store.stalls("a"))
    }

    @Test fun `knows which shares are still wanted`() {
        store.add(job("a", 1, share = "k1"))
        store.add(job("b", 2))
        assertEquals(setOf("k1"), store.sharedKeys())
        assertTrue(store.isEmpty().not())
    }
}
