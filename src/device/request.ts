/**
 * A `Request` whose headers are the copy's own: its cookies and user agent,
 * never a session. `Request` forbids setting `cookie`, so the headers come in
 * beside the constructor and the getter returns them. The content type also
 * goes to the base `Request` (offline phase 3), so `formData()` can parse a
 * write's body, a multipart one included.
 */
export class DeviceRequest extends Request {
	readonly #headers: Headers;

	constructor(url: string | URL, init: RequestInit, headers: Headers) {
		const type = headers.get('content-type');
		super(url, { ...init, headers: type ? { 'content-type': type } : undefined });
		this.#headers = headers;
	}

	override get headers(): Headers {
		return this.#headers;
	}
}
