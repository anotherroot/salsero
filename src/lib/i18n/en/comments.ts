// Comments on a class's lessons: the card, the sheet, a comment, the composer,
// and the API's refusals.

export const comments = {
	title: 'Comments',
	/** The card and the sheet with nothing yet. */
	empty: 'Be the first to ask or say something',
	/** The card's pill: "2 new". */
	newCount: (n: number): string => `${n} new`,
	/** Beside a name: the group's owner or an editor. */
	teacher: 'Teacher',
	replies: (n: number): string => (n === 1 ? '1 reply' : `${n} replies`),
	hideReplies: 'Hide replies',
	deleted: 'Comment deleted',
	/** Under the list: "Everyone in Salsa Tuesdays sees it". */
	whoSees: (group: string): string => `Everyone in ${group} sees it`,
	loading: 'Loading comments',
	/** A comment's actions. */
	heart: 'Heart',
	heartCount: (n: number): string => `Heart, ${n}`,
	reply: 'Reply',
	more: 'More about this comment',
	/** The composer. */
	comment: 'Comment',
	placeholder: 'Write a comment…',
	replyingTo: (name: string): string => `Replying to ${name}`,
	newInstead: 'Write a new comment instead',
	send: 'Send',
	stillSending: 'Still sending.',
	tooShort: 'Write something first.',
	tooLong: (max: number): string => `A comment can be at most ${max} characters.`,
	/** The fetch failed, or the server said nothing. */
	failed: 'That did not work. Try again.',
	/** The name line's "2 d". */
	ago: {
		now: 'now',
		minutes: (n: number): string => `${n} min`,
		hours: (n: number): string => `${n} h`,
		days: (n: number): string => `${n} d`,
		weeks: (n: number): string => `${n} w`,
		years: (n: number): string => `${n} y`
	},
	/** A name the server no longer has. */
	someone: 'Someone',
	refused: {
		closed: 'This class has been deleted, so its comments can only be read.',
		notInLesson: 'That comment is not in this lesson.',
		replyDeleted: 'That comment was deleted.',
		noLesson: 'No such lesson',
		noComment: 'No such comment',
		signIn: 'Sign in',
		badJson: 'Bad JSON.'
	}
};
