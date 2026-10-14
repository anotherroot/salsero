package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiTest {
    @Test fun `config with a reminder`() =
        assertEquals(Config(1080, 720), parseConfig("""{"reminderMinute":1080,"shortSide":720}"""))

    @Test fun `config with reminders off`() =
        assertEquals(Config(null, 480), parseConfig("""{"reminderMinute":null,"shortSide":480}"""))

    @Test fun `today, per dance, in the server's order`() =
        assertEquals(
            mapOf("salsa" to listOf("Urgent", "Mild"), "bachata" to emptyList()),
            parseToday("""{"salsa":{"due":["Urgent","Mild"]},"bachata":{"due":[]}}"""),
        )
}
