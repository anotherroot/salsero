package eu.anotherroot.salsa

import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull

class BarsTest {
    @Test
    fun `tabs and page are the two strips`() {
        assertEquals(Strip.TABS, stripFor("tabs"))
        assertEquals(Strip.PAGE, stripFor("page"))
    }

    @Test
    fun `anything else is ignored`() {
        assertNull(stripFor(null))
        assertNull(stripFor("TABS"))
        assertNull(stripFor(""))
    }
}
