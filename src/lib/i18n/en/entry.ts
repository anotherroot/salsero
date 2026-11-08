// The way in: sign in, Join, the name, the first run, the levels, a class code
// and My class's lines.
import { plural } from './plural';

export const entry = {
	email: 'Email',
	password: 'Password',
	/** Sign in's and Join's refusal of an empty field. */
	required: 'Email and password are required.',
	tooMany: 'Too many attempts. Wait 15 minutes and try again.',
	login: {
		title: 'Sign in',
		subtitle: 'Welcome back. Sign in to practise.',
		note: 'Got an invite? Open its link, or scan its code with your camera.',
		signIn: 'Sign in',
		signingIn: 'Signing in…',
		wrong: 'Incorrect email or password.'
	},
	join: {
		title: 'Join',
		invited: 'You were invited',
		passwordRule: 'At least 12 characters, mixing three of lower, upper, digit and symbol.',
		/** The unsaved-changes label of the form. */
		form: 'Your account',
		create: 'Create account',
		creating: 'Creating…',
		dead: 'This invite no longer works. Ask for a new one.',
		badEmail: 'Enter a valid email address.',
		taken: 'That email already has an account.',
		/** A weak password, by why (`weakReason` in server/admin.ts). */
		weak: {
			short: 'Password must be at least 12 characters.',
			common: 'Password is a well-known password.',
			repeated: 'Password is a single repeated character.',
			mix: 'Password must mix at least three of: lower, upper, digit, symbol.'
		}
	},
	name: {
		first: 'First name',
		last: 'Last name',
		firstRefusal: 'Enter your first name (up to 60 letters).',
		lastRefusal: 'Enter your last name (up to 60 letters).'
	},
	welcome: {
		title: 'Welcome',
		subtitle: 'What should we call you?',
		note: 'Friends in a group see this instead of your email.',
		form: 'Your name',
		continue: 'Continue',
		saving: 'Saving…'
	},
	firstRun: {
		slides: [
			{
				title: 'Practise what you learned in class',
				body: 'Your teacher puts each class here. You watch it again and practise at home, a few minutes at a time.'
			},
			{
				title: 'A few things a day',
				body: 'Today shows just a handful. When they are done, you are done.'
			},
			{
				title: 'You say when it comes back',
				body: 'After practising, tap how it went. The app remembers for you.'
			}
		],
		skip: 'Skip',
		next: 'Next',
		level: {
			title: 'How much app?',
			note: 'You can change this any time in Settings',
			refusal: 'Pick how much app you want.'
		},
		join: {
			title: 'Join your class',
			subtitle: 'Your teacher has the code',
			label: 'Class code',
			or: 'Or open the link your teacher sent, or scan the code on the studio wall.',
			notNow: 'Not now',
			join: 'Join',
			joining: 'Joining…'
		},
		code: {
			empty: 'Enter the class code.',
			unknown: 'No class has this code. Check it and try again.',
			refused: 'This class was deleted, so it cannot be joined.'
		}
	},
	/** The "How much app?" cards. Everything has no small line. */
	levels: {
		follow: {
			title: 'Follow my class',
			body: 'What my class is working on, a few things a day. Nothing to set up.',
			small: 'New class lessons come to Today by themselves.'
		},
		own: {
			title: 'Practise and keep my own',
			body: 'Also keep my own videos, like workshops or my performances, and my own songs.',
			small: 'Videos still just play.'
		},
		all: {
			title: 'Everything',
			body: 'My own figures, positions and routines. Mark and edit sections in videos.'
		}
	},
	classes: {
		joinTitle: (name: string): string => `Join ${name}`,
		joinQuestion: (name: string): string => `Join ${name}?`,
		people: (n: number): string => plural(n, 'person', 'people'),
		/** `admin` is the dance's admin's first name, null when they have none. */
		noAccount: (admin: string | null): string =>
			`This code only adds people who already have an account. Ask ${admin ?? 'the admin'} for an invite.`,
		stale: 'This code no longer works',
		signIn: 'Sign in',
		lastClass: (day: string): string => `Last class ${day}`,
		noClasses: 'No classes yet',
		videos: (n: number): string => plural(n, 'video', 'videos'),
		toPractise: (n: number): string => `${n} to practise`,
		songs: 'Class songs',
		songsCount: (n: number): string => `Class songs · ${n}`,
		classes: 'Your classes',
		latest: 'Latest class',
		earlier: 'Earlier classes',
		menu: 'Class menu',
		pick: { title: 'Pick a class', body: 'Its classes and songs open here.' },
		somethingNew: ', something new',
		isNew: 'New',
		add: 'Add',
		addLesson: (title: string): string => `Add ${title}`
	}
};
