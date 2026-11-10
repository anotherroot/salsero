package eu.anotherroot.salsa

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files

class OriginalStoreTest {
    private lateinit var dir: File
    private val a = Original("0f8fad5b-d9cb-469f-a165-70867728950e.mp4", "content://media/picker/0/x/media/1", "video/mp4", 500, "u1")
    private val b = Original("1f8fad5b-d9cb-469f-a165-70867728950e.mov", "content://media/picker/0/x/media/2", "video/quicktime", 700, "u2")

    @Before fun setUp() {
        dir = Files.createTempDirectory("originals").toFile()
    }

    @After fun tearDown() {
        dir.deleteRecursively()
    }

    @Test fun `put, get, forget`() {
        val store = OriginalStore(File(dir, "originals.json"))
        store.put(a)
        store.put(b)
        assertEquals(a, store.get(a.file))
        assertEquals(listOf(a), store.of("u1"))
        store.forget(a.file)
        assertNull(store.get(a.file))
        assertEquals(listOf(b), store.all())
    }

    @Test fun `survives a reload from the file`() {
        OriginalStore(File(dir, "originals.json")).apply { put(a); put(b) }
        val again = OriginalStore(File(dir, "originals.json"))
        assertEquals(setOf(a, b), again.all().toSet())
    }

    @Test fun `a broken file reads as none`() {
        File(dir, "originals.json").writeText("{not json")
        assertEquals(emptyList<Original>(), OriginalStore(File(dir, "originals.json")).all())
    }
}
