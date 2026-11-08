import { describe, expect, it } from 'vitest';
import { fold } from '$lib/fold';
import { DANCE_SLUGS, DANCES } from '$lib/dances/dances';
import { withLocale } from '$lib/i18n/current';
import { TEMPLATES, firstTemplateType, templateDescription, templateTypes } from './templates';

describe('templates', () => {
	it('knows the types of each dance', () => {
		expect(templateTypes('salsa')).toEqual(['salsa', 'son', 'timba']);
		expect(templateTypes('bachata')).toEqual(['dominican', 'sensual', 'traditional']);
	});
	it('opens on the person’s “New figures” type when it has templates, else the first', () => {
		expect(firstTemplateType('salsa', 'son')).toBe('son');
		expect(firstTemplateType('salsa', 'timba')).toBe('timba');
		expect(firstTemplateType('salsa', 'other')).toBe('salsa');
		expect(firstTemplateType('bachata', 'sensual')).toBe('sensual');
		expect(firstTemplateType('bachata', 'salsa')).toBe('dominican');
	});
	it('has the salsa board set verbatim', () => {
		expect(TEMPLATES.salsa.salsa.map((t) => [t.name, t.description])).toEqual([
			['Abierta (dos manos)', 'Open, both hands'],
			['Abierta (una mano)', 'Open, his left in her right'],
			['Cerrada', 'Closed, the basic frame'],
			['Hammerlock', 'Her right arm folded behind her back'],
			['Cuddle', 'Side by side, her wrapped in his arms'],
			['Sombra', 'Shadow: he is behind her, same direction']
		]);
	});
	it('has the son board set verbatim', () => {
		expect(TEMPLATES.salsa.son.map((t) => [t.name, t.description])).toEqual([
			['Cerrada de son', 'Closed and low, close together'],
			['Abierta', 'Open, one hand, loose'],
			['Manos cruzadas', 'Both hands crossed, right on top'],
			['Paseo', 'Side by side, walking']
		]);
	});
	it('has timba drafts', () => {
		expect(TEMPLATES.salsa.timba.map((t) => t.name)).toEqual([
			'Pegao',
			'Caída',
			'Sombra de timba',
			'Abierta de timba'
		]);
	});
	it('has unique names per type and at least three per type, all styles of the dance', () => {
		for (const dance of DANCE_SLUGS) {
			for (const type of templateTypes(dance)) {
				expect(DANCES[dance].styles).toContain(type);
				const list = TEMPLATES[dance][type];
				expect(list.length).toBeGreaterThanOrEqual(3);
				const names = list.map((t) => fold(t.name));
				expect(new Set(names).size).toBe(names.length);
			}
		}
	});
});

describe('templates in Slovenian', () => {
	it('keeps the names, and reads the descriptions in the reader’s language', () => {
		const cerrada = TEMPLATES.salsa.salsa.find((t) => t.name === 'Cerrada')!;
		expect(withLocale('sl', () => cerrada.description)).toBe('Zaprta, osnovna drža');
		expect(cerrada.description).toBe('Closed, the basic frame');
		expect(withLocale('sl', () => templateDescription('bachata', 'sensual', 'Closed'))).toBe(
			'Zaprta, s stikom teles'
		);
		expect(withLocale('sl', () => TEMPLATES.salsa.son.map((t) => t.name))).toEqual([
			'Cerrada de son',
			'Abierta',
			'Manos cruzadas',
			'Paseo'
		]);
	});
	it('has a description for every template in both languages', () => {
		for (const l of ['en', 'sl'] as const)
			for (const dance of DANCE_SLUGS)
				for (const type of templateTypes(dance))
					for (const tpl of TEMPLATES[dance][type])
						expect(
							withLocale(l, () => tpl.description),
							`${l} ${dance} ${tpl.name}`
						).not.toBe('');
	});
});
