package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PagesTest {
    private val site = "https://salsa.anotherroot.eu"

    @Test fun `our own pages are ours`() {
        assertTrue(isOwnPage("$site/salsa", site))
        assertTrue(isOwnPage("$site/", site))
        assertTrue(isOwnPage(site, site))
    }

    @Test fun `look-alikes are not ours`() {
        for (foreign in listOf(
            "http://salsa.anotherroot.eu/x",
            "https://salsa.anotherroot.eu.evil.com/x",
            "https://evil.com@salsa.anotherroot.eu/x",
            "https://salsa.anotherroot.eu:444/x",
            "not a uri",
        )) {
            assertFalse(foreign, isOwnPage(foreign, site))
        }
    }

    @Test fun `our pages open inside the app`() =
        assertEquals(Nav.INSIDE, navigationFor("$site/bachata/figures/4?x=1#top", site))

    @Test fun `a salsa link goes to the app's own link handler`() =
        assertEquals(Nav.APP_LINK, navigationFor("salsa://upload?lesson=3", site))

    @Test fun `other sites, mail and phone numbers leave the app`() {
        for (url in listOf("https://www.youtube.com/watch?v=1", "http://example.com", "mailto:a@b.c", "tel:+386123")) {
            assertEquals(url, Nav.OUTSIDE, navigationFor(url, site))
        }
    }

    @Test fun `anything else is dropped`() {
        for (url in listOf("javascript:alert(1)", "intent://x#Intent;end", "file:///sdcard/x", "content://x/y", "not a uri")) {
            assertEquals(url, Nav.BLOCKED, navigationFor(url, site))
        }
    }

    @Test fun `a dev build on http keeps its own pages inside`() =
        assertEquals(Nav.INSIDE, navigationFor("http://10.0.2.2:5173/salsa", "http://10.0.2.2:5173"))
}
