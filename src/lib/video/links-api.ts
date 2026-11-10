/**
 * The Link popup's side of `/api/video-spots/[id]/links`. Every call answers
 * the section's link options as they are after it, or rejects with
 * `SpotsApiError` carrying the server's message.
 */
import { ok } from './spots-api';
import type { ElsewhereKind, LinkCreate, LinkOptions, LinkTarget } from '$lib/types';

const JSON_HEADERS = { 'content-type': 'application/json' };
const base = (spotId: number) => `/api/video-spots/${spotId}/links`;

export async function fetchLinkOptions(spotId: number): Promise<LinkOptions> {
	return (await ok(await fetch(base(spotId)))).json();
}

async function send(spotId: number, body: unknown): Promise<LinkOptions> {
	const res = await fetch(base(spotId), {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify(body)
	});
	return (await ok(res)).json();
}

export const addLink = (spotId: number, target: LinkTarget) => send(spotId, { target });

export const createLink = (spotId: number, create: LinkCreate) => send(spotId, { create });

/**
 * Unlink. A position link's id is of its own table: `kind` 'position' says so
 * (`unlinkKind`), and without it the id is a variation's or drill's link.
 */
export async function removeLink(
	spotId: number,
	linkId: number,
	alsoLesson: boolean,
	kind?: 'position'
): Promise<LinkOptions> {
	const params = new URLSearchParams();
	if (alsoLesson) params.set('alsoLesson', '1');
	if (kind) params.set('kind', kind);
	const q = params.size > 0 ? `?${params}` : '';
	const res = await fetch(`${base(spotId)}/${linkId}${q}`, { method: 'DELETE' });
	return (await ok(res)).json();
}

/** Copy and link's answer: the section's options after it, or the archived member to restore first. */
export type CopyLinkAnswer = { options: LinkOptions } | { restore: number };

/**
 * Link from other places: copy a row from another place into the video's
 * group and link this section or point to the copy (`restore`: Restore and
 * link the family's archived member instead). Network only.
 */
export async function copyLink(
	spotId: number,
	body: { kind: ElsewhereKind; id: number; use: Record<string, number>; restore: number | null }
): Promise<CopyLinkAnswer> {
	const res = await fetch(`/api/video-spots/${spotId}/copy-link`, {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify(body)
	});
	if (res.status === 409) {
		const said: unknown = await res
			.clone()
			.json()
			.catch(() => null);
		const restore =
			said && typeof said === 'object' ? (said as { restore?: unknown }).restore : null;
		if (typeof restore === 'number') return { restore };
	}
	return { options: await (await ok(res)).json() };
}
