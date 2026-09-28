/**
 * Each type's components. The pages ask here and never branch on the type
 * themselves — the guitar app's rule: the shell asks the registry for a
 * component; the type owns its experience.
 */
import type { Component } from 'svelte';
import type { Dance } from '$lib/dances/dances';
import type { ExerciseType } from '$lib/exercises/kinds';
import type { PracticeContent } from '$lib/types';
import LessonContent from './lesson/Content.svelte';
import FigureContent from './figure/Content.svelte';
import DrillContent from './drill/Content.svelte';
import RoutineContent from './routine/Content.svelte';

export interface ContentProps {
	dance: Dance;
	content: PracticeContent;
	/** Offer the links editor — only the drill's content, whose links are its own, honours it. */
	editLinks?: { message: string | null; entered: string };
}

const CONTENT: Record<ExerciseType, Component<ContentProps>> = {
	lesson: LessonContent,
	figure: FigureContent,
	drill: DrillContent,
	routine: RoutineContent
};

export const contentFor = (type: ExerciseType) => CONTENT[type];
