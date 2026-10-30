package eu.anotherroot.salsa

import java.time.ZonedDateTime

/**
 * The daily nudge, as pure decisions: when it next fires and what it says.
 * Each dance is its own app, so each reminds of its own dance only; what is
 * due comes from `/api/device/today`, computed by the server when asked —
 * nothing about it is stored.
 */

/** The next moment at [minute] of the day strictly after [now], in [now]'s zone. */
fun nextFire(now: ZonedDateTime, minute: Int): ZonedDateTime {
    fun on(day: ZonedDateTime) =
        ZonedDateTime.of(day.toLocalDate(), java.time.LocalTime.of(minute / 60, minute % 60), now.zone)
    val today = on(now)
    return if (today.isAfter(now)) today else on(now.plusDays(1))
}

/** How many names before "+N". */
private const val NAMES_SHOWN = 4

/**
 * Title and body for this dance's [due] names, or null when nothing is due.
 * The notification already carries the app's name, so the dance is not repeated.
 */
fun reminderText(due: List<String>): Pair<String, String>? {
    if (due.isEmpty()) return null
    val title = if (due.size == 1) "1 exercise due" else "${due.size} exercises due"
    val more = if (due.size > NAMES_SHOWN) " +${due.size - NAMES_SHOWN}" else ""
    return title to due.take(NAMES_SHOWN).joinToString(", ") + more
}
