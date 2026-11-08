import { stringify } from 'devalue';

/** The message of a read the device could not answer: the error page draws it as offline. */
export const NEEDS_CONNECTION = 'needs-connection';

export type OfflineAnswer = { status: 503; headers: [string, string][]; body: string };

const JSON_HEADERS: [string, string][] = [['content-type', 'application/json']];

/**
 * What the service worker answers a write that cannot reach the server.
 * A form action gets a `failure` SvelteKit's client reads; anything else a
 * plain JSON message.
 */
export function offlineWrite(isAction: boolean, message: string): OfflineAnswer {
	const body = isAction
		? JSON.stringify({
				type: 'failure',
				status: 503,
				data: stringify({ message, offline: true })
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
