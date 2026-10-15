package eu.anotherroot.salsa

import android.content.Context
import androidx.core.content.edit

/** What the app remembers: its device token, and a link waiting for pairing to finish. */
object Prefs {
    private fun prefs(context: Context) = context.getSharedPreferences("salsa", Context.MODE_PRIVATE)

    fun token(context: Context): String? = prefs(context).getString("token", null)

    fun setToken(context: Context, token: String?) = prefs(context).edit { putString("token", token) }

    /** The `salsa://upload` link that sent the app to pair, to carry on with once paired. */
    fun pendingLink(context: Context): String? = prefs(context).getString("pendingLink", null)

    fun setPendingLink(context: Context, link: String?) = prefs(context).edit { putString("pendingLink", link) }

    /** The reminder time last read from the server, for rescheduling after a reboot. -1 = off. */
    fun reminderMinute(context: Context): Int? = prefs(context).getInt("reminderMinute", -1).takeIf { it >= 0 }

    fun setReminderMinute(context: Context, minute: Int?) = prefs(context).edit { putInt("reminderMinute", minute ?: -1) }
}
