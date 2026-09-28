/**
 * The "Links" editor's two actions, shared by the lesson, figure and exercise
 * pages. Each page resolves its owner through its own dance-guarded lookup
 * (`figureOf`, `lessonOf`, `requireExerciseInDance`) and hands it in — so a
 * link can only ever be added to, or removed from, the page it was posted on.
 */
import { fail } from '@sveltejs/kit';
import type { Db } from './db';
import { int, optionalText } from './form';
import { addLinks, deleteLink, type LinkOwner } from './links';
import { splitLinkLines } from '$lib/links';

/** A URL longer than this is not a link someone pasted on purpose. */
const MAX_URL = 2000;

export async function addLinkFrom(request: Request, db: Db, owner: LinkOwner) {
	const form = await request.formData();
	const typed = String(form.get('urls') ?? '');
	const title = optionalText(form, 'title', 200);
	const { urls, bad } = splitLinkLines(typed);
	const refuse = (message: string) =>
		fail(400, { action: 'addLink' as const, message, urls: typed });

	// All or nothing: storing the good half of a paste and dropping the rest
	// would leave the user guessing which half made it.
	if (bad.length > 0) return refuse(`Not a web link: ${bad.join(', ')}`);
	if (urls.length === 0) return refuse('Paste a link first.');
	if (urls.some((u) => u.length > MAX_URL)) return refuse('That link is too long.');
	if (title === undefined) return refuse('Keep the title under 200 characters.');

	const added = addLinks(db, owner, urls, title);
	if (added === null) return refuse('Links live on the figure or lesson this exercise belongs to.');
	return { action: 'addLink' as const, ok: true, added: added.length };
}

export async function deleteLinkFrom(request: Request, db: Db, owner: LinkOwner) {
	const id = int(await request.formData(), 'linkId');
	if (id === undefined || !deleteLink(db, owner, id)) {
		return fail(404, { action: 'deleteLink' as const, message: 'That link was already removed.' });
	}
	return { action: 'deleteLink' as const, ok: true };
}
