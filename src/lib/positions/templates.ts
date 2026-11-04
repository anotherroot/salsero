/** The templates a person can add positions from, per dance and style. PURE, client-safe. */
import type { DanceSlug } from '$lib/dances/dances';
import type { Hold } from '$lib/types';

export interface Template {
	name: string;
	/** Becomes the new position's notes. */
	description: string;
	hold: Hold;
}

const h = (
	hands: Hold['hands'],
	crossed: boolean | null,
	facing: Hold['facing'],
	frame: Hold['frame']
): Hold => ({ hands, crossed, facing, frame });

export const TEMPLATES: Record<DanceSlug, Record<string, Template[]>> = {
	salsa: {
		salsa: [
			{
				name: 'Abierta (dos manos)',
				description: 'Open, both hands',
				hold: h('two', null, 'face', 'open')
			},
			{
				name: 'Abierta (una mano)',
				description: 'Open, his left in her right',
				hold: h('one', null, 'face', 'open')
			},
			{
				name: 'Cerrada',
				description: 'Closed, the basic frame',
				hold: h('two', null, 'face', 'closed')
			},
			{
				name: 'Hammerlock',
				description: 'Her right arm folded behind her back',
				hold: h('one', null, 'face', 'open')
			},
			{
				name: 'Cuddle',
				description: 'Side by side, her wrapped in his arms',
				hold: h('two', null, 'side', 'closed')
			},
			{
				name: 'Sombra',
				description: 'Shadow: he is behind her, same direction',
				hold: h('none', null, 'shadow', 'closed')
			}
		],
		son: [
			{
				name: 'Cerrada de son',
				description: 'Closed and low, close together',
				hold: h('two', null, 'face', 'closed')
			},
			{
				name: 'Abierta',
				description: 'Open, one hand, loose',
				hold: h('one', null, 'face', 'open')
			},
			{
				name: 'Manos cruzadas',
				description: 'Both hands crossed, right on top',
				hold: h('two', true, 'face', 'open')
			},
			{
				name: 'Paseo',
				description: 'Side by side, walking',
				hold: h('one', null, 'side', 'open')
			}
		],
		// draft: the user reviews
		timba: [
			{ name: 'Pegao', description: 'Closed, hip to hip', hold: h('two', null, 'face', 'closed') },
			{
				name: 'Caída',
				description: 'One hand, her weight dropped back',
				hold: h('one', null, 'face', 'open')
			},
			{
				name: 'Sombra de timba',
				description: 'Shadow, close, hips moving',
				hold: h('none', null, 'shadow', 'closed')
			},
			{
				name: 'Abierta de timba',
				description: 'Open, one hand, low',
				hold: h('one', null, 'face', 'open')
			}
		]
	},
	// draft: the user reviews
	bachata: {
		dominican: [
			{
				name: 'Closed',
				description: 'Closed, close together',
				hold: h('two', null, 'face', 'closed')
			},
			{
				name: 'Open, two hands',
				description: 'Open, both hands',
				hold: h('two', null, 'face', 'open')
			},
			{
				name: 'Side by side',
				description: 'Side by side, close',
				hold: h('one', null, 'side', 'closed')
			}
		],
		sensual: [
			{
				name: 'Closed',
				description: 'Closed, body contact',
				hold: h('two', null, 'face', 'closed')
			},
			{
				name: 'Open, one hand',
				description: 'Open, one hand',
				hold: h('one', null, 'face', 'open')
			},
			{
				name: 'Cross-hand',
				description: 'Both hands crossed, right on top',
				hold: h('two', true, 'face', 'open')
			},
			{
				name: 'Hammerlock',
				description: 'Her arm folded behind her back',
				hold: h('one', null, 'face', 'open')
			}
		],
		traditional: [
			{
				name: 'Closed',
				description: 'Closed, the basic frame',
				hold: h('two', null, 'face', 'closed')
			},
			{
				name: 'Open, two hands',
				description: 'Open, both hands',
				hold: h('two', null, 'face', 'open')
			},
			{
				name: 'Shadow',
				description: 'He is behind her, same direction',
				hold: h('none', null, 'shadow', 'closed')
			}
		]
	}
};

/** The types (styles) a dance has templates for, in display order. */
export function templateTypes(dance: DanceSlug): string[] {
	return Object.keys(TEMPLATES[dance]);
}

/** The type Templates opens on: the person's "New figures" type when it has templates, else the first. */
export function firstTemplateType(dance: DanceSlug, defaultStyle: string | null): string | null {
	const types = templateTypes(dance);
	return defaultStyle !== null && types.includes(defaultStyle) ? defaultStyle : (types[0] ?? null);
}
