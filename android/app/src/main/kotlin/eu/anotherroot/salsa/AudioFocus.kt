package eu.anotherroot.salsa

import android.media.AudioManager

/**
 * One sound at a time across the phone, as Spotify does it: while a page of ours
 * plays aloud it tells `SalsaAudio` `on` and the app holds the audio focus (Spotify
 * pauses); `off` gives it back. The page's side is `src/lib/sound/page.ts`.
 */
const val AUDIO_OBJECT = "SalsaAudio"

/** Posted to the page when another app takes the sound: it stops what plays aloud. */
const val AUDIO_PAUSE = "pause"

/** `"on"` (something of ours plays aloud) or `"off"` (nothing does); anything else is ignored. */
fun soundingFor(message: String?): Boolean? = when (message) {
    "on" -> true
    "off" -> false
    else -> null
}

/**
 * Another app took the sound, for good (Spotify) or for a while (a call): ours
 * stops and waits to be played again. A notification only ducks it.
 */
fun stopsOn(change: Int): Boolean =
    change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
