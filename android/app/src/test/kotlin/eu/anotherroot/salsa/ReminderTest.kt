package eu.anotherroot.salsa

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class ReminderTest {
    private val zone = ZoneId.of("Europe/Ljubljana")
    private fun at(y: Int, mo: Int, d: Int, h: Int, mi: Int, s: Int = 0) = ZonedDateTime.of(y, mo, d, h, mi, s, 0, zone)

    @Test fun `later today when the time is still ahead`() =
        assertEquals(at(2026, 10, 14, 18, 0), nextFire(at(2026, 10, 14, 17, 59), 18 * 60))

    @Test fun `tomorrow once it has passed, even by seconds`() {
        assertEquals(at(2026, 10, 15, 18, 0), nextFire(at(2026, 10, 14, 18, 0, 30), 18 * 60))
        assertEquals(at(2026, 10, 15, 18, 0), nextFire(at(2026, 10, 14, 18, 0, 0), 18 * 60))
    }

    @Test fun `just before midnight for a 23 59 reminder`() =
        assertEquals(at(2026, 10, 15, 23, 59), nextFire(at(2026, 10, 14, 23, 59, 30), 23 * 60 + 59))

    @Test fun `the clock going back keeps the wall-clock time`() {
        // 25 Oct 2026: 03:00 CEST becomes 02:00 CET. 18:00 the next day is 25 h away, still 18:00.
        val fire = nextFire(at(2026, 10, 24, 19, 0), 18 * 60)
        assertEquals(18, fire.hour)
        assertEquals(25, fire.dayOfMonth)
    }

    @Test fun `a time the clock skips moves past the gap`() {
        // 28 Mar 2027: 02:00 CET jumps to 03:00 CEST, so 02:30 does not exist that day.
        val fire = nextFire(at(2027, 3, 27, 23, 0), 2 * 60 + 30)
        assertEquals(at(2027, 3, 28, 3, 30), fire)
    }

    @Test fun `nothing due, no notification`() = assertNull(reminderText(emptyList()))

    @Test fun `names what is due`() = assertEquals(
        "2 exercises due" to "Shines, Cross-body lead",
        reminderText(listOf("Shines", "Cross-body lead")),
    )

    @Test fun `one is singular`() = assertEquals("1 exercise due" to "Basics", reminderText(listOf("Basics")))

    @Test fun `a long list is cut after four`() = assertEquals(
        "6 exercises due" to "A, B, C, D +2",
        reminderText(listOf("A", "B", "C", "D", "E", "F")),
    )
}
