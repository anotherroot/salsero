/**
 * The fetch side of the comments sheet. Each call resolves to its data or to
 * `{ message }`, the words of a refusal; none throws.
 */
import { t } from '$lib/i18n/catalog';
import type { CommentList, CommentRow } from '$lib/types';

export type Refused = { message: string };
/** The words when the fetch failed or the server said nothing, at call time. */
const failed = () => t().comments.failed;

async function call<T>(url: string, init?: RequestInit): Promise<T | Refused> {
	try {
		const res = await fetch(url, init);
		const body: unknown = await res.json().catch(() => null);
		if (res.ok) return body as T;
		const said = body && typeof body === 'object' ? (body as { message?: unknown }).message : null;
		return { message: typeof said === 'string' && said ? said : failed() };
	} catch {
		return { message: failed() };
	}
}

export const isRefused = (r: unknown): r is Refused =>
	!!r && typeof r === 'object' && 'message' in r;

export const loadComments = (lessonId: number) =>
	call<CommentList>(`/api/lessons/${lessonId}/comments`);

export const sendComment = (lessonId: number, body: string, replyTo: number | null) =>
	call<CommentRow>(`/api/lessons/${lessonId}/comments`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ body, replyTo })
	});

export const heartComment = (id: number) =>
	call<{ hearted: boolean; count: number }>(`/api/comments/${id}/heart`, { method: 'POST' });

export const deleteComment = (id: number) =>
	call<{ ok: true }>(`/api/comments/${id}`, { method: 'DELETE' });

export const restoreComment = (id: number) =>
	call<{ ok: true }>(`/api/comments/${id}/restore`, { method: 'POST' });
