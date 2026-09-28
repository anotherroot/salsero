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
import type { Source } from '$lib/labels';

export const EXERCISE_TYPES = ['lesson', 'figure', 'drill', 'routine'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export type LogField = 'minutes' | 'reps' | 'rating' | 'note';

export interface TypeInfo {
	type: ExerciseType;
	label: string;
	/** The fields the log form shows AND the log action stores. Anything else posted is dropped. */
	fields: readonly LogField[];
	ratingQuestion: string;
}

const BY_SOURCE: Record<Source, ExerciseType> = {
	lesson: 'lesson',
	figure: 'figure',
	custom: 'drill',
	routine: 'routine'
};

export const TYPES: Record<ExerciseType, TypeInfo> = {
	lesson: {
		type: 'lesson',
		label: 'Lesson review',
		fields: ['minutes', 'rating', 'note'],
		ratingQuestion: 'How well do you remember it?'
	},
	figure: {
		type: 'figure',
		label: 'Figure practice',
		fields: ['minutes', 'rating', 'note'],
		ratingQuestion: 'How did it go?'
	},
	// Reps stay here because a drill is where they mean something: clave
	// clapping, a hundred basics. A figure is danced, not counted.
	drill: {
		type: 'drill',
		label: 'Drill',
		fields: ['minutes', 'reps', 'rating', 'note'],
		ratingQuestion: 'How did it go?'
	},
	routine: {
		type: 'routine',
		label: 'Routine',
		fields: ['minutes', 'rating', 'note'],
		ratingQuestion: 'How did it go?'
	}
};

export const typeOf = (source: Source): ExerciseType => BY_SOURCE[source];
export const typeInfo = (source: Source): TypeInfo => TYPES[typeOf(source)];
export const hasField = (source: Source, field: LogField): boolean =>
	typeInfo(source).fields.includes(field);
