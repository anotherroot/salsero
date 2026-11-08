/**
 * An exercise's TYPE, and what that fixes. PURE and client-safe.
 *
 * The type is derived from `source` rather than stored: the four sources
 * already are the four types, one to one, and a `kind` column that could only
 * ever repeat `source` would be a second copy of one fact. The day two
 * exercises of one source need different fields, that is a new type — and
 * then, only then, a column.
 *
 * The rule from the guitar app: the type fixes which fields exist; instances
 * differ only in content. Two figure exercises never differ in whether they
 * have a rating.
 */
import { t } from '$lib/i18n/catalog';
import type { Source } from '$lib/labels';

export const EXERCISE_TYPES = ['lesson', 'figure', 'drill', 'routine'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export interface TypeInfo {
	type: ExerciseType;
	label: string;
}

const BY_SOURCE: Record<Source, ExerciseType> = {
	lesson: 'lesson',
	figure: 'figure',
	custom: 'drill',
	// A person's entry for a group's drill: the drill's page, with the drill's
	// content (practice-content.ts reads it through `drill_id`).
	added: 'drill',
	routine: 'routine'
};

/*
 * The words are getters, read from the catalog each time they are asked: a
 * table built at import would keep the language of whoever imported it first.
 */
export const TYPES: Record<ExerciseType, TypeInfo> = {
	lesson: {
		type: 'lesson',
		get label() {
			return t().exercise.types.lesson;
		}
	},
	figure: {
		type: 'figure',
		get label() {
			return t().exercise.types.figure;
		}
	},
	drill: {
		type: 'drill',
		get label() {
			return t().exercise.types.drill;
		}
	},
	routine: {
		type: 'routine',
		get label() {
			return t().exercise.types.routine;
		}
	}
};

export const typeOf = (source: Source): ExerciseType => BY_SOURCE[source];
export const typeInfo = (source: Source): TypeInfo => TYPES[typeOf(source)];
