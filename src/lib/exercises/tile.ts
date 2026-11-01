/** The icon tile and label an exercise row wears. PURE, client-safe. */
import type { IconName } from '$lib/icons/icons';
import type { Partner, Source } from '$lib/labels';

export function exerciseTile(e: { source: Source; partner: Partner | null }): {
	icon: IconName;
	label: string;
} {
	switch (e.source) {
		case 'figure':
			return e.partner === 'solo'
				? { icon: 'solo', label: 'Figure, solo' }
				: { icon: 'people', label: 'Figure, partner' };
		case 'routine':
			return { icon: 'route', label: 'Routine' };
		case 'lesson':
			return { icon: 'lessons', label: 'Lesson review' };
		default:
			return { icon: 'metronome', label: 'Drill' };
	}
}
