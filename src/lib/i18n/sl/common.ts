import type { Catalog } from '../catalog';

export const common: Catalog['common'] = {
	save: 'Shrani',
	cancel: 'Prekliči',
	close: 'Zapri',
	back: 'Nazaj',
	delete: 'Izbriši',
	undo: 'Razveljavi',
	done: 'Končano',
	edit: 'Uredi',
	add: 'Dodaj',
	remove: 'Odstrani',
	yes: 'Da',
	no: 'Ne',
	retry: 'Poskusi znova',
	loading: 'Nalaganje …',
	more: '⋯',
	search: 'Iskanje',
	/** `x` with `digits` decimals: a comma. */
	decimal: (x: number, digits: number): string => x.toFixed(digits).replace('.', ',')
};
