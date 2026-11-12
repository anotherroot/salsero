/**
 * One sound at a time, wired to the page (the rule is `one-sound.ts`). The
 * root layout starts it once (`oneSoundAtATime`): every `<audio>`/`<video>`
 * in the page is watched from the document, so a new component takes part
 * without doing anything. The rest register:
 *
 * - an element whose stop is not a bare `pause()` — the practice run's song
 *   (the run pauses as a whole, voice and all), an About clip (it gives the
 *   sound back and loops on muted) — or one not in the page (the song sample's
 *   `<audio>`): `{@attach stopsBy(fn)}` / `stopsBy(fn)(el)`;
 * - something that is no media element at all (a YouTube embed): `holdSound`,
 *   and `soundFrom` when it starts.
 *
 * (Turned off, `APP_AUDIO_FOCUS`.) In the Android app the page tells `SalsaAudio` `on` while anything of ours
 * is audible (the app takes the phone's audio focus: Spotify pauses) and `off`
 * when nothing is; the app posts `pause` when another app takes the sound.
 * In a browser there is no `SalsaAudio`; the browser does its own.
 */
import { focusWord, quietFor, quietForApp, type Playing } from './one-sound';

/** Something that plays and is not a media element: a YouTube embed. */
export interface Holder {
	playing(): boolean;
	stop(): void;
}

type Source = HTMLMediaElement | Holder;

interface Bridge {
	postMessage(message: string): void;
	onmessage: ((event: { data: unknown }) => void) | null;
}

const stoppers = new Map<HTMLMediaElement, () => void>();
const holders = new Set<Holder>();
/** Off: see `oneSoundAtATime`. */
export const APP_AUDIO_FOCUS = false;
let told: 'on' | 'off' = 'off';
let bridge: Bridge | undefined;

const isMedia = (s: Source): s is HTMLMediaElement =>
	typeof HTMLMediaElement !== 'undefined' && s instanceof HTMLMediaElement;

function look(s: Source): Playing {
	if (!isMedia(s)) return { playing: s.playing(), muted: false, ambient: false };
	return {
		playing: !s.paused && !s.ended,
		muted: s.muted || s.volume === 0,
		ambient: s.dataset.ambient !== undefined
	};
}

function sources(): Source[] {
	const media = new Set<HTMLMediaElement>(document.querySelectorAll('audio, video'));
	for (const el of stoppers.keys()) media.add(el);
	return [...media, ...holders];
}

function stop(s: Source) {
	if (!isMedia(s)) return s.stop();
	const own = stoppers.get(s);
	if (own) own();
	else s.pause();
}

/** Tell the app whether anything of ours is audible, when that changes. */
function tell() {
	if (!bridge) return;
	const word = focusWord(sources(), look);
	if (word === told) return;
	told = word;
	bridge.postMessage(word);
}

/** `from` started (or got its sound back): everything else that plays stops. */
export function soundFrom(from: Source): void {
	if (typeof document === 'undefined') return;
	for (const s of quietFor(sources(), from, look)) stop(s);
	tell();
}

function onPlay(event: Event) {
	const el = event.target;
	if (isMedia(el as Source)) soundFrom(el as HTMLMediaElement);
}

/** A pause, an end, a mute: maybe nothing is audible any more. */
const onQuiet = () => tell();

/** The root layout's: watch the whole page; returns the undo. */
export function oneSoundAtATime(): () => void {
	// Capture: `play` and `pause` do not bubble.
	document.addEventListener('play', onPlay, true);
	document.addEventListener('volumechange', onPlay, true);
	for (const type of ['pause', 'ended', 'emptied']) document.addEventListener(type, onQuiet, true);
	/*
	 * The app's audio focus is OFF (2026-11-12): in app 1.12 a song or video with
	 * sound played a split second and paused — the app's focus request took the
	 * sound from its own WebView. Never talk to `SalsaAudio`, so 1.12 apps hold
	 * no focus. Turn it back on only after it works on a real phone.
	 */
	bridge = APP_AUDIO_FOCUS ? (window as unknown as { SalsaAudio?: Bridge }).SalsaAudio : undefined;
	if (bridge) {
		bridge.onmessage = (event) => {
			if (event.data !== 'pause') return;
			// The app gave the focus back already: what we stop must not ask for it again.
			told = 'off';
			for (const s of quietForApp(sources(), look)) stop(s);
		};
	}
	return () => {
		document.removeEventListener('play', onPlay, true);
		document.removeEventListener('volumechange', onPlay, true);
		for (const type of ['pause', 'ended', 'emptied'])
			document.removeEventListener(type, onQuiet, true);
		if (bridge) bridge.onmessage = null;
		bridge = undefined;
	};
}

/**
 * This element stops by `fn`, not by a bare `pause()`. One outside the page
 * (a detached `new Audio()`) is watched on itself, since the document never
 * hears its events. An attachment: `{@attach stopsBy(fn)}`.
 */
export function stopsBy(fn: () => void): (el: HTMLMediaElement) => () => void {
	return (el) => {
		stoppers.set(el, fn);
		const play = () => {
			if (!el.isConnected) soundFrom(el);
		};
		const quiet = () => {
			if (!el.isConnected) tell();
		};
		el.addEventListener('play', play);
		el.addEventListener('volumechange', play);
		el.addEventListener('pause', quiet);
		el.addEventListener('ended', quiet);
		return () => {
			el.removeEventListener('play', play);
			el.removeEventListener('volumechange', play);
			el.removeEventListener('pause', quiet);
			el.removeEventListener('ended', quiet);
			if (stoppers.get(el) === fn) stoppers.delete(el);
			tell();
		};
	};
}

/** Something that is no media element plays now and then; returns the undo. */
export function holdSound(holder: Holder): () => void {
	holders.add(holder);
	return () => {
		holders.delete(holder);
		tell();
	};
}
