package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UploadTargetTest {
    private val id = "0f8fad5b-d9cb-469f-a165-70867728950e"

    @Test fun `every upload is chunked, to its target's route`() {
        assertEquals("/api/lessons/12/videos/$id", uploadPath(Target.Lesson(12), id))
        assertEquals("/api/figures/7/recordings/$id", uploadPath(Target.Figure(7), id))
        assertEquals("/api/recordings/40/file/$id", uploadPath(Target.Recording(40), id))
        assertEquals("/api/lesson-videos/41/file/$id", uploadPath(Target.LessonVideo(41), id))
    }

    @Test fun `a phone-only original keeps its permission when its upload ends`() {
        assertTrue(releasesSource(Target.Lesson(1)))
        assertTrue(releasesSource(Target.Figure(1)))
        assertFalse(releasesSource(Target.Recording(1)))
        assertFalse(releasesSource(Target.LessonVideo(1)))
    }
}
