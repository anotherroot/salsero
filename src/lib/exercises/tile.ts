/** The icon tile and label an exercise row wears. PURE, client-safe. */
import { t } from '$lib/i18n/catalog';
import type { IconName } from '$lib/icons/icons';
import type { Partner, Source } from '$lib/labels';
import { typeOf } from './kinds';

export function exerciseTile(e: {
	source: Source;
	partner: Partner | null;
	kind?: string | null;
}): {
	icon: IconName;
	label: string;
} {
	const w = t().today.tile;
	if (typeOf(e) === 'hearing') return { icon: 'ear', label: w.hearing };
	switch (e.source) {
		case 'figure':
			return e.partner === 'solo'
				? { icon: 'solo', label: w.figureSolo }
				: { icon: 'people', label: w.figurePartner };
		case 'routine':
			return { icon: 'route', label: w.routine };
		case 'lesson':
			return { icon: 'lessons', label: w.lesson };
		default:
			return { icon: 'metronome', label: w.drill };
	}
}
