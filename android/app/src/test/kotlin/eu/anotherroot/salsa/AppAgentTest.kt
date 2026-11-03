package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Test

class AppAgentTest {
    @Test fun userAgentNamesTheApp() {
        assertEquals(
            "Mozilla/5.0 X SalsaApp/2 (salsa; direct)",
            appUserAgent("Mozilla/5.0 X", 2, "salsa", "direct"),
        )
    }

    @Test fun userAgentIsNotDoubled() {
        val once = appUserAgent("Mozilla/5.0 X", 2, "salsa", "direct")
        assertEquals(once, appUserAgent(once, 2, "salsa", "direct"))
    }

    @Test fun versionHeader() {
        assertEquals("2; bachata; play", appVersionHeader(2, "bachata", "play"))
    }
}
