/*
 * What a replayed request's answer means for its outbox entry (offline phase
 * 3): landed, or refused with a reason the Sync page can say, and what a
 * clash or a gone row carries for the clash screen.
 */
import * as devalue from 'devalue';
import type { ClashInfo, GoneInfo } from '$lib/clash/clash';
import type { RefusalReason } from '$lib/sync/outbox';

export type Outcome =
	| { landed: true }
	| {
			landed: false;
			reason: RefusalReason;
			message: string | null;
			clash: ClashInfo | null;
			gone: GoneInfo | null;
	  };

const refused = (
	reason: RefusalReason,
	message: string | null = null,
	clash: ClashInfo | null = null,
	gone: GoneInfo | null = null
): Outcome => ({ landed: false, reason, message, clash, gone });

const textOf = (v: unknown): string | null => (typeof v === 'string' ? v : null);

async function bodyJson(res: Response): Promise<Record<string, unknown> | null> {
	try {
		const v = (await res.json()) as unknown;
		return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function byStatus(status: number, message: string | null): Outcome {
	if (status === 404 || status === 410) return refused('gone', message);
	if (status === 401 || status === 403) return refused('access', message);
	if (status >= 500) return refused('error', message);
	return refused('refused', message);
}

/** A failure's data, as SvelteKit sends it (devalue), or as an endpoint's JSON. */
function fromData(status: number, data: Record<string, unknown> | null): Outcome {
	const message = textOf(data?.message);
	if (data?.clash) return refused('clash', message, data.clash as ClashInfo);
	if (data?.gone || status === 404 || status === 410) {
		return refused('gone', message, null, (data?.gone as GoneInfo | undefined) ?? null);
	}
	if (data?.stale) return refused('stale', message);
	return byStatus(status, message);
}

export async function outcomeOf(res: Response, isAction: boolean): Promise<Outcome> {
	if (isAction) {
		const body = await bodyJson(res);
		const type = body?.type;
		if (type === 'success' || type === 'redirect') return { landed: true };
		if (type === 'failure') {
			let data: Record<string, unknown> | null = null;
			try {
				data = typeof body!.data === 'string' ? (devalue.parse(body!.data) as typeof data) : null;
			} catch {
				data = null;
			}
			return fromData(Number(body!.status ?? res.status), data);
		}
		if (type === 'error') {
			const error = body!.error as { message?: unknown } | undefined;
			return byStatus(res.status >= 400 ? res.status : 500, textOf(error?.message));
		}
		// Not an action's answer at all (an HTML page, a stray redirect).
		return res.ok || (res.status >= 300 && res.status < 400)
			? { landed: true }
			: byStatus(res.status, null);
	}
	if (res.status < 400) return { landed: true };
	return fromData(res.status, await bodyJson(res));
}
