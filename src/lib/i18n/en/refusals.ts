// The refusals no area owns: a missing row on an error page, a sign-in a request
// lacked, a request only a hand-built body sends, a chunk in the wrong place, the
// file checks before an upload.
export const refusals = {
	signIn: 'Sign in',
	notFound: 'Not found',
	/** A Sync or Take refused because a copy is gone or not this person's. */
	notFoundLine: 'Not found.',
	noDance: 'No such dance',
	unknownDance: 'Unknown dance',
	noLesson: 'No such lesson',
	noExercise: 'No such exercise',
	noSet: 'No such set',
	noRoutine: 'No such routine',
	noGroup: 'No such group',
	noSong: 'No such song',
	songNotFound: 'Song not found',
	figureNotFound: 'Figure not found',
	moveNotFound: 'Move not found',
	positionNotFound: 'Position not found',
	noAnalysedSong: 'No analysed song here',
	nothingShared: 'Nothing was shared',
	/** A move refused by name whose own name is gone. */
	thatMove: 'That move',
	badRequest: 'Bad request',
	badJson: 'Bad JSON.',
	/** A 5xx: the server's own message is a path or a SQL error, never shown. */
	couldNotSave: 'Couldn’t save. Try it again.',
	/** An older open page sent what the server no longer takes (the page epoch). */
	stale: 'This page is out of date. Reload to continue.',
	sayWhatToRestore: 'Say what to restore.',
	practiceSettings: 'Those practice settings cannot be used',
	/** Saving a section or point (the video player's API). */
	spots: {
		nameVideoQuery: 'Name one video: ?recording= or ?lessonVideo=.',
		nameVideoBody: 'Name one video: recordingId or lessonVideoId.',
		nothingToChange: 'Nothing to change.',
		sendTarget: 'Send a target or something to create.'
	},
	/** My count's take upload. */
	take: {
		unknownPattern: 'Unknown count pattern.',
		tempo: 'That tempo is not one of the recorded ones.',
		phrase: 'Phrase must be a or b.',
		metadata: 'Bad take metadata.',
		shorter: 'A take cannot be shorter than its phrase.',
		empty: 'Empty upload.'
	},
	/** A chunked upload's protocol (a lesson video), read on the upload card. */
	chunk: {
		badUploadId: 'Bad upload id.',
		noRange: 'A content-range header of bytes <start>-<end>/<total> is required.',
		tooBig: 'That chunk is too big.',
		empty: 'Empty chunk.',
		busy: 'That upload is already being written.',
		wrongPlace: 'That chunk starts in the wrong place.',
		hostLimit: 'The server refused a chunk that size. Check BODY_SIZE_LIMIT on the host.',
		notSaved: 'That chunk could not be saved.'
	},
	/** Picking files before an upload: the browser's own check, and the batch's outcome. */
	files: {
		/** "That file is 120 MB; the limit is 95 MB." */
		overLimit: (mb: number, limit: string): string =>
			`That file is ${mb} MB; the limit is ${limit}.`,
		audioOnly: 'Only audio files can be added.',
		audioOnlyBody: 'Pick a video with Add video instead.',
		videoOnly: 'Only video files can be added.',
		videoOrAudio: 'Only video and audio files can be added.',
		/** Why one file of a batch was skipped: a phrase in brackets after its name. */
		reason: {
			notVideo: 'not a video',
			/** "2.0 GB — the limit is 1.0 GB" */
			overLimit: (size: string, limit: string): string => `${size} — the limit is ${limit}`,
			connection: 'the connection dropped',
			outOfStep: 'that upload got out of step',
			notSaved: 'the upload finished but the video was not saved',
			/** A refusal without a message: "the server said 502". */
			status: (status: number): string => `the server said ${status}`
		},
		/** "Skipped a.txt (not a video), b.mp4 (the connection dropped)." */
		skipped: (list: string): string => `Skipped ${list}.`,
		/** "2 videos added. Skipped …" */
		addedThenSkipped: (n: number, skipped: string): string =>
			`${n} video${n === 1 ? '' : 's'} added. ${skipped}`,
		someSkipped: 'Some files were skipped',
		oneNotAdded: 'That file wasn’t added',
		noneAdded: 'No videos were added',
		/** The upload card of a chunked upload. */
		retrying: 'Connection dropped — retrying',
		retryingHelper: (pct: number): string => `Picks up from what the server already has · ${pct}%`,
		/** "Uploading 2 of 3… 40%", "Uploading… 40%" */
		uploading: (pct: number, index: number | null, count: number | null): string =>
			`Uploading${index === null ? '' : ` ${index} of ${count}`}… ${pct}%`,
		keepOpen: 'Keep this page open — a reload starts over'
	}
};
