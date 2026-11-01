package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BarsTest {
    @Test
    fun `light and dark are the two schemes`() {
        assertEquals(Scheme.LIGHT, schemeFor("light"))
        assertEquals(Scheme.DARK, schemeFor("dark"))
    }

    @Test
    fun `anything else is ignored`() {
        assertNull(schemeFor(null))
        assertNull(schemeFor("DARK"))
        assertNull(schemeFor("tabs"))
        assertNull(schemeFor(""))
    }

    @Test
    fun `under the bars the page pads itself top and bottom`() {
        assertEquals(
            InsetSplit(padLeft = 0, padTop = 0, padRight = 0, padBottom = 0, safeTop = 84, safeBottom = 63),
            splitInsets(0, 84, 0, 63, keyboard = 0, underBars = true),
        )
    }

    @Test
    fun `the sides stay padded`() {
        val split = splitInsets(120, 84, 40, 0, keyboard = 0, underBars = true)
        assertEquals(120, split.padLeft)
        assertEquals(40, split.padRight)
    }

    @Test
    fun `with the keyboard up the WebView sits above it and the page pads nothing at the bottom`() {
        val split = splitInsets(0, 84, 0, 63, keyboard = 900, underBars = true)
        assertEquals(900, split.padBottom)
        assertEquals(0, split.safeBottom)
        assertEquals(84, split.safeTop)
    }

    @Test
    fun `without page insets every bar is padded`() {
        assertEquals(
            InsetSplit(padLeft = 0, padTop = 84, padRight = 0, padBottom = 63, safeTop = 0, safeBottom = 0),
            splitInsets(0, 84, 0, 63, keyboard = 0, underBars = false),
        )
        assertEquals(900, splitInsets(0, 84, 0, 63, keyboard = 900, underBars = false).padBottom)
    }

    @Test
    fun `the script carries CSS px`() {
        assertEquals(
            "window.appInsets={top:32.00,bottom:24.00,left:0,right:0};" +
                "window.applyAppInsets&&window.applyAppInsets();",
            insetsScript(84, 63, 2.625f),
        )
    }
}
