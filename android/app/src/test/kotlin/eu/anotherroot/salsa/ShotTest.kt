package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Test

class ShotTest {
    @Test
    fun `a tall phone screen shrinks to the long side`() {
        assertEquals(ShotSize(576, 1280), shotSize(1080, 2400))
    }

    @Test
    fun `a wide one too`() {
        assertEquals(ShotSize(1280, 720), shotSize(2560, 1440))
    }

    @Test
    fun `a small one stays as it is`() {
        assertEquals(ShotSize(720, 1280), shotSize(720, 1280))
        assertEquals(ShotSize(390, 844), shotSize(390, 844))
    }
}
