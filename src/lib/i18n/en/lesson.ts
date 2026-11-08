// A lesson as a class sees it: the simple lesson page and the Lessons list.
// The full lesson page (the editor, sections, links to figures) is part 2's.
import { plural } from './plural';

const word = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const lesson = {
	/** The simple page's line over the title: "Class · Tue 3 Nov". */
	bandLine: (day: string): string => `Class · ${day}`,
	/** When an entry is next on Today: "On Today today", "On Today tomorrow". */
	onToday: (day: string): string => `On Today ${day}`,
	/** `when` from `whenWords`: "On Today on Sunday", "On Today on 19 Nov". */
	onTodayOn: (when: string): string => `On Today on ${when}`,
	onTodayNextWeek: 'On Today next week',
	paused: 'Paused',
	/** The lesson's own entry in "What you're practising". */
	goOver: 'Go over this lesson',
	/** The banner while its group is being deleted: "Salsa Tuesdays is being deleted on 2 Dec". */
	deleting: (name: string, day: string): string => `${name} is being deleted on ${day}`,
	page: {
		notes: 'Notes',
		videos: 'Videos',
		links: 'Links',
		practising: "What you're practising",
		noVideos: 'No videos yet.',
		addVideos: 'Add videos',
		/** A video's caption and its place: "Video 2". */
		video: (n: number): string => `Video ${n}`,
		deleteVideo: (n: number): string => `Delete video ${n}`,
		missingTitle: 'This file is missing',
		missingBody: 'The server has no file for this video.',
		unplayableTitle: 'Can’t play here',
		unplayableBody: 'This browser can’t play this file. Download it or open it on your phone.',
		download: 'Download',
		cantDelete: 'Can’t delete this video',
		/** The band under the title of a class not added yet. */
		notInPractice: 'Not in your practice yet',
		adding: 'Adding…',
		added: 'Added to Today',
		couldNotAdd: 'Could not add.',
		couldNotUndo: 'Could not undo.',
		notNow: 'Not now',
		menu: 'Lesson menu',
		edit: 'Edit lesson'
	},
	list: {
		empty: 'No lessons yet',
		emptyGroup:
			'Add one after your next class — the videos and the notes. Members see it once you publish it.',
		emptyOwn:
			'Add one after your next class — the videos, the notes, and something on Today to make you go back over it.',
		newLesson: 'New lesson',
		drafts: 'Drafts',
		draft: 'Draft',
		/** The badge on a lesson the person has not opened. */
		isNew: 'New',
		videos: (n: number): string => plural(n, 'video', 'videos'),
		/** The three counts' words, the number drawn apart: "sections". */
		sections: (n: number): string => word(n, 'section', 'sections'),
		routines: (n: number): string => word(n, 'routine', 'routines'),
		figures: (n: number): string => word(n, 'figure', 'figures'),
		onDisk: (size: string): string => `Videos on disk: ${size}`,
		groupVideos: (used: string, limit: string): string => `Group videos: ${used} of ${limit}`,
		pick: {
			title: 'Pick a lesson',
			body: 'Its notes, videos and what it teaches open here, beside the list.'
		}
	}
};
