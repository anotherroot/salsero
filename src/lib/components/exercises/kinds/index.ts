/**
 * Each type's components. The pages ask here and never branch on the type
 * themselves — the guitar app's rule: the shell asks the registry for a
 * component; the type owns its experience.
 */
import type { Component, Snippet } from 'svelte';
import type { Dance } from '$lib/dances/dances';
import type { ExerciseType } from '$lib/exercises/kinds';
import type {
	CountTakeRow,
	ExerciseItem,
	PickerSong,
	PracticeContent,
	SectionGroup
} from '$lib/types';
import LessonContent from './lesson/Content.svelte';
import FigureContent from './figure/Content.svelte';
import DrillContent from './drill/Content.svelte';
import RoutineContent from './routine/Content.svelte';
import FigurePractice from './figure/Practice.svelte';
import DrillPractice from './drill/Practice.svelte';
import RoutinePractice from './routine/Practice.svelte';
import type { LogProps } from '../LogShell.svelte';
import LessonLog from './lesson/Log.svelte';
import FigureLog from './figure/Log.svelte';
import DrillLog from './drill/Log.svelte';
import RoutineLog from './routine/Log.svelte';

export interface ContentProps {
	dance: Dance;
	content: PracticeContent;
	/** For captions (a recording's day). */
	timezone: string;
	/**
	 * Whether the person may mark and edit spots in the videos it plays: off for
	 * a reader of a group's things. Defaults to on.
	 */
	canEdit?: boolean;
	/** The simple look (Follow my class, Practise and keep my own): videos in the simple player, no editing. */
	simple?: boolean;
	/** The popup's look until Task 9 deletes the popup (and this prop). */
	onPage?: boolean;
	/**
	 * The Practise with card, drawn right after the type's description (drill:
	 * Description; figure: the reference notes; routine: its notes). A lesson has none.
	 */
	practice?: Snippet;
	/**
	 * A drill's Recordings' + Add, or null when the person may not add (a reader,
	 * the simple page). Only the drill's content honours it: the other types'
	 * links and sections are edited on their owner's page.
	 */
	recordings?: {
		/** "Add to <drill>". */
		label: string;
		linkable: SectionGroup[];
		/** The last `addLink` refusal, if any. */
		message: string | null;
		/** What was typed, handed back by that refusal. */
		entered: string;
	} | null;
}

const CONTENT: Record<ExerciseType, Component<ContentProps>> = {
	lesson: LessonContent,
	figure: FigureContent,
	drill: DrillContent,
	routine: RoutineContent
};

export const contentFor = (type: ExerciseType) => CONTENT[type];

export interface PracticeProps {
	dance: Dance;
	exercise: ExerciseItem;
	content: PracticeContent;
	songs: PickerSong[];
	takes: CountTakeRow[];
	/** The player link's `from` part: 'from=exercise' (plan 3 passes the run's). */
	playerFrom: string;
	onrun: (r: { durationS: number; playerJson: string }) => void;
	onactive: (playing: boolean) => void;
}

const PRACTICE: Record<ExerciseType, Component<PracticeProps> | null> = {
	lesson: null,
	figure: FigurePractice,
	drill: DrillPractice,
	routine: RoutinePractice
};

/** The type's Practise with card; a lesson has none. */
export const practiceFor = (type: ExerciseType) => PRACTICE[type];

const LOG: Record<ExerciseType, Component<LogProps>> = {
	lesson: LessonLog,
	figure: FigureLog,
	drill: DrillLog,
	routine: RoutineLog
};

export const logFor = (type: ExerciseType) => LOG[type];
export type { LogProps };
