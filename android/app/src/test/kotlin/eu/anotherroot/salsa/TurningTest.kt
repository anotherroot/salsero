package eu.anotherroot.salsa

import android.content.pm.ActivityInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TurningTest {
    @Test
    fun `free and portrait are the two answers`() {
        assertEquals(Turning.FREE, turningFor("free"))
        assertEquals(Turning.PORTRAIT, turningFor("portrait"))
    }

    @Test
    fun `anything else is ignored`() {
        assertNull(turningFor(null))
        assertNull(turningFor(""))
        assertNull(turningFor("FREE"))
        assertNull(turningFor("landscape"))
    }

    @Test
    fun `the app stands upright`() {
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT, orientationFor(pageFree = false, fullscreen = false))
    }

    @Test
    fun `a video turns with the phone`() {
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_FULL_USER, orientationFor(pageFree = true, fullscreen = false))
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_FULL_USER, orientationFor(pageFree = false, fullscreen = true))
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_FULL_USER, orientationFor(pageFree = true, fullscreen = true))
    }
}
