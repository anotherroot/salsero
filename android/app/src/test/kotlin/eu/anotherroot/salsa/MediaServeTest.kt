package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MediaServeTest {
    @Test fun `no Range asks for the whole file`() {
        assertEquals(Span.Whole, spanOf(null, 1000))
        assertEquals(Span.Whole, spanOf("", 1000))
    }

    @Test fun `a closed range, an open one and a suffix`() {
        assertEquals(Span.Part(0, 0), spanOf("bytes=0-0", 1000))
        assertEquals(Span.Part(100, 999), spanOf("bytes=100-", 1000))
        assertEquals(Span.Part(500, 999), spanOf("bytes=-500", 1000))
        assertEquals(Span.Part(990, 999), spanOf("bytes=990-5000", 1000))
    }

    @Test fun `past the end, or junk, cannot be answered`() {
        assertEquals(Span.Unsatisfiable, spanOf("bytes=1000-", 1000))
        assertEquals(Span.Unsatisfiable, spanOf("bytes=5-2", 1000))
        assertEquals(Span.Unsatisfiable, spanOf("items=0-1", 1000))
    }

    @Test fun `the headers a part answers with`() {
        assertEquals("bytes 100-199/1000", contentRange(Span.Part(100, 199), 1000))
        assertEquals(100L, Span.Part(100, 199).length)
    }

    @Test fun `only the site's own video paths, with a server file name`() {
        val name = "0f8fad5b-d9cb-469f-a165-70867728950e.mp4"
        assertEquals(name, originalPathFile("/recordings/$name"))
        assertEquals(name, originalPathFile("/lesson-videos/$name"))
        assertNull(originalPathFile("/audio/$name"))
        assertNull(originalPathFile("/recordings/../x.mp4"))
        assertNull(originalPathFile("/recordings/x.mp4"))
    }
}

class SliceTest {
    @org.junit.Test fun `a slice of a stream from a start, so many bytes`() {
        val all = ByteArray(1000) { (it % 251).toByte() }
        val got = sliceOf(java.io.ByteArrayInputStream(all), 100, 50).readBytes()
        org.junit.Assert.assertArrayEquals(all.copyOfRange(100, 150), got)
    }

    @org.junit.Test fun `the extension a picked video's file name takes`() {
        org.junit.Assert.assertEquals("mov", extensionOf("video/quicktime"))
        org.junit.Assert.assertEquals("webm", extensionOf("video/webm"))
        org.junit.Assert.assertEquals("mp4", extensionOf("video/mp4"))
        org.junit.Assert.assertEquals("mp4", extensionOf(null))
    }
}
