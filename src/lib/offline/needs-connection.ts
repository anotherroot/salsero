import { stringify } from 'devalue';

/** The message of a read the device could not answer: the error page draws it as offline. */
export const NEEDS_CONNECTION = 'needs-connection';

export type OfflineAnswer = { status: 503; headers: [string, string][]; body: string };

const JSON_HEADERS: [string, string][] = [['content-type', 'application/json']];

/**
 * What the service worker answers a write that cannot reach the server.
 * A form action gets a `failure` SvelteKit's client reads, `{ offline: true }`
 * and no message: the root layout says it, in the person's language (the
 * service worker has none), so a form's `form.message` shows nothing and a
 * refusal toast asks `offlineRefusal` (`$lib/act-toast`). Anything else gets
 * a plain JSON `message`.
 */
export function offlineWrite(isAction: boolean, message: string): OfflineAnswer {
	const body = isAction
		? JSON.stringify({
				type: 'failure',
				status: 503,
				data: stringify({ offline: true })
			})
		: JSON.stringify({ message });
	return { status: 503, headers: JSON_HEADERS.map((h) => [...h] as [string, string]), body };
}

/** What a read the device cannot answer gets: the error page reads it as offline. */
export function offlineRead(): OfflineAnswer {
	return {
		status: 503,
		headers: JSON_HEADERS.map((h) => [...h] as [string, string]),
		body: JSON.stringify({ message: NEEDS_CONNECTION })
	};
}
