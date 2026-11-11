// Hearing rounds: "Can you find the 1?" on a song's page and the listening
// player (spec 2026-11-10-hearing-drills-design.md). The count's digits and
// "2-3"/"3-2" are not words.

const seconds = (s: number) => s.toFixed(1);

export const hearing = {
	pageTitle: (dance: string) => `Can you find the 1? · ${dance}`,
	back: 'Back',
	/** The card on a song's page. */
	card: {
		title: 'Can you find the 1?',
		sub: 'Tap along, or get dropped in mid-song',
		try: 'Try it',
		countFirst: "Works once someone sets the song's count"
	},
	setup: {
		kind: 'Round',
		target: 'Listen for',
		part: 'Part of the song',
		wholeSong: 'Whole song',
		ownCounts: 'Your counts',
		start: 'Start'
	},
	kinds: {
		tapAlong: 'Tap along',
		dropped: 'Dropped in'
	},
	kindSub: {
		tapAlong: 'The count is hidden. Tap along all the way.',
		dropped: 'Ten random spots in the song. Find the next one each time.'
	},
	targets: {
		one: 'The 1',
		every: 'Every beat',
		clave: 'The clave',
		own: 'Your own'
	},
	/** After a score: "7 of 10 on the 1". */
	onTarget: {
		one: 'on the 1',
		every: 'on the beat',
		ones: 'on 1 and 5',
		odd: 'on 1 3 5 7',
		fourEight: 'on 4 and 8',
		clave: 'on the clave',
		own: 'on your counts'
	},
	/** The tap area while tapping along. */
	tapOn: {
		one: 'Tap on the 1',
		every: 'Tap every beat',
		ones: 'Tap on 1 and 5',
		odd: 'Tap on 1 3 5 7',
		fourEight: 'Tap on 4 and 8',
		clave: 'Tap the clave',
		own: 'Tap on your counts'
	},
	/** The tap area when dropped in. */
	tapNext: {
		one: 'Tap the next 1',
		every: 'Tap the next beat',
		ones: 'Tap the next 1 or 5',
		odd: 'Tap the next 1, 3, 5 or 7',
		fourEight: 'Tap the next 4 or 8',
		clave: 'Tap the next clave hit',
		own: 'Tap your counts'
	},
	anywhere: 'anywhere here',
	hidden: 'The count is hidden until the end',
	drop: (n: number, of: number) => `Drop ${n} of ${of}`,
	listen: 'Listen, then tap',
	keepTapping: 'Keep tapping for two eights',
	reveal: {
		spot: 'Spot on',
		late: (ms: number) => `Found it · ${ms} ms late`,
		early: (ms: number) => `Found it · ${ms} ms early`,
		other: (count: number) => `That was the ${count}`,
		missed: 'Not on a beat',
		pattern: (hits: number, of: number) => `${hits} of ${of} on the beat`
	},
	result: {
		title: 'How close you were',
		score: (hit: number, of: number) => `${hit} of ${of}`,
		late: (ms: number) => `${ms} ms late on average`,
		early: (ms: number) => `${ms} ms early on average`,
		onTime: 'On time on average',
		listened: (s: number) => `You listened about ${seconds(s)} s before tapping`,
		verdict: {
			on: 'On time',
			late: (ms: number) => `Late, ${ms} ms`,
			early: (ms: number) => `Early, ${ms} ms`,
			other: (count: number) => `On the ${count}`,
			missed: 'Missed'
		},
		wholeSong: 'The song',
		drop: (n: number) => `Drop ${n}`,
		noTap: 'No tap',
		tooShort: 'Too short to judge. Tap a little longer.',
		strip: 'Your taps on the count, one row per eight'
	},
	eightRow: (n: number) => `Eight ${n}`,
	reset: 'Reset',
	skip: 'Skip',
	startOver: {
		noTap: 'No tap in four eights: from the start of the spot again',
		stopped: 'You stopped: from the start of the spot again',
		reset: 'From the start of this spot'
	},
	listening: 'Listen…',
	listenFirst: 'listen first',
	nextSpot: 'next spot coming',
	restartsLine: (n: number) => (n === 1 ? '1 start-over' : `${n} start-overs`),
	firstTry: 'First try',
	/** A target position in a sentence: "the 1", "the and of 6". */
	posName: (whole: number, and: boolean) => (and ? `the and of ${whole}` : `the ${whole}`),
	score: {
		title: (n: number) => `Score ${n}`,
		onBeat: (hit: number, of: number) => `${hit} of ${of} on the beat`,
		findEach: (s: number) => `about ${seconds(s)} s to find each spot`,
		timing: 'Timing',
		restarts: 'Restarts',
		listening: 'Listening',
		stackTitle: 'All your eights, on top of each other',
		stackLabel: 'Every tap of the round, under the beat it was for',
		early: '◂ early',
		late: 'late ▸',
		dropRow: (n: number, section: string) => (section ? `Drop ${n} · ${section}` : `Drop ${n}`),
		counted: (hit: number, of: number) => `${hit} of ${of}`,
		skipped: 'skipped',
		replayDrop: (n: number) => `Replay drop ${n}`,
		verdict: {
			late: (pos: string) => `Late on ${pos}`,
			early: (pos: string) => `Early on ${pos}`,
			offSub: (ms: number) => `About ${ms} ms, nearly every time. The rest is on time.`,
			missed: (pos: string) => `${pos.charAt(0).toUpperCase()}${pos.slice(1)} is missed most`,
			missedSub: (n: number, of: number) => `${n} of ${of} times.`,
			onTime: 'All on time',
			onTimeSub: 'Every beat within 60 ms.'
		}
	},
	replay: {
		title: (n: number) => `Replay · drop ${n}`,
		countOn: 'The count is on',
		yourTap: 'your tap',
		onTime: 'on time',
		close: 'close',
		missed: 'missed',
		now: 'now',
		back: 'Back to the result',
		prev: 'One beat back',
		next: 'One beat on',
		play: 'Play',
		pause: 'Pause',
		slower: 'Slower'
	},
	clave: {
		t23: '2-3 clave: two hits, then three',
		p23: 'On 2 and on 3, then on 5, on the and of 6 (between 6 and 7), and on 8.',
		t32: '3-2 clave: three hits, then two',
		p32: 'On 1, on the and of 2 (between 2 and 3), and on 4, then on 6 and on 7.',
		hear: 'Hear it'
	},
	again: 'Again',
	done: 'Done',
	stop: 'Stop',
	check: {
		title: 'Your tap delay',
		intro:
			'Tap along with the count for a few seconds. Then your taps are measured from when you hear the beat.',
		tapWith: 'Tap with each count',
		progress: (n: number, of: number) => `${n} of ${of} taps`,
		result: (ms: number) => `You tap ${ms} ms after you hear it`,
		uneven: 'Your taps were uneven. Try again.',
		save: 'Use this',
		again: 'Again',
		skip: 'Skip for now',
		start: 'Start',
		row: 'Check my tap delay',
		rowValue: (ms: number | null) => (ms === null ? 'Not checked' : `${ms} ms`)
	}
};
