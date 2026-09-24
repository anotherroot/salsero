import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createFigure, listFigures } from '$lib/server/figures';
import { checkbox, int, oneOf, optionalText, text } from '$lib/server/form';
import { DEFAULT_EVERY_DAYS, isFrequency } from '$lib/frequency';
import { PARTNER, type Partner } from '$lib/labels';
import { DANCES, type DanceSlug } from '$lib/dances/dances';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, params }) => {
	const dance = params.dance as DanceSlug;
	const q = url.searchParams.get('q')?.trim() ?? '';
	const style = url.searchParams.get('style');
	const partner = url.searchParams.get('partner');
	const filter = {
		q: q || undefined,
		style: (DANCES[dance].styles as readonly string[]).includes(style ?? '')
			? (style as string)
			: undefined,
		partner: (PARTNER as readonly string[]).includes(partner ?? '')
			? (partner as Partner)
			: undefined
	};
	return { figures: listFigures(getDb(), dance, filter), filter: { ...filter, q } };
};

export const actions: Actions = {
	create: async ({ params, request }) => {
		const dance = params.dance as DanceSlug;
		const form = await request.formData();
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');
		const callable = checkbox(form, 'callable');
		const callText = optionalText(form, 'callText', 200);
		const everyDays = int(form, 'everyDays') ?? DEFAULT_EVERY_DAYS;
		if (
			!name ||
			!partner ||
			!style ||
			notes === undefined ||
			callText === undefined ||
			!isFrequency(everyDays)
		) {
			return fail(400, {
				message: 'Give the figure a name (up to 200 characters).',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}
		const made = createFigure(
			getDb(),
			dance,
			{ name, partner, style, notes, callable, callText },
			everyDays
		);
		if (!made) {
			return fail(400, {
				message: 'That style does not belong to this dance.',
				name,
				notes: notes ?? ''
			});
		}
		throw redirect(303, `/${dance}/figures/${made.figure.id}`);
	}
};
