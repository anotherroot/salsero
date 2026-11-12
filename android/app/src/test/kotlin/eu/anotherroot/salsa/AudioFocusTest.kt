package eu.anotherroot.salsa

import android.media.AudioManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AudioFocusTest {
    @Test
    fun `on and off are the two words`() {
        assertEquals(true, soundingFor("on"))
        assertEquals(false, soundingFor("off"))
    }

    @Test
    fun `anything else is ignored`() {
        assertNull(soundingFor(null))
        assertNull(soundingFor(""))
        assertNull(soundingFor("ON"))
        assertNull(soundingFor("pause"))
    }

    @Test
    fun `another app taking the sound stops ours`() {
        assertTrue(stopsOn(AudioManager.AUDIOFOCUS_LOSS))
        assertTrue(stopsOn(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT))
    }

    @Test
    fun `a notification only ducks it, and the focus coming back plays nothing`() {
        assertFalse(stopsOn(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK))
        assertFalse(stopsOn(AudioManager.AUDIOFOCUS_GAIN))
    }
}
