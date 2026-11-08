/** The templates a person can add positions from, per dance and style. PURE, client-safe. */
import type { DanceSlug } from '$lib/dances/dances';
import { t } from '$lib/i18n/catalog';
import type { Hold } from '$lib/types';

export interface Template {
	/** A dance term, the same in every language: `addTemplates` matches by it. */
	name: string;
	/** Becomes the new position's notes: the catalog's, in the language it is read in. */
	readonly description: string;
	hold: Hold;
}

const h = (
	hands: Hold['hands'],
	crossed: boolean | null,
	facing: Hold['facing'],
	frame: Hold['frame']
): Hold => ({ hands, crossed, facing, frame });

/** A template's description in the current language (`positions.templates.descriptions`). */
export function templateDescription(dance: DanceSlug, type: string, name: string): string {
	return t().positions.templates.descriptions[dance]?.[type]?.[name] ?? '';
}

const TABLE: Record<DanceSlug, Record<string, [name: string, hold: Hold][]>> = {
	salsa: {
		salsa: [
			['Abierta (dos manos)', h('two', null, 'face', 'open')],
			['Abierta (una mano)', h('one', null, 'face', 'open')],
			['Cerrada', h('two', null, 'face', 'closed')],
			['Hammerlock', h('one', null, 'face', 'open')],
			['Cuddle', h('two', null, 'side', 'closed')],
			['Sombra', h('none', null, 'shadow', 'closed')]
		],
		son: [
			['Cerrada de son', h('two', null, 'face', 'closed')],
			['Abierta', h('one', null, 'face', 'open')],
			['Manos cruzadas', h('two', true, 'face', 'open')],
			['Paseo', h('one', null, 'side', 'open')]
		],
		// draft: the user reviews
		timba: [
			['Pegao', h('two', null, 'face', 'closed')],
			['Caída', h('one', null, 'face', 'open')],
			['Sombra de timba', h('none', null, 'shadow', 'closed')],
			['Abierta de timba', h('one', null, 'face', 'open')]
		]
	},
	// draft: the user reviews
	bachata: {
		dominican: [
			['Closed', h('two', null, 'face', 'closed')],
			['Open, two hands', h('two', null, 'face', 'open')],
			['Side by side', h('one', null, 'side', 'closed')]
		],
		sensual: [
			['Closed', h('two', null, 'face', 'closed')],
			['Open, one hand', h('one', null, 'face', 'open')],
			['Cross-hand', h('two', true, 'face', 'open')],
			['Hammerlock', h('one', null, 'face', 'open')]
		],
		traditional: [
			['Closed', h('two', null, 'face', 'closed')],
			['Open, two hands', h('two', null, 'face', 'open')],
			['Shadow', h('none', null, 'shadow', 'closed')]
		]
	}
};

/** Each template's description is read when it is shown or written, never at import. */
export const TEMPLATES: Record<DanceSlug, Record<string, Template[]>> = Object.fromEntries(
	Object.entries(TABLE).map(([dance, types]) => [
		dance,
		Object.fromEntries(
			Object.entries(types).map(([type, rows]) => [
				type,
				rows.map(([name, hold]): Template => ({
					name,
					hold,
					get description() {
						return templateDescription(dance as DanceSlug, type, name);
					}
				}))
			])
		)
	])
) as Record<DanceSlug, Record<string, Template[]>>;

/** The types (styles) a dance has templates for, in display order. */
export function templateTypes(dance: DanceSlug): string[] {
	return Object.keys(TEMPLATES[dance]);
}

/** The type Templates opens on: the person's "New figures" type when it has templates, else the first. */
export function firstTemplateType(dance: DanceSlug, defaultStyle: string | null): string | null {
	const types = templateTypes(dance);
	return defaultStyle !== null && types.includes(defaultStyle) ? defaultStyle : (types[0] ?? null);
}
