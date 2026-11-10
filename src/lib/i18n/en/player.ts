// Practice: the player's setup, the run, Save this run, and where Back goes. The
// chips and the panel's shared words (Play, Stop, Speed, Voice count …) are
// `exercise.panel`'s.
import { plural } from './plural';
import { nouns } from './nouns';

export const player = {
	title: 'Practice',
	/** The tab's title: "Practice · Salsa". */
	pageTitle: (dance: string): string => `Practice · ${dance}`,
	/** The band's subtitle over a routine: "Shines · 3 figures". */
	routineLine: (name: string, figures: number): string => `${name} · ${nouns.figures(figures)}`,
	voice: 'Voice',
	recordOwn: 'Record your own count',
	/** Whose voice counts: the built-in clips, or the person's own recording. */
	builtIn: 'Built-in',
	yours: 'Yours',
	couldNotStart: 'Could not start the player.',
	couldNotStartBody: 'Nothing is playing. Tap Play to try again.',
	loadingGrid: 'Loading the beat grid…',
	/** A routine run: the list moves with the music, or stays put. */
	follow: 'Follow',
	still: 'Still',
	/** The full-screen routine's line: "5 of 16", or the routine's length. */
	routinePlace: (n: number, total: number): string => `${n} of ${total}`,
	figures: (n: number): string => plural(n, 'figure', 'figures'),
	/** A routine row's button in Follow: "Start from 3, Enchufla · Basic". */
	startFrom: (n: number, names: string): string => `Start from ${n}, ${names}`,
	or: 'or',
	showFull: 'Show the routine full screen',
	closeFull: 'Close the full-screen routine',
	/** What the run is, first in its subtitle: "Drill · 130 BPM". */
	kind: { figure: 'Figure', drill: 'Drill', routine: 'Routine' },
	/** The rows under the band, and what each one's line says. */
	about: 'About',
	/** Under the count in Follow: "Next: Enchufla · Basic". */
	next: (name: string): string => `Next: ${name}`,
	/** A layer's ✕. */
	closeLayer: 'Close',
	/** Voice: how late the phone's sound reaches the ear (Bluetooth headphones: ~250 ms). */
	countDelay: 'Sound delay',
	ms: 'ms',
	countEarlier: 'Less sound delay',
	countLater: 'More sound delay',
	/**
	 * Under Sound delay: what the phone reports, already counted in, and what it
	 * moves — with a song the voice and the clave start early, count only the
	 * visual count waits.
	 */
	countDelayNote: (reportedMs: number, withSong: boolean): string =>
		withSong
			? reportedMs > 0
				? `This phone says its sound reaches you ${reportedMs} ms late, so the voice and the clave start that much early to land on the music. If they are still late, raise it.`
				: 'This phone does not say its sound arrives late. With wireless headphones, raise it until the voice and the clave land on the music.'
			: reportedMs > 0
				? `This phone says its sound reaches you ${reportedMs} ms late, so the visual count waits that long. If the visual count is still ahead of the voice, raise it.`
				: 'This phone does not say its sound arrives late. With wireless headphones, raise it until the visual count lands with the voice.',
	/** A figure's timing in About: "1 → 1 · 8 counts". */
	timing: (start: number, next: number, length: number): string =>
		`${start} → ${next} · ${length} counts`,
	/** A figure's own video, in About. */
	recording: 'Recording',
	aboutOf: (name: string): string => `About ${name}`,
	aboutNotes: 'Notes',
	aboutPositions: 'Positions',
	aboutSections: (n: number): string => (n === 1 ? 'a lesson section' : `${n} lesson sections`),
	aboutRecordings: (n: number): string => (n === 1 ? 'a recording' : `${n} recordings`),
	aboutLinks: (n: number): string => (n === 1 ? 'a link' : `${n} links`),
	/** A video in About: a tap plays it aloud, and the music pauses. */
	withSound: (caption: string): string => `Play ${caption} with sound`,
	/** Over About while a video has the sound. */
	musicPaused: 'Music paused',
	/** A lesson's About. */
	aboutFigures: (n: number): string => (n === 1 ? 'a figure' : `${n} figures`),
	aboutVideos: (n: number): string => (n === 1 ? 'a video' : `${n} videos`),
	starting: 'Starting…',
	pickSongFirst: 'Pick a song first.',
	/** The picked song's grid did not load. */
	songFailed: 'That song could not be loaded. Pick another, or use the count.',
	/** The running band: "Paused · 1:04". */
	paused: (clock: string): string => `Paused · ${clock}`,
	stopAndBack: 'Stop and go back',
	routine: 'Routine',
	now: 'Now',
	/** The count disc's name. */
	countNotStarted: 'Count not started',
	countDigit: (digit: string): string => `Count ${digit}`,
	/** The run's subtitle part for a count-only tempo: "180 BPM". */
	bpm: (n: number): string => `${n} BPM`,
	/** Where the band's back goes with no opener recorded. */
	backToToday: 'Back to Today',
	backToMusic: 'Back to Music'
};
