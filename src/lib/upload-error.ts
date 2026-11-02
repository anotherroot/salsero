/**
 * The message in an error response body: the JSON `message` the routes send
 * (SvelteKit's error shape is the same), or a plain-text body. HTML (an edge
 * proxy's page) and an empty body give ''.
 */
export function messageFromBody(body: string): string {
	const text = body.trim();
	if (!text) return '';
	try {
		const parsed: unknown = JSON.parse(text);
		if (parsed && typeof parsed === 'object' && 'message' in parsed) {
			const m = (parsed as { message: unknown }).message;
			return typeof m === 'string' ? m : '';
		}
		return typeof parsed === 'string' ? parsed : '';
	} catch {
		return text.startsWith('<') ? '' : text;
	}
}

/** What a failed upload says: the server's message, else `fallback`. */
export function uploadFailure(body: string, fallback: string): string {
	return messageFromBody(body) || fallback;
}
