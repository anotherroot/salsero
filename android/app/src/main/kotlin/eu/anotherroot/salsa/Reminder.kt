package eu.anotherroot.salsa

import java.time.ZonedDateTime

/**
 * The daily nudge, as pure decisions: when it next fires, what it says, and
 * which dance tapping it opens. What is due comes from `/api/device/today`,
 * computed by the server when asked — nothing about it is stored.
 */

/** The next moment at [minute] of the day strictly after [now], in [now]'s zone. */
fun nextFire(now: ZonedDateTime, minute: Int): ZonedDateTime {
    fun on(day: ZonedDateTime) =
        ZonedDateTime.of(day.toLocalDate(), java.time.LocalTime.of(minute / 60, minute % 60), now.zone)
    val today = on(now)
    return if (today.isAfter(now)) today else on(now.plusDays(1))
}

/** How many names per dance before "+N". */
private const val NAMES_PER_DANCE = 3

/** Title and body, or null when nothing is due. Dances in the server's order. */
fun reminderText(due: Map<String, List<String>>): Pair<String, String>? {
    val total = due.values.sumOf { it.size }
    if (total == 0) return null
    val title = if (total == 1) "1 exercise due" else "$total exercises due"
    val body = due.filterValues { it.isNotEmpty() }.entries.joinToString(" · ") { (dance, names) ->
        val shown = names.take(NAMES_PER_DANCE).joinToString(", ")
        val more = if (names.size > NAMES_PER_DANCE) " +${names.size - NAMES_PER_DANCE}" else ""
        "${dance.replaceFirstChar { it.uppercase() }}: $shown$more"
    }
    return title to body
}

/** The dance with the most due; the first listed on a tie; null when none is due. */
fun danceToOpen(due: Map<String, List<String>>): String? =
    due.entries.filter { it.value.isNotEmpty() }.maxByOrNull { it.value.size }?.key
